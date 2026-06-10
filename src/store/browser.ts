import { create } from "zustand";

export interface PaneState {
  /** rclone fs root, e.g. "gdrive:" or "/" for the local filesystem. */
  fs: string | null;
  /** Path within the fs, "" = root. */
  path: string;
}

export type PaneIndex = 0 | 1;

interface BrowserState {
  panes: [PaneState, PaneState];
  active: PaneIndex;
  setActive: (pane: PaneIndex) => void;
  setFs: (pane: PaneIndex, fs: string | null) => void;
  setPath: (pane: PaneIndex, path: string) => void;
  /** Open an fs in the left pane (used by "Browse" elsewhere in the app). */
  openFs: (fs: string) => void;
}

function withPane(
  panes: [PaneState, PaneState],
  index: PaneIndex,
  next: PaneState,
): [PaneState, PaneState] {
  const copy: [PaneState, PaneState] = [...panes];
  copy[index] = next;
  return copy;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  panes: [
    { fs: "/", path: "" },
    { fs: null, path: "" },
  ],
  active: 0,
  setActive: (pane) => set({ active: pane }),
  setFs: (pane, fs) =>
    set((s) => ({ panes: withPane(s.panes, pane, { fs, path: "" }), active: pane })),
  setPath: (pane, path) =>
    set((s) => ({ panes: withPane(s.panes, pane, { ...s.panes[pane], path }), active: pane })),
  openFs: (fs) => set((s) => ({ panes: withPane(s.panes, 0, { fs, path: "" }), active: 0 })),
}));
