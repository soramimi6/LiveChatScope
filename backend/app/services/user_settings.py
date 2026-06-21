"""User default display filter persistence (UX-20 / Personal stage)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.services.analysis.message_filter import (
    default_display_filter,
    parse_display_filter,
    serialize_display_filter,
)

# Personal stage: single local user until Beta auth (D1).
LOCAL_USER_ID = "local"

USER_DEFAULT_FILTER_KEYS = (
    "exclude_stamp_only",
    "exclude_ng_keywords",
    "ng_keywords",
    "excluded_author_ids",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def extract_user_default_fields(filter_cfg: dict[str, Any]) -> dict[str, Any]:
    ng_keywords = list(filter_cfg.get("ng_keywords") or [])
    exclude_ng = bool(filter_cfg.get("exclude_ng_keywords"))
    if ng_keywords and not exclude_ng:
        exclude_ng = True
    return {
        "exclude_stamp_only": bool(filter_cfg.get("exclude_stamp_only", True)),
        "exclude_ng_keywords": exclude_ng,
        "ng_keywords": ng_keywords,
        "excluded_author_ids": list(filter_cfg.get("excluded_author_ids") or []),
    }


def load_user_display_filter_defaults(
    conn,
    params: dict | None = None,
) -> dict[str, Any]:
    row = conn.execute(
        "SELECT display_filter_json FROM user_settings WHERE user_id = ?",
        (LOCAL_USER_ID,),
    ).fetchone()
    base = default_display_filter(params)
    if row is None:
        return extract_user_default_fields(base)
    try:
        parsed = json.loads(row["display_filter_json"])
    except json.JSONDecodeError:
        return extract_user_default_fields(base)
    if not isinstance(parsed, dict):
        return extract_user_default_fields(base)
    merged = {**base, **parsed}
    return extract_user_default_fields(merged)


def save_user_display_filter_defaults(conn, filter_cfg: dict[str, Any]) -> None:
    payload = extract_user_default_fields(filter_cfg)
    now = _utc_now()
    conn.execute(
        """
        INSERT INTO user_settings (user_id, display_filter_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            display_filter_json = excluded.display_filter_json,
            updated_at = excluded.updated_at
        """,
        (LOCAL_USER_ID, serialize_display_filter(payload), now),
    )


def build_initial_video_display_filter(
    conn,
    params: dict | None = None,
) -> dict[str, Any]:
    defaults = load_user_display_filter_defaults(conn, params)
    return {
        **defaults,
        "auto_ng_keywords": [],
        "dismissed_auto_ng_keywords": [],
    }


def apply_user_defaults_to_video(
    conn,
    video_id: str,
    params: dict | None = None,
) -> None:
    filter_cfg = build_initial_video_display_filter(conn, params)
    conn.execute(
        """
        UPDATE videos
        SET display_filter_json = ?
        WHERE video_id = ?
        """,
        (serialize_display_filter(filter_cfg), video_id),
    )


def parse_user_default_response(raw: dict[str, Any], params: dict | None = None) -> dict[str, Any]:
    return extract_user_default_fields(parse_display_filter(serialize_display_filter(raw), params))
