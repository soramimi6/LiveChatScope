import sqlite3

from app.api.common import format_time_text

_TEXT_TRUNCATE = 120


def _truncate_text(text: str | None, limit: int = _TEXT_TRUNCATE) -> str:
    if not text:
        return ""
    stripped = text.strip()
    if len(stripped) <= limit:
        return stripped
    return f"{stripped[: limit - 1]}…"


def build_highlight_context(
    conn: sqlite3.Connection,
    video_id: str,
    clip_start_sec: int,
    clip_end_sec: int,
    *,
    sample_limit: int = 5,
    top_authors_limit: int = 3,
) -> dict:
    """Collect representative messages and top authors within a highlight clip window."""
    midpoint = (clip_start_sec + clip_end_sec) / 2.0
    sample_rows = conn.execute(
        """
        SELECT author_name, text, time_in_seconds, message_type
        FROM messages
        WHERE video_id = ?
          AND time_in_seconds >= ?
          AND time_in_seconds <= ?
        ORDER BY
          CASE WHEN message_type = 'text_message' THEN 0 ELSE 1 END,
          ABS(time_in_seconds - ?) ASC,
          time_in_seconds ASC
        LIMIT ?
        """,
        (video_id, clip_start_sec, clip_end_sec, midpoint, sample_limit),
    ).fetchall()

    sample_messages = [
        {
            "author_name": row["author_name"] or "（不明）",
            "text": _truncate_text(row["text"]),
            "time_in_seconds": row["time_in_seconds"] or 0.0,
            "time_text": format_time_text(row["time_in_seconds"] or 0.0),
        }
        for row in sample_rows
    ]

    author_rows = conn.execute(
        """
        SELECT author_id, author_name, COUNT(*) AS message_count
        FROM messages
        WHERE video_id = ?
          AND time_in_seconds >= ?
          AND time_in_seconds <= ?
          AND author_id IS NOT NULL
          AND author_id != ''
        GROUP BY author_id, author_name
        ORDER BY message_count DESC, author_name ASC
        LIMIT ?
        """,
        (video_id, clip_start_sec, clip_end_sec, top_authors_limit),
    ).fetchall()

    top_authors = [
        {
            "author_id": row["author_id"],
            "author_name": row["author_name"] or "（不明）",
            "message_count": int(row["message_count"]),
        }
        for row in author_rows
    ]

    return {
        "sample_messages": sample_messages,
        "top_authors": top_authors,
    }
