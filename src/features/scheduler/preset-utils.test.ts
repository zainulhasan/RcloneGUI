import { describe, expect, it } from "vitest";

import { EMPTY_FLAGS } from "@/features/operations/flags";
import type { Preset } from "@/store/presets";

import { presetToScheduledJob } from "./preset-utils";

function preset(over: Partial<Preset> = {}): Preset {
  return {
    id: "p1",
    name: "Nightly photos",
    kind: "copy",
    srcFs: "gdrive:photos",
    dstFs: "/backup/photos",
    flags: { ...EMPTY_FLAGS, transfers: "8" },
    ...over,
  };
}

describe("presetToScheduledJob", () => {
  it("maps preset fields onto a fresh job", () => {
    const job = presetToScheduledJob(preset(), "job-1");
    expect(job.id).toBe("job-1");
    expect(job.name).toBe("Nightly photos");
    expect(job.kind).toBe("copy");
    expect(job.srcFs).toBe("gdrive:photos");
    expect(job.dstFs).toBe("/backup/photos");
    expect(job.flags.transfers).toBe("8");
  });

  it("keeps schedulable defaults from newScheduledJob", () => {
    const job = presetToScheduledJob(preset(), "job-2");
    expect(job.cron).toBe("0 3 * * *");
    expect(job.enabled).toBe(true);
    expect(job.lastRunAt).toBeNull();
  });

  it("downgrades bisync presets to copy (scheduler has no bisync)", () => {
    const job = presetToScheduledJob(preset({ kind: "bisync" }), "job-3");
    expect(job.kind).toBe("copy");
  });
});
