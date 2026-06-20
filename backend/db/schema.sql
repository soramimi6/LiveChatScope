-- LiveChatScope SQLite schema (Phase 1 POC)
-- See docs/db-schema.md for documentation

PRAGMA foreign_keys = ON;

-- =============================================================================
-- Core
-- =============================================================================

CREATE TABLE IF NOT EXISTS videos (
    video_id            TEXT PRIMARY KEY,
    source_url          TEXT NOT NULL,
    title               TEXT,
    channel_name        TEXT,
    channel_id          TEXT,
    duration_seconds    REAL,
    message_count       INTEGER NOT NULL DEFAULT 0,
    fetch_status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (fetch_status IN ('pending','fetching','fetched','failed')),
    analysis_status     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (analysis_status IN ('pending','running','partial','complete','failed')),
    fetch_error_code    TEXT,
    fetch_error_message TEXT,
    analysis_error_code TEXT,
    analysis_error_message TEXT,
    analysis_stage      INTEGER,
    messages_fetched    INTEGER NOT NULL DEFAULT 0,
    fetched_at          TEXT,
    analyzed_at         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_fetch_status ON videos(fetch_status);
CREATE INDEX IF NOT EXISTS idx_videos_analysis_status ON videos(analysis_status);

CREATE TABLE IF NOT EXISTS messages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    message_id          TEXT NOT NULL,
    author_id           TEXT,
    author_name         TEXT,
    message_type        TEXT NOT NULL,
    text                TEXT,
    time_in_seconds     REAL,
    timestamp_usec      INTEGER,
    super_chat_amount   REAL,
    super_chat_currency TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (video_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_video_time ON messages(video_id, time_in_seconds);
CREATE INDEX IF NOT EXISTS idx_messages_video_author ON messages(video_id, author_id);
CREATE INDEX IF NOT EXISTS idx_messages_video_type ON messages(video_id, message_type);
CREATE INDEX IF NOT EXISTS idx_messages_video_author_name ON messages(video_id, author_name);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    text,
    author_name,
    content='messages',
    content_rowid='id',
    tokenize='unicode61'
);

-- =============================================================================
-- Stage 1: Basic aggregation
-- =============================================================================

CREATE TABLE IF NOT EXISTS density_buckets (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    bucket_start_sec    INTEGER NOT NULL,
    bucket_sec          INTEGER NOT NULL DEFAULT 60,
    count               INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (video_id, bucket_start_sec)
);

CREATE TABLE IF NOT EXISTS author_stats (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    author_id           TEXT NOT NULL,
    author_name         TEXT,
    message_count       INTEGER NOT NULL,
    rank                INTEGER NOT NULL,
    is_core_regular     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (video_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_author_stats_rank ON author_stats(video_id, rank);

CREATE TABLE IF NOT EXISTS message_type_stats (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    message_type        TEXT NOT NULL,
    count               INTEGER NOT NULL,
    PRIMARY KEY (video_id, message_type)
);

-- =============================================================================
-- Stage 2: Highlights
-- =============================================================================

CREATE TABLE IF NOT EXISTS highlights (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    rank                INTEGER NOT NULL,
    time_in_seconds     REAL NOT NULL,
    score               REAL NOT NULL,
    clip_start_sec      INTEGER NOT NULL,
    clip_end_sec        INTEGER NOT NULL,
    PRIMARY KEY (video_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_highlights_time ON highlights(video_id, time_in_seconds);

-- =============================================================================
-- Stage 3: Super Chat
-- =============================================================================

CREATE TABLE IF NOT EXISTS super_chat_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    message_id          TEXT,
    time_in_seconds     REAL NOT NULL,
    author_id           TEXT,
    author_name         TEXT,
    amount              REAL NOT NULL,
    currency            TEXT NOT NULL,
    text                TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_super_chat_video_time ON super_chat_events(video_id, time_in_seconds);

CREATE TABLE IF NOT EXISTS super_chat_summary (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    currency            TEXT NOT NULL,
    total_amount        REAL NOT NULL,
    count               INTEGER NOT NULL,
    PRIMARY KEY (video_id, currency)
);

CREATE TABLE IF NOT EXISTS super_chat_buckets (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    bucket_start_sec    INTEGER NOT NULL,
    bucket_sec          INTEGER NOT NULL DEFAULT 60,
    count               INTEGER NOT NULL DEFAULT 0,
    total_amount        REAL NOT NULL DEFAULT 0,
    currency            TEXT NOT NULL DEFAULT 'JPY',
    PRIMARY KEY (video_id, bucket_start_sec, currency)
);

-- =============================================================================
-- Stage 4: Keywords (tokens = transient)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tokens (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    message_id          TEXT NOT NULL,
    time_in_seconds     REAL,
    bucket_start_sec    INTEGER,
    token               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_video_token ON tokens(video_id, token);
CREATE INDEX IF NOT EXISTS idx_tokens_video_bucket ON tokens(video_id, bucket_start_sec);

CREATE TABLE IF NOT EXISTS keyword_stats (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    token               TEXT NOT NULL,
    count               INTEGER NOT NULL,
    rank                INTEGER NOT NULL,
    PRIMARY KEY (video_id, token)
);

CREATE INDEX IF NOT EXISTS idx_keyword_stats_rank ON keyword_stats(video_id, rank);

CREATE TABLE IF NOT EXISTS keyword_timeline (
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    bucket_start_sec    INTEGER NOT NULL,
    token               TEXT NOT NULL,
    count               INTEGER NOT NULL,
    PRIMARY KEY (video_id, bucket_start_sec, token)
);

-- =============================================================================
-- Stage 5–6: Topics
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_blocks (
    block_id            TEXT PRIMARY KEY,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    block_index         INTEGER NOT NULL,
    start_sec           REAL NOT NULL,
    end_sec             REAL NOT NULL,
    label               TEXT NOT NULL,
    message_count       INTEGER NOT NULL DEFAULT 0,
    unique_authors      INTEGER NOT NULL DEFAULT 0,
    super_chat_total    REAL NOT NULL DEFAULT 0,
    super_chat_currency TEXT,
    UNIQUE (video_id, block_index)
);

CREATE INDEX IF NOT EXISTS idx_topic_blocks_video ON topic_blocks(video_id, block_index);

CREATE TABLE IF NOT EXISTS topic_transitions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    from_block_id       TEXT NOT NULL REFERENCES topic_blocks(block_id) ON DELETE CASCADE,
    to_block_id         TEXT NOT NULL REFERENCES topic_blocks(block_id) ON DELETE CASCADE,
    from_block_index    INTEGER NOT NULL,
    to_block_index      INTEGER NOT NULL,
    from_label          TEXT,
    to_label            TEXT,
    at_sec              REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_transitions_video ON topic_transitions(video_id);

CREATE TABLE IF NOT EXISTS topic_author_stats (
    block_id            TEXT NOT NULL REFERENCES topic_blocks(block_id) ON DELETE CASCADE,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    author_id           TEXT NOT NULL,
    author_name         TEXT,
    message_count       INTEGER NOT NULL,
    rank                INTEGER NOT NULL,
    PRIMARY KEY (block_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_author_stats_rank ON topic_author_stats(block_id, rank);

-- =============================================================================
-- Stage 6c: Low activity
-- =============================================================================

CREATE TABLE IF NOT EXISTS low_activity_segments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    start_sec           REAL NOT NULL,
    end_sec             REAL NOT NULL,
    duration_sec        REAL NOT NULL,
    avg_density         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_low_activity_video ON low_activity_segments(video_id, start_sec);

-- =============================================================================
-- Stage 7: Summary
-- =============================================================================

CREATE TABLE IF NOT EXISTS stream_summary (
    video_id            TEXT PRIMARY KEY REFERENCES videos(video_id) ON DELETE CASCADE,
    summary_json        TEXT NOT NULL,
    generated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_params (
    video_id            TEXT PRIMARY KEY REFERENCES videos(video_id) ON DELETE CASCADE,
    params_json         TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
