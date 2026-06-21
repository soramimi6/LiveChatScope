import logging
from datetime import datetime, timezone

from chat_downloader import ChatDownloader

from app.db import get_connection
from app.services.chat_message_types import (
    CHAT_MESSAGE_GROUPS,
    PAID_MESSAGE_TYPES,
    TICKER_DUPLICATE_TYPES,
    canonical_message_type,
)
from app.services.video_metadata import (
    extract_video_metadata,
    fallback_duration_from_messages,
    save_video_metadata,
)

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _extract_paid_amount(item: dict) -> tuple[float | None, str | None]:
    details = item.get("money") or item.get("amount") or {}
    if isinstance(details, dict):
        amount = details.get("amount") or details.get("value")
        currency = details.get("currency")
    else:
        amount = item.get("amount")
        currency = item.get("currency")
    return amount, currency


def _normalize_message(video_id: str, item: dict) -> dict | None:
    raw_type = item.get("message_type") or "text_message"
    if raw_type in TICKER_DUPLICATE_TYPES:
        return None

    message_type = canonical_message_type(raw_type)
    author = item.get("author") or {}
    text = item.get("message")
    if text is None and raw_type == "membership_item":
        text = item.get("header_secondary_text")
    time_in_seconds = item.get("time_in_seconds")

    amount = None
    currency = None
    if raw_type in PAID_MESSAGE_TYPES or message_type in {"super_chat", "super_sticker"}:
        amount, currency = _extract_paid_amount(item)

    message_id = str(item.get("message_id") or item.get("id") or "")
    if not message_id:
        return None

    return {
        "video_id": video_id,
        "message_id": message_id,
        "author_id": author.get("id"),
        "author_name": author.get("name"),
        "message_type": message_type,
        "text": text,
        "time_in_seconds": time_in_seconds,
        "timestamp_usec": item.get("timestamp"),
        "super_chat_amount": amount,
        "super_chat_currency": currency,
    }


def fetch_chat_replay(video_id: str, source_url: str) -> None:
    """Fetch live chat replay and persist messages. Runs synchronously (POC)."""
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET fetch_status = 'fetching', updated_at = ?
            WHERE video_id = ?
            """,
            (_utc_now(), video_id),
        )
        conn.commit()

    downloader = ChatDownloader()
    batch: list[dict] = []
    batch_size = 500
    total = 0

    try:
        chat = downloader.get_chat(source_url, message_groups=CHAT_MESSAGE_GROUPS)
        try:
            metadata = extract_video_metadata(chat, downloader, video_id)
            save_video_metadata(video_id, metadata)
        except Exception:
            logger.warning(
                "Failed to save video metadata for %s",
                video_id,
                exc_info=True,
            )

        for item in chat:
            row = _normalize_message(video_id, item)
            if row is None:
                continue
            if row["time_in_seconds"] is None:
                continue
            if row["time_in_seconds"] < 0:
                continue
            batch.append(row)
            if len(batch) >= batch_size:
                _insert_batch(batch)
                total += len(batch)
                batch.clear()
                _update_fetch_progress(video_id, total)

        if batch:
            _insert_batch(batch)
            total += len(batch)

        try:
            fallback_duration_from_messages(video_id)
        except Exception:
            logger.warning(
                "Failed to apply duration fallback for %s",
                video_id,
                exc_info=True,
            )

        with get_connection() as conn:
            conn.execute(
                """
                UPDATE videos
                SET fetch_status = 'fetched',
                    message_count = ?,
                    messages_fetched = ?,
                    fetched_at = ?,
                    updated_at = ?,
                    fetch_error_code = NULL,
                    fetch_error_message = NULL
                WHERE video_id = ?
                """,
                (total, total, _utc_now(), _utc_now(), video_id),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Fetch failed for %s", video_id)
        code = "FETCH_FAILED"
        message = str(exc)
        lowered = message.lower()
        if "replay" in lowered or "disabled" in lowered:
            code = "REPLAY_DISABLED"
        elif "unavailable" in lowered or "private" in lowered:
            code = "VIDEO_NOT_FOUND"

        with get_connection() as conn:
            conn.execute(
                """
                UPDATE videos
                SET fetch_status = 'failed',
                    fetch_error_code = ?,
                    fetch_error_message = ?,
                    updated_at = ?
                WHERE video_id = ?
                """,
                (code, message, _utc_now(), video_id),
            )
            conn.commit()


def _insert_batch(rows: list[dict]) -> None:
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT OR IGNORE INTO messages (
                video_id, message_id, author_id, author_name, message_type,
                text, time_in_seconds, timestamp_usec,
                super_chat_amount, super_chat_currency
            ) VALUES (
                :video_id, :message_id, :author_id, :author_name, :message_type,
                :text, :time_in_seconds, :timestamp_usec,
                :super_chat_amount, :super_chat_currency
            )
            """,
            rows,
        )
        conn.commit()


def _update_fetch_progress(video_id: str, count: int) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET messages_fetched = ?, message_count = ?, updated_at = ?
            WHERE video_id = ?
            """,
            (count, count, _utc_now(), video_id),
        )
        conn.commit()
