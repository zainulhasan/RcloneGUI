/** A media item tracked in the watched DB, keyed by remote + path. */
export interface MediaItem {
  id: number;
  remoteFs: string;
  remotePath: string;
  name: string;
  size: number;
  localPath: string | null;
  syncedAt: number | null;
  watchedAt: number | null;
  localDeletedAt: number | null;
}

/** Context a Watch sync carries through the job tracker. */
export interface WatchJobMeta {
  remoteFs: string;
  remotePath: string;
  name: string;
  size: number;
  localPath: string;
  isDir: boolean;
  [key: string]: unknown;
}
