"""Build membership/gift API payloads from analysis tables."""

from __future__ import annotations

import sqlite3

from app.services.analysis.params import load_analysis_defaults
from app.services.analysis.utils import format_time_text, jump_url
from app.services.membership_context import build_burst_context


def _registration_item(video_id: str, row: sqlite3.Row) -> dict:
    time_sec = row["time_in_seconds"]
    time_unknown = time_sec is None
    return {
        "author_id": row["author_id"],
        "author_name": row["author_name"],
        "time_in_seconds": time_sec,
        "time_text": format_time_text(time_sec) if time_sec is not None else None,
        "time_unknown": time_unknown,
        "jump_url": jump_url(video_id, time_sec) if time_sec is not None else None,
        "registered_during_stream": True,
    }


def build_membership_events(conn: sqlite3.Connection, video_id: str) -> dict:
    params = load_analysis_defaults()
    window_sec = int(params.get("stage3b", {}).get("proximity_window_sec", 120))

    registrations = [
        _registration_item(video_id, row)
        for row in conn.execute(
            """
            SELECT author_id, author_name, time_in_seconds
            FROM membership_registrations
            WHERE video_id = ?
            ORDER BY
                CASE WHEN time_in_seconds IS NULL THEN 1 ELSE 0 END,
                time_in_seconds ASC,
                author_id ASC
            """,
            (video_id,),
        ).fetchall()
    ]

    timeline = [
        {
            "bucket_start_sec": row["bucket_start_sec"],
            "count": row["count"],
        }
        for row in conn.execute(
            """
            SELECT bucket_start_sec, count
            FROM membership_buckets
            WHERE video_id = ?
            ORDER BY bucket_start_sec ASC
            """,
            (video_id,),
        ).fetchall()
    ]

    bursts = []
    for row in conn.execute(
        """
        SELECT rank, peak_bucket_start_sec, peak_count,
               baseline_count, burst_ratio, burst_score
        FROM membership_bursts
        WHERE video_id = ?
        ORDER BY rank ASC
        """,
        (video_id,),
    ).fetchall():
        peak_sec = int(row["peak_bucket_start_sec"])
        context = build_burst_context(conn, video_id, peak_sec, window_sec=window_sec)
        bursts.append(
            {
                "rank": row["rank"],
                "peak_bucket_start_sec": peak_sec,
                "peak_time_text": format_time_text(peak_sec),
                "peak_count": row["peak_count"],
                "baseline_count": row["baseline_count"],
                "burst_ratio": row["burst_ratio"],
                "burst_score": row["burst_score"],
                "jump_url": jump_url(video_id, peak_sec),
                **context,
            }
        )

    return {
        "video_id": video_id,
        "total_unique": len(registrations),
        "timeline": timeline,
        "bursts": bursts,
        "registrations": registrations,
    }


def build_membership_gifts(conn: sqlite3.Connection, video_id: str) -> dict:
    items = []
    for row in conn.execute(
        """
        SELECT author_id, author_name, time_in_seconds
        FROM membership_gift_users
        WHERE video_id = ?
        ORDER BY
            CASE WHEN time_in_seconds IS NULL THEN 1 ELSE 0 END,
            time_in_seconds ASC,
            author_id ASC
        """,
        (video_id,),
    ).fetchall():
        time_sec = row["time_in_seconds"]
        items.append(
            {
                "author_id": row["author_id"],
                "author_name": row["author_name"],
                "time_in_seconds": time_sec,
                "time_text": format_time_text(time_sec) if time_sec is not None else None,
                "time_unknown": time_sec is None,
                "jump_url": jump_url(video_id, time_sec) if time_sec is not None else None,
                "used_membership_gift": True,
            }
        )

    return {
        "video_id": video_id,
        "total_unique": len(items),
        "items": items,
    }


def author_membership_flags(
    conn: sqlite3.Connection,
    video_id: str,
    author_id: str,
) -> dict[str, bool]:
    registered = conn.execute(
        """
        SELECT 1 FROM membership_registrations
        WHERE video_id = ? AND author_id = ?
        LIMIT 1
        """,
        (video_id, author_id),
    ).fetchone()
    gifted = conn.execute(
        """
        SELECT 1 FROM membership_gift_users
        WHERE video_id = ? AND author_id = ?
        LIMIT 1
        """,
        (video_id, author_id),
    ).fetchone()
    return {
        "registered_during_stream": registered is not None,
        "used_membership_gift": gifted is not None,
    }
