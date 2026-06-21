import sqlite3

MESSAGE_TYPE_ALIASES = {
    "super_chat_event": "super_chat",
    "super_sticker_event": "super_sticker",
}


def run_stage0_normalize(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Post-fetch normalization pass: message types, empty text, FTS rebuild."""
    stage0 = params.get("stage0", {})
    skip_missing_time = bool(stage0.get("skip_missing_time", True))
    skip_negative_time = bool(stage0.get("skip_negative_time", True))

    for alias, canonical in MESSAGE_TYPE_ALIASES.items():
        conn.execute(
            """
            UPDATE messages
            SET message_type = ?
            WHERE video_id = ? AND message_type = ?
            """,
            (canonical, video_id, alias),
        )

    conn.execute(
        """
        UPDATE messages
        SET text = NULL
        WHERE video_id = ? AND text IS NOT NULL AND trim(text) = ''
        """,
        (video_id,),
    )

    if skip_missing_time:
        conn.execute(
            """
            DELETE FROM messages
            WHERE video_id = ? AND time_in_seconds IS NULL
            """,
            (video_id,),
        )

    if skip_negative_time:
        conn.execute(
            """
            DELETE FROM messages
            WHERE video_id = ? AND time_in_seconds < 0
            """,
            (video_id,),
        )

    conn.execute("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')")
