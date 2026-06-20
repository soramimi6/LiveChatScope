import sqlite3
from collections import Counter


def run_stage6b_topic_authors(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Top authors per topic block and core-regular flags on author_stats."""
    stage1 = params.get("stage1", {})
    stage6b = params.get("stage6b", {})
    topic_author_top_n = int(stage1.get("topic_author_top_n", 10))
    core_ratio = float(stage6b.get("core_regular_min_block_ratio", 0.5))

    conn.execute("DELETE FROM topic_author_stats WHERE video_id = ?", (video_id,))
    conn.execute(
        "UPDATE author_stats SET is_core_regular = 0 WHERE video_id = ?",
        (video_id,),
    )

    blocks = conn.execute(
        """
        SELECT block_id, start_sec, end_sec
        FROM topic_blocks
        WHERE video_id = ?
        ORDER BY block_index ASC
        """,
        (video_id,),
    ).fetchall()
    if not blocks:
        return

    author_block_counts: Counter[str] = Counter()

    for block in blocks:
        rows = conn.execute(
            """
            SELECT
                COALESCE(author_id, 'unknown:' || COALESCE(author_name, '')) AS author_key,
                MAX(author_name) AS author_name,
                COUNT(*) AS message_count
            FROM messages
            WHERE video_id = ?
              AND time_in_seconds IS NOT NULL
              AND time_in_seconds >= ?
              AND time_in_seconds < ?
            GROUP BY author_key
            ORDER BY message_count DESC, author_key ASC
            LIMIT ?
            """,
            (video_id, block["start_sec"], block["end_sec"], topic_author_top_n),
        ).fetchall()

        for rank, row in enumerate(rows, start=1):
            author_block_counts[row["author_key"]] += 1
            conn.execute(
                """
                INSERT INTO topic_author_stats (
                    block_id, video_id, author_id, author_name, message_count, rank
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    block["block_id"],
                    video_id,
                    row["author_key"],
                    row["author_name"],
                    row["message_count"],
                    rank,
                ),
            )

    total_blocks = len(blocks)
    min_blocks = max(1, int(total_blocks * core_ratio + 0.999999))
    for author_id, block_count in author_block_counts.items():
        if block_count >= min_blocks:
            conn.execute(
                """
                UPDATE author_stats
                SET is_core_regular = 1
                WHERE video_id = ? AND author_id = ?
                """,
                (video_id, author_id),
            )
