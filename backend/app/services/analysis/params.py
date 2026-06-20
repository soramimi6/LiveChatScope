import json
from functools import lru_cache
from typing import Any

from app.config import settings


@lru_cache
def load_analysis_defaults() -> dict[str, Any]:
    raw = settings.analysis_defaults_path.read_text(encoding="utf-8")
    return json.loads(raw)


def save_analysis_params_snapshot(conn, video_id: str, params: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO analysis_params (video_id, params_json, created_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(video_id) DO UPDATE SET
            params_json = excluded.params_json,
            created_at = excluded.created_at
        """,
        (video_id, json.dumps(params, ensure_ascii=False)),
    )
