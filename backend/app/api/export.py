import csv
import io
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.common import (
    format_time_text,
    get_video_row,
    is_analysis_complete,
    jump_url,
    require_analysis_ready,
)
from app.api.export_names import export_download_filename
from app.db import get_connection
from app.services.analysis.stage8 import (
    _build_markdown_clips,
    _build_markdown_summary,
    _build_markdown_thanks,
)

router = APIRouter(prefix="/videos", tags=["export"])

EXPORT_VERSION = 2

VALID_EXPORT_TYPES = {
    "json",
    "csv",
    "markdown-summary",
    "markdown-clips",
    "markdown-thanks",
}


def _content_disposition(filename: str, download: bool) -> str | None:
    if not download:
        return None
    return f'attachment; filename="{filename}"'


@router.get("/{video_id}/export/{export_type}")
def export_video(
    video_id: str,
    export_type: str,
    download: bool = Query(default=False),
):
    if export_type not in VALID_EXPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_EXPORT_TYPE",
                    "message": f"未対応の export type です: {export_type}",
                }
            },
        )

    row = get_video_row(video_id)
    require_analysis_ready(row)

    if export_type == "json":
        body = _build_json_export(video_id, row)
        headers = {}
        disposition = _content_disposition(export_download_filename(video_id, "json"), download)
        if disposition:
            headers["Content-Disposition"] = disposition
        return Response(content=body, media_type="application/json", headers=headers)

    if export_type == "csv":
        body = _build_csv_export(video_id)
        headers = {}
        disposition = _content_disposition(export_download_filename(video_id, "csv"), download)
        if disposition:
            headers["Content-Disposition"] = disposition
        return Response(content=body, media_type="text/csv; charset=utf-8", headers=headers)

    if export_type == "markdown-summary":
        title = row["title"] or video_id
        with get_connection() as conn:
            summary_row = conn.execute(
                "SELECT summary_json FROM stream_summary WHERE video_id = ?",
                (video_id,),
            ).fetchone()
            body = _build_markdown_summary(conn, video_id, title, row, summary_row)
        if row["analysis_status"] != "complete":
            body = (
                body.rstrip()
                + "\n\n> A+ 分析（話題・ハイライト等）は未完了のため、このエクスポートには含まれていません。\n"
            )
    elif export_type == "markdown-clips":
        if row["analysis_status"] == "complete":
            title = row["title"] or video_id
            with get_connection() as conn:
                body = _build_markdown_clips(conn, video_id, title)
        else:
            body = _build_markdown_clips_stub(video_id, row)
    else:
        if row["analysis_status"] == "complete":
            title = row["title"] or video_id
            with get_connection() as conn:
                body = _build_markdown_thanks(conn, video_id, title)
        else:
            body = _build_markdown_thanks_stub(video_id, row)

    headers = {}
    disposition = _content_disposition(
        export_download_filename(video_id, export_type), download
    )
    if disposition:
        headers["Content-Disposition"] = disposition
    return Response(content=body, media_type="text/markdown; charset=utf-8", headers=headers)


