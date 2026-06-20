import re
import sqlite3
from collections import Counter, defaultdict

from janome.tokenizer import Tokenizer

from app.services.analysis.utils import NOUN_EXCLUDE_SUBTYPES, is_stopword_token, load_stopwords


def _normalize_text(text: str) -> str:
    cleaned = re.sub(r"@\S+", " ", text)
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

    messages = conn.execute(
        """
        SELECT message_id, time_in_seconds, text
        FROM messages
        WHERE video_id = ?
          AND text IS NOT NULL
          AND trim(text) != ''
        """,
        (video_id,),
    ).fetchall()

    overall_counts: Counter[str] = Counter()
    bucket_counts: dict[int, Counter[str]] = defaultdict(Counter)
    token_rows: list[tuple] = []

    for msg in messages:
        text = _normalize_text(msg["text"] or "")
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
            pos_parts = token.part_of_speech.split(",")
            if not _pos_allowed(surface, tuple(pos_parts), include_pos, exclude_pos):
                continue
            if is_stopword_token(surface, stopwords, stopword_regex):
                continue

            overall_counts[surface] += 1
            if bucket_start is not None:
                bucket_counts[bucket_start][surface] += 1
            token_rows.append((video_id, msg["message_id"], time_sec, bucket_start, surface))

    for video_id_val, message_id, time_sec, bucket_start, token in token_rows:
        conn.execute(
            """
            INSERT INTO tokens (video_id, message_id, time_in_seconds, bucket_start_sec, token)
            VALUES (?, ?, ?, ?, ?)
            """,
            (video_id_val, message_id, time_sec, bucket_start, token),
        )

    eligible = [(token, count) for token, count in overall_counts.items() if count >= min_doc_count]
    eligible.sort(key=lambda item: (-item[1], item[0]))
    ranked_overall = eligible[:top_n_overall]
    overall_rank_tokens = {token for token, _ in ranked_overall}

    for rank, (token, count) in enumerate(ranked_overall, start=1):
        conn.execute(
            """
            INSERT INTO keyword_stats (video_id, token, count, rank)
            VALUES (?, ?, ?, ?)
            """,
            (video_id, token, count, rank),
        )

    for bucket_start in sorted(bucket_counts.keys()):
        bucket_items = [
            (token, count)
            for token, count in bucket_counts[bucket_start].items()
            if token in overall_rank_tokens
        ]
        bucket_items.sort(key=lambda item: (-item[1], item[0]))
        for token, count in bucket_items[:top_n_timeline]:
            conn.execute(
                """
                INSERT INTO keyword_timeline (video_id, bucket_start_sec, token, count)
                VALUES (?, ?, ?, ?)
                """,
                (video_id, bucket_start, token, count),
            )

    if delete_tokens:
        conn.execute("DELETE FROM tokens WHERE video_id = ?", (video_id,))
