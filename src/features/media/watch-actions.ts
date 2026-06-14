import { toast } from "sonner";

import { rc, tauriTransport, type RcListItem } from "@/lib/rc-client";
import { diskFree, openWithPlayer } from "@/lib/tauri";
import { formatBytes } from "@/lib/format";
import { logActivity } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";

import { isInsideWatchFolder } from "./cleanup";
import type { WatchJobMeta } from "./types";
import { getWatchedDb } from "./watched-db";

// ── subtitle helpers ──────────────────────────────────────────────────────────
const SUBTITLE_EXTS = new Set([".srt", ".sub", ".ass", ".ssa", ".vtt", ".idx", ".sup"]);

function fileBaseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function parentDirPath(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash > 0 ? filePath.slice(0, slash) : "";
}

async function downloadSubtitles(
  fs: string,
  videoItem: RcListItem,
  watchFolder: string,
): Promise<number> {
  const dir = parentDirPath(videoItem.Path);
  const videoBase = fileBaseName(videoItem.Name).toLowerCase();

  let siblings: RcListItem[];
  try {
    siblings = await rc.list(fs, dir);
  } catch {
    return 0;
  }

  const subs = siblings.filter((s) => {
    if (s.IsDir) return false;
    const dotIdx = s.Name.lastIndexOf(".");
    if (dotIdx < 0) return false;
    const ext = s.Name.slice(dotIdx).toLowerCase();
    if (!SUBTITLE_EXTS.has(ext)) return false;
    // Match exact base or language-coded variant (e.g. Movie.en.srt)
    const subBase = fileBaseName(s.Name).toLowerCase();
    return subBase === videoBase || subBase.startsWith(videoBase + ".");
  });

  for (const sub of subs) {
    try {
      const job = await rc.copyFile(fs, sub.Path, watchFolder, sub.Name, {
        config: { Retries: 3, LowLevelRetries: 3 },
      });
      logActivity("info", "media", `Subtitle download started: ${sub.Name} (job ${job.jobid})`);
    } catch (err) {
      logActivity(
        "warning",
        "media",
        `Subtitle download failed for ${sub.Name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return subs.length;
}

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

  const resumeOpts = {
    config: {
      Retries: 10,
      RetriesSleep: "5s",
      LowLevelRetries: 10,
    },
  };

  try {
    const job = item.IsDir
      ? await rc.copy(`${joinFs(pane.fs, item.Path)}`, localPath, resumeOpts)
      : await rc.copyFile(pane.fs, item.Path, watchFolder, item.Name, resumeOpts);
    useJobsStore
      .getState()
      .track({ jobid: job.jobid, label: `Watch: ${item.Name}`, kind: "watch", meta });
    logActivity("info", "media", `Watch sync started for "${item.Name}" (job ${job.jobid})`);
    toast.success(`Syncing "${item.Name}" to your Watch Folder`);

    // For single files, also grab any matching subtitle files from the same folder
    if (!item.IsDir) {
      void downloadSubtitles(pane.fs, item, watchFolder).then((count) => {
        if (count > 0) {
          toast.info(`Downloading ${count} subtitle file${count > 1 ? "s" : ""} alongside`);
        }
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(`Could not start sync: ${msg}`);
    logActivity("error", "media", `Watch sync failed to start: ${msg}`);
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
      toast.error(
        `Could not open "${meta.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Open a local file or URL, using the preferred player if configured.
 * Falls back to VLC auto-detection then the system default. */
export async function openLocal(path: string): Promise<void> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(path);
    return;
  }
  const { preferredPlayer } = useSettingsStore.getState().settings;
  // Empty string → Rust open_auto: tries VLC first, then system default
  await openWithPlayer(preferredPlayer ?? "", path);
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
