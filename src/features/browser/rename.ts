import { joinFsPath, tauriTransport, type RcListItem } from "@/lib/rc-client";

/** Null when valid, else a human-readable problem. */
export function validateRename(name: string, siblings: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty.";
  if (trimmed.includes("/")) return "Name cannot contain a slash.";
  if (trimmed === "." || trimmed === "..") return "That name is reserved.";
  if (siblings.includes(trimmed)) return "An item with this name already exists.";
  return null;
}

/** "films/old.mkv" + "new.mkv" → "films/new.mkv" */
export function renamedPath(path: string, newName: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? newName : `${path.slice(0, idx)}/${newName}`;
}

/**
 * Rename in place. Files use operations/movefile; folders use sync/move
 * (rclone has no dir-rename primitive — same-remote moves are server-side).
 */
export async function renameItem(fs: string, item: RcListItem, newName: string): Promise<void> {
  const dst = renamedPath(item.Path, newName.trim());
  if (item.IsDir) {
    await tauriTransport("sync/move", {
      srcFs: joinFsPath(fs, item.Path),
      dstFs: joinFsPath(fs, dst),
      deleteEmptySrcDirs: true,
    });
  } else {
    await tauriTransport("operations/movefile", {
      srcFs: fs,
      srcRemote: item.Path,
      dstFs: fs,
      dstRemote: dst,
    });
  }
}
