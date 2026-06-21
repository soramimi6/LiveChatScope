"""End-to-end whitelist tests: fixture messages → pipeline → API value assertions."""

from __future__ import annotations

import sqlite3

import pytest

from app.config import settings
from app.services.analysis.pipeline import run_analysis_pipeline
from app.services.fetch_worker import _normalize_message
from tests.helpers.fixture_loader import load_chat_downloader_messages

VIDEO_ID = "whitelist-vid"
SOURCE_URL = f"https://www.youtube.com/watch?v={VIDEO_ID}"


def _seed_fixture_video(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            title, duration_seconds, message_count
        ) VALUES (?, ?, 'fetched', 'pending', 'Fixture Stream', 600, 0)
        """,
        (VIDEO_ID, SOURCE_URL),
    )

    for item in load_chat_downloader_messages():
        row = _normalize_message(VIDEO_ID, item)
        if row is None:
            continue
        if row["time_in_seconds"] is None or row["time_in_seconds"] < 0:
            continue
        conn.execute(
            """
            INSERT INTO messages (
                video_id, message_id, author_id, author_name, message_type,
                text, time_in_seconds, super_chat_amount, super_chat_currency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["video_id"],
                row["message_id"],
                row["author_id"],
                row["author_name"],
                row["message_type"],
                row["text"],
                row["time_in_seconds"],
                row["super_chat_amount"],
                row["super_chat_currency"],
            ),
        )

    conn.execute(
        "UPDATE videos SET message_count = (SELECT COUNT(*) FROM messages WHERE video_id = ?) WHERE video_id = ?",
        (VIDEO_ID, VIDEO_ID),
    )
    conn.commit()
    conn.close()


def test_pipeline_produces_super_chat_events_from_fixture(client):
    _seed_fixture_video(settings.database_path)
    run_analysis_pipeline(VIDEO_ID)

    conn = sqlite3.connect(settings.database_path)
    sc_count = conn.execute(
        "SELECT COUNT(*) FROM super_chat_events WHERE video_id = ?",
        (VIDEO_ID,),
    ).fetchone()[0]
    conn.close()

    assert sc_count >= 2, "paid_message + paid_sticker fixture must yield super_chat_events"


def test_topics_api_whitelist_after_fixture_pipeline(client):
    _seed_fixture_video(settings.database_path)
    run_analysis_pipeline(VIDEO_ID)

    response = client.get(f"/api/v1/videos/{VIDEO_ID}/topics")
    assert response.status_code == 200
    body = response.json()

    assert isinstance(body["items"], list)
    assert len(body["items"]) >= 1

    for item in body["items"]:
        assert item["block_id"]
        assert item["label"]
        assert item["jump_url"].startswith("https://www.youtube.com/watch?v=")
        assert "t=" in item["jump_url"]
        assert item["start_sec"] >= 0
        assert item["end_sec"] > item["start_sec"]

    labels = [item["label"] for item in body["items"]]
    avg_label_len = sum(len(label) for label in labels) / len(labels)
    assert avg_label_len >= 3, f"topic labels too short on average: {labels}"


def test_super_chats_summary_present_after_fixture_pipeline(client):
    _seed_fixture_video(settings.database_path)
    run_analysis_pipeline(VIDEO_ID)

    response = client.get(f"/api/v1/videos/{VIDEO_ID}/super-chats/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["super_chat_status"] == "present"
    assert body["by_currency"], "expected currency totals from fixture super chats"
