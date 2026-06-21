"""Tests for UX-20 user default display filter persistence."""

from __future__ import annotations

import json

import pytest

from app.db import get_connection, init_db
from app.services.user_settings import (
    LOCAL_USER_ID,
    apply_user_defaults_to_video,
    build_initial_video_display_filter,
    load_user_display_filter_defaults,
    save_user_display_filter_defaults,
)


@pytest.fixture()
def conn(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("app.config.settings.database_path", db_path)
    init_db()
    with get_connection() as connection:
        yield connection


def test_load_defaults_without_row_uses_analysis_defaults(conn):
    defaults = load_user_display_filter_defaults(conn)
    assert defaults["exclude_stamp_only"] is True
    assert defaults["ng_keywords"] == []
    assert defaults["excluded_author_ids"] == []


def test_save_and_load_user_defaults(conn):
    save_user_display_filter_defaults(
        conn,
        {
            "exclude_stamp_only": False,
            "exclude_ng_keywords": True,
            "ng_keywords": ["spam", "草"],
            "excluded_author_ids": ["UC123"],
            "auto_ng_keywords": ["ignored"],
        },
    )
    conn.commit()

    loaded = load_user_display_filter_defaults(conn)
    assert loaded == {
        "exclude_stamp_only": False,
        "exclude_ng_keywords": True,
        "ng_keywords": ["spam", "草"],
        "excluded_author_ids": ["UC123"],
    }

    row = conn.execute(
        "SELECT display_filter_json FROM user_settings WHERE user_id = ?",
        (LOCAL_USER_ID,),
    ).fetchone()
    stored = json.loads(row["display_filter_json"])
    assert "auto_ng_keywords" not in stored


def test_apply_user_defaults_to_video(conn):
    conn.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
        VALUES ('vid1', 'https://example.com', 'pending', 'pending')
        """
    )
    save_user_display_filter_defaults(
        conn,
        {
            "exclude_stamp_only": False,
            "exclude_ng_keywords": True,
            "ng_keywords": ["ng"],
            "excluded_author_ids": ["UC999"],
        },
    )
    apply_user_defaults_to_video(conn, "vid1")
    conn.commit()

    row = conn.execute(
        "SELECT display_filter_json FROM videos WHERE video_id = 'vid1'"
    ).fetchone()
    parsed = json.loads(row["display_filter_json"])
    assert parsed["ng_keywords"] == ["ng"]
    assert parsed["excluded_author_ids"] == ["UC999"]
    assert parsed["auto_ng_keywords"] == []
    assert parsed["dismissed_auto_ng_keywords"] == []


def test_build_initial_video_display_filter_excludes_auto_fields(conn):
    save_user_display_filter_defaults(
        conn,
        {
            "exclude_stamp_only": True,
            "exclude_ng_keywords": True,
            "ng_keywords": ["a"],
            "excluded_author_ids": [],
        },
    )
    conn.commit()
    initial = build_initial_video_display_filter(conn)
    assert initial["auto_ng_keywords"] == []
    assert initial["ng_keywords"] == ["a"]
