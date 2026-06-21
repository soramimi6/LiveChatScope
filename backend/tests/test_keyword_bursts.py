"""Tests for B1 keyword burst detection and API."""

from __future__ import annotations

import sqlite3
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services.analysis.stage4b import _detect_bursts, run_stage4b_keyword_bursts


def _row(bucket_start_sec: int, token: str, count: int) -> SimpleNamespace:
    return SimpleNamespace(
        bucket_start_sec=bucket_start_sec,
        token=token,
        count=count,
    )


@pytest.fixture
def burst_params() -> dict:
    return {
        "stage4b": {
            "burst_min_peak_count": 5,
            "burst_min_ratio": 3.0,
            "burst_baseline_buckets": 2,
            "burst_min_baseline": 1.0,
            "burst_top_n": 10,
        }
    }


def test_detect_bursts_finds_spike_with_baseline(burst_params):
    rows = [
        _row(0, "ボス", 2),
        _row(60, "ボス", 3),
        _row(120, "ボス", 18),
        _row(180, "ボス", 4),
    ]

    bursts = _detect_bursts(rows, burst_params)

    assert len(bursts) == 1
    assert bursts[0]["token"] == "ボス"
    assert bursts[0]["peak_bucket_start_sec"] == 120
    assert bursts[0]["peak_count"] == 18
    assert bursts[0]["baseline_count"] == 2.5
    assert bursts[0]["burst_ratio"] == 7.2


def test_detect_bursts_requires_prior_timeline_entry(burst_params):
    rows = [
        _row(0, "初登場", 5),
        _row(60, "初登場", 20),
    ]

    bursts = _detect_bursts(rows, burst_params)

    assert len(bursts) == 1
    assert bursts[0]["token"] == "初登場"
    assert bursts[0]["peak_bucket_start_sec"] == 60
    assert bursts[0]["baseline_count"] == 5.0
    assert bursts[0]["burst_ratio"] == 4.0


def test_detect_bursts_skips_first_timeline_bucket(burst_params):
    rows = [_row(300, "初登場", 15)]

    bursts = _detect_bursts(rows, burst_params)

    assert bursts == []


def test_detect_bursts_filters_low_peak_and_ratio(burst_params):
    rows = [
        _row(0, "安定", 10),
        _row(60, "安定", 10),
        _row(120, "安定", 12),
    ]

    bursts = _detect_bursts(rows, burst_params)

    assert bursts == []


def _insert_burst_fixture(db_path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO videos (
            video_id, source_url, fetch_status, analysis_status, duration_seconds
        ) VALUES ('vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete', 3600)
        """
    )
    conn.executemany(
        """
        INSERT INTO keyword_timeline (video_id, bucket_start_sec, token, count)
        VALUES (?, ?, ?, ?)
        """,
        [
            ("vid1", 0, "ボス", 2),
            ("vid1", 60, "ボス", 3),
            ("vid1", 120, "ボス", 18),
        ],
    )
    conn.commit()
    conn.close()


def test_stage4b_persists_ranked_bursts(tmp_path, burst_params):
    db_path = tmp_path / "burst_stage.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(settings.schema_path.read_text(encoding="utf-8"))
    conn.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
        VALUES ('vid1', 'https://www.youtube.com/watch?v=vid1', 'fetched', 'complete')
        """
    )
    conn.executemany(
        """
        INSERT INTO keyword_timeline (video_id, bucket_start_sec, token, count)
        VALUES (?, ?, ?, ?)
        """,
        [
            ("vid1", 0, "ボス", 2),
            ("vid1", 60, "ボス", 3),
            ("vid1", 120, "ボス", 18),
        ],
    )
    conn.commit()

    run_stage4b_keyword_bursts(conn, "vid1", burst_params)
    conn.commit()

    rows = conn.execute(
        """
        SELECT token, peak_bucket_start_sec, peak_count, rank
        FROM keyword_bursts
        WHERE video_id = ?
        ORDER BY rank ASC
        """,
        ("vid1",),
    ).fetchall()
    conn.close()

    assert len(rows) == 1
    assert rows[0]["token"] == "ボス"
    assert rows[0]["peak_bucket_start_sec"] == 120
    assert rows[0]["peak_count"] == 18
    assert rows[0]["rank"] == 1


def test_keyword_bursts_api(client):
    db_path = settings.database_path
    _insert_burst_fixture(db_path)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    from app.services.analysis.stage4b import run_stage4b_keyword_bursts
    from app.services.analysis.params import load_analysis_defaults

    run_stage4b_keyword_bursts(conn, "vid1", load_analysis_defaults())
    conn.commit()
    conn.close()

    response = client.get("/api/v1/videos/vid1/keywords/bursts")
    assert response.status_code == 200

    payload = response.json()
    assert payload["video_id"] == "vid1"
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["rank"] == 1
    assert item["token"] == "ボス"
    assert item["peak_bucket_start_sec"] == 120
    assert item["time_text"] == "00:02:00"
    assert item["peak_count"] == 18
    assert item["burst_ratio"] == 7.2
    assert "jump_url" in item
