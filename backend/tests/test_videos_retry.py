from datetime import datetime, timezone

from app.db import get_connection
from app.services.job_recovery import recover_stale_video_job


def _insert_video(
    video_id: str,
    *,
    fetch_status: str = "pending",
    analysis_status: str = "pending",
    updated_at: str | None = None,
) -> None:
    updated = updated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO videos (
                video_id, source_url, fetch_status, analysis_status, updated_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                video_id,
                f"https://www.youtube.com/watch?v={video_id}",
                fetch_status,
                analysis_status,
                updated,
            ),
        )
        conn.commit()


def test_status_marks_stale_fetch_as_interrupted(client):
    stale_at = "2020-01-01T00:00:00+00:00"
    _insert_video("stale-fetch-01", fetch_status="fetching", updated_at=stale_at)

    response = client.get("/api/v1/videos/stale-fetch-01/status")
    assert response.status_code == 200
    body = response.json()
    assert body["fetch_status"] == "failed"
    assert body["error"]["code"] == "INTERRUPTED"


def test_retry_full_after_fetch_failed(client):
    _insert_video("retry-full-01", fetch_status="failed", analysis_status="pending")
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET fetch_error_code = 'INTERRUPTED',
                fetch_error_message = 'interrupted'
            WHERE video_id = 'retry-full-01'
            """
        )
        conn.commit()

    response = client.post("/api/v1/videos/retry-full-01/retry")
    assert response.status_code == 202
    body = response.json()
    assert body["retry_mode"] == "full"
    assert body["fetch_status"] == "pending"


def test_retry_analysis_only_when_messages_fetched(client):
    _insert_video("retry-an-01", fetch_status="fetched", analysis_status="failed")
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET analysis_error_code = 'ANALYSIS_FAILED',
                analysis_error_message = 'boom',
                message_count = 10,
                messages_fetched = 10
            WHERE video_id = 'retry-an-01'
            """
        )
        conn.commit()

    response = client.post("/api/v1/videos/retry-an-01/retry")
    assert response.status_code == 202
    body = response.json()
    assert body["retry_mode"] == "analysis"
    assert body["fetch_status"] == "fetched"
    assert body["analysis_status"] == "pending"


def test_retry_rejected_while_active(client):
    _insert_video("retry-busy-01", fetch_status="fetching")

    response = client.post("/api/v1/videos/retry-busy-01/retry")
    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "ALREADY_PROCESSING"


def test_recover_stale_video_job_marks_analysis_running(client):
    stale_at = "2020-01-01T00:00:00+00:00"
    _insert_video(
        "stale-an-01",
        fetch_status="fetched",
        analysis_status="running",
        updated_at=stale_at,
    )

    assert recover_stale_video_job("stale-an-01") is True

    response = client.get("/api/v1/videos/stale-an-01/status")
    body = response.json()
    assert body["analysis_status"] == "failed"
    assert body["error"]["code"] == "INTERRUPTED"
