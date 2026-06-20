import sqlite3
import uuid
from collections import defaultdict

from app.services.analysis.utils import format_time_text


def _cosine_distance(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    if not vec_a or not vec_b:
        return 1.0
    keys = set(vec_a) | set(vec_b)
    dot = sum(vec_a.get(k, 0.0) * vec_b.get(k, 0.0) for k in keys)
    norm_a = sum(v * v for v in vec_a.values()) ** 0.5
    norm_b = sum(v * v for v in vec_b.values()) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 1.0
    similarity = dot / (norm_a * norm_b)
    return 1.0 - similarity


def _build_bucket_vectors(conn, video_id: str) -> tuple[list[int], dict[int, dict[str, float]], int]:
    rows = conn.execute(
        """
        SELECT bucket_start_sec, token, count
        FROM keyword_timeline
        WHERE video_id = ?
        ORDER BY bucket_start_sec ASC, token ASC
        """,
        (video_id,),
    ).fetchall()
    bucket_vectors: dict[int, dict[str, float]] = defaultdict(dict)
    for row in rows:
        bucket_vectors[int(row["bucket_start_sec"])][row["token"]] = float(row["count"])

    if bucket_vectors:
        bucket_sec = int(
            conn.execute(
                """
                SELECT bucket_sec
                FROM density_buckets
                WHERE video_id = ?
                LIMIT 1
                """,
                (video_id,),
            ).fetchone()["bucket_sec"]
        )
        return sorted(bucket_vectors.keys()), bucket_vectors, bucket_sec

    density = conn.execute(
        """
        SELECT MIN(bucket_start_sec) AS min_sec,
               MAX(bucket_start_sec) AS max_sec,
               MAX(bucket_sec) AS bucket_sec
        FROM density_buckets
        WHERE video_id = ?
        """,
        (video_id,),
    ).fetchone()
    if density and density["min_sec"] is not None:
        return [int(density["min_sec"])], {}, int(density["bucket_sec"] or 60)
    return [], {}, 60


def _segment_blocks(
    bucket_starts: list[int],
    bucket_vectors: dict[int, dict[str, float]],
    bucket_sec: int,
    threshold: float,
) -> list[tuple[int, int]]:
    if not bucket_starts:
        return []
    if len(bucket_starts) == 1:
        start = bucket_starts[0]
        return [(start, start + bucket_sec)]

    change_indices: list[int] = []
    for idx in range(len(bucket_starts) - 1):
        left = bucket_vectors.get(bucket_starts[idx], {})
        right = bucket_vectors.get(bucket_starts[idx + 1], {})
        if _cosine_distance(left, right) > threshold:
            change_indices.append(idx + 1)

    boundaries = [0, *change_indices, len(bucket_starts)]
    blocks: list[tuple[int, int]] = []
    for idx in range(len(boundaries) - 1):
        start_idx = boundaries[idx]
        end_idx = boundaries[idx + 1] - 1
        start_sec = bucket_starts[start_idx]
        end_sec = bucket_starts[end_idx] + bucket_sec
        blocks.append((start_sec, end_sec))
    return blocks


def _merge_short_blocks(blocks: list[tuple[int, int]], min_block_sec: int) -> list[tuple[int, int]]:
    if not blocks:
        return []
    merged = list(blocks)
    changed = True
    while changed and len(merged) > 1:
        changed = False
        next_blocks: list[tuple[int, int]] = []
        idx = 0
        while idx < len(merged):
            start_sec, end_sec = merged[idx]
            duration = end_sec - start_sec
            if duration < min_block_sec and len(merged) > 1:
                if idx == 0:
                    _, next_end = merged[idx + 1]
                    next_blocks.append((start_sec, next_end))
                    idx += 2
                else:
                    prev_start, _ = next_blocks[-1]
                    next_blocks[-1] = (prev_start, end_sec)
                    idx += 1
                changed = True
            else:
                next_blocks.append((start_sec, end_sec))
                idx += 1
        merged = next_blocks
    return merged


def _block_label(
    conn,
    video_id: str,
    start_sec: float,
    end_sec: float,
    top_k: int,
    separator: str,
) -> str:
    rows = conn.execute(
        """
        SELECT token, SUM(count) AS total_count
        FROM keyword_timeline
        WHERE video_id = ?
          AND bucket_start_sec >= ?
          AND bucket_start_sec < ?
        GROUP BY token
        ORDER BY total_count DESC, token ASC
        LIMIT ?
        """,
        (video_id, int(start_sec), int(end_sec), top_k),
    ).fetchall()
    if rows:
        return separator.join(row["token"] for row in rows)

    duration_min = max(1, int((end_sec - start_sec) // 60))
    return f"話題区間 ({format_time_text(start_sec)}–{format_time_text(end_sec)}, ~{duration_min}分)"


def _block_metrics(
    conn,
    video_id: str,
    start_sec: float,
    end_sec: float,
    primary_currency: str,
) -> tuple[int, int, float, str | None]:
    msg_row = conn.execute(
        """
        SELECT COUNT(*) AS message_count,
               COUNT(DISTINCT COALESCE(author_id, 'unknown:' || COALESCE(author_name, ''))) AS unique_authors
        FROM messages
        WHERE video_id = ?
          AND time_in_seconds IS NOT NULL
          AND time_in_seconds >= ?
          AND time_in_seconds < ?
        """,
        (video_id, start_sec, end_sec),
    ).fetchone()
    sc_row = conn.execute(
        """
        SELECT COALESCE(SUM(amount), 0) AS total_amount
        FROM super_chat_events
        WHERE video_id = ?
          AND time_in_seconds >= ?
          AND time_in_seconds < ?
          AND currency = ?
        """,
        (video_id, start_sec, end_sec, primary_currency),
    ).fetchone()
    message_count = int(msg_row["message_count"] or 0)
    unique_authors = int(msg_row["unique_authors"] or 0)
    super_chat_total = float(sc_row["total_amount"] or 0.0)
    currency = primary_currency if super_chat_total > 0 else None
    return message_count, unique_authors, super_chat_total, currency


def run_stage5_topic_blocks(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Split the stream into topic blocks from keyword timeline change points."""
    global_cfg = params.get("global", {})
    stage3 = params.get("stage3", {})
    stage5 = params.get("stage5", {})
    bucket_sec = int(global_cfg.get("density_bucket_sec", 60))
    label_top_k = int(global_cfg.get("topic_label_top_k", 3))
    threshold = float(stage5.get("topic_change_threshold", 0.35))
    min_block_sec = int(stage5.get("topic_min_block_sec", 180))
    max_blocks = int(stage5.get("topic_max_blocks", 20))
    label_separator = stage5.get("topic_label_separator", " / ")
    primary_currency = stage3.get("primary_currency_display", "JPY")

    conn.execute("DELETE FROM topic_author_stats WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM topic_transitions WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM topic_blocks WHERE video_id = ?", (video_id,))

    bucket_starts, bucket_vectors, detected_bucket_sec = _build_bucket_vectors(conn, video_id)
    if detected_bucket_sec:
        bucket_sec = detected_bucket_sec

    if not bucket_starts:
        duration_row = conn.execute(
            "SELECT duration_seconds FROM videos WHERE video_id = ?",
            (video_id,),
        ).fetchone()
        end_sec = float(duration_row["duration_seconds"] or bucket_sec)
        blocks = [(0.0, end_sec)]
    else:
        base_threshold = threshold
        blocks = _segment_blocks(bucket_starts, bucket_vectors, bucket_sec, threshold)
        blocks = _merge_short_blocks(blocks, min_block_sec)
        while len(blocks) > max_blocks and threshold < base_threshold + 0.30:
            threshold += 0.05
            blocks = _segment_blocks(bucket_starts, bucket_vectors, bucket_sec, threshold)
            blocks = _merge_short_blocks(blocks, min_block_sec)

    for block_index, (start_sec, end_sec) in enumerate(blocks):
        label = _block_label(conn, video_id, start_sec, end_sec, label_top_k, label_separator)
        message_count, unique_authors, super_chat_total, currency = _block_metrics(
            conn, video_id, start_sec, end_sec, primary_currency
        )
        conn.execute(
            """
            INSERT INTO topic_blocks (
                block_id, video_id, block_index, start_sec, end_sec, label,
                message_count, unique_authors, super_chat_total, super_chat_currency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                video_id,
                block_index,
                float(start_sec),
                float(end_sec),
                label,
                message_count,
                unique_authors,
                super_chat_total,
                currency,
            ),
        )
