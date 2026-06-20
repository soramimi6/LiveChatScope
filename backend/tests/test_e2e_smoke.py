"""Smoke tests — always run, no external services required."""

from __future__ import annotations


def test_post_videos_invalid_url_returns_400(client):
    response = client.post("/api/v1/videos", json={"url": "not-a-youtube-url"})
    assert response.status_code == 400
    body = response.json()
    assert body["detail"]["error"]["code"] == "INVALID_URL"


def test_openapi_json_returns_200(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema.get("openapi")
    assert "paths" in schema
