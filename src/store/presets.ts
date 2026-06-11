import { create } from "zustand";

import type { FlagsValue } from "@/features/operations/flags";

/** A saved, reusable transfer configuration. */
export interface Preset {
  id: string;
  name: string;
  kind: "copy" | "sync" | "move" | "bisync";
  srcFs: string;
  dstFs: string;
  flags: FlagsValue;
}

interface PresetsState {
  presets: Preset[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (preset: Preset) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "presets.json";
const STORE_KEY = "presets";

async function persist(presets: Preset[]): Promise<void> {
  if (!isTauri()) return;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  await store.set(STORE_KEY, presets);
}

export const usePresetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    let presets: Preset[] = [];
    if (isTauri()) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
      presets = (await store.get<Preset[]>(STORE_KEY)) ?? [];
    }
    set({ presets, hydrated: true });
  },
  upsert: async (preset) => {
    const presets = [...get().presets.filter((p) => p.id !== preset.id), preset].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    set({ presets });
    await persist(presets);
  },
  remove: async (id) => {
    const presets = get().presets.filter((p) => p.id !== id);
    set({ presets });
    await persist(presets);
  },
}));
