import { create } from "zustand";

/** Auto-cleanup rules for the Watch Folder. All optional/off by default. */
export interface CleanupRules {
  /** Delete local copies N hours after sync (null = off). */
  afterHours: number | null;
  /** Keep the Watch Folder under this many GB, evicting oldest first (null = off). */
  sizeCapGb: number | null;
  /** When true, auto-delete only items marked watched. */
  watchedOnly: boolean;
}

export interface AppSettings {
  /** Explicit rclone binary path; null = auto-detect from PATH. */
  rclonePath: string | null;
  /** Default per-operation overrides applied to new operations. */
  defaultTransfers: number | null;
  defaultCheckers: number | null;
  defaultBwLimit: string | null;
  /** Local folder media is synced into for watching. */
  watchFolder: string | null;
  /** Open the file with the OS default app when a Watch sync completes. */
  autoOpenAfterSync: boolean;
  /** Delete the local copy immediately when marked watched. */
  deleteOnMarkWatched: boolean;
  cleanup: CleanupRules;
  /** TMDB API key for the media library view (user-supplied). */
  tmdbApiKey: string | null;
  /** Keep running in the tray when the window is closed. */
  runInBackground: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  rclonePath: null,
  defaultTransfers: null,
  defaultCheckers: null,
  defaultBwLimit: null,
  watchFolder: null,
  autoOpenAfterSync: true,
  deleteOnMarkWatched: false,
  cleanup: { afterHours: null, sizeCapGb: null, watchedOnly: true },
  tmdbApiKey: null,
  runInBackground: true,
};

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "settings.json";
const STORE_KEY = "app";

async function readPersisted(): Promise<Partial<AppSettings> | null> {
  if (!isTauri()) return null;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  return (await store.get<Partial<AppSettings>>(STORE_KEY)) ?? null;
}

async function writePersisted(settings: AppSettings): Promise<void> {
  if (!isTauri()) return;
  const { load } = await import("@tauri-apps/plugin-store");
  const store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  await store.set(STORE_KEY, settings);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const persisted = await readPersisted();
    set({
      settings: {
        ...DEFAULT_SETTINGS,
        ...persisted,
        cleanup: { ...DEFAULT_SETTINGS.cleanup, ...persisted?.cleanup },
      },
      hydrated: true,
    });
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await writePersisted(next);
  },
}));
