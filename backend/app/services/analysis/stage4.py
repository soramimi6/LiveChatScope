import re
import sqlite3
from collections import Counter, defaultdict

from janome.tokenizer import Tokenizer

from app.services.analysis.global_token_detection import (
    build_detection_snapshot,
    detect_global_tokens,
)
from app.services.analysis.message_filter import (
    effective_auto_ng_keywords,
    is_stamp_code_token,
    load_video_display_filter,
    save_auto_ng_keywords,
    should_include_for_keyword_analysis,
    strip_stamp_codes,
)
from app.services.analysis.params import save_analysis_params_snapshot
from app.services.analysis.utils import NOUN_EXCLUDE_SUBTYPES, is_stopword_token, load_stopwords


def _normalize_text(text: str, *, exclude_stamp_codes: bool = False) -> str:
    cleaned = re.sub(r"@\S+", " ", text)
    if exclude_stamp_codes:
        cleaned = strip_stamp_codes(cleaned)
    return cleaned.strip()


def _pos_allowed(surface: str, pos_parts: tuple[str, ...], include_pos: set[str], exclude_pos: set[str]) -> bool:
    if not pos_parts:
        return False
    primary = pos_parts[0]
    if primary in exclude_pos:
        return False
    if primary not in include_pos:
        return False
    if primary == "名詞" and len(pos_parts) > 1 and pos_parts[1] in NOUN_EXCLUDE_SUBTYPES:
        return False
    return bool(surface)


