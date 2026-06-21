import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import settings


def _ensure_migrations(conn: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(videos)").fetchall()
    }
    if "display_filter_json" not in columns:
        conn.execute("ALTER TABLE videos ADD COLUMN display_filter_json TEXT")


def init_db() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    schema_sql = settings.schema_path.read_text(encoding="utf-8")
    with get_connection() as conn:
        conn.executescript(schema_sql)
        _ensure_migrations(conn)
        conn.commit()


@contextmanager
def get_connection():
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def db_exists() -> bool:
    return settings.database_path.exists()
