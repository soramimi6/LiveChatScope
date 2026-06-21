"""Performance API tests against a running server — requires LIVECHATSCOPE_E2E_URL or LIVECHATSCOPE_PERF_VIDEO_ID."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

import httpx
import pytest

E2E_YOUTUBE_URL = os.environ.get("LIVECHATSCOPE_E2E_URL")
PERF_VIDEO_ID = os.environ.get("LIVECHATSCOPE_PERF_VIDEO_ID")
E2E_API_BASE = os.environ.get("LIVECHATSCOPE_E2E_API_BASE", "http://localhost:8000").rstrip("/")
POLL_INTERVAL_SEC = 15
POLL_TIMEOUT_SEC = 30 * 60
MAX_DB_BYTES = 500 * 1024 * 1024

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = REPO_ROOT / "data" / "livechatscope.db"


def _extract_video_id(value: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/)([\w-]+)", value)
    if match:
        return match.group(1)
    return value


def _target_video_id() -> str | None:
    if PERF_VIDEO_ID:
        return _extract_video_id(PERF_VIDEO_ID)
    if E2E_YOUTUBE_URL:
        return _extract_video_id(E2E_YOUTUBE_URL)
    return None


TARGET_VIDEO_ID = _target_video_id()

pytestmark = pytest.mark.skipif(
    not TARGET_VIDEO_ID,
    reason="LIVECHATSCOPE_E2E_URL or LIVECHATSCOPE_PERF_VIDEO_ID is not set",
)


def _api(path: str) -> str:
    return f"{E2E_API_BASE}{path}"


def _poll_until_complete(client: httpx.Client, video_id: str) -> dict:
    deadline = time.monotonic() + POLL_TIMEOUT_SEC
    last_status: dict = {}

    while time.monotonic() < deadline:
        response = client.get(_api(f"/api/v1/videos/{video_id}/status"))
        response.raise_for_status()
        last_status = response.json()

        fetch_status = last_status.get("fetch_status")
        analysis_status = last_status.get("analysis_status")

        if fetch_status == "failed" or analysis_status == "failed":
            error = last_status.get("error") or {}
            pytest.fail(
                f"Pipeline failed: fetch={fetch_status}, analysis={analysis_status}, "
                f"error={error}"
            )

        if fetch_status == "fetched" and analysis_status == "complete":
            return last_status

        time.sleep(POLL_INTERVAL_SEC)

    pytest.fail(
        f"Timed out after {POLL_TIMEOUT_SEC}s waiting for fetched+complete. "
        f"Last status: {last_status}"
    )


def _ensure_video_ready(client: httpx.Client, video_id: str) -> None:
    status_response = client.get(_api(f"/api/v1/videos/{video_id}/status"))

    if status_response.status_code == 404:
        if not E2E_YOUTUBE_URL:
            pytest.skip(
                "Video not found and LIVECHATSCOPE_E2E_URL is not set for creation"
            )
        create_response = client.post(
            _api("/api/v1/videos"),
            json={"url": E2E_YOUTUBE_URL},
        )
        assert create_response.status_code == 202, create_response.text
        _poll_until_complete(client, video_id)
        return

    status_response.raise_for_status()
    status = status_response.json()
    if (
        status.get("fetch_status") == "fetched"
        and status.get("analysis_status") == "complete"
    ):
        return

    _poll_until_complete(client, video_id)


@pytest.fixture(scope="module")
def perf_video_id() -> str:
    assert TARGET_VIDEO_ID is not None
    with httpx.Client(timeout=120.0) as client:
        _ensure_video_ready(client, TARGET_VIDEO_ID)
    return TARGET_VIDEO_ID


def test_p02_summary_latency(perf_video_id: str):
    with httpx.Client(timeout=30.0) as client:
        started = time.monotonic()
        response = client.get(_api(f"/api/v1/videos/{perf_video_id}/summary"))
        elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    print(f"P-02 summary: {elapsed:.3f}s")
    assert elapsed <= 2.0, f"P-02 summary exceeded 2s: {elapsed:.3f}s"


def test_p03_density_latency(perf_video_id: str):
    with httpx.Client(timeout=30.0) as client:
        started = time.monotonic()
        response = client.get(_api(f"/api/v1/videos/{perf_video_id}/density"))
        elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    print(f"P-03 density: {elapsed:.3f}s")
    assert elapsed <= 2.0, f"P-03 density exceeded 2s: {elapsed:.3f}s"


def test_p04_messages_search_latency(perf_video_id: str):
    with httpx.Client(timeout=30.0) as client:
        started = time.monotonic()
        response = client.get(
            _api(f"/api/v1/videos/{perf_video_id}/messages?q=test")
        )
        elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    print(f"P-04 messages search: {elapsed:.3f}s")
    assert elapsed <= 5.0, f"P-04 messages search exceeded 5s: {elapsed:.3f}s"


def test_p06_database_file_size():
    db_path = Path(os.environ.get("DATABASE_PATH", str(DEFAULT_DB_PATH)))
    if not db_path.exists():
        pytest.skip(f"Database file not found: {db_path}")

    size_bytes = db_path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    print(f"P-06 database size: {size_mb:.2f} MB ({db_path})")
    assert size_bytes <= MAX_DB_BYTES, (
        f"P-06 database size exceeded 500MB: {size_mb:.2f} MB"
    )
