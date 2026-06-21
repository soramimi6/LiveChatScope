from fastapi import APIRouter

from app.api import analysis, export, messages_api, settings, videos

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(videos.router)
api_router.include_router(settings.router)
api_router.include_router(analysis.router)
api_router.include_router(messages_api.router)
api_router.include_router(export.router)
