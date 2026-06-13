import { invoke } from "@tauri-apps/api/core";

/** Mirror of the Rust `RcloneInfo` struct. */
export interface RcloneInfo {
  path: string;
  version: string;
}

/** Mirror of the Rust `DaemonStatus` struct. */
export interface DaemonStatus {
  running: boolean;
  port: number | null;
  pid: number | null;
}

export function detectRclone(configuredPath?: string | null): Promise<RcloneInfo | null> {
  return invoke("detect_rclone", { configuredPath: configuredPath ?? null });
}

export function daemonStart(configuredPath?: string | null): Promise<DaemonStatus> {
  return invoke("daemon_start", { configuredPath: configuredPath ?? null });
}

export function daemonStop(): Promise<void> {
  return invoke("daemon_stop");
}

export function daemonStatus(): Promise<DaemonStatus> {
  return invoke("daemon_status");
}

/** Free bytes on the filesystem containing `path`. */
export function diskFree(path: string): Promise<number> {
  return invoke("disk_free", { path });
}

/** Open a local file with a specific player app/binary. */
export function openWithPlayer(player: string, path: string): Promise<void> {
  return invoke("open_with_player", { player, path });
}
