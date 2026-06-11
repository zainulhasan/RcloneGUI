export type ServeProtocol = "http" | "webdav" | "dlna";

/** One configured network share. */
export interface ServeConfig {
  id: string;
  /** Full rclone fs string, e.g. "gdrive:films". */
  fs: string;
  protocol: ServeProtocol;
  port: number;
  readOnly: boolean;
  /** Basic auth (http/webdav only; DLNA is open by design). */
  user: string;
  pass: string;
  /** Start this serve when the app launches. */
  autoStart: boolean;
}

/** Map a config onto `rclone serve <protocol> <fs>` CLI options. */
export function buildServeArgs(c: ServeConfig): { arg: string[]; opt: Record<string, string> } {
  const opt: Record<string, string> = { addr: `:${c.port}` };
  if (c.readOnly) opt["read-only"] = "true";
  if (c.protocol !== "dlna" && c.user.trim()) {
    opt.user = c.user.trim();
    opt.pass = c.pass;
  }
  return { arg: [c.protocol, c.fs], opt };
}

/** Shareable URL for devices on the same network. */
export function serveUrl(c: ServeConfig, lanIp: string): string {
  return `http://${lanIp}:${c.port}`;
}
