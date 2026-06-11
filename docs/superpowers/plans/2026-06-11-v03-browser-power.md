# v0.3 Browser Power Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four file-manager features from the v0.3 spec: type-to-filter, rename + double-click open, remote usage bars, persistent transfer history.

**Architecture:** Each feature is a pure logic module (TDD) plus a thin UI wiring change. History reuses the existing SQLite plumbing (`tauri-plugin-sql`, injectable `SqlExecutor` fakes in tests). One PR per feature; `main` is protected, so every task ends with a branch push + PR + auto-merge monitor.

**Tech Stack:** React 19 + TS strict, TanStack Query, Zustand, shadcn/ui, Vitest + RTL, tauri-plugin-sql (SQLite), rclone RC API via the typed client in `src/lib/rc-client`.

**Conventions for every task:**

- Quality gate before every commit: `npm run check` (must print nothing failing; exit 0).
- Branch from fresh `main`: `git checkout main && git pull && git checkout -b <branch>`.
- PR + auto-merge (run after `gh pr create`, replacing `<N>`):

```bash
export GH_TOKEN=$(git remote get-url origin | sed -E 's#https://[^:]+:([^@]+)@.*#\1#')
# monitor: poll gh pr checks <N>; when all pass run:
gh pr merge <N> --repo zainulhasan/RcloneGUI --squash --delete-branch
```

---

### Task 1: Type-to-filter — pure function

**Files:**

- Create: `src/features/browser/filter.ts`
- Test: `src/features/browser/filter.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/pane-filter
```

- [ ] **Step 2: Write the failing test**

```ts
// src/features/browser/filter.test.ts
import { describe, expect, it } from "vitest";

import type { RcListItem } from "@/lib/rc-client";

import { filterListing } from "./filter";

function item(name: string): RcListItem {
  return { Path: name, Name: name, Size: 1, MimeType: "", ModTime: "", IsDir: false };
}

describe("filterListing", () => {
  const items = [item("Movie.mkv"), item("notes.md"), item("MOVIE-2.mkv")];

  it("returns all items for an empty or whitespace query", () => {
    expect(filterListing(items, "")).toBe(items);
    expect(filterListing(items, "   ")).toBe(items);
  });

  it("matches case-insensitive substrings", () => {
    expect(filterListing(items, "movie").map((i) => i.Name)).toEqual(["Movie.mkv", "MOVIE-2.mkv"]);
    expect(filterListing(items, ".MD").map((i) => i.Name)).toEqual(["notes.md"]);
  });

  it("returns empty for no matches", () => {
    expect(filterListing(items, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/browser/filter.test.ts`
Expected: FAIL — `Cannot find module './filter'`

- [ ] **Step 4: Write minimal implementation**

```ts
// src/features/browser/filter.ts
import type { RcListItem } from "@/lib/rc-client";

/** Case-insensitive substring filter on item names. Empty query = all. */
export function filterListing(items: RcListItem[], query: string): RcListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.Name.toLowerCase().includes(q));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/browser/filter.test.ts`
Expected: 3 passed

### Task 2: Type-to-filter — pane UI

**Files:**

- Modify: `src/features/browser/pane.tsx`

- [ ] **Step 1: Add filter state + filtered items**

In `Pane`, after the `keys` memo, add:

```tsx
const [filterOpen, setFilterOpen] = useState(false);
const [filterQuery, setFilterQuery] = useState("");
const visibleItems = useMemo(
  () => (filterOpen ? filterListing(items, filterQuery) : items),
  [items, filterOpen, filterQuery],
);
const visibleKeys = useMemo(() => visibleItems.map((i) => i.Path), [visibleItems]);
```

Import `filterListing` from `./filter` and `Filter as FilterIcon` plus `X` from `lucide-react`.
Replace list rendering and selection wiring to use `visibleItems`/`visibleKeys`
(the `applyClick(s, visibleKeys, i, …)` call and `selection`'s prune now use `visibleKeys`,
so hidden items drop out of selection automatically).

- [ ] **Step 2: Add the funnel toggle + input to the header**

