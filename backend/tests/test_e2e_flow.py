"""Full E2E flow against a running API server — requires LIVECHATSCOPE_E2E_URL."""

from __future__ import annotations

import os
import re
import time

import httpx
import pytest

E2E_YOUTUBE_URL = os.environ.get("LIVECHATSCOPE_E2E_URL")
E2E_API_BASE = os.environ.get("LIVECHATSCOPE_E2E_API_BASE", "http://localhost:8000").rstrip("/")
POLL_INTERVAL_SEC = 15
POLL_TIMEOUT_SEC = 30 * 60

JUMP_URL_PATTERN = re.compile(
    r"^https://www\.youtube\.com/watch\?v=[\w-]+&t=\d+s$"
)

pytestmark = pytest.mark.skipif(
    not E2E_YOUTUBE_URL,
    reason="LIVECHATSCOPE_E2E_URL is not set",
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


def _assert_jump_urls_in_payload(payload: object, video_id: str) -> None:
    """Recursively find jump_url fields and validate YouTube watch link format."""
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == "jump_url" and isinstance(value, str):
                assert JUMP_URL_PATTERN.match(value), f"Invalid jump_url: {value}"
                assert f"v={video_id}" in value
                assert "&t=" in value
            else:
                _assert_jump_urls_in_payload(value, video_id)
    elif isinstance(payload, list):
        for item in payload:
            _assert_jump_urls_in_payload(item, video_id)


def test_e2e_full_analysis_flow():
    with httpx.Client(timeout=120.0) as client:
        create_response = client.post(
            _api("/api/v1/videos"),
            json={"url": E2E_YOUTUBE_URL},
        )
        assert create_response.status_code == 202, create_response.text
        created = create_response.json()
        video_id = created["video_id"]
        assert video_id

        _poll_until_complete(client, video_id)

        analysis_paths = [
            f"/api/v1/videos/{video_id}/summary",
            f"/api/v1/videos/{video_id}/density",
            f"/api/v1/videos/{video_id}/highlights",
            f"/api/v1/videos/{video_id}/topics",
            f"/api/v1/videos/{video_id}/keywords",
            f"/api/v1/videos/{video_id}/authors",
            f"/api/v1/videos/{video_id}/messages?q=test",
        ]
        for path in analysis_paths:
            response = client.get(_api(path))
            assert response.status_code == 200, f"{path}: {response.status_code} {response.text}"
            _assert_jump_urls_in_payload(response.json(), video_id)

        # E2E-01 step 7: JSON / CSV export
        json_response = client.get(_api(f"/api/v1/videos/{video_id}/export/json"))
        assert json_response.status_code == 200, json_response.text
        json_body = json_response.json()
        assert json_body["video_id"] == video_id
        assert json_body.get("export_version") == 2
        assert json_body.get("message_count", 0) > 0
        assert "density" in json_body
        assert "authors" in json_body
        assert "messages" in json_body
        assert len(json_body["messages"]) > 0
        assert "highlights" in json_body
        assert "topics" in json_body
        assert "keywords" in json_body

        csv_response = client.get(_api(f"/api/v1/videos/{video_id}/export/csv"))
        assert csv_response.status_code == 200, csv_response.text
        csv_text = csv_response.text
        assert "time_in_seconds" in csv_text
        assert "author_name" in csv_text
        assert "message_type" in csv_text
        csv_lines = [line for line in csv_text.strip().splitlines() if line]
        assert len(csv_lines) >= 2, "CSV should include header and at least one message row"

        # E2E-01 step 8: markdown-clips / markdown-thanks export
        clips_response = client.get(
            _api(f"/api/v1/videos/{video_id}/export/markdown-clips")
        )
        assert clips_response.status_code == 200, clips_response.text
        clips_text = clips_response.text.strip()
        assert clips_text
        assert "切り抜き候補" in clips_text
        assert (
            "score=" in clips_text
            or "盛り上がり候補は検出されませんでした" in clips_text
        )

        thanks_response = client.get(
            _api(f"/api/v1/videos/{video_id}/export/markdown-thanks")
        )
        assert thanks_response.status_code == 200, thanks_response.text
        thanks_text = thanks_response.text.strip()
        assert thanks_text
        assert "スパチャ感謝文" in thanks_text
        assert (
            "スパチャはありませんでした" in thanks_text
            or "お礼リスト" in thanks_text
        )
