import { useEffect } from "react";

import { absoluteToLocalPath, useBrowserStore } from "@/store/browser";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Resolve the OS home directory once and point local panes at it. */
export function useHomeInit(): void {
  const setHomePath = useBrowserStore((s) => s.setHomePath);
  useEffect(() => {
    if (!isTauri()) return;
    void import("@tauri-apps/api/path")
      .then((m) => m.homeDir())
      .then((home) => {
        if (home) setHomePath(absoluteToLocalPath(home));
      })
      .catch(() => {
        // Home stays at "/" — navigation still works, just less convenient.
      });
  }, [setHomePath]);
}
