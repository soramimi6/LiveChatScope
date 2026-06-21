"""Stage 3b: membership registrations and gift announcements."""

from __future__ import annotations

import sqlite3
from collections import defaultdict

from app.services.membership_types import (
    GIFT_ANNOUNCEMENT_TYPE,
    MEMBERSHIP_ITEM_TYPE,
    author_key,
)


def _detect_membership_bursts(
    bucket_series: list[tuple[int, int]],
    params: dict,
) -> list[dict]:
    stage3b = params.get("stage3b", {})
    min_peak_count = int(stage3b.get("membership_burst_min_peak_count", 2))
    min_ratio = float(stage3b.get("membership_burst_min_ratio", 2.0))
    baseline_buckets = int(stage3b.get("membership_burst_baseline_buckets", 3))
    min_baseline = float(stage3b.get("membership_burst_min_baseline", 1.0))
    top_n = int(stage3b.get("membership_burst_top_n", 5))

    if not bucket_series:
        return []

    candidates: list[dict] = []
    for index, (bucket_start, peak_count) in enumerate(bucket_series):
        if index == 0 or peak_count < min_peak_count:
            continue

        previous_counts = [count for _, count in bucket_series[:index]]
        window = previous_counts[-baseline_buckets:]
        baseline = sum(window) / len(window) if window else 0.0
        baseline = max(baseline, min_baseline)
        ratio = peak_count / baseline
        if ratio < min_ratio:
            continue

        candidates.append(
            {
                "peak_bucket_start_sec": bucket_start,
                "peak_count": peak_count,
                "baseline_count": round(baseline, 2),
                "burst_ratio": round(ratio, 2),
                "burst_score": round(peak_count * ratio, 2),
            }
        )

    candidates.sort(
        key=lambda item: (
            -item["burst_score"],
            -item["peak_count"],
            item["peak_bucket_start_sec"],
        )
    )
    ranked = candidates[:top_n]
    for rank, item in enumerate(ranked, start=1):
        item["rank"] = rank
    return ranked


def _dedupe_events(rows: list[sqlite3.Row]) -> list[dict]:
    """Keep earliest event per author; null-time rows kept once per author."""
    best: dict[str, dict] = {}
    for row in rows:
        key = author_key(row["author_id"], row["author_name"])
        time_val = row["time_in_seconds"]
        candidate = {
            "author_id": row["author_id"] or key,
            "author_name": row["author_name"],
            "time_in_seconds": time_val,
            "message_id": row["message_id"],
        }
        existing = best.get(key)
        if existing is None:
            best[key] = candidate
            continue
        if existing["time_in_seconds"] is None and time_val is not None:
            best[key] = candidate
            continue
        if (
            existing["time_in_seconds"] is not None
            and time_val is not None
            and time_val < existing["time_in_seconds"]
        ):
            best[key] = candidate
    return list(best.values())


def run_stage3b_membership(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Aggregate membership registrations and gift announcements."""
    global_cfg = params.get("global", {})
    bucket_sec = int(global_cfg.get("density_bucket_sec", 60))

    conn.execute("DELETE FROM membership_registrations WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM membership_buckets WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM membership_bursts WHERE video_id = ?", (video_id,))
    conn.execute("DELETE FROM membership_gift_users WHERE video_id = ?", (video_id,))

    membership_rows = conn.execute(
        """
        SELECT message_id, author_id, author_name, time_in_seconds
        FROM messages
        WHERE video_id = ? AND message_type = ?
        ORDER BY time_in_seconds ASC, message_id ASC
        """,
        (video_id, MEMBERSHIP_ITEM_TYPE),
    ).fetchall()

    gift_rows = conn.execute(
        """
        SELECT message_id, author_id, author_name, time_in_seconds
        FROM messages
        WHERE video_id = ? AND message_type = ?
        ORDER BY time_in_seconds ASC, message_id ASC
        """,
        (video_id, GIFT_ANNOUNCEMENT_TYPE),
    ).fetchall()

    registrations = _dedupe_events(membership_rows)
    if registrations:
        conn.executemany(
            """
            INSERT INTO membership_registrations (
                video_id, author_id, author_name, time_in_seconds, message_id
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    video_id,
                    row["author_id"] or author_key(row["author_id"], row["author_name"]),
                    row["author_name"],
                    row["time_in_seconds"],
                    row["message_id"],
                )
                for row in registrations
            ],
        )

    bucket_counts: dict[int, set[str]] = defaultdict(set)
    for row in registrations:
        if row["time_in_seconds"] is None:
            continue
        bucket_start = int(row["time_in_seconds"] // bucket_sec) * bucket_sec
        key = author_key(row["author_id"], row["author_name"])
        bucket_counts[bucket_start].add(key)

    bucket_series = sorted(
        (bucket_start, len(authors)) for bucket_start, authors in bucket_counts.items()
    )
    if bucket_series:
        conn.executemany(
            """
            INSERT INTO membership_buckets (
                video_id, bucket_start_sec, bucket_sec, count
            ) VALUES (?, ?, ?, ?)
            """,
            [
                (video_id, bucket_start, bucket_sec, count)
                for bucket_start, count in bucket_series
            ],
        )

    bursts = _detect_membership_bursts(bucket_series, params)
    if bursts:
        conn.executemany(
            """
            INSERT INTO membership_bursts (
                video_id, rank, peak_bucket_start_sec, peak_count,
                baseline_count, burst_ratio, burst_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    video_id,
                    burst["rank"],
                    burst["peak_bucket_start_sec"],
                    burst["peak_count"],
                    burst["baseline_count"],
                    burst["burst_ratio"],
                    burst["burst_score"],
                )
                for burst in bursts
            ],
        )

    gifts = _dedupe_events(gift_rows)
    if gifts:
        conn.executemany(
            """
            INSERT INTO membership_gift_users (
                video_id, author_id, author_name, time_in_seconds, message_id
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    video_id,
                    row["author_id"] or author_key(row["author_id"], row["author_name"]),
                    row["author_name"],
                    row["time_in_seconds"],
                    row["message_id"],
                )
                for row in gifts
            ],
        )
