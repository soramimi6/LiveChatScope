"""Tests for UX-24 refilter API."""

from __future__ import annotations

import json
import sqlite3

import pytest

from app.config import settings


def _insert_complete_video(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            message_count, analyzed_at
        ) VALUES (
            'vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete',
            1, '2026-06-21T00:00:00Z'
        )
        """
    )
    conn.commit()
    conn.close()


def _read_display_filter(db_path) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT display_filter_json, analysis_status FROM videos WHERE video_id = 'vid1'"
    ).fetchone()
    conn.close()
    return {
        "display_filter_json": row["display_filter_json"],
        "analysis_status": row["analysis_status"],
    }


def test_post_refilter_returns_202_and_persists_filter(client, monkeypatch):
    db_path = settings.database_path
    _insert_complete_video(db_path)

    pipeline_called: list[str] = []

    def fake_refilter(video_id: str) -> None:
        pipeline_called.append(video_id)

    monkeypatch.setattr(
        "app.api.analysis.run_refilter_pipeline",
        fake_refilter,
    )

    payload = {
        "display_filter": {
            "exclude_stamp_only": True,
            "exclude_ng_keywords": True,
            "ng_keywords": ["spam"],
            "excluded_author_ids": ["user123"],
        }
    }
    response = client.post("/api/v1/videos/vid1/analysis/refilter", json=payload)

    assert response.status_code == 202
    body = response.json()
    assert body["video_id"] == "vid1"
    assert body["analysis_status"] == "running"
    assert body["status_url"] == "/api/v1/videos/vid1/status"
    assert pipeline_called == ["vid1"]

    saved = _read_display_filter(db_path)
    assert saved["analysis_status"] == "running"
    assert json.loads(saved["display_filter_json"]) == {
        **payload["display_filter"],
        "auto_ng_keywords": [],
        "dismissed_auto_ng_keywords": [],
    }


def test_post_refilter_applies_ng_keywords(client, monkeypatch):
    db_path = settings.database_path
    _insert_complete_video(db_path)
    monkeypatch.setattr("app.api.analysis.run_refilter_pipeline", lambda _vid: None)

    payload = {
        "display_filter": {
            "exclude_stamp_only": False,
            "exclude_ng_keywords": True,
            "ng_keywords": ["spam"],
            "excluded_author_ids": [],
        }
    }
    response = client.post("/api/v1/videos/vid1/analysis/refilter", json=payload)
    assert response.status_code == 202

    saved = _read_display_filter(db_path)
    assert json.loads(saved["display_filter_json"])["ng_keywords"] == ["spam"]


def test_post_refilter_returns_409_when_already_running(client):
    db_path = settings.database_path
    _insert_complete_video(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute(
        "UPDATE videos SET analysis_status = 'running' WHERE video_id = 'vid1'"
    )
    conn.commit()
    conn.close()

    response = client.post(
        "/api/v1/videos/vid1/analysis/refilter",
        json={
            "display_filter": {
                "exclude_stamp_only": True,
                "exclude_ng_keywords": False,
                "ng_keywords": [],
                "excluded_author_ids": [],
            }
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "ANALYSIS_RUNNING"


def test_get_video_meta_includes_display_filter(client):
    db_path = settings.database_path
    _insert_complete_video(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        UPDATE videos
        SET display_filter_json = ?
        WHERE video_id = 'vid1'
        """,
        (
            '{"exclude_stamp_only":false,"exclude_ng_keywords":true,'
            '"ng_keywords":["test"],"excluded_author_ids":[]}',
        ),
    )
    conn.commit()
    conn.close()

    response = client.get("/api/v1/videos/vid1")
    assert response.status_code == 200
    body = response.json()
    assert body["display_filter"]["exclude_stamp_only"] is False
    assert body["display_filter"]["exclude_ng_keywords"] is True
    assert body["display_filter"]["ng_keywords"] == ["test"]
