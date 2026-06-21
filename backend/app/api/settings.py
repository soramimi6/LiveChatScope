from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db import get_connection
from app.services.analysis.params import load_analysis_defaults
from app.services.user_settings import (
    load_user_display_filter_defaults,
    save_user_display_filter_defaults,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class UserDisplayFilterDefaults(BaseModel):
    exclude_stamp_only: bool = True
    exclude_ng_keywords: bool = False
    ng_keywords: list[str] = Field(default_factory=list)
    excluded_author_ids: list[str] = Field(default_factory=list)


@router.get("/display-filter", response_model=UserDisplayFilterDefaults)
def get_display_filter_defaults():
    params = load_analysis_defaults()
    with get_connection() as conn:
        defaults = load_user_display_filter_defaults(conn, params)
    return UserDisplayFilterDefaults(**defaults)


@router.put("/display-filter", response_model=UserDisplayFilterDefaults)
def put_display_filter_defaults(payload: UserDisplayFilterDefaults):
    params = load_analysis_defaults()
    with get_connection() as conn:
        save_user_display_filter_defaults(conn, payload.model_dump())
        defaults = load_user_display_filter_defaults(conn, params)
        conn.commit()
    return UserDisplayFilterDefaults(**defaults)
