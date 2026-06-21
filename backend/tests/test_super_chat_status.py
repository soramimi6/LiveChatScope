"""Unit tests for super chat zero-state status discrimination (UX-05)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.config import settings
from app.services.super_chat_status import (
    STATUS_AMOUNT_PARSE_FAILED,
    STATUS_NONE_IN_CHAT,
    STATUS_PRESENT,
    compute_super_chat_status,
)


@pytest.fixture
def conn(tmp_path, monkeypatch):
    db_path = tmp_path / "super_chat_status_test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setattr(settings, "database_path", db_path)

    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(settings.schema_path.read_text(encoding="utf-8"))
    connection.commit()
    connection.close()
    yield db_path


def _insert_video(db_path: Path, video_id: str = "vid1") -> None:
    connection = sqlite3.connect(db_path)
    connection.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status)
        VALUES (?, 'https://www.youtube.com/watch?v=vid1', 'fetched')
        """,
        (video_id,),
    )
    connection.commit()
    connection.close()


def _insert_message(
    db_path: Path,
    *,
    message_id: str,
    message_type: str = "text_message",
    super_chat_amount: float | None = None,
    super_chat_currency: str | None = None,
    video_id: str = "vid1",
) -> None:
    connection = sqlite3.connect(db_path)
    connection.execute(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds,
            super_chat_amount, super_chat_currency
        )
        VALUES (?, ?, ?, 'hello', 10.0, ?, ?)
        """,
        (video_id, message_id, message_type, super_chat_amount, super_chat_currency),
    )
    connection.commit()
    connection.close()


def _compute(db_path: Path, video_id: str = "vid1") -> dict[str, str | None]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    result = compute_super_chat_status(connection, video_id)
    connection.close()
    return result


def test_none_in_chat_when_no_super_chat_messages(conn):
    _insert_video(conn)
    _insert_message(conn, message_id="m1", message_type="text_message")
    _insert_message(conn, message_id="m2", message_type="text_message")

    result = _compute(conn)

    assert result["super_chat_status"] == STATUS_NONE_IN_CHAT
    assert "見つかりませんでした" in (result["super_chat_status_message"] or "")


def test_amount_parse_failed_when_super_chat_without_amount(conn):
    _insert_video(conn)
    _insert_message(conn, message_id="sc1", message_type="super_chat")
    _insert_message(
        conn,
        message_id="sc2",
        message_type="super_sticker",
        super_chat_amount=None,
    )

    result = _compute(conn)

    assert result["super_chat_status"] == STATUS_AMOUNT_PARSE_FAILED
    assert "金額情報を取得できませんでした" in (result["super_chat_status_message"] or "")


def test_amount_parse_failed_when_amount_is_zero(conn):
    _insert_video(conn)
    _insert_message(
        conn,
        message_id="sc1",
        message_type="super_chat",
        super_chat_amount=0.0,
        super_chat_currency="JPY",
    )

    result = _compute(conn)

    assert result["super_chat_status"] == STATUS_AMOUNT_PARSE_FAILED


def test_present_when_valid_super_chat_amount(conn):
    _insert_video(conn)
    _insert_message(
        conn,
        message_id="sc1",
        message_type="super_chat",
        super_chat_amount=500.0,
        super_chat_currency="JPY",
    )

    result = _compute(conn)

    assert result["super_chat_status"] == STATUS_PRESENT
    assert result["super_chat_status_message"] is None


def test_present_when_mixed_messages_include_valid_amount(conn):
    _insert_video(conn)
    _insert_message(conn, message_id="m1", message_type="text_message")
    _insert_message(conn, message_id="sc1", message_type="super_chat_event")
    _insert_message(
        conn,
        message_id="sc2",
        message_type="super_sticker_event",
        super_chat_amount=100.0,
        super_chat_currency="JPY",
    )

    result = _compute(conn)

    assert result["super_chat_status"] == STATUS_PRESENT
