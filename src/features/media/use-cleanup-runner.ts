import { useEffect } from "react";
import { toast } from "sonner";

import { logActivity } from "@/store/activity";
import { useSettingsStore } from "@/store/settings";

import { planCleanup } from "./cleanup";
import { deleteLocalCopy } from "./watch-actions";
import { getWatchedDb } from "./watched-db";

const RUN_EVERY_MS = 5 * 60_000;

/** Apply the configured auto-cleanup rules to the Watch Folder right now. */
export async function runCleanupNow(): Promise<number> {
  const { settings } = useSettingsStore.getState();
  const rules = settings.cleanup;
  if ((rules.afterHours === null && rules.sizeCapGb === null) || !settings.watchFolder) {
    return 0;
  }

  const db = await getWatchedDb();
  const items = await db.withLocalCopies();
  const plan = planCleanup(
    items.map((i) => ({
      id: i.id,
      name: i.name,
      localPath: i.localPath ?? "",
      size: i.size,
      syncedAt: i.syncedAt,
      watchedAt: i.watchedAt,
    })),
    rules,
    Date.now(),
  );

  let deleted = 0;
  for (const { item, reason } of plan) {
    try {
      await deleteLocalCopy(item.localPath, item.name);
      await db.markLocalDeleted(item.id);
      logActivity("warning", "cleanup", `Auto-cleanup (${reason}) removed "${item.name}"`);
      deleted++;
    } catch (err) {
      logActivity(
        "error",
        "cleanup",
        `Auto-cleanup could not remove "${item.name}": ${(err as Error).message}`,
      );
    }
  }
  if (deleted > 0) {
    toast.info(`Auto-cleanup removed ${deleted} item${deleted === 1 ? "" : "s"}`);
  }
  return deleted;
}

/** Periodic auto-cleanup while the app is open. */
export function useCleanupRunner(): void {
  useEffect(() => {
    const initial = setTimeout(() => void runCleanupNow(), 15_000);
    const timer = setInterval(() => void runCleanupNow(), RUN_EVERY_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);
}
