import { useEffect } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { logActivity } from "@/store/activity";

export interface AvailableUpdate {
  version: string;
  notes: string;
  /** Starts download + install, then relaunches the app. */
  install: () => Promise<void>;
}

interface UpdaterState {
  available: AvailableUpdate | null;
  installing: boolean;
  dismiss: () => void;
  setAvailable: (u: AvailableUpdate | null) => void;
  setInstalling: (v: boolean) => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  available: null,
  installing: false,
  dismiss: () => set({ available: null }),
  setAvailable: (available) => set({ available }),
  setInstalling: (installing) => set({ installing }),
}));

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Tauri plugin errors arrive as plain strings, not Error objects — and a
 * call interrupted by a reload rejects with `undefined`.
 */
function errorText(err: unknown): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;
  return "The check was interrupted — please try again.";
}

/**
 * Check GitHub Releases for a newer version. `silent` suppresses the
 * "you're up to date" / error toasts (used for the launch check).
 */
export async function checkForUpdates(opts: { silent: boolean }): Promise<void> {
  if (!isTauri()) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) {
      logActivity("info", "app", `Update available: v${update.version}`);
      useUpdaterStore.getState().setAvailable({
        version: update.version,
        notes: update.body ?? "",
        install: async () => {
          useUpdaterStore.getState().setInstalling(true);
          try {
            await update.downloadAndInstall();
            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
          } finally {
            useUpdaterStore.getState().setInstalling(false);
          }
        },
      });
    } else if (!opts.silent) {
      toast.success("RcloneGUI is up to date.");
    }
  } catch (err) {
    const detail = errorText(err);
    // A 404 on latest.json means no published release yet — not an error
    // worth alarming the user about.
    const friendly = /404|[Nn]ot [Ff]ound/.test(detail)
      ? "No published release found yet."
      : detail;
    logActivity("warning", "app", `Update check failed: ${friendly}`);
    if (!opts.silent) {
      toast.error("Update check failed", { description: friendly });
    }
  }
}

/** Silent update check once per app launch. */
export function useLaunchUpdateCheck(): void {
  useEffect(() => {
    const timer = setTimeout(() => void checkForUpdates({ silent: true }), 3000);
    return () => clearTimeout(timer);
  }, []);
}
