from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "LiveChatScope API"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]

    database_path: Path = ROOT_DIR / "data" / "livechatscope.db"
    schema_path: Path = BACKEND_DIR / "db" / "schema.sql"
    analysis_defaults_path: Path = BACKEND_DIR / "config" / "analysis_defaults.json"
    stopwords_path: Path = BACKEND_DIR / "config" / "stopwords_ja_chat.txt"


settings = Settings()
