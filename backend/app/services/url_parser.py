import re
from urllib.parse import parse_qs, urlparse

YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"}


class InvalidYouTubeURLError(ValueError):
    pass


def extract_video_id(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.netloc not in YOUTUBE_HOSTS:
        raise InvalidYouTubeURLError("YouTube の URL を入力してください")

    if parsed.netloc == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/")[0]
    else:
        query = parse_qs(parsed.query)
        video_id = query.get("v", [None])[0]

    if not video_id or not re.fullmatch(r"[\w-]{11}", video_id):
        raise InvalidYouTubeURLError("動画 ID を取得できません")

    return video_id
