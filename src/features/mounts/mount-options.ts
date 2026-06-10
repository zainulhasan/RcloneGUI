/** VFS/mount settings the mount form exposes. */
export interface MountFormOptions {
  /** rclone VFS cache mode. "full" enables seeking/streaming for most apps. */
  cacheMode: "off" | "minimal" | "writes" | "full";
  /** e.g. "10G"; empty = unlimited. */
  cacheMaxSize: string;
  /** e.g. "24h"; empty = rclone default (1h). */
  cacheMaxAge: string;
  readOnly: boolean;
  /** Volume name shown by the OS (macOS/Windows). */
  volumeName: string;
}

export const DEFAULT_MOUNT_OPTIONS: MountFormOptions = {
  cacheMode: "writes",
  cacheMaxSize: "",
  cacheMaxAge: "",
  readOnly: false,
  volumeName: "",
};

/** Convert form state into rclone RC `vfsOpt` / `mountOpt` payloads. */
export function toRcMountOptions(form: MountFormOptions): {
  vfsOpt: Record<string, unknown>;
  mountOpt: Record<string, unknown>;
} {
  const vfsOpt: Record<string, unknown> = {};
  if (form.cacheMode !== "off") vfsOpt.CacheMode = form.cacheMode;
  if (form.cacheMaxSize.trim()) vfsOpt.CacheMaxSize = form.cacheMaxSize.trim();
  if (form.cacheMaxAge.trim()) vfsOpt.CacheMaxAge = form.cacheMaxAge.trim();
  if (form.readOnly) vfsOpt.ReadOnly = true;

  const mountOpt: Record<string, unknown> = {};
  if (form.volumeName.trim()) mountOpt.VolumeName = form.volumeName.trim();

  return { vfsOpt, mountOpt };
}
