import { tauriTransport, type RcTransport } from "./transport";
import type {
  RcAbout,
  RcAsyncJob,
  RcConfigDump,
  RcConfigPaths,
  RcCoreStats,
  RcJobList,
  RcJobStatus,
  RcListItem,
  RcListResponse,
  RcMountList,
  RcOperationOptions,
  RcProvidersResponse,
  RcRemotesList,
  RcSize,
  RcVersion,
} from "./types";

/** Build the optional `_config` / `_filter` / `_group` params for a call. */
function operationParams(options?: RcOperationOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (options?.config && Object.keys(options.config).length > 0) {
    params._config = options.config;
  }
  if (options?.filter && Object.keys(options.filter).length > 0) {
    params._filter = options.filter;
  }
  if (options?.group) {
    params._group = options.group;
  }
  return params;
}

/**
 * Typed client for the rclone RC API. All calls go through the injected
 * transport (the Tauri proxy in production, a stub in tests).
 */
export class RcClient {
  private readonly transport: RcTransport;

  constructor(transport: RcTransport = tauriTransport) {
    this.transport = transport;
  }

  private call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.transport(method, params) as Promise<T>;
  }

  // ── core ──────────────────────────────────────────────────────────────

  version(): Promise<RcVersion> {
    return this.call("core/version");
  }

  /** Live stats; pass a group to scope to one job. */
  stats(group?: string): Promise<RcCoreStats> {
    return this.call("core/stats", group ? { group } : {});
  }

  statsReset(group?: string): Promise<void> {
    return this.call("core/stats-reset", group ? { group } : {});
  }

  /** Set the global bandwidth limit, e.g. "10M", "1M:100k" or "off". */
  setBandwidthLimit(rate: string): Promise<{ bytesPerSecond: number; rate: string }> {
    return this.call("core/bwlimit", { rate });
  }

  configPaths(): Promise<RcConfigPaths> {
    return this.call("config/paths");
  }

  // ── remotes (config/*) ────────────────────────────────────────────────

  async listRemotes(): Promise<string[]> {
    const res = await this.call<RcRemotesList>("config/listremotes");
    return res.remotes ?? [];
  }

  configDump(): Promise<RcConfigDump> {
    return this.call("config/dump");
  }

  getRemote(name: string): Promise<Record<string, string>> {
    return this.call("config/get", { name });
  }

  providers(): Promise<RcProvidersResponse> {
    return this.call("config/providers");
  }

  /**
   * Create a remote. OAuth backends pass `interactive: true` so rclone runs
   * its browser-based authorization flow on this machine.
   */
  createRemote(
    name: string,
    type: string,
    parameters: Record<string, unknown>,
    opts?: { interactive?: boolean },
  ): Promise<void> {
    return this.call("config/create", {
      name,
      type,
      parameters,
      opt: { nonInteractive: !opts?.interactive, obscure: true },
    });
  }

  updateRemote(name: string, parameters: Record<string, unknown>): Promise<void> {
    return this.call("config/update", {
      name,
      parameters,
      opt: { nonInteractive: true, obscure: true },
    });
  }

  /** Re-run the OAuth browser flow for an existing OAuth remote. */
  reconnectRemote(name: string): Promise<void> {
    return this.call("config/update", {
      name,
      parameters: {},
      opt: { nonInteractive: false, obscure: true },
    });
  }

  deleteRemote(name: string): Promise<void> {
    return this.call("config/delete", { name });
  }

  // ── filesystem (operations/*) ─────────────────────────────────────────

  /**
   * List a directory. `fs` is `remote:` (or `/` for local), `remote` is the
   * path within it.
   */
  async list(
    fs: string,
    remote: string,
    opt?: { recurse?: boolean; dirsOnly?: boolean; filesOnly?: boolean },
  ): Promise<RcListItem[]> {
    const res = await this.call<RcListResponse>("operations/list", {
      fs,
      remote,
      ...(opt ? { opt } : {}),
    });
    return res.list;
  }

  about(fs: string): Promise<RcAbout> {
    return this.call("operations/about", { fs });
  }

  size(fs: string, remote: string): Promise<RcSize> {
    return this.call("operations/size", { fs: joinFsPath(fs, remote) });
  }

  mkdir(fs: string, remote: string): Promise<void> {
    return this.call("operations/mkdir", { fs, remote });
  }

  /** Delete a single file. */
  deleteFile(fs: string, remote: string): Promise<void> {
    return this.call("operations/deletefile", { fs, remote });
  }

  /** Recursively delete a directory and its contents. */
  purge(fs: string, remote: string): Promise<void> {
    return this.call("operations/purge", { fs, remote });
  }

  /** Server-side copy of a single file; async, returns a job id. */
  copyFile(
    srcFs: string,
    srcRemote: string,
    dstFs: string,
    dstRemote: string,
    options?: RcOperationOptions,
  ): Promise<RcAsyncJob> {
    return this.call("operations/copyfile", {
      srcFs,
      srcRemote,
      dstFs,
      dstRemote,
      _async: true,
      ...operationParams(options),
    });
  }

  moveFile(
    srcFs: string,
    srcRemote: string,
    dstFs: string,
    dstRemote: string,
    options?: RcOperationOptions,
  ): Promise<RcAsyncJob> {
    return this.call("operations/movefile", {
      srcFs,
      srcRemote,
      dstFs,
      dstRemote,
      _async: true,
      ...operationParams(options),
    });
  }

  // ── directory operations (sync/*) ─────────────────────────────────────

  /** Copy a directory tree. Async: returns a job id for the dashboard. */
  copy(srcFs: string, dstFs: string, options?: RcOperationOptions): Promise<RcAsyncJob> {
    return this.call("sync/copy", {
      srcFs,
      dstFs,
      _async: true,
      ...operationParams(options),
    });
  }

  /** Make dst identical to src (deletes extraneous files in dst). */
  sync(srcFs: string, dstFs: string, options?: RcOperationOptions): Promise<RcAsyncJob> {
    return this.call("sync/sync", {
      srcFs,
      dstFs,
      _async: true,
      ...operationParams(options),
    });
  }

  move(srcFs: string, dstFs: string, options?: RcOperationOptions): Promise<RcAsyncJob> {
    return this.call("sync/move", {
      srcFs,
      dstFs,
      _async: true,
      ...operationParams(options),
    });
  }

  /** Bidirectional sync. `resync` must be true on the first run of a pair. */
  bisync(
    path1: string,
    path2: string,
    options?: RcOperationOptions & { resync?: boolean },
  ): Promise<RcAsyncJob> {
    return this.call("sync/bisync", {
      path1,
      path2,
      resync: options?.resync ?? false,
      _async: true,
      ...operationParams(options),
    });
  }

  /**
   * Run an rclone CLI command inside the daemon as an async job (used for
   * long-running `serve` processes; stop with jobStop).
   */
  command(command: string, arg: string[], opt: Record<string, string>): Promise<RcAsyncJob> {
    return this.call("core/command", {
      command,
      arg,
      opt,
      returnType: "STREAM_ONLY_STDERR",
      _async: true,
    });
  }

  // ── jobs ──────────────────────────────────────────────────────────────

  jobStatus(jobid: number): Promise<RcJobStatus> {
    return this.call("job/status", { jobid });
  }

  jobStop(jobid: number): Promise<void> {
    return this.call("job/stop", { jobid });
  }

  jobList(): Promise<RcJobList> {
    return this.call("job/list");
  }

  // ── mounts ────────────────────────────────────────────────────────────

  mount(
    fs: string,
    mountPoint: string,
    opts?: { mountOpt?: Record<string, unknown>; vfsOpt?: Record<string, unknown> },
  ): Promise<void> {
    return this.call("mount/mount", {
      fs,
      mountPoint,
      ...(opts?.mountOpt && Object.keys(opts.mountOpt).length > 0
        ? { mountOpt: opts.mountOpt }
        : {}),
      ...(opts?.vfsOpt && Object.keys(opts.vfsOpt).length > 0 ? { vfsOpt: opts.vfsOpt } : {}),
    });
  }

  unmount(mountPoint: string): Promise<void> {
    return this.call("mount/unmount", { mountPoint });
  }

  unmountAll(): Promise<void> {
    return this.call("mount/unmountall");
  }

  async listMounts(): Promise<RcMountList["mountPoints"]> {
    const res = await this.call<RcMountList>("mount/listmounts");
    return res.mountPoints ?? [];
  }
}

/** Join an fs root (`remote:`) and a path into a single fs string. */
export function joinFsPath(fs: string, remote: string): string {
  if (!remote) return fs;
  if (fs.endsWith(":") || fs.endsWith("/")) return `${fs}${remote}`;
  return `${fs}/${remote}`;
}

/** Singleton used by the app; tests construct their own with a stub transport. */
export const rc = new RcClient();
