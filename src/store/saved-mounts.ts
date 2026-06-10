import { create } from "zustand";

import { DEFAULT_MOUNT_OPTIONS, type MountFormOptions } from "@/features/mounts/mount-options";

export interface SavedMount {
  id: string;
  fs: string;
  mountPoint: string;
  options: MountFormOptions;
  /** Mount automatically when the app starts. */
  autoMount: boolean;
}

interface SavedMountsState {
  mounts: SavedMount[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (mount: SavedMount) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setAutoMount: (id: string, autoMount: boolean) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "mounts.json";
const STORE_KEY = "saved";

async function persist(mounts: SavedMount[]): Promise<void> {
  if (!isTauri()) return;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  await store.set(STORE_KEY, mounts);
}

export const useSavedMountsStore = create<SavedMountsState>((set, get) => ({
  mounts: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    let mounts: SavedMount[] = [];
    if (isTauri()) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
      const raw = (await store.get<SavedMount[]>(STORE_KEY)) ?? [];
      mounts = raw.map((m) => ({ ...m, options: { ...DEFAULT_MOUNT_OPTIONS, ...m.options } }));
    }
    set({ mounts, hydrated: true });
  },
  upsert: async (mount) => {
    const mounts = [...get().mounts.filter((m) => m.id !== mount.id), mount].sort((a, b) =>
      a.fs.localeCompare(b.fs),
    );
    set({ mounts });
    await persist(mounts);
  },
  remove: async (id) => {
    const mounts = get().mounts.filter((m) => m.id !== id);
    set({ mounts });
    await persist(mounts);
  },
  setAutoMount: async (id, autoMount) => {
    const mounts = get().mounts.map((m) => (m.id === id ? { ...m, autoMount } : m));
    set({ mounts });
    await persist(mounts);
  },
}));
