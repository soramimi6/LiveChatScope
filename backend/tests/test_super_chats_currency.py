"""Tests for super-chats currency filter."""

from __future__ import annotations

import sqlite3

from app.config import settings


def _seed_super_chat_video(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('sc1', 'https://www.youtube.com/watch?v=sc1', 'fetched', 'complete', 3600)
        """
    )
    conn.executemany(
        """
        INSERT INTO super_chat_events (
            video_id, time_in_seconds, author_id, author_name, amount, currency, text
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("sc1", 100.0, "UC-a", "alice", 500, "JPY", "thanks"),
            ("sc1", 200.0, "UC-b", "bob", 1000, "JPY", "gg"),
            ("sc1", 300.0, "UC-c", "carol", 5, "USD", "nice"),
        ],
    )
    conn.commit()
    conn.close()


def test_super_chats_filter_by_currency(client):
    db_path = settings.database_path
    _seed_super_chat_video(db_path)

    jpy = client.get("/api/v1/videos/sc1/super-chats?currency=JPY")
    assert jpy.status_code == 200
    payload = jpy.json()
    assert payload["currency"] == "JPY"
    assert payload["pagination"]["total"] == 2
    assert all(item["currency"] == "JPY" for item in payload["items"])

    usd = client.get("/api/v1/videos/sc1/super-chats?currency=USD")
    assert usd.status_code == 200
    usd_payload = usd.json()
    assert usd_payload["pagination"]["total"] == 1
    assert usd_payload["items"][0]["currency"] == "USD"