def run_stage4_keywords(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Tokenize chat text with Janome and build keyword aggregates."""
    global_cfg = params.get("global", {})
    stage4 = params.get("stage4", {})
    bucket_sec = int(global_cfg.get("density_bucket_sec", 60))
    min_token_length = int(global_cfg.get("min_token_length", 2))
    top_n_overall = int(global_cfg.get("keyword_top_n_overall", 30))
    top_n_timeline = int(global_cfg.get("keyword_top_n_timeline", 10))
    min_doc_count = int(stage4.get("keyword_min_doc_count", 5))
    delete_tokens = bool(global_cfg.get("delete_tokens_after_stage4", True))
    stopwords_file = stage4.get("stopwords_file", "stopwords_ja_chat.txt")
    stopword_regex = stage4.get("stopword_regex")
    include_pos = set(stage4.get("include_pos", ["名詞", "動詞", "形容詞", "副詞"]))
    exclude_pos = set(stage4.get("exclude_pos", ["助詞", "助動詞", "記号", "接続詞", "感動詞"]))

    stopwords = load_stopwords(stopwords_file)
    tokenizer = Tokenizer()

    conn.execute("DELETE FROM tokens WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM keyword_stats WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM keyword_timeline WHERE video_id = ?", (video_id,))

    display_filter = load_video_display_filter(conn, video_id, params)
    exclude_stamp_codes = bool(display_filter.get("exclude_stamp_only"))
    messages = conn.execute(
        """
        SELECT message_id, time_in_seconds, text, message_type, author_id
        FROM messages
        WHERE video_id = ?
          AND text IS NOT NULL
          AND trim(text) != ''
        """,
        (video_id,),
    ).fetchall()

    overall_counts: Counter[str] = Counter()
    bucket_counts: dict[int, Counter[str]] = defaultdict(Counter)
    token_bucket_presence: dict[str, set[int]] = defaultdict(set)
    active_buckets: set[int] = set()
    token_rows: list[tuple] = []
    persist_tokens = not delete_tokens

    for msg in messages:
        if not should_include_for_keyword_analysis(msg, display_filter, params):
            continue
        text = _normalize_text(msg["text"] or "", exclude_stamp_codes=exclude_stamp_codes)
        if not text:
            continue
        time_sec = msg["time_in_seconds"]
        bucket_start = None
        if time_sec is not None:
            bucket_start = int(time_sec // bucket_sec) * bucket_sec

        for token in tokenizer.tokenize(text):
            surface = token.surface.strip()
            if len(surface) < min_token_length:
                continue
            if exclude_stamp_codes and is_stamp_code_token(surface):
                continue
            pos_parts = token.part_of_speech.split(",")
            if not _pos_allowed(surface, tuple(pos_parts), include_pos, exclude_pos):
                continue
            if is_stopword_token(surface, stopwords, stopword_regex):
                continue

            overall_counts[surface] += 1
            if bucket_start is not None:
                bucket_counts[bucket_start][surface] += 1
                token_bucket_presence[surface].add(bucket_start)
                active_buckets.add(bucket_start)
            if persist_tokens:
                token_rows.append((video_id, msg["message_id"], time_sec, bucket_start, surface))

    detection_cfg = stage4.get("global_token_detection", {})
    coverage_threshold = float(detection_cfg.get("coverage_threshold", 0.8))
    min_total_count = int(detection_cfg.get("min_total_count", 20))
    require_top_n = bool(detection_cfg.get("require_top_n", True))

    video_row = conn.execute(
        "SELECT channel_name FROM videos WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    channel_name = video_row["channel_name"] if video_row is not None else None

    auto_tokens = detect_global_tokens(
        overall_counts,
        token_bucket_presence,
        len(active_buckets),
        coverage_threshold=coverage_threshold,
        min_total_count=min_total_count,
        top_n=top_n_overall,
        require_top_n=require_top_n,
        channel_name=channel_name,
        min_token_length=min_token_length,
    )
    effective_auto = effective_auto_ng_keywords(auto_tokens, display_filter)
    snapshot = build_detection_snapshot(
        effective_auto,
        overall_counts,
        token_bucket_presence,
        len(active_buckets),
        coverage_threshold=coverage_threshold,
        min_total_count=min_total_count,
    )
    params.setdefault("stage4", {})["global_token_detection_result"] = snapshot
    save_analysis_params_snapshot(conn, video_id, params)
    save_auto_ng_keywords(conn, video_id, auto_tokens, params)

    auto_set = set(effective_auto)
    if auto_set:
        overall_counts = Counter(
            {token: count for token, count in overall_counts.items() if token not in auto_set}
        )
        for bucket_start in list(bucket_counts.keys()):
            bucket_counts[bucket_start] = Counter(
                {
                    token: count
                    for token, count in bucket_counts[bucket_start].items()
                    if token not in auto_set
                }
            )
        if persist_tokens:
            token_rows = [row for row in token_rows if row[4] not in auto_set]

    if token_rows:
        conn.executemany(
            """
            INSERT INTO tokens (video_id, message_id, time_in_seconds, bucket_start_sec, token)
            VALUES (?, ?, ?, ?, ?)
            """,
            token_rows,
        )

    eligible = [(token, count) for token, count in overall_counts.items() if count >= min_doc_count]
    eligible.sort(key=lambda item: (-item[1], item[0]))
    ranked_overall = eligible[:top_n_overall]
    overall_rank_tokens = {token for token, _ in ranked_overall}

    stats_rows = [
        (video_id, token, count, rank)
        for rank, (token, count) in enumerate(ranked_overall, start=1)
    ]
    if stats_rows:
        conn.executemany(
            """
            INSERT INTO keyword_stats (video_id, token, count, rank)
            VALUES (?, ?, ?, ?)
            """,
            stats_rows,
        )

    timeline_rows: list[tuple] = []
    for bucket_start in sorted(bucket_counts.keys()):
        bucket_items = [
            (token, count)
            for token, count in bucket_counts[bucket_start].items()
            if token in overall_rank_tokens
        ]
        bucket_items.sort(key=lambda item: (-item[1], item[0]))
        for token, count in bucket_items[:top_n_timeline]:
            timeline_rows.append((video_id, bucket_start, token, count))

    if timeline_rows:
        conn.executemany(
            """
            INSERT INTO keyword_timeline (video_id, bucket_start_sec, token, count)
            VALUES (?, ?, ?, ?)
            """,
            timeline_rows,
        )
