import { toast } from "sonner";

import { rc, tauriTransport, type RcListItem } from "@/lib/rc-client";
import { diskFree } from "@/lib/tauri";
import { formatBytes } from "@/lib/format";
import { logActivity } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";

import { isInsideWatchFolder } from "./cleanup";
import type { WatchJobMeta } from "./types";
import { getWatchedDb } from "./watched-db";

/**
 * The Watch flow: copy a remote file/folder into the Watch Folder, then (on
 * completion) record it and open it with the OS default app.
 * The remote is only ever read — never modified.
 */
export async function startWatchSync(
  item: RcListItem,
  pane: { fs: string },
  opts: { skipSpaceCheck?: boolean } = {},
): Promise<void> {
  const { settings } = useSettingsStore.getState();
  const watchFolder = settings.watchFolder;
  if (!watchFolder) {
    toast.error("Set a Watch Folder in Settings first.");
    return;
  }

  // Disk space guard: warn when the item won't fit, with an explicit override.
  if (!opts.skipSpaceCheck) {
    try {
      const needed = item.IsDir ? (await rc.size(pane.fs, item.Path)).bytes : item.Size;
      const free = await diskFree(watchFolder);
      if (needed > free) {
        toast.warning(`"${item.Name}" (${formatBytes(needed)}) won't fit`, {
          description: `Only ${formatBytes(free)} free on the Watch Folder drive.`,
          action: {
            label: "Sync anyway",
            onClick: () => void startWatchSync(item, pane, { skipSpaceCheck: true }),
          },
          duration: 10_000,
        });
        return;
      }
    } catch {
      // If the check itself fails we proceed; rclone will surface real errors.
    }
  }

  const localPath = `${watchFolder.replace(/\/+$/, "")}/${item.Name}`;
  const meta: WatchJobMeta = {
    remoteFs: pane.fs,
    remotePath: item.Path,
    name: item.Name,
    size: item.Size,
    localPath,
    isDir: item.IsDir,
  };

  try {
    const job = item.IsDir
      ? await rc.copy(`${joinFs(pane.fs, item.Path)}`, localPath)
      : await rc.copyFile(pane.fs, item.Path, watchFolder, item.Name);
    useJobsStore
      .getState()
      .track({ jobid: job.jobid, label: `Watch: ${item.Name}`, kind: "watch", meta });
    logActivity("info", "media", `Watch sync started for "${item.Name}" (job ${job.jobid})`);
    toast.success(`Syncing "${item.Name}" to your Watch Folder`);
  } catch (err) {
    toast.error(`Could not start sync: ${(err as Error).message}`);
    logActivity("error", "media", `Watch sync failed to start: ${(err as Error).message}`);
  }
}

function joinFs(fs: string, path: string): string {
  if (!path) return fs;
  return fs.endsWith(":") || fs.endsWith("/") ? `${fs}${path}` : `${fs}/${path}`;
}

/** Called by the job watcher when a Watch sync finishes successfully. */
export async function handleWatchSyncComplete(meta: WatchJobMeta): Promise<void> {
  const db = await getWatchedDb();
  await db.recordSynced({
    remoteFs: meta.remoteFs,
    remotePath: meta.remotePath,
    name: meta.name,
    size: meta.size,
    localPath: meta.localPath,
  });
  logActivity("info", "media", `"${meta.name}" is ready in the Watch Folder`);

  const { settings } = useSettingsStore.getState();
  if (settings.autoOpenAfterSync && !meta.isDir) {
    try {
      await openLocal(meta.localPath);
    } catch (err) {
      toast.error(`Could not open "${meta.name}": ${(err as Error).message}`);
    }
  }
}

/** Open a local file with the OS default application. */
export async function openLocal(path: string): Promise<void> {
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

/**
 * Delete one local copy from the Watch Folder. Refuses anything outside it.
 * Every call is logged; the remote is never touched.
 */
export async function deleteLocalCopy(localPath: string, name: string): Promise<void> {
  const { settings } = useSettingsStore.getState();
  const watchFolder = settings.watchFolder ?? "";
  if (!isInsideWatchFolder(localPath, watchFolder)) {
    throw new Error(`refusing to delete outside the Watch Folder: ${localPath}`);
  }
  const relative = localPath.slice(watchFolder.replace(/\/+$/, "").length + 1);
  try {
    await tauriTransport("operations/deletefile", { fs: watchFolder, remote: relative });
  } catch {
    // Directories synced via Watch need purge instead.
    await tauriTransport("operations/purge", { fs: watchFolder, remote: relative });
  }
  logActivity("warning", "cleanup", `Deleted local copy "${name}" (${localPath})`);
}
