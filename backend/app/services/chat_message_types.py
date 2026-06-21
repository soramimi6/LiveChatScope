"""YouTube live chat message type mapping for chat-downloader → LiveChatScope."""

from __future__ import annotations

# chat-downloader default is ["messages"] only; superchat/tickers are required for SC.
CHAT_MESSAGE_GROUPS = ["messages", "superchat", "tickers"]

# Ticker duplicates mirror paid/membership items with negative time_in_seconds.
TICKER_DUPLICATE_TYPES = frozenset(
    {
        "ticker_paid_message_item",
        "ticker_paid_sticker_item",
        "ticker_sponsor_item",
    }
)

MESSAGE_TYPE_CANONICAL: dict[str, str] = {
    "paid_message": "super_chat",
    "paid_sticker": "super_sticker",
    "super_chat_event": "super_chat",
    "super_sticker_event": "super_sticker",
}

PAID_MESSAGE_TYPES = frozenset(
    {
        "super_chat",
        "super_sticker",
        "paid_message",
        "paid_sticker",
        "super_chat_event",
        "super_sticker_event",
    }
)


def canonical_message_type(raw_type: str) -> str:
    return MESSAGE_TYPE_CANONICAL.get(raw_type, raw_type)
