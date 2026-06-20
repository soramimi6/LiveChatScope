import re

from fastapi import APIRouter, Query

from app.api.common import format_time_text, get_video_row, jump_url, require_fetch_ready
from app.db import get_connection

router = APIRouter(prefix="/videos", tags=["messages"])

_FTS_SPECIAL = re.compile(r'(["\'\\])')


def _escape_fts_term(term: str) -> str:
    return _FTS_SPECIAL.sub(r"\\\1", term.strip())


def _build_fts_query(q: str) -> str:
    terms = [t for t in q.split() if t.strip()]
    if not terms:
        return ""
    escaped = [_escape_fts_term(t) for t in terms]
    return " AND ".join(f'text:"{term}"*' for term in escaped)


@router.get("/{video_id}/messages")
def search_messages(
    video_id: str,
    q: str | None = Query(default=None),
    author: str | None = Query(default=None),
    message_type: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
):
    row = get_video_row(video_id)
    require_fetch_ready(row)

    conditions = ["m.video_id = ?"]
    params: list = [video_id]

    if author:
        conditions.append("m.author_name = ?")
        params.append(author)

    if message_type:
        conditions.append("m.message_type = ?")
        params.append(message_type)

    fts_query = _build_fts_query(q) if q else ""
    join_fts = bool(fts_query)
    if join_fts:
        conditions.append("messages_fts MATCH ?")
        params.append(fts_query)

    where_clause = " AND ".join(conditions)
    offset = (page - 1) * page_size

    with get_connection() as conn:
        if join_fts:
            count_sql = f"""
                SELECT COUNT(*) AS cnt
                FROM messages m
                JOIN messages_fts ON messages_fts.rowid = m.id
                WHERE {where_clause}
            """
            select_sql = f"""
                SELECT m.message_id, m.time_in_seconds, m.author_name,
                       m.message_type, m.text
                FROM messages m
                JOIN messages_fts ON messages_fts.rowid = m.id
                WHERE {where_clause}
                ORDER BY m.time_in_seconds ASC, m.id ASC
                LIMIT ? OFFSET ?
            """
        else:
            count_sql = f"""
                SELECT COUNT(*) AS cnt
                FROM messages m
                WHERE {where_clause}
            """
            select_sql = f"""
                SELECT m.message_id, m.time_in_seconds, m.author_name,
                       m.message_type, m.text
                FROM messages m
                WHERE {where_clause}
                ORDER BY m.time_in_seconds ASC, m.id ASC
                LIMIT ? OFFSET ?
            """

        total = conn.execute(count_sql, params).fetchone()["cnt"]
        rows = conn.execute(select_sql, [*params, page_size, offset]).fetchall()

    items = []
    for msg in rows:
        time_sec = msg["time_in_seconds"] or 0.0
        items.append(
            {
                "message_id": msg["message_id"],
                "time_in_seconds": time_sec,
                "time_text": format_time_text(time_sec),
                "author_name": msg["author_name"],
                "message_type": msg["message_type"],
                "text": msg["text"],
                "jump_url": jump_url(video_id, time_sec),
            }
        )

    return {
        "video_id": video_id,
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }
