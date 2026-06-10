import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { rc, type RcOperationOptions } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";
import { useJobsStore, type JobKind } from "@/store/jobs";

export interface DirOperationRequest {
  kind: Exclude<JobKind, "delete" | "watch">;
  srcFs: string;
  dstFs: string;
  options: RcOperationOptions;
  label: string;
  /** First bisync run for a pair must resync. */
  resync?: boolean;
}

/** Start an async directory operation and register it with the dashboard. */
export function useRunOperation() {
  const track = useJobsStore((s) => s.track);
  return useMutation({
    mutationFn: async (req: DirOperationRequest) => {
      switch (req.kind) {
        case "copy":
          return rc.copy(req.srcFs, req.dstFs, req.options);
        case "sync":
          return rc.sync(req.srcFs, req.dstFs, req.options);
        case "move":
          return rc.move(req.srcFs, req.dstFs, req.options);
        case "bisync":
          return rc.bisync(req.srcFs, req.dstFs, { ...req.options, resync: req.resync });
      }
    },
    onSuccess: (job, req) => {
      track({ jobid: job.jobid, label: req.label, kind: req.kind });
      const dry = req.options.config?.DryRun ? " (dry run)" : "";
      logActivity(
        "info",
        "operation",
        `Started ${req.kind}${dry}: ${req.srcFs} → ${req.dstFs} (job ${job.jobid})`,
      );
      toast.success(`${capitalize(req.kind)} started${dry}`, {
        description: req.label,
      });
    },
    onError: (err, req) => {
      logActivity("error", "operation", `Failed to start ${req.kind}: ${err.message}`);
      toast.error(`${capitalize(req.kind)} failed to start`, { description: err.message });
    },
  });
}

export interface DeleteRequest {
  fs: string;
  items: { path: string; name: string; isDir: boolean }[];
  dryRun: boolean;
}

/** Delete files/directories. Sequential so one failure stops the batch. */
export function useDeleteItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fs, items, dryRun }: DeleteRequest) => {
      const options = dryRun ? { _config: { DryRun: true } } : {};
      for (const item of items) {
        if (item.isDir) {
          await rcCallDelete("operations/purge", fs, item.path, options);
        } else {
          await rcCallDelete("operations/deletefile", fs, item.path, options);
        }
      }
    },
    onSuccess: (_d, req) => {
      const what = req.items.length === 1 ? req.items[0].name : `${req.items.length} items`;
      if (req.dryRun) {
        toast.success(`Dry run: ${what} would be deleted`);
        logActivity("info", "operation", `Dry-run delete on ${req.fs}: ${what}`);
      } else {
        toast.success(`Deleted ${what}`);
        for (const item of req.items) {
          logActivity("warning", "operation", `Deleted ${req.fs}${item.path}`);
        }
        void queryClient.invalidateQueries({ queryKey: ["listing"] });
      }
    },
    onError: (err, req) => {
      toast.error(`Delete failed: ${err.message}`);
      logActivity("error", "operation", `Delete on ${req.fs} failed: ${err.message}`);
    },
  });
}

/** rclone's delete endpoints take fs+remote plus optional _config. */
async function rcCallDelete(
  method: "operations/purge" | "operations/deletefile",
  fs: string,
  remote: string,
  extra: Record<string, unknown>,
): Promise<void> {
  const { tauriTransport } = await import("@/lib/rc-client");
  await tauriTransport(method, { fs, remote, ...extra });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
