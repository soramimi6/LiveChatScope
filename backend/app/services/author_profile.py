import sqlite3

from app.api.common import format_time_text, jump_url

AUTHOR_KEY_SQL = "COALESCE(author_id, 'unknown:' || COALESCE(author_name, ''))"
MESSAGE_AUTHOR_KEY_SQL = (
    "COALESCE(m.author_id, 'unknown:' || COALESCE(m.author_name, ''))"
)


def build_author_profile(
    conn: sqlite3.Connection,
    video_id: str,
    author_id: str,
    *,
    top_topics_limit: int = 5,
) -> dict | None:
    """Aggregate author profile fields from existing analysis tables."""
    author = conn.execute(
        """
        SELECT author_id, author_name, message_count, rank, is_core_regular
        FROM author_stats
        WHERE video_id = ? AND author_id = ?
        """,
        (video_id, author_id),
    ).fetchone()
    if author is None:
        return None

    total_blocks = conn.execute(
        "SELECT COUNT(*) AS cnt FROM topic_blocks WHERE video_id = ?",
        (video_id,),
    ).fetchone()["cnt"]
    participated_blocks = conn.execute(
        f"""
        SELECT COUNT(*) AS cnt
        FROM topic_blocks tb
        WHERE tb.video_id = ?
          AND EXISTS (
            SELECT 1
            FROM messages m
            WHERE m.video_id = ?
              AND {AUTHOR_KEY_SQL} = ?
              AND m.time_in_seconds IS NOT NULL
              AND m.time_in_seconds >= tb.start_sec
              AND m.time_in_seconds < tb.end_sec
          )
        """,
        (video_id, video_id, author_id),
    ).fetchone()["cnt"]

    first_last = conn.execute(
        f"""
        SELECT MIN(time_in_seconds) AS first_sec, MAX(time_in_seconds) AS last_sec
        FROM messages
        WHERE video_id = ?
          AND time_in_seconds IS NOT NULL
          AND {AUTHOR_KEY_SQL} = ?
        """,
        (video_id, author_id),
    ).fetchone()

    super_chat_rows = conn.execute(
        f"""
        SELECT currency, SUM(amount) AS amount, COUNT(*) AS count
        FROM super_chat_events
        WHERE video_id = ?
          AND {AUTHOR_KEY_SQL} = ?
        GROUP BY currency
        ORDER BY amount DESC
        """,
        (video_id, author_id),
    ).fetchall()

    top_topic_rows = conn.execute(
        f"""
        SELECT
            tb.block_id,
            tb.block_index,
            tb.label,
            tb.start_sec,
            COUNT(*) AS message_count
        FROM topic_blocks tb
        JOIN messages m
          ON m.video_id = tb.video_id
         AND m.time_in_seconds IS NOT NULL
         AND m.time_in_seconds >= tb.start_sec
         AND m.time_in_seconds < tb.end_sec
         AND {MESSAGE_AUTHOR_KEY_SQL} = ?
        WHERE tb.video_id = ?
        GROUP BY tb.block_id, tb.block_index, tb.label, tb.start_sec
        ORDER BY message_count DESC, tb.block_index ASC
        LIMIT ?
        """,
        (author_id, video_id, top_topics_limit),
    ).fetchall()

    participated = int(participated_blocks or 0)
    total = int(total_blocks or 0)
    ratio = round(participated / total, 4) if total > 0 else 0.0

    def message_moment(seconds: float | None) -> dict | None:
        if seconds is None:
            return None
        return {
            "time_in_seconds": float(seconds),
            "time_text": format_time_text(seconds),
            "jump_url": jump_url(video_id, seconds),
        }

    return {
        "video_id": video_id,
        "author_id": author["author_id"],
        "author_name": author["author_name"],
        "message_count": author["message_count"],
        "rank": author["rank"],
        "is_core_regular": bool(author["is_core_regular"]),
        "block_participation": {
            "participated_blocks": participated,
            "total_blocks": total,
            "ratio": ratio,
        },
        "first_message": message_moment(first_last["first_sec"]),
        "last_message": message_moment(first_last["last_sec"]),
        "super_chat_total": [
            {
                "currency": row["currency"],
                "amount": float(row["amount"] or 0),
                "count": int(row["count"] or 0),
            }
            for row in super_chat_rows
        ],
        "top_topics": [
            {
                "block_id": row["block_id"],
                "block_index": row["block_index"],
                "label": row["label"],
                "message_count": int(row["message_count"]),
                "jump_url": jump_url(video_id, row["start_sec"]),
            }
            for row in top_topic_rows
        ],
    }
