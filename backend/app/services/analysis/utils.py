import math
import re
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

DEFAULT_STOPWORD_REGEX = [
    r"^[wW]+$",
    r"^[ｗＷ]+$",
    r"^[0-9]+$",
    r"^.{1}$",
]

NOUN_EXCLUDE_SUBTYPES = {"非自立", "代名詞", "数"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def format_time_text(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def jump_url(video_id: str, seconds: float) -> str:
    return f"https://www.youtube.com/watch?v={video_id}&t={math.floor(seconds)}s"


def load_stopwords(stopwords_file: str | None = None) -> set[str]:
    path = settings.stopwords_path
    if stopwords_file:
        candidate = settings.analysis_defaults_path.parent / stopwords_file
        if candidate.is_file():
            path = candidate
    words: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        word = line.strip()
        if word and not word.startswith("#"):
            words.add(word)
    return words


def is_stopword_token(token: str, stopwords: set[str], stopword_regex: list[str] | None = None) -> bool:
    if token in stopwords:
        return True
    patterns = stopword_regex or DEFAULT_STOPWORD_REGEX
    for pattern in patterns:
        if re.fullmatch(pattern, token):
            return True
    return False


def exports_dir(video_id: str) -> Path:
    return settings.database_path.parent / "exports" / video_id
