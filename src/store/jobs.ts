import { create } from "zustand";

export type JobKind = "copy" | "sync" | "move" | "bisync" | "delete" | "watch";

export interface TrackedJob {
  jobid: number;
  /** Stats group rclone assigned ("job/<id>"). */
  group: string;
  label: string;
  kind: JobKind;
  startedAt: number;
  /** Set when job/status reports the job done. */
  finished?: boolean;
  success?: boolean;
  error?: string;
  /** Extra context, e.g. the media item a Watch sync belongs to. */
  meta?: Record<string, unknown>;
}

interface JobsState {
  jobs: TrackedJob[];
  track: (job: Omit<TrackedJob, "group" | "startedAt">) => void;
  markFinished: (jobid: number, success: boolean, error?: string) => void;
  remove: (jobid: number) => void;
  clearFinished: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  track: (job) =>
    set((s) => ({
      jobs: [
        ...s.jobs.filter((j) => j.jobid !== job.jobid),
        { ...job, group: `job/${job.jobid}`, startedAt: Date.now() },
      ],
    })),
  markFinished: (jobid, success, error) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.jobid === jobid ? { ...j, finished: true, success, error } : j)),
    })),
  remove: (jobid) => set((s) => ({ jobs: s.jobs.filter((j) => j.jobid !== jobid) })),
  clearFinished: () => set((s) => ({ jobs: s.jobs.filter((j) => !j.finished) })),
}));
