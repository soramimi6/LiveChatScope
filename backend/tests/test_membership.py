"""Tests for stage3b membership aggregation and API."""

from __future__ import annotations

import sqlite3

from app.config import settings
from app.services.analysis.params import load_analysis_defaults
from app.services.analysis.stage3b_membership import run_stage3b_membership


def _seed_membership_video(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('mem1', 'https://www.youtube.com/watch?v=mem1', 'fetched', 'complete', 3600)
        """
    )
    conn.executemany(
        """
        INSERT INTO messages (
            video_id, message_id, message_type, text, time_in_seconds, author_id, author_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("mem1", "m1", "text_message", "hi", 10.0, "UC-a", "alice"),
            ("mem1", "mem1", "membership_item", None, 120.0, "UC-m1", "member1"),
            ("mem1", "mem2", "membership_item", None, 125.0, "UC-m2", "member2"),
            ("mem1", "mem3", "membership_item", None, 130.0, "UC-m1", "member1"),
            ("mem1", "mem4", "membership_item", None, -5.0, "UC-m3", "member3"),
            (
                "mem1",
                "gift1",
                "sponsorships_gift_purchase_announcement",
                "gift",
                200.0,
                "UC-g1",
                "gifter1",
            ),
            (
                "mem1",
                "gift2",
                "sponsorships_gift_purchase_announcement",
                "gift",
                210.0,
                "UC-g1",
                "gifter1",
            ),
        ],
    )
    conn.executemany(
        """
        INSERT INTO topic_blocks (
            block_id, video_id, block_index, start_sec, end_sec, label, message_count
        ) VALUES (?, 'mem1', ?, ?, ?, ?, 0)
        """,
        [
            ("b0", 0, 0, 600, "Opening"),
        ],
    )
    conn.execute(
        """
        INSERT INTO highlights (
            video_id, rank, time_in_seconds, score, clip_start_sec, clip_end_sec
        ) VALUES ('mem1', 1, 128.0, 2.5, 98, 158)
        """
    )
    conn.commit()
    conn.close()


def test_stage3b_dedupes_authors_and_buckets(tmp_path, monkeypatch):
    db_path = tmp_path / "mem.db"
    monkeypatch.setattr(settings, "database_path", db_path)

    from app.db import init_db

    init_db()
    _seed_membership_video(db_path)

    params = load_analysis_defaults()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        run_stage3b_membership(conn, "mem1", params)
        conn.commit()

        reg_count = conn.execute(
            "SELECT COUNT(*) FROM membership_registrations WHERE video_id='mem1'"
        ).fetchone()[0]
        gift_count = conn.execute(
            "SELECT COUNT(*) FROM membership_gift_users WHERE video_id='mem1'"
        ).fetchone()[0]
        bucket = conn.execute(
            "SELECT count FROM membership_buckets WHERE video_id='mem1' AND bucket_start_sec=120"
        ).fetchone()

    assert reg_count == 3
    assert gift_count == 1
    assert bucket is not None
    assert bucket[0] == 2


def test_membership_events_api(client):
    db_path = settings.database_path
    _seed_membership_video(db_path)
    params = load_analysis_defaults()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        run_stage3b_membership(conn, "mem1", params)
        conn.commit()

    response = client.get("/api/v1/videos/mem1/membership-events")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_unique"] == 3
    assert len(payload["registrations"]) == 3
    assert payload["timeline"]
    assert payload["bursts"]
    assert payload["bursts"][0]["nearby_highlight"]["rank"] == 1


def test_membership_gifts_api(client):
    db_path = settings.database_path
    _seed_membership_video(db_path)
    params = load_analysis_defaults()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        run_stage3b_membership(conn, "mem1", params)
        conn.commit()

    response = client.get("/api/v1/videos/mem1/membership-gifts")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_unique"] == 1
    assert payload["items"][0]["author_id"] == "UC-g1"


def test_authors_include_membership_flags(client):
    db_path = settings.database_path
    _seed_membership_video(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO author_stats (
            video_id, author_id, author_name, message_count, rank, is_core_regular
        ) VALUES
            ('mem1', 'UC-m1', 'member1', 1, 1, 0),
            ('mem1', 'UC-a', 'alice', 5, 2, 0)
        """
    )
    conn.commit()
    conn.close()

    params = load_analysis_defaults()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        run_stage3b_membership(conn, "mem1", params)
        conn.commit()

    response = client.get("/api/v1/videos/mem1/authors?limit=10")
    assert response.status_code == 200
    by_id = {item["author_id"]: item for item in response.json()["items"]}
    assert by_id["UC-m1"]["registered_during_stream"] is True
    assert by_id["UC-a"]["registered_during_stream"] is False
