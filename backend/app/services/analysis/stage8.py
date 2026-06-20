import sqlite3

from app.services.analysis.utils import exports_dir, format_time_text, jump_url


def run_stage8_exports(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Write cached markdown export files under data/exports/{video_id}/."""
    video = conn.execute(
        "SELECT title, channel_name, message_count, analysis_status FROM videos WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    title = video["title"] or video_id

    summary_row = conn.execute(
        "SELECT summary_json FROM stream_summary WHERE video_id = ?",
        (video_id,),
    ).fetchone()

    out_dir = exports_dir(video_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "markdown-summary.md").write_text(
        _build_markdown_summary(conn, video_id, title, video, summary_row),
        encoding="utf-8",
    )
    (out_dir / "markdown-clips.md").write_text(
        _build_markdown_clips(conn, video_id, title),
        encoding="utf-8",
    )
    (out_dir / "markdown-thanks.md").write_text(
        _build_markdown_thanks(conn, video_id, title),
        encoding="utf-8",
    )


def _build_markdown_summary(conn, video_id: str, title: str, video, summary_row) -> str:
    lines = [
        f"# {title} — 振り返りサマリー",
        "",
        f"- 動画 ID: `{video_id}`",
        f"- チャンネル: {video['channel_name'] or '—'}",
        f"- メッセージ数: {video['message_count']}",
        f"- 分析状態: {video['analysis_status']}",
        "",
    ]

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

    keywords = conn.execute(
        """
        SELECT token, count, rank
        FROM keyword_stats
        WHERE video_id = ?
        ORDER BY rank ASC
        LIMIT 10
        """,
        (video_id,),
    ).fetchall()
    if keywords:
        lines.extend(["## キーワード Top 10", ""])
        for kw in keywords:
            lines.append(f"{kw['rank']}. {kw['token']} ({kw['count']})")
        lines.append("")

    topics = conn.execute(
        """
        SELECT block_index, start_sec, end_sec, label, message_count
        FROM topic_blocks
        WHERE video_id = ?
        ORDER BY block_index ASC
        LIMIT 6
        """,
        (video_id,),
    ).fetchall()
    if topics:
        lines.extend(["## 話題ブロック（推定）", ""])
        for topic in topics:
            lines.append(
                f"- [{format_time_text(topic['start_sec'])}–{format_time_text(topic['end_sec'])}] "
                f"{topic['label']} ({topic['message_count']} msg) "
                f"[ジャンプ]({jump_url(video_id, topic['start_sec'])})"
            )
        lines.append("")

    if summary_row:
        lines.extend(
            [
                "> stream_summary JSON をキャッシュ済み（API `/summary` と同等）。",
                "",
            ]
        )

    return "\n".join(lines)


def _build_markdown_clips(conn, video_id: str, title: str) -> str:
    lines = [
        f"# {title} — 切り抜き候補",
        "",
        f"動画: https://www.youtube.com/watch?v={video_id}",
        "",
    ]
    highlights = conn.execute(
        """
        SELECT rank, time_in_seconds, score, clip_start_sec, clip_end_sec
        FROM highlights
        WHERE video_id = ?
        ORDER BY rank ASC
        """,
        (video_id,),
    ).fetchall()
    if not highlights:
        lines.append("盛り上がり候補は検出されませんでした。")
        return "\n".join(lines)

    for hl in highlights:
        lines.extend(
            [
                f"## #{hl['rank']} score={hl['score']:.2f}",
                "",
                f"- ピーク: {format_time_text(hl['time_in_seconds'])} "
                f"([{int(hl['time_in_seconds'])}s]({jump_url(video_id, hl['time_in_seconds'])}))",
                f"- クリップ範囲: {format_time_text(hl['clip_start_sec'])} – "
                f"{format_time_text(hl['clip_end_sec'])}",
                "",
            ]
        )
    return "\n".join(lines)


def _build_markdown_thanks(conn, video_id: str, title: str) -> str:
    lines = [
        f"# {title} — スパチャ感謝文",
        "",
        f"動画: https://www.youtube.com/watch?v={video_id}",
        "",
    ]
    events = conn.execute(
        """
        SELECT time_in_seconds, author_name, amount, currency, text
        FROM super_chat_events
        WHERE video_id = ?
        ORDER BY time_in_seconds ASC
        """,
        (video_id,),
    ).fetchall()
    if not events:
        lines.append("スパチャはありませんでした。")
        return "\n".join(lines)

    lines.extend(["## お礼リスト", ""])
    for event in events:
        author = event["author_name"] or "匿名"
        amount = event["amount"]
        currency = event["currency"]
        time_text = format_time_text(event["time_in_seconds"])
        message = (event["text"] or "").strip()
        lines.append(f"- **{author}** — {amount} {currency} @ {time_text}")
        if message:
            lines.append(f"  - 「{message}」")
    lines.append("")
    lines.append("## テンプレート")
    lines.append("")
    lines.append("本日の配信、スパチャ・メンバーシップ等のご支援ありがとうございました！")
    return "\n".join(lines)
