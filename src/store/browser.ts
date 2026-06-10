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
  /** Local home directory relative to "/", e.g. "Users/zain". "" until known. */
  homePath: string;
  setActive: (pane: PaneIndex) => void;
  setFs: (pane: PaneIndex, fs: string | null) => void;
  setPath: (pane: PaneIndex, path: string) => void;
  /** Record the home dir; points untouched local panes at it. */
  setHomePath: (home: string) => void;
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
  homePath: "",
  setActive: (pane) => set({ active: pane }),
  setFs: (pane, fs) =>
    set((s) => ({
      // A local pane starts at the user's home folder, not the filesystem root.
      panes: withPane(s.panes, pane, { fs, path: fs === "/" ? s.homePath : "" }),
      active: pane,
    })),
  setPath: (pane, path) =>
    set((s) => ({ panes: withPane(s.panes, pane, { ...s.panes[pane], path }), active: pane })),
  setHomePath: (home) =>
    set((s) => {
      const next: Partial<BrowserState> = { homePath: home };
      // Point panes still at the default local root to home.
      const panes = s.panes.map((p) =>
        p.fs === "/" && p.path === "" ? { ...p, path: home } : p,
      ) as [PaneState, PaneState];
      next.panes = panes;
      return next;
    }),
  openFs: (fs) => set((s) => ({ panes: withPane(s.panes, 0, { fs, path: "" }), active: 0 })),
}));

/** "/Users/zain" → "Users/zain" (rclone local fs is "/", paths are relative). */
export function absoluteToLocalPath(absolute: string): string {
  return absolute.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Parent of a pane path ("a/b/c" → "a/b", "a" → ""). */
export function parentPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}
