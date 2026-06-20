import sqlite3


def run_stage1_basic(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Density buckets, author top-N, message type counts."""
    global_cfg = params.get("global", {})
    stage1 = params.get("stage1", {})
    bucket_sec = int(global_cfg.get("density_bucket_sec", 60))
    author_top_n = int(stage1.get("author_top_n", 20))

    conn.execute("DELETE FROM density_buckets WHERE video_id = ?", (video_id,))
    conn.execute(
        """
        INSERT INTO density_buckets (video_id, bucket_start_sec, bucket_sec, count)
        SELECT
            video_id,
            CAST(floor(time_in_seconds / ?) * ? AS INTEGER) AS bucket_start_sec,
            ? AS bucket_sec,
            COUNT(*) AS count
        FROM messages
        WHERE video_id = ? AND time_in_seconds IS NOT NULL
        GROUP BY bucket_start_sec
        """,
        (bucket_sec, bucket_sec, bucket_sec, video_id),
    )

    conn.execute("DELETE FROM message_type_stats WHERE video_id = ?", (video_id,))
    conn.execute(
        """
        INSERT INTO message_type_stats (video_id, message_type, count)
        SELECT video_id, message_type, COUNT(*) AS count
        FROM messages
        WHERE video_id = ?
        GROUP BY message_type
        """,
        (video_id,),
    )

    conn.execute("DELETE FROM author_stats WHERE video_id = ?", (video_id,))
    rows = conn.execute(
        """
        SELECT
            COALESCE(author_id, 'unknown:' || COALESCE(author_name, '')) AS author_key,
            MAX(author_name) AS author_name,
            COUNT(*) AS message_count
        FROM messages
        WHERE video_id = ?
        GROUP BY author_key
        ORDER BY message_count DESC, author_key ASC
        LIMIT ?
        """,
        (video_id, author_top_n),
    ).fetchall()

    for rank, row in enumerate(rows, start=1):
        conn.execute(
            """
            INSERT INTO author_stats (
                video_id, author_id, author_name, message_count, rank, is_core_regular
            ) VALUES (?, ?, ?, ?, ?, 0)
            """,
            (video_id, row["author_key"], row["author_name"], row["message_count"], rank),
        )
