# v0.3 — Browser Power Features

## Mission context

RcloneGUI is the **free alternative to paid cloud-storage apps** (Mountain Duck, ExpanDrive,
CloudMounter, Transmit). Those apps win on file-manager polish. v0.3 closes the gap: the four
features below are table stakes in every paid competitor.

## Scope

1. Rename (files and folders) + double-click to open local files
2. Type-to-filter the current folder listing
3. Storage usage bars on the Remotes page
4. Persistent transfer history

Out of scope: drag-and-drop between panes, remote file streaming/preview, batch rename.

## 1. Rename + open

**Rename** — context-menu item on a single selected item → dialog pre-filled with the current
name.

- Files: `operations/movefile` (same fs, same parent dir, new leaf name).
- Folders: `sync/move` with `deleteEmptySrcDirs: true` (rclone has no dir-rename primitive;
  same-remote moves are server-side).
- Validation (pure function `validateRename(name, siblings)`): non-empty, no `/`, not `.`/`..`,
  no collision with an existing sibling (case-sensitive compare; the remote decides the rest).
- On success: invalidate the pane listing; if the renamed item was in the watched DB, update its
  `remote_path` so badges and history survive renames.

**Open** — double-click on a _file_ in a **local** pane opens it with the OS default app
(opener plugin, same helper as the media flow). Double-click on remote files keeps doing
nothing (streaming is a future feature); directories keep navigating.

## 2. Type-to-filter

- A small filter input sits in the pane header (funnel icon toggles it; `Esc` clears+closes).
- Pure function `filterListing(items, query)`: case-insensitive substring on `Name`.
- Filtering is client-side on the already-fetched listing — no RC calls.
- The footer shows `n of m shown` while a filter is active. Selection is pruned to visible
  items (existing `pruneSelection` handles this once keys shrink).

## 3. Remote usage bars

- Remotes table gains a **Usage** column: `used / total` with a small Progress bar.
- Data: `operations/about` per remote, queried lazily with `staleTime: 5 min`,
  `retry: false` (many backends don't support `about`).
- Fallbacks: unsupported/erroring backends show "—"; backends reporting only `used`
  (no `total`) show the used figure without a bar.

## 4. Persistent transfer history

**Storage** — second SQLite migration on the existing `media.db` plumbing:

```sql
CREATE TABLE job_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,            -- copy/sync/move/bisync/watch/scheduled
    label TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,
    success INTEGER NOT NULL,
    error TEXT,
    bytes INTEGER NOT NULL DEFAULT 0
);
```

- `JobHistoryDb` class mirrors `WatchedDb` (injectable SQL executor; in-memory fake in tests).
- The existing job-completion watcher writes one row per finished job (bytes from the final
  `core/stats` group snapshot; 0 when unavailable).
- Retention: after insert, delete all but the newest 500 rows.

**UI** — the Transfers page becomes two tabs: **Active** (today's view, unchanged) and
**History** (table: label, kind badge, finished time, duration, bytes, status badge with error
tooltip; "Clear history" button with confirm).

## Error handling

- Rename failures (permission, unsupported remote) surface as toasts with the RC error text;
  the dialog stays open for retry.
- `about` failures are silent per-remote ("—"), never toasts — unsupported is normal.
- History writes are fire-and-forget: a failed insert logs to the activity log but never
  blocks job completion handling.

## Testing

- Pure: `validateRename` (collisions, slashes, empties), `filterListing`, history retention
  (insert 501 → oldest evicted) against the SQL fake.
- Component: history tab renders rows + empty state; filter input narrows the pane list.
- E2E: type in the filter box, assert row count changes.

## Build order (one PR each)

filter → rename/open → usage bars → history.
