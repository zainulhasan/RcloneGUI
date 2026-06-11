import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

import { rc } from "@/lib/rc-client";
import { formatSpeed } from "@/lib/format";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Keep the Rust hide-on-close flag in sync with the setting. */
export function useBackgroundMode(): void {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const runInBackground = useSettingsStore((s) => s.settings.runInBackground);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    void invoke("set_hide_on_close", { enabled: runInBackground });
  }, [hydrated, runInBackground]);
}

const TRAY_POLL_MS = 2000;

/** Mirror live transfer speed into the tray title/tooltip while jobs run. */
export function useTrayStatus(): void {
  const activeCount = useJobsStore((s) => s.jobs.filter((j) => !j.finished).length);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    if (activeCount === 0) {
      if (wasActive.current) {
        wasActive.current = false;
        void invoke("tray_status", { text: "" });
      }
      return;
    }

    wasActive.current = true;
    const update = async () => {
      try {
        const stats = await rc.stats();
        const speed = stats.speed > 0 ? formatSpeed(stats.speed) : "starting…";
        await invoke("tray_status", {
          text: `↕ ${speed} · ${activeCount} job${activeCount === 1 ? "" : "s"}`,
        });
      } catch {
        // Daemon hiccup — leave the previous status.
      }
    };
    void update();
    const timer = setInterval(() => void update(), TRAY_POLL_MS);
    return () => clearInterval(timer);
  }, [activeCount]);
}

/** Query + toggle the OS launch-at-login registration. */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  return isEnabled();
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}