def _build_json_export(video_id: str, row) -> str:
    with get_connection() as conn:
        density = [
            {"bucket_start_sec": b["bucket_start_sec"], "count": b["count"]}
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
        authors = [
            {
                "author_id": a["author_id"],
                "author_name": a["author_name"],
                "message_count": a["message_count"],
                "rank": a["rank"],
            }
            for a in conn.execute(
                """
                SELECT author_id, author_name, message_count, rank
                FROM author_stats
                WHERE video_id = ?
                ORDER BY rank ASC
                """,
                (video_id,),
            ).fetchall()
        ]
        super_chats = [
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
                """
                SELECT time_in_seconds, author_name, amount, currency, text
                FROM super_chat_events
                WHERE video_id = ?
                ORDER BY time_in_seconds ASC
                """,
                (video_id,),
            ).fetchall()
        ]
        messages = [
            {
                "message_id": msg["message_id"],
                "time_in_seconds": msg["time_in_seconds"],
                "time_text": format_time_text(msg["time_in_seconds"] or 0.0),
                "author_id": msg["author_id"],
                "author_name": msg["author_name"],
                "message_type": msg["message_type"],
                "text": msg["text"],
                "super_chat_amount": msg["super_chat_amount"],
                "super_chat_currency": msg["super_chat_currency"],
                "jump_url": jump_url(video_id, msg["time_in_seconds"] or 0.0),
            }
            for msg in conn.execute(
                """
                SELECT message_id, time_in_seconds, author_id, author_name,
                       message_type, text, super_chat_amount, super_chat_currency
                FROM messages
                WHERE video_id = ?
                ORDER BY time_in_seconds ASC, id ASC
                """,
                (video_id,),
            ).fetchall()
        ]

        highlights: list[dict] = []
        topics: list[dict] = []
        keywords: list[dict] = []
        low_activity: list[dict] = []
        stream_summary = None

        if is_analysis_complete(row["analysis_status"]):
            highlights = [
                {
                    "rank": hl["rank"],
                    "time_in_seconds": hl["time_in_seconds"],
                    "time_text": format_time_text(hl["time_in_seconds"]),
                    "score": hl["score"],
                    "clip_start_sec": hl["clip_start_sec"],
                    "clip_end_sec": hl["clip_end_sec"],
                    "jump_url": jump_url(video_id, hl["time_in_seconds"]),
                }
                for hl in conn.execute(
                    """
                    SELECT rank, time_in_seconds, score, clip_start_sec, clip_end_sec
                    FROM highlights
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    """,
                    (video_id,),
                ).fetchall()
            ]
            topics = [
                {
                    "block_id": tb["block_id"],
                    "block_index": tb["block_index"],
                    "start_sec": tb["start_sec"],
                    "end_sec": tb["end_sec"],
                    "label": tb["label"],
                    "message_count": tb["message_count"],
                    "unique_authors": tb["unique_authors"],
                    "super_chat_total": tb["super_chat_total"],
                    "super_chat_currency": tb["super_chat_currency"],
                    "jump_url": jump_url(video_id, tb["start_sec"]),
                }
                for tb in conn.execute(
                    """
                    SELECT block_id, block_index, start_sec, end_sec, label,
                           message_count, unique_authors, super_chat_total, super_chat_currency
                    FROM topic_blocks
                    WHERE video_id = ?
                    ORDER BY block_index ASC
                    """,
                    (video_id,),
                ).fetchall()
            ]
            keywords = [
                {"token": kw["token"], "count": kw["count"], "rank": kw["rank"]}
                for kw in conn.execute(
                    """
                    SELECT token, count, rank
                    FROM keyword_stats
                    WHERE video_id = ?
                    ORDER BY rank ASC
                    """,
                    (video_id,),
                ).fetchall()
            ]
            low_activity = [
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
            summary_row = conn.execute(
                "SELECT summary_json FROM stream_summary WHERE video_id = ?",
                (video_id,),
            ).fetchone()
            if summary_row is not None:
                stream_summary = json.loads(summary_row["summary_json"])

    payload: dict = {
        "export_version": EXPORT_VERSION,
        "video_id": video_id,
        "title": row["title"],
        "channel_name": row["channel_name"],
        "duration_seconds": row["duration_seconds"],
        "message_count": row["message_count"],
        "analysis_status": row["analysis_status"],
        "analyzed_at": row["analyzed_at"],
        "density": density,
        "authors": authors,
        "super_chats": super_chats,
        "messages": messages,
        "highlights": highlights,
        "topics": topics,
        "keywords": keywords,
        "low_activity": low_activity,
    }
    if stream_summary is not None:
        payload["stream_summary"] = stream_summary

    return json.dumps(payload, ensure_ascii=False, indent=2)


def _build_csv_export(video_id: str) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["time_in_seconds", "time_text", "author_name", "message_type", "text", "jump_url"]
    )
    with get_connection() as conn:
        for msg in conn.execute(
            """
            SELECT time_in_seconds, author_name, message_type, text
            FROM messages
            WHERE video_id = ?
            ORDER BY time_in_seconds ASC, id ASC
            """,
            (video_id,),
        ).fetchall():
            time_sec = msg["time_in_seconds"] or 0.0
            writer.writerow(
                [
                    time_sec,
                    format_time_text(time_sec),
                    msg["author_name"],
                    msg["message_type"],
                    msg["text"],
                    jump_url(video_id, time_sec),
                ]
            )
    return buffer.getvalue()


def _build_markdown_clips_stub(video_id: str, row) -> str:
    title = row["title"] or video_id
    return "\n".join(
        [
            f"# {title} — 切り抜き候補",
            "",
            "ハイライト分析（A+）が未完了のため、切り抜き候補データはありません。",
            "",
            f"動画: https://www.youtube.com/watch?v={video_id}",
            "",
        ]
    )


def _build_markdown_thanks_stub(video_id: str, row) -> str:
    title = row["title"] or video_id
    return "\n".join(
        [
            f"# {title} — スパチャ感謝文",
            "",
            "話題ブロック分析（A+）が未完了のため、感謝文テンプレートは生成できません。",
            "",
            f"動画: https://www.youtube.com/watch?v={video_id}",
            "",
        ]
    )
