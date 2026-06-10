-- Watched-media tracking, keyed by remote + path.
CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remote_fs TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    local_path TEXT,
    synced_at INTEGER,
    watched_at INTEGER,
    local_deleted_at INTEGER,
    UNIQUE (remote_fs, remote_path)
);

CREATE INDEX IF NOT EXISTS idx_media_items_synced_at ON media_items (synced_at);
CREATE INDEX IF NOT EXISTS idx_media_items_watched_at ON media_items (watched_at);
