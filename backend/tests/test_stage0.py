"""Unit tests for analysis stage0 normalization."""

from __future__ import annotations

import sqlite3

import pytest

from app.services.analysis.stage0 import run_stage0_normalize


@pytest.fixture
def conn(tmp_path):
    db_path = tmp_path / "stage0_test.db"
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    from app.config import settings

    connection.executescript(settings.schema_path.read_text(encoding="utf-8"))
    connection.commit()
    yield connection
    connection.close()


def _insert_video(conn: sqlite3.Connection, video_id: str = "vid1") -> None:
    conn.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status)
        VALUES (?, 'https://www.youtube.com/watch?v=vid1', 'fetched')
        """,
        (video_id,),
    )
    conn.commit()


def _insert_message(
    conn: sqlite3.Connection,
    *,
    message_id: str,
    time_in_seconds: float | None,
    video_id: str = "vid1",
) -> None:
    conn.execute(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds
        ) VALUES (?, ?, 'text_message', ?, ?)
        """,
        (video_id, message_id, f"msg-{message_id}", time_in_seconds),
    )
    conn.commit()


def test_stage0_deletes_negative_time_in_seconds(conn):
    _insert_video(conn)
    _insert_message(conn, message_id="pre", time_in_seconds=-390.0)
    _insert_message(conn, message_id="live", time_in_seconds=10.0)
    _insert_message(conn, message_id="later", time_in_seconds=120.5)

    run_stage0_normalize(
        conn,
        "vid1",
        {"stage0": {"skip_missing_time": True, "skip_negative_time": True}},
    )
    conn.commit()

    rows = conn.execute(
        "SELECT message_id, time_in_seconds FROM messages WHERE video_id = ? ORDER BY time_in_seconds",
        ("vid1",),
    ).fetchall()

    assert len(rows) == 2
    assert rows[0]["message_id"] == "live"
    assert rows[0]["time_in_seconds"] == 10.0
    assert rows[1]["message_id"] == "later"
    assert rows[1]["time_in_seconds"] == 120.5


def test_stage0_keeps_negative_time_when_skip_disabled(conn):
    _insert_video(conn)
    _insert_message(conn, message_id="pre", time_in_seconds=-390.0)
    _insert_message(conn, message_id="live", time_in_seconds=10.0)

    run_stage0_normalize(
        conn,
        "vid1",
        {"stage0": {"skip_missing_time": True, "skip_negative_time": False}},
    )
    conn.commit()

    count = conn.execute(
        "SELECT COUNT(*) AS n FROM messages WHERE video_id = ?",
        ("vid1",),
    ).fetchone()["n"]
    assert count == 2