Next to the New-folder button, add:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Filter items"
      disabled={!pane.fs}
      onClick={() => {
        setFilterOpen((v) => !v);
        setFilterQuery("");
      }}
    >
      <FilterIcon className={cn(filterOpen && "text-primary")} />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Filter</TooltipContent>
</Tooltip>
```

Directly under the `<header>` (before the listing container), render when `filterOpen`:

```tsx
{
  filterOpen && (
    <div className="flex items-center gap-1 border-b px-2 py-1">
      <Input
        autoFocus
        className="h-7 text-xs"
        placeholder="Filter this folder…"
        value={filterQuery}
        aria-label="Filter query"
        onChange={(e) => setFilterQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFilterOpen(false);
            setFilterQuery("");
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Clear filter"
        onClick={() => {
          setFilterOpen(false);
          setFilterQuery("");
        }}
      >
        <X />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Footer shows `shown of total` while filtering**

Replace the folders/files counts span with:

```tsx
<span>
  {filterOpen && filterQuery.trim()
    ? `${visibleItems.length} of ${items.length} shown`
    : `${items.filter((i) => i.IsDir).length} folders · ${items.filter((i) => !i.IsDir).length} files`}
</span>
```

- [ ] **Step 4: Gate**

Run: `npm run check` — expected exit 0. Also `npx playwright test` — 2 passed.

- [ ] **Step 5: Commit, push, PR, auto-merge**

```bash
git add -A && git commit -m "Add type-to-filter to browser panes"
git push -u origin feature/pane-filter
gh pr create --title "Browser: type-to-filter the current folder" --body "v0.3 spec item 2: client-side case-insensitive filter, funnel toggle in pane header, Esc clears, footer shows shown/total. Pure filterListing() unit-tested."
# then auto-merge per Conventions
```

---

### Task 3: Rename — validation + RC helper (pure logic)

**Files:**

- Create: `src/features/browser/rename.ts`
- Test: `src/features/browser/rename.test.ts`
- Modify: `src/features/media/watched-db.ts` (add `updateRemotePath`)
- Modify: `src/features/media/watched-db.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/rename-open
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/features/browser/rename.test.ts
import { describe, expect, it, vi } from "vitest";

import { renamedPath, validateRename } from "./rename";

describe("validateRename", () => {
  const siblings = ["a.mkv", "b.mkv"];

  it("accepts a fresh, clean name", () => {
    expect(validateRename("c.mkv", siblings)).toBeNull();
  });

  it("rejects empties, slashes and dot names", () => {
    expect(validateRename("", siblings)).toMatch(/empty/i);
    expect(validateRename("  ", siblings)).toMatch(/empty/i);
    expect(validateRename("a/b", siblings)).toMatch(/slash/i);
    expect(validateRename(".", siblings)).toMatch(/name/i);
    expect(validateRename("..", siblings)).toMatch(/name/i);
  });

  it("rejects collisions with existing siblings", () => {
    expect(validateRename("a.mkv", siblings)).toMatch(/exists/i);
  });
});

describe("renamedPath", () => {
  it("replaces the leaf name", () => {
    expect(renamedPath("films/old.mkv", "new.mkv")).toBe("films/new.mkv");
    expect(renamedPath("old.mkv", "new.mkv")).toBe("new.mkv");
  });
});
```

Add to `src/features/media/watched-db.test.ts` (inside `describe("WatchedDb")`):

```ts
it("updateRemotePath moves the key so badges survive renames", async () => {
  const { executor, rows } = fakeDb();
  const db = new WatchedDb(executor);
  await db.markWatched("gdrive:", "films/old.mkv");
  await db.updateRemotePath("gdrive:", "films/old.mkv", "films/new.mkv");
  expect(rows[0].remote_path).toBe("films/new.mkv");
});
```

And teach the fake's `execute` the new statement (add an `else if` branch before the throw):

```ts
} else if (sql.includes("SET remote_path")) {
  const [fs, oldPath, newPath] = params as [string, string, string];
  const row = rows.find((r) => r.remote_fs === fs && r.remote_path === oldPath);
  if (row) row.remote_path = newPath;
}
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/features/browser/rename.test.ts src/features/media/watched-db.test.ts`
Expected: FAIL — `Cannot find module './rename'` and `updateRemotePath is not a function`

- [ ] **Step 4: Implement**

```ts
// src/features/browser/rename.ts
import { tauriTransport, joinFsPath, type RcListItem } from "@/lib/rc-client";

/** Null when valid, else a human-readable problem. */
export function validateRename(name: string, siblings: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty.";
  if (trimmed.includes("/")) return "Name cannot contain a slash.";
  if (trimmed === "." || trimmed === "..") return "That name is reserved.";
  if (siblings.includes(trimmed)) return "An item with this name already exists.";
  return null;
}

/** "films/old.mkv" + "new.mkv" → "films/new.mkv" */
export function renamedPath(path: string, newName: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? newName : `${path.slice(0, idx)}/${newName}`;
}

/**
 * Rename in place. Files use operations/movefile; folders use sync/move
 * (rclone has no dir-rename primitive — same-remote moves are server-side).
 */
export async function renameItem(fs: string, item: RcListItem, newName: string): Promise<void> {
  const dst = renamedPath(item.Path, newName.trim());
  if (item.IsDir) {
    await tauriTransport("sync/move", {
      srcFs: joinFsPath(fs, item.Path),
      dstFs: joinFsPath(fs, dst),
      deleteEmptySrcDirs: true,
    });
  } else {
    await tauriTransport("operations/movefile", {
      srcFs: fs,
      srcRemote: item.Path,
      dstFs: fs,
      dstRemote: dst,
    });
  }
}
```

Add to `WatchedDb` (after `markLocalDeleted`):

```ts
/** Keep watched status attached when an item is renamed on the remote. */
async updateRemotePath(remoteFs: string, oldPath: string, newPath: string): Promise<void> {
  await this.db.execute(
    `UPDATE media_items SET remote_path = $3 WHERE remote_fs = $1 AND remote_path = $2`,
    [remoteFs, oldPath, newPath],
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/features/browser/rename.test.ts src/features/media/watched-db.test.ts`
Expected: all pass

### Task 4: Rename dialog + double-click open in the pane

**Files:**

- Modify: `src/features/browser/pane.tsx`

- [ ] **Step 1: Rename dialog state + mutation**

In `Pane` add state and a handler (imports: `renameItem, renamedPath, validateRename` from
`./rename`; `getWatchedDb` from `@/features/media/watched-db`; `toast` already imported):

```tsx
const [renaming, setRenaming] = useState<RcListItem | null>(null);
const [renameValue, setRenameValue] = useState("");

const renameError = renaming
  ? validateRename(
      renameValue,
      items.filter((i) => i.Path !== renaming.Path).map((i) => i.Name),
    )
  : null;

const submitRename = async () => {
  if (!renaming || !paneFs || renameError) return;
  try {
    await renameItem(paneFs, renaming, renameValue);
    const db = await getWatchedDb();
    await db.updateRemotePath(
      paneFs,
      renaming.Path,
      renamedPath(renaming.Path, renameValue.trim()),
    );
    toast.success(`Renamed to "${renameValue.trim()}"`);
    setRenaming(null);
    void refresh();
  } catch (err) {
    toast.error(`Rename failed: ${(err as Error).message}`);
  }
};
```

- [ ] **Step 2: Context-menu entry (single selection only)**

Inside the selected-items context-menu block, before "Copy path":

```tsx
{
  selectedItems.length === 1 && (
    <ContextMenuItem
      onClick={() => {
        setRenaming(selectedItems[0]);
        setRenameValue(selectedItems[0].Name);
      }}
    >
      Rename…
    </ContextMenuItem>
  );
}
```

- [ ] **Step 3: Rename dialog markup** (next to the mkdir dialog)

```tsx
<Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Rename "{renaming?.Name}"</DialogTitle>
    </DialogHeader>
    <Input
      autoFocus
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      aria-label="New name"
      aria-invalid={!!renameError}
      onKeyDown={(e) => e.key === "Enter" && void submitRename()}
    />
    {renameError && renameValue !== renaming?.Name && (
      <p className="text-destructive text-xs">{renameError}</p>
    )}
    <DialogFooter>
      <Button variant="ghost" onClick={() => setRenaming(null)}>
        Cancel
      </Button>
      <Button
        onClick={() => void submitRename()}
        disabled={!!renameError || renameValue.trim() === renaming?.Name}
      >
        Rename
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Double-click opens local files**

Replace `onDoubleClick={() => enterDir(item)}` with:

```tsx
onDoubleClick={() => {
  if (item.IsDir) {
    enterDir(item);
  } else if (paneFs === LOCAL_FS) {
    void import("@/features/media/watch-actions").then((m) =>
      m.openLocal(`/${item.Path}`).catch((err: Error) =>
        toast.error(`Could not open: ${err.message}`),
      ),
    );
  }
}}
```

- [ ] **Step 5: Gate + commit + PR**

Run: `npm run check` (exit 0), `npx playwright test` (2 passed). Then:

```bash
git add -A && git commit -m "Add rename and double-click-to-open to browser panes"
git push -u origin feature/rename-open
gh pr create --title "Browser: rename + double-click to open local files" --body "v0.3 spec item 1: rename via operations/movefile (files) / sync-move (folders) with validated names; watched-DB path follows renames; double-click opens local files with the OS default app."
# auto-merge per Conventions
```

---

### Task 5: Remote usage bars

**Files:**

- Create: `src/features/remotes/usage-cell.tsx`
- Test: `src/features/remotes/usage-cell.test.tsx`
- Modify: `src/features/remotes/remotes-view.tsx`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/remote-usage
```

- [ ] **Step 2: Failing component test**

```tsx
// src/features/remotes/usage-cell.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as rcClient from "@/lib/rc-client";

import { UsageCell } from "./usage-cell";

function renderCell(name = "gdrive") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsageCell name={name} />
    </QueryClientProvider>,
  );
}

describe("UsageCell", () => {
  it("shows used/total with a bar when both are known", async () => {
    vi.spyOn(rcClient.rc, "about").mockResolvedValue({
      used: 50 * 1024 ** 3,
      total: 100 * 1024 ** 3,
    });
    renderCell();
    expect(await screen.findByText("50.0 GiB / 100 GiB")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows used only when total is missing", async () => {
    vi.spyOn(rcClient.rc, "about").mockResolvedValue({ used: 5 * 1024 ** 3 });
    renderCell();
    expect(await screen.findByText("5.0 GiB used")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a dash when about is unsupported", async () => {
    vi.spyOn(rcClient.rc, "about").mockRejectedValue(new Error("not supported"));
    renderCell();
    expect(await screen.findByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/features/remotes/usage-cell.test.tsx`
Expected: FAIL — `Cannot find module './usage-cell'`

- [ ] **Step 4: Implement**

```tsx
// src/features/remotes/usage-cell.tsx
import { useQuery } from "@tanstack/react-query";

import { Progress } from "@/components/ui/progress";
import { rc } from "@/lib/rc-client";
import { formatBytes } from "@/lib/format";

/** Storage usage for one remote; "—" for backends without `about` support. */
export function UsageCell({ name }: { name: string }) {
  const about = useQuery({
    queryKey: ["remote-about", name],
    queryFn: () => rc.about(`${name}:`),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (about.isLoading) {
    return <span className="text-muted-foreground text-xs">…</span>;
  }
  const used = about.data?.used;
  const total = about.data?.total;

  if (about.isError || used === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (total === undefined || total === 0) {
    return <span className="text-muted-foreground text-xs">{formatBytes(used)} used</span>;
  }
  return (
    <div className="flex w-44 flex-col gap-1">
      <span className="text-muted-foreground text-xs tabular-nums">
        {formatBytes(used)} / {formatBytes(total)}
      </span>
      <Progress value={(used / total) * 100} aria-label={`${name} usage`} className="h-1.5" />
    </div>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/features/remotes/usage-cell.test.tsx`
Expected: 3 passed

- [ ] **Step 6: Wire the column into the Remotes table**

In `remotes-view.tsx`: import `UsageCell`, add `<TableHead>Usage</TableHead>` after Type, and
in the body row add `<TableCell><UsageCell name={name} /></TableCell>` after the type badge cell.

- [ ] **Step 7: Gate + commit + PR**

`npm run check` (exit 0), then:

```bash
git add -A && git commit -m "Show storage usage per remote via operations/about"
git push -u origin feature/remote-usage
gh pr create --title "Remotes: storage usage bars" --body "v0.3 spec item 3: lazy operations/about per remote (5 min staleTime, no retry), used/total bar, graceful — for unsupported backends. Component-tested for all three states."
# auto-merge per Conventions
```

---

### Task 6: Transfer history — SQLite layer

**Files:**

- Create: `src-tauri/migrations/002_job_history.sql`
- Modify: `src-tauri/src/lib.rs` (register migration v2)
- Create: `src/features/transfers/history-db.ts`
- Test: `src/features/transfers/history-db.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/transfer-history
```

- [ ] **Step 2: Migration file**

```sql
-- src-tauri/migrations/002_job_history.sql
-- Finished-transfer history shown in the Transfers → History tab.
CREATE TABLE IF NOT EXISTS job_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,
    success INTEGER NOT NULL,
    error TEXT,
    bytes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_job_history_finished_at ON job_history (finished_at);
```

In `src-tauri/src/lib.rs`, extend the migrations vec:

```rust
vec![
    tauri_plugin_sql::Migration {
        version: 1,
        description: "create media_items",
        sql: include_str!("../migrations/001_media_items.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
    tauri_plugin_sql::Migration {
        version: 2,
        description: "create job_history",
        sql: include_str!("../migrations/002_job_history.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
],
```

Verify: `cd src-tauri && cargo clippy --all-targets -- -D warnings` — clean.

- [ ] **Step 3: Failing TS test**

```ts
// src/features/transfers/history-db.test.ts
import { describe, expect, it } from "vitest";

import type { SqlExecutor } from "@/features/media/watched-db";

import { JobHistoryDb, type JobHistoryEntry } from "./history-db";

/** In-memory stand-in for the job_history statements this app issues. */
function fakeDb() {
  interface Row {
    id: number;
    kind: string;
    label: string;
    started_at: number;
    finished_at: number;
    success: number;
    error: string | null;
    bytes: number;
  }
  const rows: Row[] = [];
  let nextId = 1;

  const executor: SqlExecutor = {
    async execute(sql, params = []) {
      if (sql.includes("INSERT INTO job_history")) {
        const [kind, label, startedAt, finishedAt, success, error, bytes] = params as [
          string,
          string,
          number,
          number,
          number,
          string | null,
          number,
        ];
        rows.push({
          id: nextId++,
          kind,
          label,
          started_at: startedAt,
          finished_at: finishedAt,
          success,
          error,
          bytes,
        });
      } else if (sql.includes("DELETE FROM job_history WHERE id NOT IN")) {
        const [keep] = params as [number];
        const keepIds = new Set(
          [...rows]
            .sort((a, b) => b.finished_at - a.finished_at || b.id - a.id)
            .slice(0, keep)
            .map((r) => r.id),
        );
        for (let i = rows.length - 1; i >= 0; i--) if (!keepIds.has(rows[i].id)) rows.splice(i, 1);
      } else if (sql.includes("DELETE FROM job_history")) {
        rows.length = 0;
      } else {
        throw new Error(`fakeDb cannot handle: ${sql}`);
      }
      return undefined;
    },
    async select(sql, params = []) {
      if (sql.includes("FROM job_history")) {
        const [limit] = params as [number];
        return [...rows]
          .sort((a, b) => b.finished_at - a.finished_at || b.id - a.id)
          .slice(0, limit) as never;
      }
      throw new Error(`fakeDb cannot handle: ${sql}`);
    },
  };
  return { executor, rows };
}

function entry(over: Partial<JobHistoryEntry> = {}): Omit<JobHistoryEntry, "id"> {
  return {
    kind: "copy",
    label: "films → /watch",
    startedAt: 1000,
    finishedAt: 2000,
    success: true,
    error: null,
    bytes: 42,
    ...over,
  };
}

describe("JobHistoryDb", () => {
  it("records and lists newest-first", async () => {
    const { executor } = fakeDb();
    const db = new JobHistoryDb(executor, 500);
    await db.record(entry({ label: "first", finishedAt: 1 }));
    await db.record(entry({ label: "second", finishedAt: 2 }));
    const recent = await db.recent(10);
    expect(recent.map((r) => r.label)).toEqual(["second", "first"]);
  });

  it("evicts beyond the retention cap", async () => {
    const { executor, rows } = fakeDb();
    const db = new JobHistoryDb(executor, 3);
    for (let i = 1; i <= 5; i++) await db.record(entry({ label: `job${i}`, finishedAt: i }));
    expect(rows.map((r) => r.label)).toEqual(["job3", "job4", "job5"]);
  });

  it("clear wipes everything", async () => {
    const { executor, rows } = fakeDb();
    const db = new JobHistoryDb(executor, 500);
    await db.record(entry());
    await db.clear();
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/features/transfers/history-db.test.ts`
Expected: FAIL — `Cannot find module './history-db'`

- [ ] **Step 5: Implement**

```ts
// src/features/transfers/history-db.ts
import type { SqlExecutor } from "@/features/media/watched-db";
import type { JobKind } from "@/store/jobs";

export interface JobHistoryEntry {
  id: number;
  kind: JobKind | "scheduled";
  label: string;
  startedAt: number;
  finishedAt: number;
  success: boolean;
  error: string | null;
  bytes: number;
}

const DEFAULT_RETENTION = 500;

export class JobHistoryDb {
  constructor(
    private readonly db: SqlExecutor,
    private readonly retention = DEFAULT_RETENTION,
  ) {}

  /** Insert one finished job and evict beyond the retention cap. */
  async record(e: Omit<JobHistoryEntry, "id">): Promise<void> {
    await this.db.execute(
      `INSERT INTO job_history (kind, label, started_at, finished_at, success, error, bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.kind, e.label, e.startedAt, e.finishedAt, e.success ? 1 : 0, e.error, e.bytes],
    );
    await this.db.execute(
      `DELETE FROM job_history WHERE id NOT IN
         (SELECT id FROM job_history ORDER BY finished_at DESC, id DESC LIMIT $1)`,
      [this.retention],
    );
  }

  async recent(limit = 100): Promise<JobHistoryEntry[]> {
    const rows = await this.db.select<
      {
        id: number;
        kind: string;
        label: string;
        started_at: number;
        finished_at: number;
        success: number;
        error: string | null;
        bytes: number;
      }[]
    >(`SELECT * FROM job_history ORDER BY finished_at DESC, id DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as JobHistoryEntry["kind"],
      label: r.label,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      success: r.success === 1,
      error: r.error,
      bytes: r.bytes,
    }));
  }

  async clear(): Promise<void> {
    await this.db.execute(`DELETE FROM job_history`);
  }
}

let dbPromise: Promise<JobHistoryDb> | null = null;

/** App-wide history DB (same sqlite file as the media module). */
export function getJobHistoryDb(): Promise<JobHistoryDb> {
  dbPromise ??= (async () => {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const db = await Database.load("sqlite:media.db");
    return new JobHistoryDb(db);
  })();
  return dbPromise;
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/features/transfers/history-db.test.ts`
Expected: 3 passed

### Task 7: Transfer history — record on completion + History tab

**Files:**

- Modify: `src/features/transfers/use-transfers.ts` (record in the completion watcher)
- Create: `src/features/transfers/history-tab.tsx`
- Modify: `src/features/transfers/transfers-view.tsx` (Active/History tabs)

- [ ] **Step 1: Record finished jobs**

In `useJobCompletionWatcher`'s `.then((status) => { … })`, after the success/error branches
(both paths), add (import `getJobHistoryDb` at top):

```ts
void getJobHistoryDb()
  .then((db) =>
    db.record({
      kind: job.kind,
      label: job.label,
      startedAt: job.startedAt,
      finishedAt: Date.now(),
      success: status.success,
      error: status.error || null,
      bytes: 0,
    }),
  )
  .then(() => queryClient.invalidateQueries({ queryKey: ["job-history"] }))
  .catch(() => {});
```

Then fetch real bytes where available: before `markFinished`, add
`const finalStats = await rc.stats(job.group).catch(() => null);` (make the `.then` callback
`async`) and pass `bytes: finalStats?.bytes ?? 0`.

- [ ] **Step 2: History tab component**

```tsx
// src/features/transfers/history-tab.tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes, formatDateTime, formatEta } from "@/lib/format";

import { getJobHistoryDb } from "./history-db";

export function HistoryTab() {
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["job-history"],
    queryFn: async () => (await getJobHistoryDb()).recent(200),
  });

  const entries = history.data ?? [];

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No finished transfers yet"
        hint="Completed jobs are kept here (newest 500) across restarts."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void getJobHistoryDb()
              .then((db) => db.clear())
              .then(() => queryClient.invalidateQueries({ queryKey: ["job-history"] }))
              .then(() => toast.success("History cleared"));
          }}
        >
          <Trash2 /> Clear history
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Transferred</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="max-w-72 truncate font-medium">{e.label}</TableCell>
              <TableCell>
                <Badge variant="secondary">{e.kind}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDateTime(new Date(e.finishedAt).toISOString())}
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {formatEta((e.finishedAt - e.startedAt) / 1000)}
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {e.bytes > 0 ? formatBytes(e.bytes) : "—"}
              </TableCell>
              <TableCell>
                {e.success ? (
                  <Badge variant="secondary">done</Badge>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="destructive">failed</Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80">{e.error}</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Tabs in the Transfers view**

In `transfers-view.tsx`, wrap the bandwidth card + job list as the **Active** tab and add
**History** (imports: `Tabs, TabsContent, TabsList, TabsTrigger`, `HistoryTab`):

```tsx
<Tabs defaultValue="active">
  <TabsList>
    <TabsTrigger value="active">Active</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="active" className="flex flex-col gap-4">
    {/* existing bandwidth Card + job list / EmptyState move here unchanged */}
  </TabsContent>
  <TabsContent value="history">
    <HistoryTab />
  </TabsContent>
</Tabs>
```

- [ ] **Step 4: Gate + commit + PR**

`npm run check` (exit 0; the sql plugin stub in `src/test/setup.ts` already returns `[]` for
`plugin:sql|select`, so the History tab renders the empty state in component tests),
`npx playwright test` (2 passed). Then:

```bash
git add -A && git commit -m "Add persistent transfer history (SQLite) with History tab"
git push -u origin feature/transfer-history
gh pr create --title "Transfers: persistent history" --body "v0.3 spec item 4: job_history table (migration v2), JobHistoryDb with 500-row retention (unit-tested against a SQL fake), completion watcher records every finished job with final bytes, Transfers page gains Active/History tabs with clear-history."
# auto-merge per Conventions
```

---

### Task 8: Wrap-up

- [ ] Update `docs/ROADMAP.md`: mark v0.3 items ✅ SHIPPED (same style as v0.2), via a small
      `docs/` PR.
- [ ] Run the screenshot review: `node scripts/screenshot.mjs`, inspect
      `screenshots/light-transfers.png` and `light-remotes.png` for layout regressions.
- [ ] Full final gate on main after all merges: `npm run check && npx playwright test`.

## Self-review notes

- Spec coverage: filter (Tasks 1–2), rename/open (3–4), usage bars (5), history (6–7) — all
  four spec items have tasks; spec's error-handling rules are embedded in the task code
  (silent `about` failures, fire-and-forget history writes, rename toast-on-fail).
- Types: `SqlExecutor` import path matches its export in `watched-db.ts`; `JobKind` import
  matches `src/store/jobs.ts`; `formatEta` takes seconds (duration passed as ms/1000).
- No placeholders: every code step contains the full code.
