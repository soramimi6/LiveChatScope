"""Detect globally frequent tokens (background noise) for auto NG keywords."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any


def extract_channel_name_tokens(channel_name: str | None, min_token_length: int) -> set[str]:
    if not channel_name or not channel_name.strip():
        return set()
    tokens: set[str] = set()
    stripped = channel_name.strip()
    if len(stripped) >= min_token_length:
        tokens.add(stripped)
    for part in re.split(r"\s+", stripped):
        part = part.strip()
        if len(part) >= min_token_length:
            tokens.add(part)
    return tokens


def detect_global_tokens(
    overall_counts: Counter[str],
    token_bucket_presence: dict[str, set[int]],
    active_bucket_count: int,
    *,
    coverage_threshold: float = 0.8,
    min_total_count: int = 20,
    top_n: int | None = 30,
    require_top_n: bool = True,
    channel_name: str | None = None,
    min_token_length: int = 4,
) -> list[str]:
    """Return tokens that appear in most active buckets (global background noise)."""
    if active_bucket_count <= 0 or not overall_counts:
        return []

    sorted_tokens = sorted(overall_counts.items(), key=lambda item: (-item[1], item[0]))
    top_n_set = {token for token, _ in sorted_tokens[:top_n]} if top_n else set()
    channel_tokens = extract_channel_name_tokens(channel_name, min_token_length)

    detected: set[str] = set()
    for token, count in overall_counts.items():
        if count < min_total_count:
            continue
        buckets = token_bucket_presence.get(token, set())
        coverage = len(buckets) / active_bucket_count
        if coverage < coverage_threshold:
            continue
        if require_top_n and top_n_set and token not in top_n_set and token not in channel_tokens:
            continue
        detected.add(token)

    return sorted(detected)


def build_detection_snapshot(
    auto_tokens: list[str],
    overall_counts: Counter[str],
    token_bucket_presence: dict[str, set[int]],
    active_bucket_count: int,
    *,
    coverage_threshold: float,
    min_total_count: int,
) -> dict[str, Any]:
    details: list[dict[str, Any]] = []
    for token in auto_tokens:
        buckets = token_bucket_presence.get(token, set())
        coverage = len(buckets) / active_bucket_count if active_bucket_count else 0.0
        details.append(
            {
                "token": token,
                "total_count": overall_counts[token],
                "bucket_count": len(buckets),
                "coverage": round(coverage, 4),
            }
        )
    return {
        "coverage_threshold": coverage_threshold,
        "min_total_count": min_total_count,
        "active_bucket_count": active_bucket_count,
        "detected_tokens": details,
    }
