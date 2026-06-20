import sqlite3

UNKNOWN_CURRENCY = "UNKNOWN"


def run_stage3_super_chat(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Super chat events, summary, and per-bucket timeline."""
    global_cfg = params.get("global", {})
    stage0 = params.get("stage0", {})
    bucket_sec = int(global_cfg.get("density_bucket_sec", 60))
    super_chat_types = stage0.get(
        "super_chat_types",
        ["super_chat", "super_sticker", "super_chat_event", "super_sticker_event"],
    )
    placeholders = ",".join("?" for _ in super_chat_types)

    conn.execute("DELETE FROM super_chat_events WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM super_chat_summary WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM super_chat_buckets WHERE video_id = ?", (video_id,))

    rows = conn.execute(
        f"""
        SELECT
            message_id,
            time_in_seconds,
            author_id,
            author_name,
            super_chat_amount,
            super_chat_currency,
            text
        FROM messages
        WHERE video_id = ?
          AND message_type IN ({placeholders})
          AND time_in_seconds IS NOT NULL
        ORDER BY time_in_seconds ASC
        """,
        (video_id, *super_chat_types),
    ).fetchall()

    for row in rows:
        amount = row["super_chat_amount"]
        if amount is None:
            amount = 0.0
        currency = row["super_chat_currency"] or UNKNOWN_CURRENCY

        conn.execute(
            """
            INSERT INTO super_chat_events (
                video_id, message_id, time_in_seconds,
                author_id, author_name, amount, currency, text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id,
                row["message_id"],
                row["time_in_seconds"],
                row["author_id"],
                row["author_name"],
                amount,
                currency,
                row["text"],
            ),
        )

    conn.execute(
        """
        INSERT INTO super_chat_summary (video_id, currency, total_amount, count)
        SELECT video_id, currency, SUM(amount) AS total_amount, COUNT(*) AS count
        FROM super_chat_events
        WHERE video_id = ?
        GROUP BY currency
        """,
        (video_id,),
    )

    conn.execute(
        """
        INSERT INTO super_chat_buckets (
            video_id, bucket_start_sec, bucket_sec, count, total_amount, currency
        )
        SELECT
            video_id,
            CAST(floor(time_in_seconds / ?) * ? AS INTEGER) AS bucket_start_sec,
            ? AS bucket_sec,
            COUNT(*) AS count,
            SUM(amount) AS total_amount,
            currency
        FROM super_chat_events
        WHERE video_id = ?
        GROUP BY bucket_start_sec, currency
        """,
        (bucket_sec, bucket_sec, bucket_sec, video_id),
    )
