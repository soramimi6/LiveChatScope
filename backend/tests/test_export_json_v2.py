"""Tests for UX-23 JSON export v2 (full analysis bundle)."""

from __future__ import annotations

import json
import sqlite3

from app.api.export import EXPORT_VERSION, _build_json_export


def _insert_video(db_path, *, analysis_status: str = "complete") -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            title, channel_name, duration_seconds, message_count, analyzed_at
        ) VALUES (
            'vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', ?,
            'Test Stream', 'Test Channel', 3600, 2, '2026-06-21T00:00:00Z'
        )
        """,
        (analysis_status,),
    )
    conn.execute(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds, author_name
        ) VALUES
            ('vid1', 'm1', 'text_message', 'hello', 10.0, 'Alice'),
            ('vid1', 'm2', 'text_message', 'world', 20.0, 'Bob')
        """
    )
    conn.execute(
        """
        INSERT INTO density_buckets (video_id, bucket_start_sec, count)
        VALUES ('vid1', 0, 5)
        """
    )
    conn.execute(
        """
        INSERT INTO author_stats (video_id, author_id, author_name, message_count, rank)
        VALUES ('vid1', 'a1', 'Alice', 1, 1)
        """
    )
    conn.execute(
        """
        INSERT INTO super_chat_events (
            video_id, time_in_seconds, author_name, amount, currency, text
        ) VALUES ('vid1', 15.0, 'Alice', 1000, 'JPY', 'thanks')
        """
    )
    conn.execute(
        """
        INSERT INTO highlights (
            video_id, rank, time_in_seconds, score, clip_start_sec, clip_end_sec
        ) VALUES ('vid1', 1, 30.0, 0.9, 20, 40)
        """
    )
    conn.execute(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label, message_count
        ) VALUES ('vid1-b0', 'vid1', 0, 0, 60, 'Opening', 2)
        """
    )
    conn.execute(
        """
        INSERT INTO keyword_stats (video_id, token, count, rank)
        VALUES ('vid1', 'hello', 1, 1)
        """
    )
    conn.execute(
        """
        INSERT INTO low_activity_segments (
            video_id, start_sec, end_sec, duration_sec, avg_density
        ) VALUES ('vid1', 100, 200, 100, 0.5)
        """
    )
    conn.execute(
        """
        INSERT INTO stream_summary (video_id, summary_json)
        VALUES ('vid1', '{"highlights":[]}')
        """
    )
    conn.commit()
    conn.close()


def _video_row(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM videos WHERE video_id = 'vid1'").fetchone()
    conn.close()
    return row


def test_json_export_v2_includes_analysis_bundle(client):
    from app.config import settings

    db_path = settings.database_path
    _insert_video(db_path)

    body = _build_json_export("vid1", _video_row(db_path))
    payload = json.loads(body)

    assert payload["export_version"] == EXPORT_VERSION
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["message_id"] == "m1"
    assert "jump_url" in payload["messages"][0]
    assert len(payload["highlights"]) == 1
    assert len(payload["topics"]) == 1
    assert len(payload["keywords"]) == 1
    assert len(payload["low_activity"]) == 1
    assert payload["stream_summary"] == {"highlights": []}
    assert payload["duration_seconds"] == 3600


def test_json_export_api_returns_v2(client):
    from app.config import settings

    db_path = settings.database_path
    _insert_video(db_path, analysis_status="failed")

    response = client.get("/api/v1/videos/vid1/export/json")
    assert response.status_code == 200

    payload = response.json()
    assert payload["export_version"] == 2
    assert len(payload["messages"]) == 2
    assert payload["highlights"] == []
    assert payload["topics"] == []
    assert "stream_summary" not in payload


def test_csv_export_still_messages_only(client):
    from app.config import settings

    db_path = settings.database_path
    _insert_video(db_path)

    response = client.get("/api/v1/videos/vid1/export/csv")
    assert response.status_code == 200

    lines = response.text.strip().splitlines()
    assert lines[0].startswith("time_in_seconds")
    assert len(lines) == 3
    assert "hello" in response.text
    assert "density" not in response.text.lower()
