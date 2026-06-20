from fastapi import APIRouter

from app.api import videos

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(videos.router)
