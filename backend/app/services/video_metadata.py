"""Extract and persist YouTube video metadata during chat replay fetch."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.db import get_connection

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _coerce_duration(value: Any) -> float | None:
    if value is None:
        return None
    try:
        duration = float(value)
    except (TypeError, ValueError):
        return None
    return duration if duration >= 0 else None


def extract_metadata_from_chat(chat: Any) -> dict[str, Any]:
    """Extract title and duration from a chat-downloader Chat object."""
    return {
        "title": getattr(chat, "title", None) or None,
        "channel_name": None,
        "channel_id": None,
        "duration_seconds": _coerce_duration(getattr(chat, "duration", None)),
    }


def enrich_from_video_data(
    metadata: dict[str, Any],
    video_data: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge channel and duration fields from get_video_data() output."""
    if not video_data:
        return metadata

    if not metadata.get("title") and video_data.get("title"):
        metadata["title"] = video_data["title"]

    if video_data.get("author"):
        metadata["channel_name"] = video_data["author"]
    if video_data.get("author_id"):
        metadata["channel_id"] = video_data["author_id"]

    if metadata.get("duration_seconds") is None:
        metadata["duration_seconds"] = _coerce_duration(video_data.get("duration"))

    return metadata


def _get_youtube_session(chat: Any, downloader: Any) -> Any | None:
    site = getattr(chat, "site", None)
    if site is not None and hasattr(site, "get_video_data"):
        return site

    sessions = getattr(downloader, "sessions", None) or {}
    youtube_session = sessions.get("YouTubeChatDownloader")
    if youtube_session is not None and hasattr(youtube_session, "get_video_data"):
        return youtube_session

    return None


def extract_video_metadata(chat: Any, downloader: Any, video_id: str) -> dict[str, Any]:
    """Build metadata dict from Chat object and optional YouTube get_video_data()."""
    metadata = extract_metadata_from_chat(chat)

    youtube_session = _get_youtube_session(chat, downloader)
    if youtube_session is None:
        return metadata

    lookup_id = getattr(chat, "id", None) or video_id
    try:
        video_data = youtube_session.get_video_data(lookup_id)
        metadata = enrich_from_video_data(metadata, video_data)
    except Exception:
        logger.warning(
            "Failed to enrich video metadata via get_video_data for %s",
            video_id,
            exc_info=True,
        )

    return metadata


def save_video_metadata(video_id: str, metadata: dict[str, Any]) -> None:
    """Persist non-null metadata fields to the videos table."""
    assignments: list[str] = []
    values: list[Any] = []

    for column in ("title", "channel_name", "channel_id", "duration_seconds"):
        value = metadata.get(column)
        if value is not None:
            assignments.append(f"{column} = ?")
            values.append(value)

    if not assignments:
        return

    assignments.append("updated_at = ?")
    values.append(_utc_now())
    values.append(video_id)

    sql = f"UPDATE videos SET {', '.join(assignments)} WHERE video_id = ?"

    with get_connection() as conn:
        conn.execute(sql, values)
        conn.commit()


def fallback_duration_from_messages(video_id: str) -> None:
    """Set duration_seconds from max message time when still missing."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT duration_seconds FROM videos WHERE video_id = ?",
            (video_id,),
        ).fetchone()
        if row is None or row["duration_seconds"] is not None:
            return

        max_row = conn.execute(
            """
            SELECT MAX(time_in_seconds) AS max_time
            FROM messages
            WHERE video_id = ?
            """,
            (video_id,),
        ).fetchone()
        max_time = max_row["max_time"] if max_row else None
        if max_time is None:
            return

        conn.execute(
            """
            UPDATE videos
            SET duration_seconds = ?, updated_at = ?
            WHERE video_id = ?
            """,
            (float(max_time), _utc_now(), video_id),
        )
        conn.commit()
