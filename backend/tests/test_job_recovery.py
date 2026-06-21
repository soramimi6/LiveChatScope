from datetime import datetime, timezone

from app.db import get_connection
from app.services.job_recovery import is_job_stale, recover_interrupted_jobs


def test_is_job_stale_when_recent():
    now = datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc)
    updated = "2026-06-21T11:59:30+00:00"
    assert is_job_stale(updated, now=now) is False


def test_is_job_stale_when_old():
    now = datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc)
    updated = "2026-06-21T11:57:00+00:00"
    assert is_job_stale(updated, now=now) is True


def test_recover_interrupted_jobs_marks_in_flight_as_failed(client):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
            VALUES ('stale-vid-01', 'https://youtu.be/stale-vid-01', 'fetching', 'pending')
            """
        )
        conn.commit()

    recover_interrupted_jobs()

    response = client.get("/api/v1/videos/stale-vid-01/status")
    assert response.status_code == 200
    body = response.json()
    assert body["fetch_status"] == "failed"
    assert body["error"]["code"] == "INTERRUPTED"
