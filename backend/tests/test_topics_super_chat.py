"""Tests for D2: super chat totals per topic block on /topics."""

from __future__ import annotations

import sqlite3

from app.config import settings


def _insert_topics_fixture(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            title, duration_seconds, message_count
        ) VALUES (
            'vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete',
            'Test Stream', 3600, 10
        )
        """
    )
    conn.execute(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label,
            message_count, unique_authors, super_chat_total, super_chat_currency
        ) VALUES
            ('b0', 'vid1', 0, 0, 300, 'Opening', 5, 3, 2500, 'JPY'),
            ('b1', 'vid1', 1, 300, 600, 'Main', 5, 4, 500, 'JPY')
        """
    )
    conn.executemany(
        """
        INSERT INTO super_chat_events (
            video_id, time_in_seconds, author_name, amount, currency, text
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("vid1", 60.0, "Alice", 1000, "JPY", "thanks"),
            ("vid1", 120.0, "Bob", 500, "JPY", "nice"),
            ("vid1", 350.0, "Bob", 1000, "JPY", "JPY only"),
            ("vid1", 400.0, "Carol", 5, "USD", "hello"),
            ("vid1", 450.0, "Dave", 10, "USD", "more"),
        ],
    )
    conn.commit()
    conn.close()


def test_topics_super_chat_counts_and_amounts_by_block(client):
    db_path = settings.database_path
    _insert_topics_fixture(db_path)

    response = client.get("/api/v1/videos/vid1/topics")
    assert response.status_code == 200

    items = response.json()["items"]
    assert len(items) == 2

    opening = items[0]
    assert opening["block_index"] == 0
    assert opening["super_chat_total"] == [
        {"currency": "JPY", "amount": 1500.0, "count": 2},
    ]

    main = items[1]
    assert main["block_index"] == 1
    assert main["super_chat_total"] == [
        {"currency": "JPY", "amount": 1000.0, "count": 1},
        {"currency": "USD", "amount": 15.0, "count": 2},
    ]


def test_topics_super_chat_empty_when_no_events_in_range(client):
    db_path = settings.database_path
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('vid2', 'https://www.youtube.com/watch?v=vid2', 'fetched', 'complete', 600)
        """
    )
    conn.execute(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label,
            message_count, unique_authors, super_chat_total, super_chat_currency
        ) VALUES ('b0', 'vid2', 0, 0, 600, 'Quiet', 0, 0, 0, NULL)
        """
    )
    conn.commit()
    conn.close()

    response = client.get("/api/v1/videos/vid2/topics")
    assert response.status_code == 200
    assert response.json()["items"][0]["super_chat_total"] == []
