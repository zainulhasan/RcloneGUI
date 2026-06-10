import { describe, expect, it } from "vitest";

import { isInsideWatchFolder, planCleanup, type CleanupItem } from "./cleanup";
import type { CleanupRules } from "@/store/settings";

const GB = 1024 ** 3;
const HOUR = 3_600_000;
const NOW = 1_750_000_000_000;

let nextId = 1;
function item(over: Partial<CleanupItem> = {}): CleanupItem {
  const id = over.id ?? nextId++;
  return {
    id,
    name: `item-${id}`,
    localPath: `/watch/item-${id}.mkv`,
    size: 1 * GB,
    syncedAt: NOW - 1 * HOUR,
    watchedAt: null,
    ...over,
  };
}

const OFF: CleanupRules = { afterHours: null, sizeCapGb: null, watchedOnly: true };

describe("planCleanup — time rule", () => {
  it("does nothing when all rules are off", () => {
    expect(planCleanup([item(), item()], OFF, NOW)).toEqual([]);
  });

  it("expires items older than afterHours", () => {
    const old = item({ syncedAt: NOW - 30 * HOUR, watchedAt: NOW });
    const fresh = item({ syncedAt: NOW - 2 * HOUR, watchedAt: NOW });
    const plan = planCleanup([old, fresh], { ...OFF, afterHours: 24 }, NOW);
    expect(plan).toEqual([{ item: old, reason: "expired" }]);
  });

  it("expires exactly at the boundary", () => {
    const boundary = item({ syncedAt: NOW - 24 * HOUR, watchedAt: NOW });
    const plan = planCleanup([boundary], { ...OFF, afterHours: 24 }, NOW);
    expect(plan).toHaveLength(1);
  });

  it("watchedOnly keeps unwatched items even when expired", () => {
    const unwatched = item({ syncedAt: NOW - 100 * HOUR, watchedAt: null });
    expect(planCleanup([unwatched], { ...OFF, afterHours: 24 }, NOW)).toEqual([]);
  });

  it("includes unwatched items when watchedOnly is off", () => {
    const unwatched = item({ syncedAt: NOW - 100 * HOUR, watchedAt: null });
    const plan = planCleanup([unwatched], { ...OFF, afterHours: 24, watchedOnly: false }, NOW);
    expect(plan).toHaveLength(1);
  });

  it("never expires items that were never synced", () => {
    const watchedOnlyEntry = item({ syncedAt: null, watchedAt: NOW - 100 * HOUR });
    expect(planCleanup([watchedOnlyEntry], { ...OFF, afterHours: 1 }, NOW)).toEqual([]);
  });
});

describe("planCleanup — size cap", () => {
  it("evicts oldest watched items first until under the cap", () => {
    const oldest = item({ size: 2 * GB, syncedAt: NOW - 10 * HOUR, watchedAt: NOW });
    const middle = item({ size: 2 * GB, syncedAt: NOW - 5 * HOUR, watchedAt: NOW });
    const newest = item({ size: 2 * GB, syncedAt: NOW - 1 * HOUR, watchedAt: NOW });
    // 6 GB total, cap 3 GB → drop oldest two (6→4→2).
    const plan = planCleanup([newest, oldest, middle], { ...OFF, sizeCapGb: 3 }, NOW);
    expect(plan.map((p) => p.item.id)).toEqual([oldest.id, middle.id]);
    expect(plan.every((p) => p.reason === "size-cap")).toBe(true);
  });

  it("does nothing when under the cap", () => {
    const a = item({ size: 1 * GB, watchedAt: NOW });
    expect(planCleanup([a], { ...OFF, sizeCapGb: 2 }, NOW)).toEqual([]);
  });

  it("unwatched items count toward the total but are not evicted when watchedOnly", () => {
    const unwatchedBig = item({ size: 5 * GB, syncedAt: NOW - 10 * HOUR, watchedAt: null });
    const watchedSmall = item({ size: 1 * GB, syncedAt: NOW - 5 * HOUR, watchedAt: NOW });
    // 6 GB total, cap 3: only the watched 1 GB item may go; still over cap after.
    const plan = planCleanup([unwatchedBig, watchedSmall], { ...OFF, sizeCapGb: 3 }, NOW);
    expect(plan.map((p) => p.item.id)).toEqual([watchedSmall.id]);
  });

  it("counts expired deletions before evicting for size", () => {
    const expired = item({ size: 4 * GB, syncedAt: NOW - 48 * HOUR, watchedAt: NOW });
    const recent = item({ size: 2 * GB, syncedAt: NOW - 1 * HOUR, watchedAt: NOW });
    // 6 GB total; removing the expired 4 GB brings it to 2 GB < 3 GB cap.
    const plan = planCleanup([expired, recent], { ...OFF, afterHours: 24, sizeCapGb: 3 }, NOW);
    expect(plan).toEqual([{ item: expired, reason: "expired" }]);
  });

  it("does not double-plan an item matched by both rules", () => {
    const both = item({ size: 9 * GB, syncedAt: NOW - 48 * HOUR, watchedAt: NOW });
    const plan = planCleanup([both], { ...OFF, afterHours: 24, sizeCapGb: 1 }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].reason).toBe("expired");
  });
});

describe("isInsideWatchFolder", () => {
  it("accepts paths inside the folder", () => {
    expect(isInsideWatchFolder("/watch/movie.mkv", "/watch")).toBe(true);
    expect(isInsideWatchFolder("/watch/sub/movie.mkv", "/watch/")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isInsideWatchFolder("/watch.mkv", "/watch")).toBe(false);
    expect(isInsideWatchFolder("/other/movie.mkv", "/watch")).toBe(false);
    expect(isInsideWatchFolder("/watch/../etc/passwd", "/watch")).toBe(false);
    expect(isInsideWatchFolder("/watch", "/watch")).toBe(false);
    expect(isInsideWatchFolder("/watch/a.mkv", "")).toBe(false);
  });
});
