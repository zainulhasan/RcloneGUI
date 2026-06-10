import { useEffect } from "react";

import { flagsToOptions } from "@/features/operations/flags";
import { rc } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useScheduledJobsStore, type ScheduledJob } from "@/store/scheduled-jobs";

import { cronMatches } from "./cron";

const TICK_MS = 20_000;

/** Start a scheduled job now. Shared by the runner and the "Run now" button. */
export async function executeScheduledJob(job: ScheduledJob): Promise<void> {
  const options = flagsToOptions(job.flags);
  const start =
    job.kind === "copy"
      ? rc.copy(job.srcFs, job.dstFs, options)
      : job.kind === "sync"
        ? rc.sync(job.srcFs, job.dstFs, options)
        : rc.move(job.srcFs, job.dstFs, options);

  const { recordRun } = useScheduledJobsStore.getState();
  try {
    const { jobid } = await start;
    useJobsStore.getState().track({ jobid, label: `${job.name} (scheduled)`, kind: job.kind });
    logActivity("info", "scheduler", `Scheduled job "${job.name}" started (job ${jobid})`);
    await recordRun(job.id, "success");
  } catch (err) {
    const message = (err as Error).message;
    logActivity("error", "scheduler", `Scheduled job "${job.name}" failed to start: ${message}`);
    await recordRun(job.id, "error", message);
  }
}

/**
 * Ticks every 20s; fires enabled jobs whose cron matches the current minute,
 * at most once per minute (guarded by lastRunAt).
 */
export function useSchedulerRunner(): void {
  const hydrate = useScheduledJobsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    const timer = setInterval(() => {
      const now = new Date();
      const { jobs } = useScheduledJobsStore.getState();
      for (const job of jobs) {
        if (!job.enabled) continue;
        if (!cronMatches(job.cron, now)) continue;
        const sameMinute =
          job.lastRunAt !== null &&
          Math.floor(job.lastRunAt / 60_000) === Math.floor(now.getTime() / 60_000);
        if (sameMinute) continue;
        void executeScheduledJob(job);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [hydrate]);
}
