"""Compute super chat presence status from raw messages (UX-05)."""

from __future__ import annotations

import sqlite3

from app.services.analysis.params import load_analysis_defaults

STATUS_NONE_IN_CHAT = "none_in_chat"
STATUS_AMOUNT_PARSE_FAILED = "amount_parse_failed"
STATUS_PRESENT = "present"

STATUS_MESSAGES: dict[str, str | None] = {
    STATUS_NONE_IN_CHAT: (
        "この配信のチャット上では、スーパーチャット / スーパーサンクスは見つかりませんでした。"
    ),
    STATUS_AMOUNT_PARSE_FAILED: (
        "スーパーチャットらしきメッセージはありますが、金額情報を取得できませんでした。"
        "YouTube 側の表示形式変更などが原因の可能性があります。"
    ),
    STATUS_PRESENT: None,
}


def _super_chat_types() -> list[str]:
    stage0 = load_analysis_defaults().get("stage0", {})
    return stage0.get(
        "super_chat_types",
        ["super_chat", "super_sticker", "super_chat_event", "super_sticker_event"],
    )


def compute_super_chat_status(conn: sqlite3.Connection, video_id: str) -> dict[str, str | None]:
    """Derive super chat status from messages table (source of truth)."""
    super_chat_types = _super_chat_types()
    placeholders = ",".join("?" for _ in super_chat_types)

    row = conn.execute(
        f"""
        SELECT
            COUNT(*) AS sc_count,
            SUM(
                CASE
                    WHEN super_chat_amount IS NOT NULL AND super_chat_amount > 0 THEN 1
                    ELSE 0
                END
            ) AS valid_amount_count
        FROM messages
        WHERE video_id = ?
          AND message_type IN ({placeholders})
        """,
        (video_id, *super_chat_types),
    ).fetchone()

    sc_count = int(row["sc_count"] or 0)
    valid_amount_count = int(row["valid_amount_count"] or 0)

    if sc_count == 0:
        status = STATUS_NONE_IN_CHAT
    elif valid_amount_count == 0:
        status = STATUS_AMOUNT_PARSE_FAILED
    else:
        status = STATUS_PRESENT

    return {
        "super_chat_status": status,
        "super_chat_status_message": STATUS_MESSAGES[status],
    }
