import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useSettingsStore, type Host } from "./settings";

export const LOCAL_HOST_ID = "local";

interface HostState {
  activeHostId: string;
  setActiveHost: (id: string) => void;
}

/** Which rclone daemon the whole app talks to. "local" = the managed one. */
export const useHostStore = create<HostState>()(
  persist(
    (set) => ({
      activeHostId: LOCAL_HOST_ID,
      setActiveHost: (id) => set({ activeHostId: id }),
    }),
    { name: "rclonegui-active-host" },
  ),
);

/** The active remote host, or null when talking to the local daemon. */
export function activeHost(): Host | null {
  const { activeHostId } = useHostStore.getState();
  if (activeHostId === LOCAL_HOST_ID) return null;
  const { hosts } = useSettingsStore.getState().settings;
  return hosts.find((h) => h.id === activeHostId) ?? null;
}

/** Hook: true while the app is pointed at the local managed daemon. */
export function useIsLocalHost(): boolean {
  const id = useHostStore((s) => s.activeHostId);
  const hosts = useSettingsStore((s) => s.settings.hosts);
  return id === LOCAL_HOST_ID || !hosts.some((h) => h.id === id);
}
