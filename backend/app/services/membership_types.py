"""Membership and gift message constants / helpers."""

from __future__ import annotations

MEMBERSHIP_ITEM_TYPE = "membership_item"
GIFT_ANNOUNCEMENT_TYPE = "sponsorships_gift_purchase_announcement"

MEMBERSHIP_MESSAGE_TYPES = frozenset(
    {
        MEMBERSHIP_ITEM_TYPE,
        GIFT_ANNOUNCEMENT_TYPE,
    }
)


def author_key(author_id: str | None, author_name: str | None) -> str:
    if author_id:
        return author_id
    return f"unknown:{author_name or ''}"
