"""Tests for GET /videos/{video_id}/messages search API."""

from __future__ import annotations

import sqlite3

from app.config import settings


def _insert_messages_fixture(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('vid-msg', 'https://www.youtube.com/watch?v=vid-msg', 'fetched', 'complete', 3600)
        """
    )
    conn.executemany(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds, author_id, author_name
        ) VALUES (?, ?, 'text_message', ?, ?, ?, ?)
        """,
        [
            ("vid-msg", "m1", "hello world", 10.0, "UC-valid-1", "Alice"),
            ("vid-msg", "m2", "test message", 20.0, "unknown:anon", "Bob"),
            ("vid-msg", "m3", "another hello", 30.0, None, "Charlie"),
        ],
    )
    conn.commit()
    conn.close()


def test_messages_api_includes_author_id(client):
    db_path = settings.database_path
    _insert_messages_fixture(db_path)

    response = client.get("/api/v1/videos/vid-msg/messages")
    assert response.status_code == 200

    payload = response.json()
    assert payload["video_id"] == "vid-msg"
    assert len(payload["items"]) == 3

    by_author = {item["author_name"]: item for item in payload["items"]}
    assert by_author["Alice"]["author_id"] == "UC-valid-1"
    assert by_author["Bob"]["author_id"] == "unknown:anon"
    assert by_author["Charlie"]["author_id"] is None
