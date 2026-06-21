import logging
from datetime import datetime, timezone

from app.db import get_connection
from app.services.analysis.message_filter import (
    default_display_filter,
    serialize_display_filter,
)
from app.services.analysis.params import load_analysis_defaults, save_analysis_params_snapshot
from app.services.analysis.stage0 import run_stage0_normalize
from app.services.analysis.stage1 import run_stage1_basic
from app.services.analysis.stage2 import run_stage2_highlights
from app.services.analysis.stage3 import run_stage3_super_chat
from app.services.analysis.stage4 import run_stage4_keywords
from app.services.analysis.stage5 import run_stage5_topic_blocks
from app.services.analysis.stage6a import run_stage6a_topic_transitions
from app.services.analysis.stage6b import run_stage6b_topic_authors
from app.services.analysis.stage6c import run_stage6c_low_activity
from app.services.analysis.stage7 import run_stage7_summary
from app.services.analysis.stage8 import run_stage8_exports

logger = logging.getLogger(__name__)

STAGE_LABELS: dict[int, str] = {
    0: "正規化",
    1: "基本集計",
    2: "盛り上がり検出",
    3: "スパチャ集計",
    4: "キーワード解析",
    5: "話題ブロック",
    6: "話題派生集計",
    7: "振り返りサマリー",
    8: "エクスポート生成",
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
    """Run Phase A+ analysis (Stage 0–8) and set analysis_status=complete."""
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
            _set_analysis_progress(conn, video_id, status="running", stage=2)
            conn.commit()

        with get_connection() as conn:
            run_stage2_highlights(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=4)
            conn.commit()

        with get_connection() as conn:
            run_stage4_keywords(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=5)
            conn.commit()

        with get_connection() as conn:
            run_stage5_topic_blocks(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=6)
            conn.commit()

        with get_connection() as conn:
            run_stage6a_topic_transitions(conn, video_id, params)
            run_stage6b_topic_authors(conn, video_id, params)
            run_stage6c_low_activity(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=7)
            conn.commit()

        with get_connection() as conn:
            run_stage7_summary(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=8)
            conn.commit()

        with get_connection() as conn:
            run_stage8_exports(conn, video_id, params)
            filter_row = conn.execute(
                "SELECT display_filter_json FROM videos WHERE video_id = ?",
                (video_id,),
            ).fetchone()
            if filter_row is not None and filter_row["display_filter_json"] is None:
                conn.execute(
                    """
                    UPDATE videos
                    SET display_filter_json = ?
                    WHERE video_id = ?
                    """,
                    (
                        serialize_display_filter(default_display_filter(params)),
                        video_id,
                    ),
                )
            conn.execute(
                """
                UPDATE videos
                SET analysis_status = 'complete',
                    analysis_stage = 8,
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
