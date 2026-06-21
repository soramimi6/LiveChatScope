"""SQLite bulk-write helpers for fetch and analysis performance."""

from __future__ import annotations

import sqlite3

FTS_TRIGGER_SQL = """
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, text, author_name)
    VALUES (new.id, new.text, new.author_name);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, text, author_name)
    VALUES ('delete', old.id, old.text, old.author_name);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, text, author_name)
    VALUES ('delete', old.id, old.text, old.author_name);
    INSERT INTO messages_fts(rowid, text, author_name)
    VALUES (new.id, new.text, new.author_name);
END;
"""


def apply_performance_pragmas(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA cache_size=-64000")


def disable_messages_fts_triggers(conn: sqlite3.Connection) -> None:
    conn.execute("DROP TRIGGER IF EXISTS messages_fts_insert")
    conn.execute("DROP TRIGGER IF EXISTS messages_fts_delete")
    conn.execute("DROP TRIGGER IF EXISTS messages_fts_update")


def ensure_messages_fts_triggers(conn: sqlite3.Connection) -> None:
    conn.executescript(FTS_TRIGGER_SQL)


def rebuild_messages_fts_index(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')")
