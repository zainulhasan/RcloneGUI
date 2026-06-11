import { create } from "zustand";

export type View =
  | "dashboard"
  | "remotes"
  | "browser"
  | "transfers"
  | "mounts"
  | "serve"
  | "scheduler"
  | "media"
  | "logs"
  | "settings";

interface NavigationState {
  view: View;
  navigate: (view: View) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  view: "dashboard",
  navigate: (view) => set({ view }),
}));
