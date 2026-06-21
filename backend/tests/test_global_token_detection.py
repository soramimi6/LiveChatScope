"""Tests for global token (auto NG keyword) detection."""

from __future__ import annotations

from collections import Counter

from app.services.analysis.global_token_detection import (
    build_detection_snapshot,
    detect_global_tokens,
    extract_channel_name_tokens,
)


def test_extract_channel_name_tokens_splits_on_whitespace():
    tokens = extract_channel_name_tokens("Test Channel Name", min_token_length=4)
    assert tokens == {"Test Channel Name", "Test", "Channel", "Name"}


def test_detect_global_tokens_requires_coverage_and_count():
    overall = Counter({"全域語": 100, "話題語": 30, "稀": 5})
    presence = {
        "全域語": set(range(8)),
        "話題語": {0, 1, 2},
        "稀": {0},
    }
    detected = detect_global_tokens(
        overall,
        presence,
        active_bucket_count=10,
        coverage_threshold=0.8,
        min_total_count=20,
        top_n=10,
        require_top_n=True,
    )
    assert detected == ["全域語"]


def test_detect_global_tokens_allows_channel_name_outside_top_n():
    overall = Counter({"配信者名": 50, "other": 100})
    presence = {
        "配信者名": set(range(8)),
        "other": set(range(8)),
    }
    detected = detect_global_tokens(
        overall,
        presence,
        active_bucket_count=10,
        coverage_threshold=0.8,
        min_total_count=20,
        top_n=1,
        require_top_n=True,
        channel_name="配信者名",
        min_token_length=4,
    )
    assert "配信者名" in detected
    assert "other" in detected


def test_build_detection_snapshot_includes_coverage():
    overall = Counter({"全域語": 42})
    presence = {"全域語": {0, 1, 2, 3, 4, 5, 6, 7}}
    snapshot = build_detection_snapshot(
        ["全域語"],
        overall,
        presence,
        active_bucket_count=10,
        coverage_threshold=0.8,
        min_total_count=20,
    )
    assert snapshot["detected_tokens"][0]["token"] == "全域語"
    assert snapshot["detected_tokens"][0]["coverage"] == 0.8
