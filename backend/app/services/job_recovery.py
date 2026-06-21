from datetime import datetime, timezone

from app.db import get_connection

# Background fetch/analysis with no heartbeat longer than this is treated as stale.
STALE_JOB_SECONDS = 120

INTERRUPTED_FETCH_MESSAGE = "取得処理が中断されました。再試行してください。"
INTERRUPTED_ANALYSIS_MESSAGE = "分析処理が中断されました。再試行してください。"


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_job_stale(updated_at: str | None, *, now: datetime | None = None) -> bool:
    parsed = _parse_utc(updated_at)
    if parsed is None:
        return True
    current = now or datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return (current - parsed).total_seconds() > STALE_JOB_SECONDS


def recover_interrupted_jobs() -> None:
    """Mark in-flight jobs as failed after server restart or crash."""
    now = _utc_now()
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET fetch_status = 'failed',
                fetch_error_code = 'INTERRUPTED',
                fetch_error_message = ?,
                updated_at = ?
            WHERE fetch_status IN ('pending', 'fetching')
            """,
            (INTERRUPTED_FETCH_MESSAGE, now),
        )
        conn.execute(
            """
            UPDATE videos
            SET analysis_status = 'failed',
                analysis_error_code = 'INTERRUPTED',
                analysis_error_message = ?,
                updated_at = ?
            WHERE analysis_status = 'running'
            """,
            (INTERRUPTED_ANALYSIS_MESSAGE, now),
        )
        conn.commit()


def recover_stale_video_job(video_id: str) -> bool:
    """Mark a single video's stale in-flight job as interrupted. Returns True if updated."""
    now = _utc_now()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT fetch_status, analysis_status, updated_at
            FROM videos
            WHERE video_id = ?
            """,
            (video_id,),
        ).fetchone()
        if row is None:
            return False

        updated = False
        if row["fetch_status"] in {"pending", "fetching"} and is_job_stale(row["updated_at"]):
            conn.execute(
                """
                UPDATE videos
                SET fetch_status = 'failed',
                    fetch_error_code = 'INTERRUPTED',
                    fetch_error_message = ?,
                    updated_at = ?
                WHERE video_id = ?
                """,
                (INTERRUPTED_FETCH_MESSAGE, now, video_id),
            )
            updated = True
        elif row["analysis_status"] == "running" and is_job_stale(row["updated_at"]):
            conn.execute(
                """
                UPDATE videos
                SET analysis_status = 'failed',
                    analysis_error_code = 'INTERRUPTED',
                    analysis_error_message = ?,
                    updated_at = ?
                WHERE video_id = ?
                """,
                (INTERRUPTED_ANALYSIS_MESSAGE, now, video_id),
            )
            updated = True

        if updated:
            conn.commit()
        return updated


def reset_video_for_full_retry(conn, video_id: str, source_url: str) -> None:
    """Clear fetched messages and reset job fields before a full fetch + analysis run."""
    conn.execute("DELETE FROM messages WHERE video_id = ?", (video_id,))
    conn.execute(
        """
        UPDATE videos
        SET source_url = ?,
            fetch_status = 'pending',
            analysis_status = 'pending',
            fetch_error_code = NULL,
            fetch_error_message = NULL,
            analysis_error_code = NULL,
            analysis_error_message = NULL,
            analysis_stage = NULL,
            messages_fetched = 0,
            message_count = 0,
            fetched_at = NULL,
            analyzed_at = NULL,
            updated_at = datetime('now')
        WHERE video_id = ?
        """,
        (source_url, video_id),
    )


def reset_video_for_analysis_retry(conn, video_id: str) -> None:
    """Reset analysis fields while keeping fetched messages."""
    conn.execute(
        """
        UPDATE videos
        SET analysis_status = 'pending',
            analysis_error_code = NULL,
            analysis_error_message = NULL,
            analysis_stage = NULL,
            analyzed_at = NULL,
            updated_at = datetime('now')
        WHERE video_id = ?
        """,
        (video_id,),
    )
