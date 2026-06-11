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
