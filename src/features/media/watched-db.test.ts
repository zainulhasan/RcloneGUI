import { describe, expect, it } from "vitest";

import { WatchedDb, type SqlExecutor } from "./watched-db";

/** Tiny in-memory stand-in implementing just the SQL this app issues. */
function fakeDb() {
  interface Row {
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
  const rows: Row[] = [];
  let nextId = 1;

  const executor: SqlExecutor = {
    async execute(sql, params = []) {
      if (sql.includes("INSERT INTO media_items") && sql.includes("synced_at = $6")) {
        const [fs, path, name, size, localPath, now] = params as [
          string,
          string,
          string,
          number,
          string,
          number,
        ];
        const existing = rows.find((r) => r.remote_fs === fs && r.remote_path === path);
        if (existing) {
          Object.assign(existing, {
            name,
            size,
            local_path: localPath,
            synced_at: now,
            local_deleted_at: null,
          });
        } else {
          rows.push({
            id: nextId++,
            remote_fs: fs,
            remote_path: path,
            name,
            size,
            local_path: localPath,
            synced_at: now,
            watched_at: null,
            local_deleted_at: null,
          });
        }
      } else if (sql.includes("DO UPDATE SET watched_at")) {
        const [fs, path, name, now] = params as [string, string, string, number];
        const existing = rows.find((r) => r.remote_fs === fs && r.remote_path === path);
        if (existing) {
          existing.watched_at = now;
        } else {
          rows.push({
            id: nextId++,
            remote_fs: fs,
            remote_path: path,
            name,
            size: 0,
            local_path: null,
            synced_at: null,
            watched_at: now,
            local_deleted_at: null,
          });
        }
      } else if (sql.includes("SET watched_at = NULL")) {
        const [fs, path] = params as [string, string];
        const row = rows.find((r) => r.remote_fs === fs && r.remote_path === path);
        if (row) row.watched_at = null;
      } else if (sql.includes("SET remote_path")) {
        const [fs, oldPath, newPath] = params as [string, string, string];
        const row = rows.find((r) => r.remote_fs === fs && r.remote_path === oldPath);
        if (row) row.remote_path = newPath;
      } else if (sql.includes("SET local_deleted_at")) {
        const [id, now] = params as [number, number];
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.local_deleted_at = now;
          row.local_path = null;
        }
      } else {
        throw new Error(`fakeDb cannot handle: ${sql}`);
      }
      return undefined;
    },
    async select(sql, params = []) {
      if (sql.includes("ORDER BY COALESCE")) {
        const [limit] = params as [number];
        const sorted = [...rows].sort(
          (a, b) => (b.synced_at ?? b.watched_at ?? 0) - (a.synced_at ?? a.watched_at ?? 0),
        );
        return sorted.slice(0, limit) as never;
      }
      if (sql.includes("local_path IS NOT NULL")) {
        return rows.filter((r) => r.local_path !== null && r.local_deleted_at === null) as never;
      }
      if (sql.includes("watched_at IS NOT NULL")) {
        const [fs] = params as [string];
        return rows
          .filter((r) => r.remote_fs === fs && r.watched_at !== null)
          .map((r) => ({ remote_path: r.remote_path })) as never;
      }
      throw new Error(`fakeDb cannot handle: ${sql}`);
    },
  };

  return { executor, rows };
}

describe("WatchedDb", () => {
  it("recordSynced inserts then refreshes on conflict", async () => {
    const { executor, rows } = fakeDb();
    const db = new WatchedDb(executor);
    await db.recordSynced({
      remoteFs: "gdrive:",
      remotePath: "films/a.mkv",
      name: "a.mkv",
      size: 100,
      localPath: "/watch/a.mkv",
      now: 1000,
    });
    expect(rows).toHaveLength(1);

    await db.recordSynced({
      remoteFs: "gdrive:",
      remotePath: "films/a.mkv",
      name: "a.mkv",
      size: 100,
      localPath: "/watch/a.mkv",
      now: 2000,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].synced_at).toBe(2000);
    expect(rows[0].local_deleted_at).toBeNull();
  });

  it("updateRemotePath moves the key so badges survive renames", async () => {
    const { executor, rows } = fakeDb();
    const db = new WatchedDb(executor);
    await db.markWatched("gdrive:", "films/old.mkv");
    await db.updateRemotePath("gdrive:", "films/old.mkv", "films/new.mkv");
    expect(rows[0].remote_path).toBe("films/new.mkv");
  });

  it("markWatched works for items never synced (badge-only)", async () => {
    const { executor, rows } = fakeDb();
    const db = new WatchedDb(executor);
    await db.markWatched("gdrive:", "films/b.mkv", 1234);
    expect(rows[0].watched_at).toBe(1234);
    expect(rows[0].name).toBe("b.mkv");
  });

  it("markLocalDeleted clears the local path", async () => {
    const { executor, rows } = fakeDb();
    const db = new WatchedDb(executor);
    await db.recordSynced({
      remoteFs: "g:",
      remotePath: "x.mkv",
      name: "x.mkv",
      size: 1,
      localPath: "/watch/x.mkv",
      now: 1,
    });
    await db.markLocalDeleted(rows[0].id, 99);
    expect(rows[0].local_path).toBeNull();
    expect(rows[0].local_deleted_at).toBe(99);
    expect(await db.withLocalCopies()).toEqual([]);
  });

  it("recent orders by most recent activity", async () => {
    const { executor } = fakeDb();
    const db = new WatchedDb(executor);
    await db.recordSynced({
      remoteFs: "g:",
      remotePath: "old.mkv",
      name: "old.mkv",
      size: 1,
      localPath: "/w/old.mkv",
      now: 100,
    });
    await db.recordSynced({
      remoteFs: "g:",
      remotePath: "new.mkv",
      name: "new.mkv",
      size: 1,
      localPath: "/w/new.mkv",
      now: 200,
    });
    const recent = await db.recent(10);
    expect(recent.map((r) => r.name)).toEqual(["new.mkv", "old.mkv"]);
  });

  it("watchedPaths returns the set for one fs", async () => {
    const { executor } = fakeDb();
    const db = new WatchedDb(executor);
    await db.markWatched("gdrive:", "films/a.mkv");
    await db.markWatched("s3:", "other/b.mkv");
    const set = await db.watchedPaths("gdrive:");
    expect(set.has("films/a.mkv")).toBe(true);
    expect(set.has("other/b.mkv")).toBe(false);
  });
});
