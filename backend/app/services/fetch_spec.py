"""Fetch-spec versioning: purge stale DB rows and export caches when ingestion changes."""

from __future__ import annotations

import logging
import shutil
import sqlite3

from pathlib import Path

from app.config import settings
from app.services.chat_message_types import CHAT_MESSAGE_GROUPS

logger = logging.getLogger(__name__)

# Bump when chat-downloader options or message normalization change (#4 and later).
FETCH_SPEC_VERSION = 2
FETCH_SPEC_META_KEY = "fetch_spec_version"


def exports_root() -> Path:
    return settings.database_path.parent / "exports"


def _ensure_app_meta(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )


def _stored_fetch_spec_version(conn: sqlite3.Connection) -> int | None:
    row = conn.execute(
        "SELECT value FROM app_meta WHERE key = ?",
        (FETCH_SPEC_META_KEY,),
    ).fetchone()
    if row is None:
        return None
    try:
        return int(row["value"])
    except (TypeError, ValueError):
        return None


def _set_fetch_spec_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(
        """
        INSERT INTO app_meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (FETCH_SPEC_META_KEY, str(version)),
    )


def clear_export_cache() -> None:
    root = exports_root()
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True, exist_ok=True)


def purge_all_video_data(conn: sqlite3.Connection) -> list[str]:
    """Delete all videos (cascades analysis tables) and wipe export files."""
    rows = conn.execute("SELECT video_id FROM videos ORDER BY video_id").fetchall()
    video_ids = [row["video_id"] for row in rows]
    if video_ids:
        conn.execute("DELETE FROM videos")
    clear_export_cache()
    return video_ids


def ensure_fetch_spec_current(conn: sqlite3.Connection) -> bool:
    """
    If stored fetch spec differs from FETCH_SPEC_VERSION, purge video data.

    Returns True when a purge ran.
    """
    _ensure_app_meta(conn)
    stored = _stored_fetch_spec_version(conn)
    if stored == FETCH_SPEC_VERSION:
        return False

    if stored is None and not conn.execute("SELECT 1 FROM videos LIMIT 1").fetchone():
        _set_fetch_spec_version(conn, FETCH_SPEC_VERSION)
        return False

    groups = ",".join(CHAT_MESSAGE_GROUPS)
    if stored is None:
        reason = "legacy data without fetch_spec_version (pre-#4 ingestion)"
    else:
        reason = f"fetch_spec_version {stored} → {FETCH_SPEC_VERSION}"

    video_ids = purge_all_video_data(conn)
    _set_fetch_spec_version(conn, FETCH_SPEC_VERSION)
    logger.warning(
        "Purged %d video(s) due to fetch spec change (%s; message_groups=%s): %s",
        len(video_ids),
        reason,
        groups,
        ", ".join(video_ids) or "(none)",
    )
    return True
