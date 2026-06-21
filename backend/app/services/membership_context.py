"""Nearby topic/highlight context for membership burst peaks."""

from __future__ import annotations

import sqlite3

from app.services.analysis.utils import format_time_text, jump_url


def _nearest_topic(
    conn: sqlite3.Connection,
    video_id: str,
    peak_sec: int,
    window_sec: int,
) -> dict | None:
    row = conn.execute(
        """
        SELECT block_id, label, start_sec, end_sec
        FROM topic_blocks
        WHERE video_id = ?
          AND start_sec <= ?
          AND end_sec >= ?
        ORDER BY block_index ASC
        LIMIT 1
        """,
        (video_id, peak_sec, peak_sec),
    ).fetchone()
    if row is not None:
        return {
            "label": row["label"],
            "start_sec": row["start_sec"],
            "end_sec": row["end_sec"],
            "jump_url": jump_url(video_id, row["start_sec"]),
        }

    row = conn.execute(
        """
        SELECT block_id, label, start_sec, end_sec,
               ABS(((start_sec + end_sec) / 2.0) - ?) AS distance
        FROM topic_blocks
        WHERE video_id = ?
        ORDER BY distance ASC, block_index ASC
        LIMIT 1
        """,
        (peak_sec, video_id),
    ).fetchone()
    if row is None or row["distance"] > window_sec:
        return None
    return {
        "label": row["label"],
        "start_sec": row["start_sec"],
        "end_sec": row["end_sec"],
        "jump_url": jump_url(video_id, row["start_sec"]),
    }


def _nearest_highlight(
    conn: sqlite3.Connection,
    video_id: str,
    peak_sec: int,
    window_sec: int,
) -> dict | None:
    row = conn.execute(
        """
        SELECT rank, time_in_seconds,
               ABS(time_in_seconds - ?) AS distance
        FROM highlights
        WHERE video_id = ?
        ORDER BY distance ASC, rank ASC
        LIMIT 1
        """,
        (peak_sec, video_id),
    ).fetchone()
    if row is None or row["distance"] > window_sec:
        return None
    return {
        "rank": row["rank"],
        "time_in_seconds": row["time_in_seconds"],
        "time_text": format_time_text(row["time_in_seconds"]),
        "jump_url": jump_url(video_id, row["time_in_seconds"]),
    }


def build_burst_context(
    conn: sqlite3.Connection,
    video_id: str,
    peak_bucket_start_sec: int,
    *,
    window_sec: int = 120,
) -> dict:
    return {
        "nearby_topic": _nearest_topic(conn, video_id, peak_bucket_start_sec, window_sec),
        "nearby_highlight": _nearest_highlight(
            conn, video_id, peak_bucket_start_sec, window_sec
        ),
    }
