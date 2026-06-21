"""Message filtering for keyword/topic analysis (UX-06 / UX-24)."""

from __future__ import annotations

import json
import re
from typing import Any

DEFAULT_DISPLAY_FILTER: dict[str, Any] = {
    "exclude_stamp_only": True,
    "exclude_ng_keywords": False,
    "ng_keywords": [],
    "excluded_author_ids": [],
}

_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)


def default_display_filter(params: dict | None = None) -> dict[str, Any]:
    cfg = (params or {}).get("message_filter", {})
    return {
        "exclude_stamp_only": bool(cfg.get("default_exclude_stamp_only", True)),
        "exclude_ng_keywords": False,
        "ng_keywords": list(cfg.get("default_ng_keywords", [])),
        "excluded_author_ids": [],
    }


def parse_display_filter(raw: str | None, params: dict | None = None) -> dict[str, Any]:
    base = default_display_filter(params)
    if not raw:
        return base
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return base
    if not isinstance(parsed, dict):
        return base
    merged = {**base, **parsed}
    merged["ng_keywords"] = list(merged.get("ng_keywords") or [])
    merged["excluded_author_ids"] = list(merged.get("excluded_author_ids") or [])
    return merged


def serialize_display_filter(filter_cfg: dict[str, Any]) -> str:
    return json.dumps(filter_cfg, ensure_ascii=False, separators=(",", ":"))


def is_filter_active(filter_cfg: dict[str, Any]) -> bool:
    if filter_cfg.get("exclude_stamp_only"):
        return True
    if filter_cfg.get("exclude_ng_keywords") and filter_cfg.get("ng_keywords"):
        return True
    if filter_cfg.get("excluded_author_ids"):
        return True
    return False


def load_video_display_filter(conn, video_id: str, params: dict | None = None) -> dict[str, Any]:
    row = conn.execute(
        "SELECT display_filter_json FROM videos WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    raw = row["display_filter_json"] if row is not None else None
    return parse_display_filter(raw, params)


def _compile_stamp_patterns(params: dict | None) -> list[re.Pattern[str]]:
    cfg = (params or {}).get("message_filter", {})
    patterns = cfg.get(
        "stamp_only_regexes",
        [
            r"^[\s]+$",
            r"^(:[\w-]+:\s*)+$",
            r"^[\U0001F300-\U0001FAFF\U00002600-\U000027BF\s]+$",
        ],
    )
    return [re.compile(p, flags=re.UNICODE) for p in patterns]


def is_stamp_only_text(text: str, params: dict | None = None) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return True
    without_emoji = _EMOJI_RE.sub("", normalized).strip()
    if not without_emoji:
        return True
    for pattern in _compile_stamp_patterns(params):
        if pattern.fullmatch(normalized):
            return True
    return False


def _contains_ng_keyword(text: str, ng_keywords: list[str]) -> bool:
    lowered = (text or "").lower()
    for keyword in ng_keywords:
        kw = keyword.strip().lower()
        if kw and kw in lowered:
            return True
    return False


def should_include_for_keyword_analysis(
    message_row,
    filter_cfg: dict[str, Any],
    params: dict | None = None,
) -> bool:
    cfg = (params or {}).get("message_filter", {})
    allowed_types = set(cfg.get("allowed_message_types", ["text_message"]))
    message_type = message_row["message_type"] if "message_type" in message_row.keys() else "text_message"
    if message_type not in allowed_types:
        return False

    text = message_row["text"] if "text" in message_row.keys() else ""
    if not (text or "").strip():
        return False

    author_id = message_row["author_id"] if "author_id" in message_row.keys() else None
    if author_id and author_id in set(filter_cfg.get("excluded_author_ids") or []):
        return False

    if filter_cfg.get("exclude_stamp_only") and is_stamp_only_text(text, params):
        return False

    if filter_cfg.get("exclude_ng_keywords") and _contains_ng_keyword(
        text, filter_cfg.get("ng_keywords") or []
    ):
        return False

    return True
