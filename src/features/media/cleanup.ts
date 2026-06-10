import type { CleanupRules } from "@/store/settings";

/** Minimal item shape the cleanup planner needs. */
export interface CleanupItem {
  id: number;
  name: string;
  localPath: string;
  size: number;
  syncedAt: number | null;
  watchedAt: number | null;
}

export type CleanupReason = "expired" | "size-cap";

export interface PlannedDeletion {
  item: CleanupItem;
  reason: CleanupReason;
}

const HOUR_MS = 3_600_000;
const GB = 1024 ** 3;

function isEligible(item: CleanupItem, rules: CleanupRules): boolean {
  return rules.watchedOnly ? item.watchedAt !== null : true;
}

/**
 * Decide which local copies to delete, given the items currently in the
 * Watch Folder and the configured rules.
 *
 * - `afterHours`: items synced more than N hours ago are expired.
 * - `sizeCapGb`: if the folder total still exceeds the cap after removing
 *   expired items, evict the oldest eligible items until under the cap.
 * - `watchedOnly`: restricts both rules to items already marked watched.
 *
 * Pure: caller supplies `now`. Only ever returns items that were passed in,
 * so it can never touch anything outside the Watch Folder.
 */
export function planCleanup(
  items: CleanupItem[],
  rules: CleanupRules,
  now: number,
): PlannedDeletion[] {
  const planned = new Map<number, PlannedDeletion>();

  if (rules.afterHours !== null) {
    const cutoff = now - rules.afterHours * HOUR_MS;
    for (const item of items) {
      if (!isEligible(item, rules)) continue;
      if (item.syncedAt !== null && item.syncedAt <= cutoff) {
        planned.set(item.id, { item, reason: "expired" });
      }
    }
  }

  if (rules.sizeCapGb !== null) {
    const capBytes = rules.sizeCapGb * GB;
    let total = items.reduce((sum, i) => sum + i.size, 0);
    for (const p of planned.values()) total -= p.item.size;

    if (total > capBytes) {
      const candidates = items
        .filter((i) => isEligible(i, rules) && !planned.has(i.id))
        .sort((a, b) => (a.syncedAt ?? 0) - (b.syncedAt ?? 0));
      for (const item of candidates) {
        if (total <= capBytes) break;
        planned.set(item.id, { item, reason: "size-cap" });
        total -= item.size;
      }
    }
  }

  return [...planned.values()];
}

/**
 * True when `path` is inside `watchFolder`. Cleanup refuses to delete
 * anything else, whatever the DB says.
 */
export function isInsideWatchFolder(path: string, watchFolder: string): boolean {
  if (!watchFolder) return false;
  const folder = watchFolder.endsWith("/") ? watchFolder : `${watchFolder}/`;
  return path.startsWith(folder) && path.length > folder.length && !path.includes("..");
}
