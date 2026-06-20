import math
from datetime import datetime, timezone

from fastapi import HTTPException

from app.db import get_connection


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def format_time_text(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def jump_url(video_id: str, seconds: float) -> str:
    return f"https://www.youtube.com/watch?v={video_id}&t={math.floor(seconds)}s"


def get_video_row(video_id: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM videos WHERE video_id = ?", (video_id,)).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "動画が見つかりません"}},
        )
    return row


def require_fetch_ready(row) -> None:
    if row["fetch_status"] != "fetched":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_NOT_READY",
                    "message": "チャット取得が完了していません",
                }
            },
        )


def require_analysis_ready(row) -> None:
    if row["fetch_status"] != "fetched":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_NOT_READY",
                    "message": "分析が完了していません",
                }
            },
        )
    if row["analysis_status"] in {"pending", "running"}:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_NOT_READY",
                    "message": "分析が完了していません",
                }
            },
        )


def is_analysis_complete(analysis_status: str) -> bool:
    return analysis_status == "complete"
