import json
import sqlite3

from app.services.analysis.utils import format_time_text, jump_url, utc_now_iso


def _count_unique_authors(conn, video_id: str) -> int:
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT COALESCE(author_id, 'unknown:' || COALESCE(author_name, ''))) AS cnt
        FROM messages
        WHERE video_id = ?
        """,
        (video_id,),
    ).fetchone()
    return int(row["cnt"] or 0)


def run_stage7_summary(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Aggregate derived tables into stream_summary.summary_json."""
    stage7 = params.get("stage7", {})
    highlights_n = int(stage7.get("summary_highlights_n", 5))
    keywords_n = int(stage7.get("summary_keywords_n", 10))
    topic_preview_n = int(stage7.get("summary_topic_preview_n", 6))

    video = conn.execute(
        "SELECT message_count FROM videos WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    message_count = int(video["message_count"] or 0)
    unique_authors = _count_unique_authors(conn, video_id)

    peak_row = conn.execute(
        """
        SELECT bucket_start_sec, count
        FROM density_buckets
        WHERE video_id = ?
        ORDER BY count DESC, bucket_start_sec ASC
        LIMIT 1
        """,
        (video_id,),
    ).fetchone()
    peak = None
    if peak_row is not None:
        start_sec = float(peak_row["bucket_start_sec"])
        peak = {
            "time_in_seconds": start_sec,
            "time_text": format_time_text(start_sec),
            "density": int(peak_row["count"]),
            "jump_url": jump_url(video_id, start_sec),
        }

    super_chat_total = [
        {
            "currency": row["currency"],
            "amount": row["total_amount"],
            "count": row["count"],
        }
        for row in conn.execute(
            """
            SELECT currency, total_amount, count
            FROM super_chat_summary
            WHERE video_id = ?
            ORDER BY total_amount DESC
            """,
            (video_id,),
        ).fetchall()
    ]

    topic_block_count = conn.execute(
        "SELECT COUNT(*) AS cnt FROM topic_blocks WHERE video_id = ?",
        (video_id,),
    ).fetchone()["cnt"]

    top_highlights = [
        {
            "rank": row["rank"],
            "time_in_seconds": row["time_in_seconds"],
            "time_text": format_time_text(row["time_in_seconds"]),
            "score": row["score"],
            "jump_url": jump_url(video_id, row["time_in_seconds"]),
        }
        for row in conn.execute(
            """
            SELECT rank, time_in_seconds, score
            FROM highlights
            WHERE video_id = ?
            ORDER BY rank ASC
            LIMIT ?
            """,
            (video_id, highlights_n),
        ).fetchall()
    ]

    top_keywords = [
        {
            "token": row["token"],
            "count": row["count"],
            "rank": row["rank"],
        }
        for row in conn.execute(
            """
            SELECT token, count, rank
            FROM keyword_stats
            WHERE video_id = ?
            ORDER BY rank ASC
            LIMIT ?
            """,
            (video_id, keywords_n),
        ).fetchall()
    ]

    topic_blocks_preview = [
        {
            "block_id": row["block_id"],
            "block_index": row["block_index"],
            "start_sec": row["start_sec"],
            "end_sec": row["end_sec"],
            "label": row["label"],
            "label_note": "チャット上の推定話題",
            "message_count": row["message_count"],
            "unique_authors": row["unique_authors"],
            "jump_url": jump_url(video_id, row["start_sec"]),
        }
        for row in conn.execute(
            """
            SELECT block_id, block_index, start_sec, end_sec, label,
                   message_count, unique_authors
            FROM topic_blocks
            WHERE video_id = ?
            ORDER BY block_index ASC
            LIMIT ?
            """,
            (video_id, topic_preview_n),
        ).fetchall()
    ]

    generated_at = utc_now_iso()
    summary = {
        "video_id": video_id,
        "message_count": message_count,
        "unique_authors": unique_authors,
        "peak": peak,
        "super_chat_total": super_chat_total,
        "topic_block_count": int(topic_block_count or 0),
        "top_highlights": top_highlights,
        "top_keywords": top_keywords,
        "topic_blocks_preview": topic_blocks_preview,
        "generated_at": generated_at,
    }

    conn.execute("DELETE FROM stream_summary WHERE video_id = ?", (video_id,))
    conn.execute(
        """
        INSERT INTO stream_summary (video_id, summary_json, generated_at)
        VALUES (?, ?, ?)
        """,
        (video_id, json.dumps(summary, ensure_ascii=False), generated_at),
    )
