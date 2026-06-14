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

const PERSIST_KEY = "browser-panes-v1";

function loadSavedPanes(): [PaneState, PaneState] | null {
  try {
    const s = localStorage.getItem(PERSIST_KEY);
    if (s) return JSON.parse(s) as [PaneState, PaneState];
  } catch {
    /* ignore */
  }
  return null;
}

function savePanes(panes: [PaneState, PaneState]) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(panes));
  } catch {
    /* ignore */
  }
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

const saved = loadSavedPanes();

export const useBrowserStore = create<BrowserState>((set) => ({
  panes: saved ?? [
    { fs: "/", path: "" },
    { fs: null, path: "" },
  ],
  active: 0,
  homePath: "",
  setActive: (pane) => set({ active: pane }),
  setFs: (pane, fs) =>
    set((s) => {
      const panes = withPane(s.panes, pane, { fs, path: fs === "/" ? s.homePath : "" });
      savePanes(panes);
      return { panes, active: pane };
    }),
  setPath: (pane, path) =>
    set((s) => {
      const panes = withPane(s.panes, pane, { ...s.panes[pane], path });
      savePanes(panes);
      return { panes, active: pane };
    }),
  setHomePath: (home) =>
    set((s) => {
      const next: Partial<BrowserState> = { homePath: home };
      const panes = s.panes.map((p) =>
        p.fs === "/" && p.path === "" ? { ...p, path: home } : p,
      ) as [PaneState, PaneState];
      next.panes = panes;
      savePanes(panes);
      return next;
    }),
  openFs: (fs) =>
    set((s) => {
      const panes = withPane(s.panes, 0, { fs, path: "" });
      savePanes(panes);
      return { panes, active: 0 };
    }),
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
