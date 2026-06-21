from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.api.common import get_video_row
from app.db import get_connection
from app.services.analysis.message_filter import parse_display_filter
from app.services.analysis.params import load_analysis_defaults
from app.services.analysis.pipeline import run_analysis_pipeline, stage_label
from app.services.fetch_worker import fetch_chat_replay
from app.services.job_recovery import (
    is_job_stale,
    recover_stale_video_job,
    reset_video_for_analysis_retry,
    reset_video_for_full_retry,
)
from app.services.url_parser import InvalidYouTubeURLError, extract_video_id

router = APIRouter(prefix="/videos", tags=["videos"])


class CreateVideoRequest(BaseModel):
    url: str = Field(..., min_length=10)


class CreateVideoResponse(BaseModel):
    video_id: str
    fetch_status: str
    analysis_status: str
    status_url: str


class VideoStatusResponse(BaseModel):
    video_id: str
    fetch_status: str
    analysis_status: str
    progress: dict
    error: dict | None = None


class RetryVideoResponse(BaseModel):
    video_id: str
    retry_mode: str
    fetch_status: str
    analysis_status: str
    status_url: str


class VideoMetaResponse(BaseModel):
    video_id: str
    title: str | None
    channel_name: str | None
    duration_seconds: float | None
    message_count: int
    fetch_status: str
    analysis_status: str
    fetched_at: str | None
    analyzed_at: str | None
    display_filter: dict


def _run_fetch_pipeline(video_id: str, source_url: str) -> None:
    fetch_chat_replay(video_id, source_url)
    run_analysis_pipeline(video_id)


def _is_actively_processing(row) -> bool:
    if row is None or is_job_stale(row["updated_at"]):
        return False
    if row["fetch_status"] in {"pending", "fetching"}:
        return True
    return row["analysis_status"] == "running"


@router.post("", status_code=202, response_model=CreateVideoResponse)
def create_video(payload: CreateVideoRequest, background_tasks: BackgroundTasks):
    try:
        video_id = extract_video_id(payload.url)
    except InvalidYouTubeURLError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_URL", "message": str(exc)}},
        ) from exc

    source_url = payload.url.strip()

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT fetch_status, analysis_status, updated_at FROM videos WHERE video_id = ?",
            (video_id,),
        ).fetchone()
        if _is_actively_processing(existing):
            raise HTTPException(
                status_code=409,
                detail={"error": {"code": "ALREADY_PROCESSING", "message": "処理中です"}},
            )

        conn.execute(
            """
            INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
            VALUES (?, ?, 'pending', 'pending')
            ON CONFLICT(video_id) DO UPDATE SET source_url = excluded.source_url
            """,
            (video_id, source_url),
        )
        reset_video_for_full_retry(conn, video_id, source_url)
        conn.commit()

    background_tasks.add_task(_run_fetch_pipeline, video_id, source_url)

    return CreateVideoResponse(
        video_id=video_id,
        fetch_status="pending",
        analysis_status="pending",
        status_url=f"/api/v1/videos/{video_id}/status",
    )


@router.get("/{video_id}", response_model=VideoMetaResponse)
def get_video(video_id: str):
    row = get_video_row(video_id)
    params = load_analysis_defaults()
    display_filter = parse_display_filter(row["display_filter_json"], params)
    return VideoMetaResponse(
        video_id=row["video_id"],
        title=row["title"],
        channel_name=row["channel_name"],
        duration_seconds=row["duration_seconds"],
        message_count=row["message_count"],
        fetch_status=row["fetch_status"],
        analysis_status=row["analysis_status"],
        fetched_at=row["fetched_at"],
        analyzed_at=row["analyzed_at"],
        display_filter=display_filter,
    )


@router.post("/{video_id}/retry", status_code=202, response_model=RetryVideoResponse)
def retry_video(video_id: str, background_tasks: BackgroundTasks):
    recover_stale_video_job(video_id)
    row = get_video_row(video_id)

    if _is_actively_processing(row):
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "ALREADY_PROCESSING", "message": "処理中です"}},
        )

    if row["fetch_status"] == "fetched" and row["analysis_status"] == "failed":
        with get_connection() as conn:
            reset_video_for_analysis_retry(conn, video_id)
            conn.commit()
        background_tasks.add_task(run_analysis_pipeline, video_id)
        return RetryVideoResponse(
            video_id=video_id,
            retry_mode="analysis",
            fetch_status="fetched",
            analysis_status="pending",
            status_url=f"/api/v1/videos/{video_id}/status",
        )

    if row["fetch_status"] == "failed" or row["analysis_status"] == "failed":
        source_url = row["source_url"]
        if not source_url:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "MISSING_SOURCE_URL", "message": "再試行に必要な URL がありません"}},
            )
        with get_connection() as conn:
            reset_video_for_full_retry(conn, video_id, source_url)
            conn.commit()
        background_tasks.add_task(_run_fetch_pipeline, video_id, source_url)
        return RetryVideoResponse(
            video_id=video_id,
            retry_mode="full",
            fetch_status="pending",
            analysis_status="pending",
            status_url=f"/api/v1/videos/{video_id}/status",
        )

    raise HTTPException(
        status_code=400,
        detail={"error": {"code": "RETRY_NOT_APPLICABLE", "message": "再試行できる状態ではありません"}},
    )


@router.get("/{video_id}/status", response_model=VideoStatusResponse)
def get_video_status(video_id: str):
    recover_stale_video_job(video_id)
    row = get_video_row(video_id)
    error = None
    if row["fetch_status"] == "failed":
        error = {
            "code": row["fetch_error_code"] or "FETCH_FAILED",
            "message": row["fetch_error_message"] or "取得に失敗しました",
        }
    elif row["analysis_status"] == "failed":
        error = {
            "code": row["analysis_error_code"] or "ANALYSIS_FAILED",
            "message": row["analysis_error_message"] or "分析に失敗しました",
        }

    progress = {
        "messages_fetched": row["messages_fetched"],
        "messages_total_estimate": None,
        "analysis_stage": row["analysis_stage"],
        "analysis_stage_label": stage_label(row["analysis_stage"]),
    }

    return VideoStatusResponse(
        video_id=row["video_id"],
        fetch_status=row["fetch_status"],
        analysis_status=row["analysis_status"],
        progress=progress,
        error=error,
    )
