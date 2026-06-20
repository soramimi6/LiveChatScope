import logging
from datetime import datetime, timezone

from app.db import get_connection
from app.services.analysis.params import load_analysis_defaults, save_analysis_params_snapshot
from app.services.analysis.stage0 import run_stage0_normalize
from app.services.analysis.stage1 import run_stage1_basic
from app.services.analysis.stage3 import run_stage3_super_chat

logger = logging.getLogger(__name__)

STAGE_LABELS: dict[int, str] = {
    0: "正規化",
    1: "基本集計",
    3: "スパチャ集計",
}


def stage_label(stage: int | None) -> str | None:
    if stage is None:
        return None
    return STAGE_LABELS.get(stage)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _set_analysis_progress(
    conn,
    video_id: str,
    *,
    status: str,
    stage: int | None = None,
) -> None:
    conn.execute(
        """
        UPDATE videos
        SET analysis_status = ?,
            analysis_stage = ?,
            updated_at = ?
        WHERE video_id = ?
        """,
        (status, stage, _utc_now(), video_id),
    )


def _mark_analysis_failed(video_id: str, exc: Exception) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET analysis_status = 'failed',
                analysis_error_code = 'ANALYSIS_FAILED',
                analysis_error_message = ?,
                updated_at = ?
            WHERE video_id = ?
            """,
            (str(exc), _utc_now(), video_id),
        )
        conn.commit()


def run_analysis_pipeline(video_id: str) -> None:
    """Run Phase A analysis (Stage 0, 1, 3) and set analysis_status=partial."""
    params = load_analysis_defaults()

    try:
        with get_connection() as conn:
            _set_analysis_progress(conn, video_id, status="running", stage=0)
            save_analysis_params_snapshot(conn, video_id, params)
            conn.commit()

        with get_connection() as conn:
            run_stage0_normalize(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=1)
            conn.commit()

        with get_connection() as conn:
            run_stage1_basic(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=3)
            conn.commit()

        with get_connection() as conn:
            run_stage3_super_chat(conn, video_id, params)
            conn.execute(
                """
                UPDATE videos
                SET analysis_status = 'partial',
                    analysis_stage = 3,
                    analyzed_at = ?,
                    updated_at = ?,
                    analysis_error_code = NULL,
                    analysis_error_message = NULL
                WHERE video_id = ?
                """,
                (_utc_now(), _utc_now(), video_id),
            )
            conn.commit()
    except Exception as exc:
        logger.exception("Analysis pipeline failed for %s", video_id)
        _mark_analysis_failed(video_id, exc)
        raise
