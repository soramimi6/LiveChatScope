import logging

from app.db import get_connection
from app.services.analysis.params import load_analysis_defaults
from app.services.analysis.pipeline import (
    STAGE_LABELS,
    _mark_analysis_failed,
    _set_analysis_progress,
    _utc_now,
)
from app.services.analysis.stage4 import run_stage4_keywords
from app.services.analysis.stage4b import run_stage4b_keyword_bursts
from app.services.analysis.stage5 import run_stage5_topic_blocks
from app.services.analysis.stage6a import run_stage6a_topic_transitions
from app.services.analysis.stage6b import run_stage6b_topic_authors
from app.services.analysis.stage7 import run_stage7_summary
from app.services.analysis.stage8 import run_stage8_exports

logger = logging.getLogger(__name__)

__all__ = ["STAGE_LABELS", "run_refilter_pipeline"]


def run_refilter_pipeline(video_id: str) -> None:
    """Re-run keyword/topic stages (4, 5, 6a, 6b, 7, 8) after display filter change."""
    params = load_analysis_defaults()

    try:
        with get_connection() as conn:
            run_stage4_keywords(conn, video_id, params)
            run_stage4b_keyword_bursts(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=5)
            conn.commit()

        with get_connection() as conn:
            run_stage5_topic_blocks(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=6)
            conn.commit()

        with get_connection() as conn:
            run_stage6a_topic_transitions(conn, video_id, params)
            run_stage6b_topic_authors(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=7)
            conn.commit()

        with get_connection() as conn:
            run_stage7_summary(conn, video_id, params)
            _set_analysis_progress(conn, video_id, status="running", stage=8)
            conn.commit()

        with get_connection() as conn:
            run_stage8_exports(conn, video_id, params)
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
        logger.exception("Refilter pipeline failed for %s", video_id)
        _mark_analysis_failed(video_id, exc)
        raise
