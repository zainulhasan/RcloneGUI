import type { Preset } from "@/store/presets";
import { newScheduledJob, type ScheduledJob } from "@/store/scheduled-jobs";

/** Seed a schedulable job from a preset (bisync schedules as copy). */
export function presetToScheduledJob(preset: Preset, id: string): ScheduledJob {
  return {
    ...newScheduledJob(),
    id,
    name: preset.name,
    kind: preset.kind === "bisync" ? "copy" : preset.kind,
    srcFs: preset.srcFs,
    dstFs: preset.dstFs,
    flags: preset.flags,
  };
}
