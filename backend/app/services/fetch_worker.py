import json
import logging
from datetime import datetime, timezone

from chat_downloader import ChatDownloader

from app.db import get_connection

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_message(video_id: str, item: dict) -> dict | None:
    author = item.get("author") or {}
    message_type = item.get("message_type") or "text_message"
    text = item.get("message")
    time_in_seconds = item.get("time_in_seconds")

    amount = None
    currency = None
    if message_type in {"super_chat", "super_sticker", "super_chat_event", "super_sticker_event"}:
        details = item.get("money") or item.get("amount") or {}
        if isinstance(details, dict):
            amount = details.get("amount") or details.get("value")
            currency = details.get("currency")
        else:
            amount = item.get("amount")
            currency = item.get("currency")

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
        chat = downloader.get_chat(source_url)
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
        raise


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
