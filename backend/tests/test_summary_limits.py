"""Tests for summary preview limit helpers."""

from __future__ import annotations

from app.api.analysis import _summary_preview_limits


def test_summary_preview_limits_match_analysis_defaults():
    highlights_n, keywords_n, topics_n = _summary_preview_limits()
    assert highlights_n == 5
    assert keywords_n == 10
    assert topics_n == 6
