import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { rc } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";
import { useSavedMountsStore, type SavedMount } from "@/store/saved-mounts";

import { toRcMountOptions } from "./mount-options";

/** Mount one saved configuration (shared by auto-mount and the Mount button). */
export async function mountSaved(saved: SavedMount): Promise<void> {
  const { vfsOpt, mountOpt } = toRcMountOptions(saved.options);
  await rc.mount(saved.fs, saved.mountPoint, { vfsOpt, mountOpt });
}

/** On app start, mount every saved mount flagged auto-mount (skipping active ones). */
export function useAutoMounts(): void {
  const hydrate = useSavedMountsStore((s) => s.hydrate);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      await hydrate();
      const { mounts } = useSavedMountsStore.getState();
      const auto = mounts.filter((m) => m.autoMount);
      if (auto.length === 0) return;

      const active = new Set(
        ((await rc.listMounts().catch(() => [])) ?? []).map((m) => m.MountPoint),
      );
      for (const saved of auto) {
        if (active.has(saved.mountPoint)) continue;
        try {
          await mountSaved(saved);
          logActivity("info", "operation", `Auto-mounted ${saved.fs} at ${saved.mountPoint}`);
        } catch (err) {
          logActivity(
            "error",
            "operation",
            `Auto-mount of ${saved.fs} failed: ${(err as Error).message}`,
          );
          toast.error(`Auto-mount of ${saved.fs} failed`, {
            description: (err as Error).message,
          });
        }
      }
      const mounted = auto.filter((m) => !active.has(m.mountPoint)).length;
      if (mounted > 0) toast.success(`Auto-mounted ${mounted} remote${mounted === 1 ? "" : "s"}`);
    })();
  }, [hydrate]);
}
