"""Load whitelist test fixtures from tests/fixtures/."""

from __future__ import annotations

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"


def load_json(name: str) -> list | dict:
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def load_chat_downloader_messages() -> list[dict]:
    return load_json("chat_downloader_messages.json")


def load_expected_normalize_whitelist() -> dict[str, dict]:
    return load_json("expected_normalize_whitelist.json")
