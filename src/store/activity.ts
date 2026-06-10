import { create } from "zustand";

export type ActivityLevel = "info" | "warning" | "error";
export type ActivityCategory = "operation" | "cleanup" | "media" | "scheduler" | "app";

export interface ActivityEntry {
  id: number;
  at: number;
  level: ActivityLevel;
  category: ActivityCategory;
  message: string;
}

const MAX_ENTRIES = 1000;
let nextId = 1;

interface ActivityState {
  entries: ActivityEntry[];
  log: (level: ActivityLevel, category: ActivityCategory, message: string) => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  entries: [],
  log: (level, category, message) =>
    set((s) => ({
      entries: [...s.entries, { id: nextId++, at: Date.now(), level, category, message }].slice(
        -MAX_ENTRIES,
      ),
    })),
  clear: () => set({ entries: [] }),
}));

/** Log helper usable outside React components. */
export function logActivity(
  level: ActivityLevel,
  category: ActivityCategory,
  message: string,
): void {
  useActivityStore.getState().log(level, category, message);
}
