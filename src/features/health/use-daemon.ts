import { useQuery } from "@tanstack/react-query";

import { daemonStart, detectRclone } from "@/lib/tauri";
import { useSettingsStore } from "@/store/settings";

/** Detect the rclone installation (null = not found). */
export function useRcloneInfo() {
  const rclonePath = useSettingsStore((s) => s.settings.rclonePath);
  return useQuery({
    queryKey: ["rclone-info", rclonePath],
    queryFn: () => detectRclone(rclonePath),
    staleTime: Infinity,
  });
}

/** Start (or confirm) the RC daemon. The Rust side is idempotent. */
export function useDaemon() {
  const rclonePath = useSettingsStore((s) => s.settings.rclonePath);
  const hydrated = useSettingsStore((s) => s.hydrated);
  return useQuery({
    queryKey: ["daemon", rclonePath],
    queryFn: () => daemonStart(rclonePath),
    enabled: hydrated,
    staleTime: Infinity,
    retry: false,
  });
}
