import { useHostStore } from "@/store/host";

/**
 * Prefix a TanStack Query key with the active host id so caches never bleed
 * between the local daemon and remote hosts.
 */
export function hostKey(...parts: unknown[]): unknown[] {
  return [useHostStore.getState().activeHostId, ...parts];
}

/** Hook variant for use inside components (re-renders on host switch). */
export function useHostKey(...parts: unknown[]): unknown[] {
  const id = useHostStore((s) => s.activeHostId);
  return [id, ...parts];
}
