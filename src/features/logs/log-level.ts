export type DaemonLevel = "DEBUG" | "INFO" | "NOTICE" | "ERROR";

/** rclone log lines look like: `2026/06/11 00:21:11 INFO  : message`. */
export function daemonLineLevel(line: string): DaemonLevel {
  if (/\bERROR\b|\bCRITICAL\b|\bFailed\b/i.test(line)) return "ERROR";
  if (/\bNOTICE\b/.test(line)) return "NOTICE";
  if (/\bDEBUG\b/.test(line)) return "DEBUG";
  return "INFO";
}

export const DAEMON_LEVEL_RANK: Record<DaemonLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  NOTICE: 2,
  ERROR: 3,
};
