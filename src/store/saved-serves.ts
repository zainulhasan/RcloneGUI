import { create } from "zustand";

import type { ServeConfig } from "@/features/serve/serve-options";

interface SavedServesState {
  serves: ServeConfig[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (serve: ServeConfig) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setAutoStart: (id: string, autoStart: boolean) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "serves.json";
const STORE_KEY = "saved";

async function persist(serves: ServeConfig[]): Promise<void> {
  if (!isTauri()) return;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  await store.set(STORE_KEY, serves);
}

export const useSavedServesStore = create<SavedServesState>((set, get) => ({
  serves: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    let serves: ServeConfig[] = [];
    if (isTauri()) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
      serves = (await store.get<ServeConfig[]>(STORE_KEY)) ?? [];
    }
    set({ serves, hydrated: true });
  },
  upsert: async (serve) => {
    const serves = [...get().serves.filter((s) => s.id !== serve.id), serve].sort((a, b) =>
      a.fs.localeCompare(b.fs),
    );
    set({ serves });
    await persist(serves);
  },
  remove: async (id) => {
    const serves = get().serves.filter((s) => s.id !== id);
    set({ serves });
    await persist(serves);
  },
  setAutoStart: async (id, autoStart) => {
    const serves = get().serves.map((s) => (s.id === id ? { ...s, autoStart } : s));
    set({ serves });
    await persist(serves);
  },
}));
