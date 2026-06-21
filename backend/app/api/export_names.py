"""Export download filename helpers."""

from __future__ import annotations

EXPORT_PREFIX = "LiveChatScope_Result"

_MARKDOWN_SUFFIX = {
    "markdown-summary": "summary",
    "markdown-clips": "clips",
    "markdown-thanks": "thanks",
}


def export_download_filename(video_id: str, export_type: str) -> str:
    """Build a human-readable export filename for Content-Disposition."""
    safe_id = _sanitize_video_id(video_id)
    if export_type == "json":
        return f"{EXPORT_PREFIX}_{safe_id}.json"
    if export_type == "csv":
        return f"{EXPORT_PREFIX}_{safe_id}.csv"
    suffix = _MARKDOWN_SUFFIX.get(export_type, export_type.removeprefix("markdown-"))
    return f"{EXPORT_PREFIX}_{safe_id}_{suffix}.md"


def _sanitize_video_id(video_id: str) -> str:
    """Keep YouTube-like IDs intact; strip path separators and control chars."""
    cleaned = "".join(ch for ch in video_id if ch not in '\\/:*?"<>|\0')
    return cleaned or "unknown"
