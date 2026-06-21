"""Whitelist tests for fetch_worker normalization using realistic chat-downloader fixtures."""

from __future__ import annotations

import pytest

from app.services.fetch_worker import _normalize_message
from tests.helpers.fixture_loader import (
    load_chat_downloader_messages,
    load_expected_normalize_whitelist,
)

VIDEO_ID = "fixture-vid"


@pytest.fixture
def raw_messages():
    return load_chat_downloader_messages()


@pytest.fixture
def expected_whitelist():
    return load_expected_normalize_whitelist()


def test_fixture_includes_superchat_and_membership_types(raw_messages):
    types = {item["message_type"] for item in raw_messages}
    assert "paid_message" in types
    assert "paid_sticker" in types
    assert "membership_item" in types
    assert "sponsorships_gift_purchase_announcement" in types


def test_normalize_message_matches_whitelist(raw_messages, expected_whitelist):
    """Each fixture message must normalize to the documented target shape (#4 contract)."""
    for item in raw_messages:
        message_id = item["message_id"]
        if message_id not in expected_whitelist:
            continue

        row = _normalize_message(VIDEO_ID, item)
        assert row is not None, f"missing normalization for {message_id}"
        expected = expected_whitelist[message_id]

        assert row["message_type"] == expected["message_type"], message_id
        assert row["super_chat_amount"] == expected["super_chat_amount"], message_id
        assert row["super_chat_currency"] == expected["super_chat_currency"], message_id


def test_normalize_preserves_time_and_author_for_paid_message(raw_messages):
    paid = next(item for item in raw_messages if item["message_id"] == "sc-001")
    row = _normalize_message(VIDEO_ID, paid)
    assert row is not None
    assert row["time_in_seconds"] == 130
    assert row["author_id"] == "UC-sc-1"
    assert row["author_name"] == "supporter1"
    assert row["message_type"] == "super_chat"
    assert row["super_chat_amount"] == 500.0
