from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.common import (
    format_time_text,
    get_video_row,
    is_analysis_complete,
    jump_url,
    require_analysis_ready,
    utc_now_iso,
)
from app.services.analysis.message_filter import serialize_display_filter
from app.services.analysis.params import load_analysis_defaults
from app.services.analysis.refilter_pipeline import run_refilter_pipeline
from app.services.user_settings import save_user_display_filter_defaults
from app.services.author_profile import build_author_profile
from app.services.membership_api import (
    author_membership_flags,
    author_membership_profile,
    build_membership_events,
    build_membership_gifts,
)
from app.services.super_chat_status import compute_super_chat_status
from app.db import get_connection

router = APIRouter(prefix="/videos", tags=["analysis"])


class DisplayFilterConfig(BaseModel):
    exclude_stamp_only: bool = True
    exclude_ng_keywords: bool = False
    ng_keywords: list[str] = Field(default_factory=list)
    auto_ng_keywords: list[str] = Field(default_factory=list)
    dismissed_auto_ng_keywords: list[str] = Field(default_factory=list)
    excluded_author_ids: list[str] = Field(default_factory=list)


class RefilterRequest(BaseModel):
    display_filter: DisplayFilterConfig


class RefilterResponse(BaseModel):
    video_id: str
    analysis_status: str
    status_url: str


@router.post("/{video_id}/analysis/refilter", status_code=202, response_model=RefilterResponse)
def refilter_analysis(
    video_id: str,
    payload: RefilterRequest,
    background_tasks: BackgroundTasks,
):
    row = get_video_row(video_id)
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
    if row["analysis_status"] == "running":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_RUNNING",
                    "message": "分析の更新中です",
                }
            },
        )
    if row["analysis_status"] != "complete":
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_NOT_READY",
                    "message": "初回分析が完了していません",
                }
            },
        )

    filter_json = serialize_display_filter(payload.display_filter.model_dump())
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE videos
            SET display_filter_json = ?,
                analysis_status = 'running',
                analysis_stage = 4,
                analysis_error_code = NULL,
                analysis_error_message = NULL,
                updated_at = ?
            WHERE video_id = ?
            """,
            (filter_json, utc_now_iso(), video_id),
        )
        save_user_display_filter_defaults(conn, payload.display_filter.model_dump())
        conn.commit()

    background_tasks.add_task(run_refilter_pipeline, video_id)

    return RefilterResponse(
        video_id=video_id,
        analysis_status="running",
        status_url=f"/api/v1/videos/{video_id}/status",
    )


def _summary_preview_limits() -> tuple[int, int, int]:
    stage7 = load_analysis_defaults().get("stage7", {})
    return (
        int(stage7.get("summary_highlights_n", 5)),
        int(stage7.get("summary_keywords_n", 10)),
        int(stage7.get("summary_topic_preview_n", 6)),
    )


def _count_unique_authors(conn, video_id: str) -> int:
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT COALESCE(author_id, 'unknown:' || COALESCE(author_name, ''))) AS cnt
        FROM messages
        WHERE video_id = ?
        """,
        (video_id,),
    ).fetchone()
    return int(row["cnt"] or 0)


def _super_chat_totals_for_range(
    conn,
    video_id: str,
    start_sec: float,
    end_sec: float,
) -> list[dict]:
    """Aggregate super_chat_events within [start_sec, end_sec) grouped by currency."""
    return [
        {
            "currency": row["currency"],
            "amount": float(row["amount"] or 0),
            "count": int(row["count"] or 0),
        }
        for row in conn.execute(
            """
            SELECT currency, SUM(amount) AS amount, COUNT(*) AS count
            FROM super_chat_events
            WHERE video_id = ?
              AND time_in_seconds >= ?
              AND time_in_seconds < ?
            GROUP BY currency
            ORDER BY amount DESC
            """,
            (video_id, start_sec, end_sec),
        ).fetchall()
    ]


