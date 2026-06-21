"""Unit tests for app.api.common helpers."""

from __future__ import annotations

from app.api.common import jump_url


def test_jump_url_clamps_negative_seconds_to_zero():
    assert jump_url("abc123", -390) == "https://www.youtube.com/watch?v=abc123&t=0s"


def test_jump_url_preserves_positive_seconds():
    assert jump_url("abc123", 125.7) == "https://www.youtube.com/watch?v=abc123&t=125s"


def test_jump_url_zero_seconds():
    assert jump_url("abc123", 0) == "https://www.youtube.com/watch?v=abc123&t=0s"
