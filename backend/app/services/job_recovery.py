from datetime import datetime, timezone

from app.db import get_connection

# Background fetch/analysis with no heartbeat longer than this is treated as stale.
STALE_JOB_SECONDS = 120


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
                fetch_error_message = '取得処理が中断されました。URLを再送信してください。',
                updated_at = ?
            WHERE fetch_status IN ('pending', 'fetching')
            """,
            (now,),
        )
        conn.execute(
            """
            UPDATE videos
            SET analysis_status = 'failed',
                analysis_error_code = 'INTERRUPTED',
                analysis_error_message = '分析処理が中断されました。URLを再送信してください。',
                updated_at = ?
            WHERE analysis_status = 'running'
            """,
            (now,),
        )
        conn.commit()
