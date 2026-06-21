"""Tests for UX-20 settings API."""

from __future__ import annotations

import json

import sqlite3

from app.config import settings


def test_get_display_filter_defaults(client):
    response = client.get("/api/v1/settings/display-filter")
    assert response.status_code == 200
    body = response.json()
    assert body["exclude_stamp_only"] is True
    assert body["ng_keywords"] == []


def test_put_display_filter_defaults_persists(client):
    payload = {
        "exclude_stamp_only": False,
        "exclude_ng_keywords": True,
        "ng_keywords": ["spam"],
        "excluded_author_ids": ["UC1"],
    }
    response = client.put("/api/v1/settings/display-filter", json=payload)
    assert response.status_code == 200
    assert response.json()["ng_keywords"] == ["spam"]

    get_response = client.get("/api/v1/settings/display-filter")
    assert get_response.json()["excluded_author_ids"] == ["UC1"]

    conn = sqlite3.connect(settings.database_path)
    row = conn.execute(
        "SELECT display_filter_json FROM user_settings WHERE user_id = 'local'"
    ).fetchone()
    conn.close()
    stored = json.loads(row[0])
    assert stored["ng_keywords"] == ["spam"]
    assert "auto_ng_keywords" not in stored
