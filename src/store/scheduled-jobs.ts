import { create } from "zustand";

import type { FlagsValue } from "@/features/operations/flags";
import { EMPTY_FLAGS } from "@/features/operations/flags";

export interface ScheduledJob {
  id: string;
  name: string;
  kind: "copy" | "sync" | "move";
  srcFs: string;
  dstFs: string;
  cron: string;
  flags: FlagsValue;
  enabled: boolean;
  lastRunAt: number | null;
  lastResult: "success" | "error" | null;
  lastError: string | null;
}

export function newScheduledJob(): Omit<ScheduledJob, "id"> {
  return {
    name: "",
    kind: "copy",
    srcFs: "",
    dstFs: "",
    cron: "0 3 * * *",
    flags: EMPTY_FLAGS,
    enabled: true,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
  };
}

interface ScheduledJobsState {
  jobs: ScheduledJob[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (job: ScheduledJob) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  recordRun: (id: string, result: "success" | "error", error?: string) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "scheduler.json";
const STORE_KEY = "jobs";

async function persist(jobs: ScheduledJob[]): Promise<void> {
  if (!isTauri()) return;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  await store.set(STORE_KEY, jobs);
}

export const useScheduledJobsStore = create<ScheduledJobsState>((set, get) => ({
  jobs: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    let jobs: ScheduledJob[] = [];
    if (isTauri()) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
      jobs = (await store.get<ScheduledJob[]>(STORE_KEY)) ?? [];
    }
    set({ jobs, hydrated: true });
  },
  upsert: async (job) => {
    const jobs = [...get().jobs.filter((j) => j.id !== job.id), job].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    set({ jobs });
    await persist(jobs);
  },
  remove: async (id) => {
    const jobs = get().jobs.filter((j) => j.id !== id);
    set({ jobs });
    await persist(jobs);
  },
  setEnabled: async (id, enabled) => {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, enabled } : j));
    set({ jobs });
    await persist(jobs);
  },
  recordRun: async (id, result, error) => {
    const jobs = get().jobs.map((j) =>
      j.id === id
        ? { ...j, lastRunAt: Date.now(), lastResult: result, lastError: error ?? null }
        : j,
    );
    set({ jobs });
    await persist(jobs);
  },
}));
