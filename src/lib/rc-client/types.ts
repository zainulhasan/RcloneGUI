/**
 * Types for the rclone Remote Control (RC) API.
 * Field names mirror the JSON payloads documented at https://rclone.org/rc/
 */

/** `core/version` */
export interface RcVersion {
  version: string;
  os: string;
  arch: string;
  decomposed: number[];
  isBeta: boolean;
  isGit: boolean;
  linking: string;
  goTags: string;
  goVersion: string;
}

/** One entry of `operations/list` */
export interface RcListItem {
  Path: string;
  Name: string;
  Size: number;
  MimeType: string;
  ModTime: string;
  IsDir: boolean;
  ID?: string;
}

/** `operations/list` response */
export interface RcListResponse {
  list: RcListItem[];
}

/** `operations/about` response (fields are optional per backend) */
export interface RcAbout {
  total?: number;
  used?: number;
  free?: number;
  trashed?: number;
  other?: number;
}

/** `operations/size` response */
export interface RcSize {
  count: number;
  bytes: number;
}

/** One active transfer inside `core/stats` */
export interface RcTransferring {
  name: string;
  size: number;
  bytes: number;
  percentage: number;
  speed: number;
  speedAvg: number;
  eta: number | null;
  group?: string;
}

/** `core/stats` response */
export interface RcCoreStats {
  bytes: number;
  checks: number;
  deletes: number;
  elapsedTime: number;
  errors: number;
  eta: number | null;
  fatalError: boolean;
  lastError?: string;
  renames: number;
  retryError: boolean;
  speed: number;
  totalBytes: number;
  totalChecks: number;
  totalTransfers: number;
  transferTime: number;
  transfers: number;
  transferring?: RcTransferring[];
  checking?: string[];
}

/** `job/status` response */
export interface RcJobStatus {
  id: number;
  group: string;
  startTime: string;
  endTime: string;
  duration: number;
  finished: boolean;
  success: boolean;
  error: string;
  output?: Record<string, unknown>;
  progress?: string;
}

/** `job/list` response */
export interface RcJobList {
  jobids: number[];
}

/** Response of any call made with `_async: true` */
export interface RcAsyncJob {
  jobid: number;
}

/** `config/dump` — remote name to its config key/values */
export type RcConfigDump = Record<string, Record<string, string>>;

/** `config/listremotes` */
export interface RcRemotesList {
  remotes: string[] | null;
}

/** One provider option from `config/providers` */
export interface RcProviderOption {
  Name: string;
  Help: string;
  Provider: string;
  Default: unknown;
  Value: unknown;
  Required: boolean;
  IsPassword: boolean;
  Advanced: boolean;
  Type: string;
  Examples?: { Value: string; Help: string; Provider: string }[];
}

/** One provider from `config/providers` */
export interface RcProvider {
  Name: string;
  Description: string;
  Prefix: string;
  Options: RcProviderOption[];
}

export interface RcProvidersResponse {
  providers: RcProvider[];
}

/** `mount/listmounts` */
export interface RcMountPoint {
  Fs: string;
  MountPoint: string;
  MountedOn: string;
}

export interface RcMountList {
  mountPoints: RcMountPoint[] | null;
}

/** `config/paths` */
export interface RcConfigPaths {
  config: string;
  cache: string;
  temp: string;
}

/** `core/memstats`, kept loose — used for diagnostics only */
export type RcMemStats = Record<string, number>;

/**
 * Per-call rclone overrides, sent as the `_config` parameter.
 * See `options/get` for the full set; these are the ones the UI exposes.
 */
export interface RcConfigOverrides {
  DryRun?: boolean;
  Transfers?: number;
  Checkers?: number;
  BwLimit?: string;
  [key: string]: unknown;
}

/** Include/exclude rules, sent as the `_filter` parameter. */
export interface RcFilterOverrides {
  IncludeRule?: string[];
  ExcludeRule?: string[];
  MinSize?: string;
  MaxSize?: string;
  [key: string]: unknown;
}

/** Options shared by every long-running operation. */
export interface RcOperationOptions {
  config?: RcConfigOverrides;
  filter?: RcFilterOverrides;
  /** Stats group so the transfer dashboard can attribute progress. */
  group?: string;
}
