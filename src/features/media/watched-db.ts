import type { MediaItem } from "./types";

/** Subset of tauri-plugin-sql's Database we use; injectable for tests. */
export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}

interface MediaRow {
  id: number;
  remote_fs: string;
  remote_path: string;
  name: string;
  size: number;
  local_path: string | null;
  synced_at: number | null;
  watched_at: number | null;
  local_deleted_at: number | null;
}

function rowToItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    remoteFs: row.remote_fs,
    remotePath: row.remote_path,
    name: row.name,
    size: row.size,
    localPath: row.local_path,
    syncedAt: row.synced_at,
    watchedAt: row.watched_at,
    localDeletedAt: row.local_deleted_at,
  };
}

export class WatchedDb {
  constructor(private readonly db: SqlExecutor) {}

  /** Record a completed Watch sync (insert or refresh an existing key). */
  async recordSynced(input: {
    remoteFs: string;
    remotePath: string;
    name: string;
    size: number;
    localPath: string;
    now?: number;
  }): Promise<void> {
    const now = input.now ?? Date.now();
    await this.db.execute(
      `INSERT INTO media_items (remote_fs, remote_path, name, size, local_path, synced_at, local_deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (remote_fs, remote_path) DO UPDATE SET
         name = $3, size = $4, local_path = $5, synced_at = $6, local_deleted_at = NULL`,
      [input.remoteFs, input.remotePath, input.name, input.size, input.localPath, now],
    );
  }

  async markWatched(remoteFs: string, remotePath: string, now = Date.now()): Promise<void> {
    await this.db.execute(
      `INSERT INTO media_items (remote_fs, remote_path, name, size, watched_at)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (remote_fs, remote_path) DO UPDATE SET watched_at = $4`,
      [remoteFs, remotePath, remotePath.split("/").pop() ?? remotePath, now],
    );
  }

  async markUnwatched(remoteFs: string, remotePath: string): Promise<void> {
    await this.db.execute(
      `UPDATE media_items SET watched_at = NULL WHERE remote_fs = $1 AND remote_path = $2`,
      [remoteFs, remotePath],
    );
  }

  async markLocalDeleted(id: number, now = Date.now()): Promise<void> {
    await this.db.execute(
      `UPDATE media_items SET local_deleted_at = $2, local_path = NULL WHERE id = $1`,
      [id, now],
    );
  }

  /** Most recently synced/watched items for the media panel. */
  async recent(limit = 50): Promise<MediaItem[]> {
    const rows = await this.db.select<MediaRow[]>(
      `SELECT * FROM media_items
       ORDER BY COALESCE(synced_at, watched_at, 0) DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map(rowToItem);
  }

  /** Items that still have a local copy in the watch folder. */
  async withLocalCopies(): Promise<MediaItem[]> {
    const rows = await this.db.select<MediaRow[]>(
      `SELECT * FROM media_items WHERE local_path IS NOT NULL AND local_deleted_at IS NULL`,
    );
    return rows.map(rowToItem);
  }

  /** Watched remote paths within one fs — used for browser badges. */
  async watchedPaths(remoteFs: string): Promise<Set<string>> {
    const rows = await this.db.select<{ remote_path: string }[]>(
      `SELECT remote_path FROM media_items WHERE remote_fs = $1 AND watched_at IS NOT NULL`,
      [remoteFs],
    );
    return new Set(rows.map((r) => r.remote_path));
  }
}

let dbPromise: Promise<WatchedDb> | null = null;

/** App-wide watched DB (sqlite via tauri-plugin-sql). */
export function getWatchedDb(): Promise<WatchedDb> {
  dbPromise ??= (async () => {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const db = await Database.load("sqlite:media.db");
    return new WatchedDb(db);
  })();
  return dbPromise;
}
