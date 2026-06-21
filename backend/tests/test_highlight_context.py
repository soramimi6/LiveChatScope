import sqlite3

import pytest

from app.services.highlight_context import build_highlight_context


@pytest.fixture
def conn():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            message_id TEXT,
            author_id TEXT,
            author_name TEXT,
            message_type TEXT,
            text TEXT,
            time_in_seconds REAL
        );
        """
    )
    yield connection
    connection.close()


def _insert_message(
    conn: sqlite3.Connection,
    *,
    video_id: str,
    author_id: str,
    author_name: str,
    message_type: str,
    text: str,
    time_in_seconds: float,
) -> None:
    conn.execute(
        """
        INSERT INTO messages (
            video_id, message_id, author_id, author_name,
            message_type, text, time_in_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            video_id,
            f"msg-{time_in_seconds}",
            author_id,
            author_name,
            message_type,
            text,
            time_in_seconds,
        ),
    )


def test_build_highlight_context_prefers_text_messages(conn):
    video_id = "vid1"
    _insert_message(
        conn,
        video_id=video_id,
        author_id="UC-a",
        author_name="Alice",
        message_type="text_message",
        text="盛り上がった！",
        time_in_seconds=100.0,
    )
    _insert_message(
        conn,
        video_id=video_id,
        author_id="UC-b",
        author_name="Bob",
        message_type="super_chat",
        text="SC only",
        time_in_seconds=101.0,
    )
    _insert_message(
        conn,
        video_id=video_id,
        author_id="UC-a",
        author_name="Alice",
        message_type="text_message",
        text="もう一回！",
        time_in_seconds=102.0,
    )

    context = build_highlight_context(conn, video_id, 90, 110, sample_limit=5)

    assert len(context["sample_messages"]) == 3
    assert context["sample_messages"][0]["author_name"] == "Alice"
    assert "盛り上がった" in context["sample_messages"][0]["text"]
    assert context["top_authors"][0]["author_name"] == "Alice"
    assert context["top_authors"][0]["message_count"] == 2


def test_build_highlight_context_truncates_long_text(conn):
    video_id = "vid1"
    long_text = "あ" * 200
    _insert_message(
        conn,
        video_id=video_id,
        author_id="UC-a",
        author_name="Alice",
        message_type="text_message",
        text=long_text,
        time_in_seconds=50.0,
    )

    context = build_highlight_context(conn, video_id, 40, 60)

    assert len(context["sample_messages"][0]["text"]) == 120
    assert context["sample_messages"][0]["text"].endswith("…")
