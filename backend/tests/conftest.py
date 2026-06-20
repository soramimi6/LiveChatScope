"""Shared pytest fixtures for LiveChatScope API tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    """FastAPI TestClient backed by an isolated temporary SQLite database."""
    db_path = tmp_path / "livechatscope_test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))

    from app.config import settings

    monkeypatch.setattr(settings, "database_path", db_path)

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
