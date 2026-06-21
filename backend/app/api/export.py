import csv
import io
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.common import format_time_text, get_video_row, jump_url, require_analysis_ready
from app.db import get_connection
from app.services.analysis.stage8 import _build_markdown_clips, _build_markdown_thanks

router = APIRouter(prefix="/videos", tags=["export"])

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
        disposition = _content_disposition(f"{video_id}.json", download)
        if disposition:
            headers["Content-Disposition"] = disposition
        return Response(content=body, media_type="application/json", headers=headers)

    if export_type == "csv":
        body = _build_csv_export(video_id)
        headers = {}
        disposition = _content_disposition(f"{video_id}.csv", download)
        if disposition:
            headers["Content-Disposition"] = disposition
        return Response(content=body, media_type="text/csv; charset=utf-8", headers=headers)

    if export_type == "markdown-summary":
        body = _build_markdown_summary(video_id, row)
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
    disposition = _content_disposition(f"{video_id}-{export_type}.md", download)
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
                "author_name": sc["author_name"],
                "amount": sc["amount"],
                "currency": sc["currency"],
                "message": sc["text"],
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

    payload = {
        "video_id": video_id,
        "title": row["title"],
        "channel_name": row["channel_name"],
        "message_count": row["message_count"],
        "analysis_status": row["analysis_status"],
        "density": density,
        "authors": authors,
        "super_chats": super_chats,
    }
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


def _build_markdown_summary(video_id: str, row) -> str:
    title = row["title"] or video_id
    lines = [
        f"# {title} — 振り返りサマリー",
        "",
        f"- 動画 ID: `{video_id}`",
        f"- チャンネル: {row['channel_name'] or '—'}",
        f"- メッセージ数: {row['message_count']}",
        f"- 分析状態: {row['analysis_status']}",
        "",
    ]

    with get_connection() as conn:
        peak = conn.execute(
            """
            SELECT bucket_start_sec, count
            FROM density_buckets
            WHERE video_id = ?
            ORDER BY count DESC, bucket_start_sec ASC
            LIMIT 1
            """,
            (video_id,),
        ).fetchone()
        if peak:
            lines.extend(
                [
                    "## ピーク",
                    "",
                    f"- 時刻: {format_time_text(peak['bucket_start_sec'])}",
                    f"- 密度: {peak['count']} msg/min",
                    f"- [ジャンプ]({jump_url(video_id, peak['bucket_start_sec'])})",
                    "",
                ]
            )

        sc_rows = conn.execute(
            """
            SELECT currency, total_amount, count
            FROM super_chat_summary
            WHERE video_id = ?
            ORDER BY total_amount DESC
            """,
            (video_id,),
        ).fetchall()
        if sc_rows:
            lines.extend(["## スパチャ合計", ""])
            for sc in sc_rows:
                lines.append(f"- {sc['currency']}: {sc['total_amount']} ({sc['count']} 件)")
            lines.append("")

    if row["analysis_status"] != "complete":
        lines.extend(
            [
                "> A+ 分析（話題・ハイライト等）は未完了のため、このエクスポートには含まれていません。",
                "",
            ]
        )

    return "\n".join(lines)


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
