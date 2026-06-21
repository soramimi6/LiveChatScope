"""Run Phase B fetch + analysis benchmark for a target video."""

from __future__ import annotations

import argparse
import sqlite3
import time
from datetime import datetime, timezone

from app.db import get_connection, init_db
from app.services.analysis.pipeline import run_analysis_pipeline
from app.services.fetch_worker import fetch_chat_replay


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ensure_video_row(video_id: str, source_url: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
            VALUES (?, ?, 'pending', 'pending')
            ON CONFLICT(video_id) DO UPDATE SET
                source_url = excluded.source_url,
                fetch_status = 'pending',
                analysis_status = 'pending',
                fetch_error_code = NULL,
                fetch_error_message = NULL,
                analysis_error_code = NULL,
                analysis_error_message = NULL,
                messages_fetched = 0,
                message_count = 0,
                updated_at = datetime('now')
            """,
            (video_id, source_url),
        )
        conn.execute("DELETE FROM messages WHERE video_id = ?", (video_id,))
        conn.commit()


def run_benchmark(video_id: str, source_url: str) -> None:
    init_db()
    _ensure_video_row(video_id, source_url)

    started = time.perf_counter()
    print(f"[phase-b] fetch start {video_id}", flush=True)
    fetch_chat_replay(video_id, source_url)
    fetch_elapsed = time.perf_counter() - started
    print(f"[phase-b] fetch done in {fetch_elapsed:.1f}s", flush=True)

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT fetch_status, message_count, duration_seconds
            FROM videos WHERE video_id = ?
            """,
            (video_id,),
        ).fetchone()
    print(
        f"[phase-b] fetch_status={row['fetch_status']} messages={row['message_count']} "
        f"duration={row['duration_seconds']}",
        flush=True,
    )
    if row["fetch_status"] != "fetched":
        raise SystemExit(1)

    analysis_started = time.perf_counter()
    print("[phase-b] analysis start", flush=True)
    run_analysis_pipeline(video_id)
    analysis_elapsed = time.perf_counter() - analysis_started
    total_elapsed = time.perf_counter() - started
    print(f"[phase-b] analysis done in {analysis_elapsed:.1f}s", flush=True)
    print(f"[phase-b] total done in {total_elapsed:.1f}s", flush=True)

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT analysis_status, message_count, fetched_at, analyzed_at
            FROM videos WHERE video_id = ?
            """,
            (video_id,),
        ).fetchone()
    print(
        f"[phase-b] analysis_status={row['analysis_status']} "
        f"messages={row['message_count']} fetched_at={row['fetched_at']} analyzed_at={row['analyzed_at']}",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Phase B fetch + analysis benchmark")
    parser.add_argument("--video-id", default="E_MsO2AzNWE")
    parser.add_argument(
        "--url",
        default="https://www.youtube.com/watch?v=E_MsO2AzNWE",
    )
    args = parser.parse_args()
    run_benchmark(args.video_id, args.url)


if __name__ == "__main__":
    main()
