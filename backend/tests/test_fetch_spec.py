"""Tests for fetch-spec versioning and purge on startup."""

import sqlite3

from app.db import init_db
from app.services.fetch_spec import (
    FETCH_SPEC_META_KEY,
    FETCH_SPEC_VERSION,
    ensure_fetch_spec_current,
    purge_all_video_data,
)


def _seed_video(conn: sqlite3.Connection, video_id: str = "abc123") -> None:
    conn.execute(
        """
        INSERT INTO videos (video_id, source_url, fetch_status, analysis_status)
        VALUES (?, 'https://youtu.be/abc123', 'fetched', 'complete')
        """,
        (video_id,),
    )
    conn.commit()


def test_purge_removes_videos_and_sets_version(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("app.db.settings.database_path", db_path)
    monkeypatch.setattr("app.services.fetch_spec.settings.database_path", db_path)

    init_db()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _seed_video(conn)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            UPDATE app_meta SET value = ?
            WHERE key = ?
            """,
            (str(FETCH_SPEC_VERSION - 1), FETCH_SPEC_META_KEY),
        )
        conn.commit()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        purged = ensure_fetch_spec_current(conn)
        conn.commit()

    assert purged is True
    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0] == 0
        row = conn.execute(
            "SELECT value FROM app_meta WHERE key = ?",
            (FETCH_SPEC_META_KEY,),
        ).fetchone()
        assert int(row[0]) == FETCH_SPEC_VERSION


def test_legacy_db_without_meta_is_purged(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy.db"
    monkeypatch.setattr("app.db.settings.database_path", db_path)
    monkeypatch.setattr("app.services.fetch_spec.settings.database_path", db_path)

    init_db()
    with sqlite3.connect(db_path) as conn:
        _seed_video(conn, "legacy1")
        conn.execute("DELETE FROM app_meta WHERE key = ?", (FETCH_SPEC_META_KEY,))
        conn.commit()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        purged = ensure_fetch_spec_current(conn)
        conn.commit()

    assert purged is True
    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0] == 0


def test_empty_db_sets_version_without_purge(tmp_path, monkeypatch):
    db_path = tmp_path / "empty.db"
    monkeypatch.setattr("app.services.fetch_spec.settings.database_path", db_path)

    init_db()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        purged = ensure_fetch_spec_current(conn)
        conn.commit()

    assert purged is False
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT value FROM app_meta WHERE key = ?",
            (FETCH_SPEC_META_KEY,),
        ).fetchone()
        assert int(row[0]) == FETCH_SPEC_VERSION


def test_purge_all_video_data_clears_exports(tmp_path, monkeypatch):
    db_path = tmp_path / "exports.db"
    exports_dir = tmp_path / "exports" / "vid1"
    exports_dir.mkdir(parents=True)
    (exports_dir / "markdown-summary.md").write_text("stale", encoding="utf-8")

    monkeypatch.setattr("app.services.fetch_spec.settings.database_path", db_path)

    init_db()
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        _seed_video(conn, "vid1")
        ids = purge_all_video_data(conn)
        conn.commit()

    assert ids == ["vid1"]
    assert not exports_dir.exists()
