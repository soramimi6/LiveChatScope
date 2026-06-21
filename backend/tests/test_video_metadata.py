"""Unit tests for video metadata extraction and persistence."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.services.video_metadata import (
    enrich_from_video_data,
    extract_metadata_from_chat,
    extract_video_metadata,
    fallback_duration_from_messages,
    save_video_metadata,
)


@pytest.fixture
def conn(tmp_path, monkeypatch):
    db_path = tmp_path / "video_metadata_test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setattr(settings, "database_path", db_path)

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(settings.schema_path.read_text(encoding="utf-8"))
    connection.commit()
    connection.close()
    yield db_path


def _insert_video(db_path: Path, video_id: str = "abc123") -> None:
    connection = sqlite3.connect(db_path)
    connection.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status)
        VALUES (?, 'https://www.youtube.com/watch?v=abc123', 'fetching')
        """,
        (video_id,),
    )
    connection.commit()
    connection.close()


def _read_video(db_path: Path, video_id: str = "abc123") -> sqlite3.Row:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    row = connection.execute(
        """
        SELECT title, channel_name, channel_id, duration_seconds
        FROM videos
        WHERE video_id = ?
        """,
        (video_id,),
    ).fetchone()
    connection.close()
    return row


def test_extract_metadata_from_chat():
    chat = MagicMock()
    chat.title = "Test Stream Title"
    chat.duration = 3600.5
    chat.id = "abc123"

    metadata = extract_metadata_from_chat(chat)

    assert metadata == {
        "title": "Test Stream Title",
        "channel_name": None,
        "channel_id": None,
        "duration_seconds": 3600.5,
    }


def test_extract_metadata_from_chat_ignores_invalid_duration():
    chat = MagicMock()
    chat.title = "Title"
    chat.duration = "not-a-number"

    metadata = extract_metadata_from_chat(chat)

    assert metadata["title"] == "Title"
    assert metadata["duration_seconds"] is None


def test_enrich_from_video_data_fills_channel_and_duration():
    metadata = {
        "title": None,
        "channel_name": None,
        "channel_id": None,
        "duration_seconds": None,
    }
    video_data = {
        "title": "YouTube Title",
        "author": "Channel Name",
        "author_id": "UC123",
        "duration": 7200,
    }

    enriched = enrich_from_video_data(metadata, video_data)

    assert enriched["title"] == "YouTube Title"
    assert enriched["channel_name"] == "Channel Name"
    assert enriched["channel_id"] == "UC123"
    assert enriched["duration_seconds"] == 7200.0


def test_enrich_from_video_data_does_not_overwrite_existing_title():
    metadata = {
        "title": "Chat Title",
        "channel_name": None,
        "channel_id": None,
        "duration_seconds": 100.0,
    }
    video_data = {
        "title": "Video Data Title",
        "author": "Channel",
        "author_id": "UC999",
        "duration": 200,
    }

    enriched = enrich_from_video_data(metadata, video_data)

    assert enriched["title"] == "Chat Title"
    assert enriched["duration_seconds"] == 100.0
    assert enriched["channel_name"] == "Channel"
    assert enriched["channel_id"] == "UC999"


def test_extract_video_metadata_uses_chat_site_get_video_data():
    chat = MagicMock()
    chat.title = "Chat Title"
    chat.duration = 100.0
    chat.id = "abc123"

    youtube_session = MagicMock()
    youtube_session.get_video_data.return_value = {
        "author": "Creator",
        "author_id": "UC456",
    }
    chat.site = youtube_session

    downloader = MagicMock()
    downloader.sessions = {}

    metadata = extract_video_metadata(chat, downloader, "abc123")

    youtube_session.get_video_data.assert_called_once_with("abc123")
    assert metadata["title"] == "Chat Title"
    assert metadata["channel_name"] == "Creator"
    assert metadata["channel_id"] == "UC456"
    assert metadata["duration_seconds"] == 100.0


def test_extract_video_metadata_falls_back_to_downloader_session():
    chat = MagicMock()
    chat.title = "Only Title"
    chat.duration = None
    chat.id = "vid1"
    chat.site = None

    youtube_session = MagicMock()
    youtube_session.get_video_data.return_value = {
        "title": "Full Title",
        "author": "Channel",
        "author_id": "UC111",
        "duration": 500,
    }

    downloader = MagicMock()
    downloader.sessions = {"YouTubeChatDownloader": youtube_session}

    metadata = extract_video_metadata(chat, downloader, "vid1")

    youtube_session.get_video_data.assert_called_once_with("vid1")
    assert metadata["title"] == "Only Title"
    assert metadata["channel_name"] == "Channel"
    assert metadata["channel_id"] == "UC111"
    assert metadata["duration_seconds"] == 500.0


def test_extract_video_metadata_handles_get_video_data_failure():
    chat = MagicMock()
    chat.title = "Safe Title"
    chat.duration = 42.0
    chat.id = "vid1"

    youtube_session = MagicMock()
    youtube_session.get_video_data.side_effect = RuntimeError("network error")
    chat.site = youtube_session

    metadata = extract_video_metadata(chat, MagicMock(), "vid1")

    assert metadata["title"] == "Safe Title"
    assert metadata["duration_seconds"] == 42.0
    assert metadata["channel_name"] is None


def test_save_video_metadata_writes_non_null_fields(conn):
    _insert_video(conn)

    save_video_metadata(
        "abc123",
        {
            "title": "Saved Title",
            "channel_name": "Saved Channel",
            "channel_id": "UCsaved",
            "duration_seconds": 1234.5,
        },
    )

    row = _read_video(conn)
    assert row["title"] == "Saved Title"
    assert row["channel_name"] == "Saved Channel"
    assert row["channel_id"] == "UCsaved"
    assert row["duration_seconds"] == 1234.5


def test_save_video_metadata_skips_null_fields(conn):
    _insert_video(conn)

    save_video_metadata(
        "abc123",
        {
            "title": "Partial Title",
            "channel_name": None,
            "channel_id": None,
            "duration_seconds": None,
        },
    )

    row = _read_video(conn)
    assert row["title"] == "Partial Title"
    assert row["channel_name"] is None
    assert row["channel_id"] is None
    assert row["duration_seconds"] is None


def test_fallback_duration_from_messages_sets_max_time(conn):
    _insert_video(conn)

    connection = sqlite3.connect(conn)
    connection.execute(
        """
        INSERT INTO messages (video_id, message_id, message_type, text, time_in_seconds)
        VALUES ('abc123', 'm1', 'text_message', 'hello', 10.0),
               ('abc123', 'm2', 'text_message', 'world', 999.5)
        """
    )
    connection.commit()
    connection.close()

    fallback_duration_from_messages("abc123")

    row = _read_video(conn)
    assert row["duration_seconds"] == 999.5


def test_fallback_duration_from_messages_noop_when_duration_exists(conn):
    _insert_video(conn)

    connection = sqlite3.connect(conn)
    connection.execute(
        "UPDATE videos SET duration_seconds = 100 WHERE video_id = 'abc123'"
    )
    connection.execute(
        """
        INSERT INTO messages (video_id, message_id, message_type, text, time_in_seconds)
        VALUES ('abc123', 'm1', 'text_message', 'hello', 5000.0)
        """
    )
    connection.commit()
    connection.close()

    fallback_duration_from_messages("abc123")

    row = _read_video(conn)
    assert row["duration_seconds"] == 100.0
