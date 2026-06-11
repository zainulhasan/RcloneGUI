import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { rc } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";
import { useSavedServesStore } from "@/store/saved-serves";

import { buildServeArgs, type ServeConfig } from "./serve-options";

/**
 * Serves run as never-ending daemon jobs; they are tracked here, NOT in the
 * jobs store, so the completion watcher and transfer history ignore them.
 */
export interface ActiveServe {
  jobid: number;
  config: ServeConfig;
}

interface ActiveServesState {
  serves: ActiveServe[];
  track: (serve: ActiveServe) => void;
  remove: (jobid: number) => void;
}

export const useActiveServesStore = create<ActiveServesState>((set) => ({
  serves: [],
  track: (serve) =>
    set((s) => ({ serves: [...s.serves.filter((x) => x.jobid !== serve.jobid), serve] })),
  remove: (jobid) => set((s) => ({ serves: s.serves.filter((x) => x.jobid !== jobid) })),
}));

/** Start one serve and track it. Throws on RC errors. */
export async function startServe(config: ServeConfig): Promise<void> {
  const { arg, opt } = buildServeArgs(config);
  const { jobid } = await rc.command("serve", arg, opt);
  useActiveServesStore.getState().track({ jobid, config });
  logActivity("info", "operation", `Serving ${config.fs} over ${config.protocol} (job ${jobid})`);
}

/** Stop a running serve. */
export async function stopServe(jobid: number): Promise<void> {
  await rc.jobStop(jobid);
  useActiveServesStore.getState().remove(jobid);
  logActivity("info", "operation", `Stopped serve job ${jobid}`);
}

/** On app start, launch every saved serve flagged auto-start. */
export function useAutoServes(): void {
  const hydrate = useSavedServesStore((s) => s.hydrate);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      await hydrate();
      const auto = useSavedServesStore.getState().serves.filter((s) => s.autoStart);
      const runningIds = new Set(useActiveServesStore.getState().serves.map((s) => s.config.id));
      for (const config of auto) {
        if (runningIds.has(config.id)) continue;
        try {
          await startServe(config);
        } catch (err) {
          logActivity(
            "error",
            "operation",
            `Auto-serve of ${config.fs} failed: ${(err as Error).message}`,
          );
          toast.error(`Auto-serve of ${config.fs} failed`, {
            description: (err as Error).message,
          });
        }
      }
      const started = auto.filter((c) => !runningIds.has(c.id)).length;
      if (started > 0) toast.success(`Started ${started} saved serve${started === 1 ? "" : "s"}`);
    })();
  }, [hydrate]);
}
