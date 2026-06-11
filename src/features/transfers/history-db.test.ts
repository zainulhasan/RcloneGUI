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
        for (let i = rows.length - 1; i >= 0; i--) {
          if (!keepIds.has(rows[i].id)) rows.splice(i, 1);
        }
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
    expect(recent[0].success).toBe(true);
  });

  it("evicts beyond the retention cap", async () => {
    const { executor, rows } = fakeDb();
    const db = new JobHistoryDb(executor, 3);
    for (let i = 1; i <= 5; i++) {
      await db.record(entry({ label: `job${i}`, finishedAt: i }));
    }
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
