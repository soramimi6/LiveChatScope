"""Tests for G-04: markdown-summary export matches stage8 builder."""

from __future__ import annotations

import sqlite3

from app.config import settings
from app.services.analysis.stage8 import _build_markdown_summary as stage8_build_markdown_summary


def _insert_complete_video(db_path, video_id: str = "vid1") -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            title, channel_name, message_count
        ) VALUES (?, 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete',
                  'Test Stream', 'Test Channel', 100)
        """,
        (video_id,),
    )
    conn.execute(
        """
        INSERT INTO density_buckets (video_id, bucket_start_sec, count)
        VALUES (?, 120, 42)
        """,
        (video_id,),
    )
    conn.execute(
        """
        INSERT INTO super_chat_summary (video_id, currency, total_amount, count)
        VALUES (?, 'JPY', 5000, 3)
        """,
        (video_id,),
    )
    conn.execute(
        """
        INSERT INTO keyword_stats (video_id, token, count, rank)
        VALUES (?, 'hello', 10, 1), (?, 'world', 5, 2)
        """,
        (video_id, video_id),
    )
    conn.execute(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label, message_count
        ) VALUES (?, ?, 0, 0, 300, 'Opening', 20)
        """,
        (f"{video_id}-block-0", video_id),
    )
    conn.execute(
        """
        INSERT INTO stream_summary (video_id, summary_json)
        VALUES (?, '{"highlights":[]}')
        """,
        (video_id,),
    )
    conn.commit()
    conn.close()


def _stage8_markdown_summary(db_path, video_id: str = "vid1") -> str:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM videos WHERE video_id = ?", (video_id,)).fetchone()
    summary_row = conn.execute(
        "SELECT summary_json FROM stream_summary WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    body = stage8_build_markdown_summary(
        conn, video_id, row["title"] or video_id, row, summary_row
    )
    conn.close()
    return body


def test_api_markdown_summary_matches_stage8(client):
    db_path = settings.database_path
    video_id = "vid1"
    _insert_complete_video(db_path, video_id)

    expected = _stage8_markdown_summary(db_path, video_id)
    response = client.get(f"/api/v1/videos/{video_id}/export/markdown-summary")

    assert response.status_code == 200
    assert response.text == expected
    assert "## キーワード Top 10" in response.text
    assert "## 話題ブロック（推定）" in response.text


def test_api_markdown_summary_incomplete_adds_note(client):
    db_path = settings.database_path
    video_id = "vid2"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status,
            title, channel_name, message_count
        ) VALUES (?, 'https://www.youtube.com/watch?v=vid2', 'fetched', 'failed',
                  'Failed Stream', 'Channel', 50)
        """,
        (video_id,),
    )
    conn.commit()
    conn.close()

    response = client.get(f"/api/v1/videos/{video_id}/export/markdown-summary")

    assert response.status_code == 200
    assert "A+ 分析（話題・ハイライト等）は未完了" in response.text