@router.get("/{video_id}/summary")
def get_summary(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    with get_connection() as conn:
        unique_authors = _count_unique_authors(conn, video_id)

        peak_row = conn.execute(
            """
            SELECT bucket_start_sec, count
            FROM density_buckets
            WHERE video_id = ?
            ORDER BY count DESC, bucket_start_sec ASC
            LIMIT 1
            """,
            (video_id,),
        ).fetchone()

        peak = None
        if peak_row is not None:
            start_sec = peak_row["bucket_start_sec"]
            peak = {
                "time_in_seconds": float(start_sec),
                "time_text": format_time_text(start_sec),
                "density": peak_row["count"],
                "jump_url": jump_url(video_id, start_sec),
            }

        super_chat_rows = conn.execute(
            """
            SELECT currency, total_amount, count
            FROM super_chat_summary
            WHERE video_id = ?
            ORDER BY total_amount DESC
            """,
            (video_id,),
        ).fetchall()
        super_chat_total = [
            {
                "currency": sc["currency"],
                "amount": sc["total_amount"],
                "count": sc["count"],
            }
            for sc in super_chat_rows
        ]

        top_highlights: list[dict] = []
        top_keywords: list[dict] = []
        topic_blocks_preview: list[dict] = []
        topic_block_count = 0

        if is_analysis_complete(row["analysis_status"]):
            highlights_n, keywords_n, topics_n = _summary_preview_limits()
            top_highlights = [
                {
                    "rank": hl["rank"],
                    "time_in_seconds": hl["time_in_seconds"],
                    "time_text": format_time_text(hl["time_in_seconds"]),
                    "score": hl["score"],
                    "jump_url": jump_url(video_id, hl["time_in_seconds"]),
                }
                for hl in conn.execute(
                    """
                    SELECT rank, time_in_seconds, score
                    FROM highlights
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    LIMIT ?
                    """,
                    (video_id, highlights_n),
                ).fetchall()
            ]

            top_keywords = [
                {
                    "token": kw["token"],
                    "count": kw["count"],
                    "rank": kw["rank"],
                }
                for kw in conn.execute(
                    """
                    SELECT token, count, rank
                    FROM keyword_stats
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    LIMIT ?
                    """,
                    (video_id, keywords_n),
                ).fetchall()
            ]

            topic_rows = conn.execute(
                """
                SELECT block_id, block_index, start_sec, end_sec, label,
                       message_count, unique_authors
                FROM topic_blocks
                WHERE video_id = ?
                ORDER BY block_index ASC
                LIMIT ?
                """,
                (video_id, topics_n),
            ).fetchall()
            topic_block_count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM topic_blocks WHERE video_id = ?",
                (video_id,),
            ).fetchone()["cnt"]

            topic_blocks_preview = [
                {
                    "block_id": tb["block_id"],
                    "block_index": tb["block_index"],
                    "start_sec": tb["start_sec"],
                    "end_sec": tb["end_sec"],
                    "label": tb["label"],
                    "label_note": "チャット上の推定話題",
                    "message_count": tb["message_count"],
                    "unique_authors": tb["unique_authors"],
                    "jump_url": jump_url(video_id, tb["start_sec"]),
                }
                for tb in topic_rows
            ]

    generated_at = row["analyzed_at"] or utc_now_iso()

    return {
        "video_id": video_id,
        "message_count": row["message_count"],
        "unique_authors": unique_authors,
        "peak": peak,
        "super_chat_total": super_chat_total,
        "topic_block_count": topic_block_count,
        "top_highlights": top_highlights,
        "top_keywords": top_keywords,
        "topic_blocks_preview": topic_blocks_preview,
        "generated_at": generated_at,
    }


