"""Tests for C1 author profile API."""

from __future__ import annotations

import sqlite3

from app.config import settings


def _insert_profile_fixture(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete', 3600)
        """
    )
    conn.execute(
        """
        INSERT INTO author_stats (
            video_id, author_id, author_name, message_count, rank, is_core_regular
        ) VALUES ('vid1', 'UC-author-1', 'たろう', 10, 1, 1)
        """
    )
    conn.executemany(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label, message_count
        ) VALUES (?, 'vid1', ?, ?, ?, ?, 0)
        """,
        [
            ("block-0", 0, 0, 600, "Opening"),
            ("block-1", 1, 600, 1200, "Main"),
        ],
    )
    conn.executemany(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds, author_id, author_name
        ) VALUES (?, ?, 'text_message', ?, ?, ?, ?)
        """,
        [
            ("vid1", "m1", "hello", 60.0, "UC-author-1", "たろう"),
            ("vid1", "m2", "again", 900.0, "UC-author-1", "たろう"),
            ("vid1", "m3", "other", 100.0, "UC-other", "other"),
        ],
    )
    conn.execute(
        """
        INSERT INTO super_chat_events (
            video_id, time_in_seconds, author_id, author_name, amount, currency, text
        ) VALUES ('vid1', 900.0, 'UC-author-1', 'たろう', 1000, 'JPY', 'thanks')
        """
    )
    conn.commit()
    conn.close()


def test_author_profile_api(client):
    db_path = settings.database_path
    _insert_profile_fixture(db_path)

    response = client.get("/api/v1/videos/vid1/authors/UC-author-1/profile")
    assert response.status_code == 200

    payload = response.json()
    assert payload["author_id"] == "UC-author-1"
    assert payload["author_name"] == "たろう"
    assert payload["is_core_regular"] is True
    assert payload["block_participation"] == {
        "participated_blocks": 2,
        "total_blocks": 2,
        "ratio": 1.0,
    }
    assert payload["first_message"]["time_text"] == "00:01:00"
    assert payload["last_message"]["time_text"] == "00:15:00"
    assert payload["super_chat_total"] == [
        {"currency": "JPY", "amount": 1000.0, "count": 1},
    ]
    assert len(payload["top_topics"]) == 2
    assert payload["top_topics"][0]["label"] == "Opening"
    assert payload["top_topics"][1]["label"] == "Main"


def test_author_profile_not_found(client):
    db_path = settings.database_path
    _insert_profile_fixture(db_path)

    response = client.get("/api/v1/videos/vid1/authors/UC-missing/profile")
    assert response.status_code == 404
