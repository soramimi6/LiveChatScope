"""Tests for UX-06 / UX-24 message display filter helpers."""

from __future__ import annotations

import sqlite3

import pytest

from app.config import settings
from app.services.analysis.message_filter import (
    effective_auto_ng_keywords,
    is_stamp_code_token,
    is_stamp_only_text,
    load_video_display_filter,
    save_auto_ng_keywords,
    should_include_for_keyword_analysis,
    strip_stamp_codes,
)


@pytest.fixture
def conn(tmp_path, monkeypatch):
    db_path = tmp_path / "message_filter_test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setattr(settings, "database_path", db_path)

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(settings.schema_path.read_text(encoding="utf-8"))
    connection.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
        VALUES ('vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete')
        """
    )
    connection.commit()
    yield connection
    connection.close()


def _row(**kwargs) -> dict:
    defaults = {
        "message_id": "m1",
        "message_type": "text_message",
        "text": "hello world",
        "author_id": "author1",
    }
    defaults.update(kwargs)
    return defaults


def test_is_stamp_only_detects_whitespace_only():
    assert is_stamp_only_text("   ")


def test_is_stamp_only_detects_emoji_only():
    assert is_stamp_only_text("😀🔥")


def test_is_stamp_only_detects_colon_stamp_pattern():
    assert is_stamp_only_text(":stamp: :wave:")


def test_is_stamp_only_rejects_normal_text():
    assert not is_stamp_only_text("こんにちは")


def test_strip_stamp_codes_removes_colon_tokens():
    assert strip_stamp_codes("わろた :laugh: :wave:") == "わろた"
    assert strip_stamp_codes(":stamp:") == ""


def test_is_stamp_code_token():
    assert is_stamp_code_token(":laugh:")
    assert not is_stamp_code_token("laugh")
    assert not is_stamp_code_token("わろた")


def test_should_exclude_stamp_only_when_enabled():
    filter_cfg = {
        "exclude_stamp_only": True,
        "exclude_ng_keywords": False,
        "ng_keywords": [],
        "excluded_author_ids": [],
    }
    assert not should_include_for_keyword_analysis(
        _row(text="😀🔥"),
        filter_cfg,
    )
    assert should_include_for_keyword_analysis(
        _row(text="meaningful chat"),
        filter_cfg,
    )


def test_should_exclude_ng_keywords_when_enabled():
    filter_cfg = {
        "exclude_stamp_only": False,
        "exclude_ng_keywords": True,
        "ng_keywords": ["spam", "NG"],
        "excluded_author_ids": [],
    }
    assert not should_include_for_keyword_analysis(
        _row(text="this is spam content"),
        filter_cfg,
    )
    assert not should_include_for_keyword_analysis(
        _row(text="contains ng word"),
        filter_cfg,
    )
    assert should_include_for_keyword_analysis(
        _row(text="clean message"),
        filter_cfg,
    )


def test_should_exclude_author_when_listed():
    filter_cfg = {
        "exclude_stamp_only": False,
        "exclude_ng_keywords": False,
        "ng_keywords": [],
        "excluded_author_ids": ["blocked_user"],
    }
    assert not should_include_for_keyword_analysis(
        _row(author_id="blocked_user", text="hello"),
        filter_cfg,
    )
    assert should_include_for_keyword_analysis(
        _row(author_id="other_user", text="hello"),
        filter_cfg,
    )


def test_load_video_display_filter_uses_defaults_when_null(conn):
    cfg = load_video_display_filter(conn, "vid1")
    assert cfg["exclude_stamp_only"] is True
    assert cfg["exclude_ng_keywords"] is False
    assert cfg["ng_keywords"] == []
    assert cfg["auto_ng_keywords"] == []
    assert cfg["excluded_author_ids"] == []


def test_load_video_display_filter_parses_saved_json(conn):
    conn.execute(
        """
        UPDATE videos
        SET display_filter_json = ?
        WHERE video_id = 'vid1'
        """,
        (
            '{"exclude_stamp_only":false,"exclude_ng_keywords":true,'
            '"ng_keywords":["bad"],"excluded_author_ids":["u1"]}',
        ),
    )
    conn.commit()

    cfg = load_video_display_filter(conn, "vid1")
    assert cfg["exclude_stamp_only"] is False
    assert cfg["exclude_ng_keywords"] is True
    assert cfg["ng_keywords"] == ["bad"]
    assert cfg["excluded_author_ids"] == ["u1"]


def test_save_auto_ng_keywords_persists_and_enables_exclude(conn):
    save_auto_ng_keywords(conn, "vid1", ["全域語", "配信"])
    conn.commit()

    cfg = load_video_display_filter(conn, "vid1")
    assert cfg["auto_ng_keywords"] == ["全域語", "配信"]
    assert cfg["exclude_ng_keywords"] is True
    assert cfg["ng_keywords"] == []


def test_effective_auto_ng_keywords_respects_dismissed(conn):
    conn.execute(
        """
        UPDATE videos
        SET display_filter_json = ?
        WHERE video_id = 'vid1'
        """,
        (
            '{"dismissed_auto_ng_keywords":["全域語"],"auto_ng_keywords":["配信"]}',
        ),
    )
    conn.commit()

    cfg = load_video_display_filter(conn, "vid1")
    assert effective_auto_ng_keywords(["全域語", "配信", "話題"], cfg) == sorted(
        ["配信", "話題"]
    )


def test_save_auto_ng_keywords_skips_dismissed(conn):
    conn.execute(
        """
        UPDATE videos
        SET display_filter_json = ?
        WHERE video_id = 'vid1'
        """,
        ('{"dismissed_auto_ng_keywords":["全域語"]}',),
    )
    conn.commit()

    save_auto_ng_keywords(conn, "vid1", ["全域語", "配信"])
    conn.commit()

    cfg = load_video_display_filter(conn, "vid1")
    assert cfg["auto_ng_keywords"] == ["配信"]
    assert cfg["dismissed_auto_ng_keywords"] == ["全域語"]
