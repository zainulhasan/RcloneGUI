# RcloneGUI Media Workflow

The media module supports one real-world loop: **sync a movie from a remote → watch it → clean
up the local copy**, without ever touching the remote original.

## Playback model

There is **no bundled player**. Files open in the **OS default application** (via the Tauri
opener plugin). Because playback position cannot be read from an external player, **"watched" is
always an explicit user action** — never auto-detected.

## Watch & Auto-Clean flow

1. Set a **Watch Folder** in Settings (the only directory the media module may delete from).
2. In the Browser, right-click any remote file/folder → **Watch (sync locally)**.
   - **Disk-space guard:** before syncing, free space on the Watch Folder's drive is checked
     (`disk_free` Tauri command → `fs4::available_space`). If the item doesn't fit, a warning
     toast appears with an explicit "Sync anyway" override.
   - The copy reuses the normal operations pipeline (`operations/copyfile` for files,
     `sync/copy` for folders, always `_async`) and shows in the Transfers dashboard.
   - The remote is **only read, never modified**.
3. When the job finishes, the item is recorded in the watched DB and (if "Open after sync" is
   on) opened with the OS default app.
4. The **Media → Now / Recently watched** panel lists each item with name, size, synced-at and
   source remote path, plus **Open**, **Mark watched / unwatched**, and **Delete local copy**
   (with confirmation).
5. **Mark watched** stamps `watched_at`. If "Delete when marked watched" is enabled in
   Settings, the local copy is removed immediately (and logged).

## Watched DB schema

SQLite via `tauri-plugin-sql`, database `media.db`, migration
`src-tauri/migrations/001_media_items.sql`:

```sql
CREATE TABLE media_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    remote_fs        TEXT NOT NULL,      -- e.g. "gdrive:"
    remote_path      TEXT NOT NULL,      -- path within the remote
    name             TEXT NOT NULL,
    size             INTEGER NOT NULL DEFAULT 0,
    local_path       TEXT,               -- watch-folder copy; NULL once deleted
    synced_at        INTEGER,            -- ms epoch of last completed Watch sync
    watched_at       INTEGER,            -- ms epoch of explicit "mark watched"
    local_deleted_at INTEGER,            -- ms epoch when the local copy was removed
    UNIQUE (remote_fs, remote_path)
);
```

The unique key is **remote + path**, so re-syncing the same item refreshes the row instead of
duplicating it, and the Browser can badge already-watched items (`watched_at IS NOT NULL`) to
avoid re-syncing something you have already seen.

Access goes through `src/features/media/watched-db.ts` (`WatchedDb`), which takes an injectable
SQL executor — unit tests run against an in-memory fake.

## Auto-cleanup rule semantics

Configured in Settings, all optional and **off by default**. Implemented as a pure function —
`planCleanup(items, rules, now)` in `src/features/media/cleanup.ts` — exhaustively unit-tested.

| Rule            | Semantics                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `afterHours: N` | Items whose `synced_at` is ≥ N hours old are deleted ("expired"). Items never synced are never expired.                                                                                        |
| `sizeCapGb: N`  | If the Watch Folder's tracked total still exceeds N GB **after** expired deletions, the **oldest** eligible items (by `synced_at`) are evicted until under the cap.                            |
| `watchedOnly`   | When **on** (default), both rules may only delete items already marked watched. When **off**, unwatched items are eligible too. Unwatched items always count toward the size total either way. |

Hard safety properties:

- The planner can only return items it was given, and the executor
  (`deleteLocalCopy`) **refuses any path outside the Watch Folder**
  (`isInsideWatchFolder`, also rejects `..`).
- Remotes and other local paths are never touched.
- Every deletion — manual or automatic — is written to the Activity log
  (Logs → Activity, category `cleanup`), with the rule that caused it.
- The runner executes 15 s after launch and every 5 minutes, plus on demand via
  **Media → Run cleanup now**.

## Media library view

Media → Library renders a **poster grid** for any remote folder:

- File names are parsed to title/year by `filename-parser.ts`
  (`The.Matrix.1999.1080p.BluRay.x264.mkv` → _The Matrix_, 1999).
- With a **TMDB API key** (Settings → Media library; free at themoviedb.org), posters and
  canonical titles come from TMDB. Responses are cached in `localStorage` for 30 days.
- **Without a key, the grid degrades gracefully**: clean cards with parsed file names and no
  posters.
- Each card offers the same **Watch** action and shows the watched badge; you can also mark
  remote items watched directly from the grid.
