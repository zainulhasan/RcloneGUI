import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";

import { rc } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";

import { getJobHistoryDb } from "./history-db";

const POLL_MS = 1000;
export const SPARKLINE_SAMPLES = 60;

interface SpeedSamplesState {
  samples: number[];
  push: (speed: number) => void;
}

const useSpeedSamplesStore = create<SpeedSamplesState>((set) => ({
  samples: [],
  push: (speed) => set((s) => ({ samples: [...s.samples, speed].slice(-SPARKLINE_SAMPLES) })),
}));

/**
 * Global transfer stats, polled while the dashboard is visible. Each poll
 * also appends to the bandwidth-history window.
 */
export function useCoreStats(enabled = true) {
  return useQuery({
    queryKey: ["core-stats"],
    queryFn: async () => {
      const stats = await rc.stats();
      useSpeedSamplesStore.getState().push(stats.speed);
      return stats;
    },
    refetchInterval: POLL_MS,
    enabled,
  });
}

/** Rolling window of global speed samples for the bandwidth chart. */
export function useSpeedSamples(): number[] {
  return useSpeedSamplesStore((s) => s.samples);
}

/**
 * Watches tracked jobs: polls job/status for unfinished ones and fires a
 * toast + activity entry exactly once when each finishes.
 */
export function useJobCompletionWatcher() {
  const jobs = useJobsStore((s) => s.jobs);
  const markFinished = useJobsStore((s) => s.markFinished);
  const queryClient = useQueryClient();
  const unfinished = jobs.filter((j) => !j.finished);

  useEffect(() => {
    if (unfinished.length === 0) return;
    const timer = setInterval(() => {
      for (const job of unfinished) {
        rc.jobStatus(job.jobid)
          .then(async (status) => {
            if (!status.finished) return;
            markFinished(job.jobid, status.success, status.error || undefined);
            const finalStats = await rc.stats(job.group).catch(() => null);
            void getJobHistoryDb()
              .then((db) =>
                db.record({
                  kind: job.kind,
                  label: job.label,
                  startedAt: job.startedAt,
                  finishedAt: Date.now(),
                  success: status.success,
                  error: status.error || null,
                  bytes: finalStats?.bytes ?? 0,
                }),
              )
              .then(() => queryClient.invalidateQueries({ queryKey: ["job-history"] }))
              .catch(() => {
                logActivity("warning", "operation", "Could not record job in history");
              });
            if (status.success) {
              toast.success(`${job.kind} finished`, { description: job.label });
              logActivity("info", "operation", `Job ${job.jobid} (${job.label}) finished`);
              if (job.kind === "watch" && job.meta) {
                void import("@/features/media/watch-actions").then((m) =>
                  m.handleWatchSyncComplete(job.meta as never),
                );
                void queryClient.invalidateQueries({ queryKey: ["media"] });
              }
            } else {
              toast.error(`${job.kind} failed`, { description: status.error || job.label });
              logActivity(
                "error",
                "operation",
                `Job ${job.jobid} (${job.label}) failed: ${status.error}`,
              );
            }
            void queryClient.invalidateQueries({ queryKey: ["listing"] });
          })
          .catch(() => {
            // Daemon restarts lose job state; mark as failed so the UI settles.
            markFinished(job.jobid, false, "job state lost (daemon restarted?)");
          });
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [unfinished, markFinished, queryClient]);
}

/** Per-job stats (speed, ETA, transferring files) scoped by group. */
export function useJobStats(group: string, enabled: boolean) {
  return useQuery({
    queryKey: ["job-stats", group],
    queryFn: () => rc.stats(group),
    refetchInterval: POLL_MS,
    enabled,
  });
}