@router.get("/{video_id}/density")
def get_density(
    video_id: str,
    bucket_sec: int = Query(default=60, ge=1),
):
    _ = bucket_sec
    row = get_video_row(video_id)
    require_analysis_ready(row)

    with get_connection() as conn:
        buckets = [
            {
                "bucket_start_sec": b["bucket_start_sec"],
                "count": b["count"],
            }
            for b in conn.execute(
                """
                SELECT bucket_start_sec, count
                FROM density_buckets
                WHERE video_id = ?
                ORDER BY bucket_start_sec ASC
                """,
                (video_id,),
            ).fetchall()
        ]
        avg_row = conn.execute(
            "SELECT AVG(count) AS avg_count FROM density_buckets WHERE video_id = ?",
            (video_id,),
        ).fetchone()

    average_count = float(avg_row["avg_count"]) if avg_row["avg_count"] is not None else 0.0

    return {
        "video_id": video_id,
        "bucket_sec": 60,
        "buckets": buckets,
        "average_count": round(average_count, 1),
    }


@router.get("/{video_id}/highlights")
def get_highlights(
    video_id: str,
    limit: int = Query(default=10, ge=1, le=100),
):
    from app.services.highlight_context import build_highlight_context

    row = get_video_row(video_id)
    require_analysis_ready(row)

    items: list[dict] = []
    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            highlight_rows = conn.execute(
                """
                SELECT rank, time_in_seconds, score, clip_start_sec, clip_end_sec
                FROM highlights
                WHERE video_id = ?
                ORDER BY rank ASC
                LIMIT ?
                """,
                (video_id, limit),
            ).fetchall()

            items = []
            for hl in highlight_rows:
                context = build_highlight_context(
                    conn,
                    video_id,
                    int(hl["clip_start_sec"]),
                    int(hl["clip_end_sec"]),
                )
                items.append(
                    {
                        "rank": hl["rank"],
                        "time_in_seconds": hl["time_in_seconds"],
                        "time_text": format_time_text(hl["time_in_seconds"]),
                        "score": hl["score"],
                        "clip_start_sec": hl["clip_start_sec"],
                        "clip_end_sec": hl["clip_end_sec"],
                        "jump_url": jump_url(video_id, hl["time_in_seconds"]),
                        "context": context,
                    }
                )

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/low-activity")
def get_low_activity(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    items: list[dict] = []
    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            items = [
                {
                    "start_sec": seg["start_sec"],
                    "end_sec": seg["end_sec"],
                    "duration_sec": seg["duration_sec"],
                    "avg_density": seg["avg_density"],
                    "start_jump_url": jump_url(video_id, seg["start_sec"]),
                }
                for seg in conn.execute(
                    """
                    SELECT start_sec, end_sec, duration_sec, avg_density
                    FROM low_activity_segments
                    WHERE video_id = ?
                    ORDER BY start_sec ASC
                    """,
                    (video_id,),
                ).fetchall()
            ]

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/topics")
def get_topics(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    items: list[dict] = []
    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            for tb in conn.execute(
                """
                SELECT block_id, block_index, start_sec, end_sec, label,
                       message_count, unique_authors, super_chat_total, super_chat_currency
                FROM topic_blocks
                WHERE video_id = ?
                ORDER BY block_index ASC
                """,
                (video_id,),
            ).fetchall():
                sc_total = _super_chat_totals_for_range(
                    conn, video_id, tb["start_sec"], tb["end_sec"]
                )
                items.append(
                    {
                        "block_id": tb["block_id"],
                        "block_index": tb["block_index"],
                        "start_sec": tb["start_sec"],
                        "end_sec": tb["end_sec"],
                        "label": tb["label"],
                        "label_note": "チャット上の推定話題",
                        "message_count": tb["message_count"],
                        "unique_authors": tb["unique_authors"],
                        "super_chat_total": sc_total,
                        "jump_url": jump_url(video_id, tb["start_sec"]),
                    }
                )

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/topics/transitions")
def get_topic_transitions(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    items: list[dict] = []
    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            items = [
                {
                    "from_block_index": tr["from_block_index"],
                    "from_label": tr["from_label"],
                    "to_block_index": tr["to_block_index"],
                    "to_label": tr["to_label"],
                    "at_sec": tr["at_sec"],
                }
                for tr in conn.execute(
                    """
                    SELECT from_block_index, from_label, to_block_index, to_label, at_sec
                    FROM topic_transitions
                    WHERE video_id = ?
                    ORDER BY at_sec ASC
                    """,
                    (video_id,),
                ).fetchall()
            ]

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/keywords/bursts")
def get_keyword_bursts(
    video_id: str,
    limit: int = Query(default=20, ge=1, le=200),
):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    items: list[dict] = []
    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            items = [
                {
                    "rank": burst["rank"],
                    "token": burst["token"],
                    "peak_bucket_start_sec": burst["peak_bucket_start_sec"],
                    "time_text": format_time_text(burst["peak_bucket_start_sec"]),
                    "peak_count": burst["peak_count"],
                    "baseline_count": burst["baseline_count"],
                    "burst_ratio": burst["burst_ratio"],
                    "jump_url": jump_url(video_id, burst["peak_bucket_start_sec"]),
                }
                for burst in conn.execute(
                    """
                    SELECT rank, token, peak_bucket_start_sec, peak_count,
                           baseline_count, burst_ratio
                    FROM keyword_bursts
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    LIMIT ?
                    """,
                    (video_id, limit),
                ).fetchall()
            ]

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/keywords")
def get_keywords(
    video_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    bucket_sec: int | None = Query(default=None, ge=1),
):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    overall: list[dict] = []
    timeline: list[dict] | None = None

    if is_analysis_complete(row["analysis_status"]):
        with get_connection() as conn:
            overall = [
                {"token": kw["token"], "count": kw["count"], "rank": kw["rank"]}
                for kw in conn.execute(
                    """
                    SELECT token, count, rank
                    FROM keyword_stats
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    LIMIT ?
                    """,
                    (video_id, limit),
                ).fetchall()
            ]

            if bucket_sec is not None:
                timeline_rows = conn.execute(
                    """
                    SELECT bucket_start_sec, token, count
                    FROM keyword_timeline
                    WHERE video_id = ?
                    ORDER BY bucket_start_sec ASC, count DESC
                    """,
                    (video_id,),
                ).fetchall()
                buckets: dict[int, list[dict]] = {}
                for tl in timeline_rows:
                    start = tl["bucket_start_sec"]
                    buckets.setdefault(start, []).append(
                        {"token": tl["token"], "count": tl["count"]}
                    )
                timeline = [
                    {"bucket_start_sec": start, "tokens": tokens}
                    for start, tokens in sorted(buckets.items())
                ]

    result: dict = {"video_id": video_id, "overall": overall}
    if timeline is not None:
        result["timeline"] = timeline
    return result


@router.get("/{video_id}/super-chats")
def get_super_chats(
    video_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    currency: str | None = Query(default=None, min_length=1, max_length=8),
):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    offset = (page - 1) * page_size
    where_clause = "WHERE video_id = ?"
    params: list = [video_id]
    if currency is not None:
        where_clause += " AND currency = ?"
        params.append(currency.upper())

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) AS cnt FROM super_chat_events {where_clause}",
            params,
        ).fetchone()["cnt"]
        items = [
            {
                "time_in_seconds": sc["time_in_seconds"],
                "time_text": format_time_text(sc["time_in_seconds"]),
                "author_name": sc["author_name"],
                "amount": sc["amount"],
                "currency": sc["currency"],
                "message": sc["text"],
                "jump_url": jump_url(video_id, sc["time_in_seconds"]),
            }
            for sc in conn.execute(
                f"""
                SELECT time_in_seconds, author_name, amount, currency, text
                FROM super_chat_events
                {where_clause}
                ORDER BY time_in_seconds ASC
                LIMIT ? OFFSET ?
                """,
                [*params, page_size, offset],
            ).fetchall()
        ]

    return {
        "video_id": video_id,
        "currency": currency.upper() if currency else None,
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/{video_id}/super-chats/summary")
def get_super_chats_summary(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    with get_connection() as conn:
        by_currency = [
            {
                "currency": sc["currency"],
                "total_amount": sc["total_amount"],
                "count": sc["count"],
            }
            for sc in conn.execute(
                """
                SELECT currency, total_amount, count
                FROM super_chat_summary
                WHERE video_id = ?
                ORDER BY total_amount DESC
                """,
                (video_id,),
            ).fetchall()
        ]

        bucket_rows = conn.execute(
            """
            SELECT bucket_start_sec, count, total_amount, currency
            FROM super_chat_buckets
            WHERE video_id = ?
            ORDER BY bucket_start_sec ASC
            """,
            (video_id,),
        ).fetchall()

        status_fields = compute_super_chat_status(conn, video_id)

    timeline_map: dict[int, dict] = {}
    for b in bucket_rows:
        start = b["bucket_start_sec"]
        entry = timeline_map.setdefault(
            start,
            {"bucket_start_sec": start, "count": 0, "amount_jpy": 0.0},
        )
        entry["count"] += b["count"]
        if b["currency"] == "JPY":
            entry["amount_jpy"] += b["total_amount"]

    timeline = sorted(timeline_map.values(), key=lambda x: x["bucket_start_sec"])

    return {
        "video_id": video_id,
        "by_currency": by_currency,
        "timeline": timeline,
        **status_fields,
    }


@router.get("/{video_id}/membership-events")
def get_membership_events(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    with get_connection() as conn:
        return build_membership_events(conn, video_id)


@router.get("/{video_id}/membership-gifts")
def get_membership_gifts(video_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    with get_connection() as conn:
        return build_membership_gifts(conn, video_id)


@router.get("/{video_id}/authors")
def get_authors(
    video_id: str,
    limit: int = Query(default=20, ge=1, le=200),
    core_only: bool = Query(default=False),
):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    query = """
        SELECT author_id, author_name, message_count, rank, is_core_regular
        FROM author_stats
        WHERE video_id = ?
    """
    params: list = [video_id]
    if core_only:
        query += " AND is_core_regular = 1"
    query += " ORDER BY rank ASC LIMIT ?"
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        items = []
        for a in rows:
            flags = author_membership_flags(conn, video_id, a["author_id"])
            items.append(
                {
                    "author_id": a["author_id"],
                    "author_name": a["author_name"],
                    "message_count": a["message_count"],
                    "rank": a["rank"],
                    "is_core_regular": bool(a["is_core_regular"]),
                    **flags,
                }
            )

    return {"video_id": video_id, "items": items}


@router.get("/{video_id}/authors/{author_id}/profile")
def get_author_profile(video_id: str, author_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    if not is_analysis_complete(row["analysis_status"]):
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ANALYSIS_NOT_READY",
                    "message": "分析が完了していません",
                }
            },
        )

    with get_connection() as conn:
        profile = build_author_profile(conn, video_id, author_id)
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "投稿者が見つかりません"}},
            )
        profile.update(author_membership_profile(conn, video_id, author_id))

    return profile


@router.get("/{video_id}/authors/by-topic/{block_id}")
def get_authors_by_topic(video_id: str, block_id: str):
    row = get_video_row(video_id)
    require_analysis_ready(row)

    if not is_analysis_complete(row["analysis_status"]):
        return {"block_id": block_id, "items": []}

    with get_connection() as conn:
        block = conn.execute(
            "SELECT block_id FROM topic_blocks WHERE video_id = ? AND block_id = ?",
            (video_id, block_id),
        ).fetchone()
        if block is None:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "話題ブロックが見つかりません"}},
            )
        items = [
            {
                "author_name": a["author_name"],
                "message_count": a["message_count"],
                "rank": a["rank"],
            }
            for a in conn.execute(
                """
                SELECT author_name, message_count, rank
                FROM topic_author_stats
                WHERE block_id = ?
                ORDER BY rank ASC
                """,
                (block_id,),
            ).fetchall()
        ]

    return {"block_id": block_id, "items": items}
