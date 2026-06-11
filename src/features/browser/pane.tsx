import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  ChevronRight,
  Filter as FilterIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rc, type RcListItem } from "@/lib/rc-client";
import { fileVisual } from "./file-visual";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { absoluteToLocalPath, parentPath, useBrowserStore, type PaneIndex } from "@/store/browser";

import { filterListing } from "./filter";
import { renamedPath, renameItem, validateRename } from "./rename";
import { applyClick, EMPTY_SELECTION, pruneSelection, type SelectionState } from "./selection";
import { LOCAL_FS, useListing } from "./use-listing";

function sortListing(items: RcListItem[]): RcListItem[] {
  return [...items].sort((a, b) => {
    if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
    return a.Name.localeCompare(b.Name, undefined, { numeric: true });
  });
}

function Breadcrumb({
  fs,
  path,
  homePath,
  onNavigate,
}: {
  fs: string;
  path: string;
  homePath: string;
  onNavigate: (path: string) => void;
}) {
  // Under the home folder, collapse the long prefix to "~".
  const underHome =
    fs === LOCAL_FS && homePath !== "" && (path === homePath || path.startsWith(`${homePath}/`));
  const rootLabel = underHome ? "~" : fs === LOCAL_FS ? "/" : fs;
  const rootTarget = underHome ? homePath : "";
  const rest = underHome ? path.slice(homePath.length).replace(/^\//, "") : path;
  const segments = rest ? rest.split("/") : [];
  const prefix = underHome ? homePath : "";
  return (
    <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-0.5 text-xs">
      <button
        className="hover:text-foreground shrink-0 font-medium transition-colors"
        onClick={() => onNavigate(rootTarget)}
      >
        {rootLabel}
      </button>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <ChevronRight className="size-3 shrink-0" />
          <button
            className="hover:text-foreground max-w-40 truncate transition-colors"
            onClick={() =>
              onNavigate([prefix, segments.slice(0, i + 1).join("/")].filter(Boolean).join("/"))
            }
          >
            {seg}
          </button>
        </span>
      ))}
    </div>
  );
}

export interface PaneProps {
  index: PaneIndex;
  remotes: string[];
  /** Extra context-menu entries rendered above the built-in ones. */
  renderItemActions?: (items: RcListItem[], pane: { fs: string; path: string }) => React.ReactNode;
  /** Badge or marker rendered after the file name. */
  renderItemBadge?: (item: RcListItem, pane: { fs: string; path: string }) => React.ReactNode;
}

export function Pane({ index, remotes, renderItemActions, renderItemBadge }: PaneProps) {
  const pane = useBrowserStore((s) => s.panes[index]);
  const paneFs = pane.fs;
  const active = useBrowserStore((s) => s.active === index);
  const setFs = useBrowserStore((s) => s.setFs);
  const setPath = useBrowserStore((s) => s.setPath);
  const setActive = useBrowserStore((s) => s.setActive);
  const homePath = useBrowserStore((s) => s.homePath);

  const pickLocalFolder = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") setPath(index, absoluteToLocalPath(dir));
  };

  const queryClient = useQueryClient();
  const listing = useListing(pane.fs, pane.path);
  const items = useMemo(() => sortListing(listing.data ?? []), [listing.data]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const visibleItems = useMemo(
    () => (filterOpen ? filterListing(items, filterQuery) : items),
    [items, filterOpen, filterQuery],
  );
  const visibleKeys = useMemo(() => visibleItems.map((i) => i.Path), [visibleItems]);

  const [rawSelection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");

  // Derive instead of syncing state: stale keys vanish on refresh/navigation.
  const selection = useMemo(
    () => pruneSelection(rawSelection, visibleKeys),
    [rawSelection, visibleKeys],
  );

  const selectedItems = visibleItems.filter((i) => selection.selected.has(i.Path));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["listing", pane.fs, pane.path] });

  const enterDir = (item: RcListItem) => {
    if (item.IsDir) {
      setPath(index, item.Path);
      setSelection(EMPTY_SELECTION);
    }
  };

  const [renaming, setRenaming] = useState<RcListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameError = renaming
    ? validateRename(
        renameValue,
        items.filter((i) => i.Path !== renaming.Path).map((i) => i.Name),
      )
    : null;

  const submitRename = async () => {
    if (!renaming || !paneFs || renameError) return;
    try {
      await renameItem(paneFs, renaming, renameValue);
      const { getWatchedDb } = await import("@/features/media/watched-db");
      const db = await getWatchedDb();
      await db.updateRemotePath(
        paneFs,
        renaming.Path,
        renamedPath(renaming.Path, renameValue.trim()),
      );
      toast.success(`Renamed to "${renameValue.trim()}"`);
      setRenaming(null);
      void refresh();
    } catch (err) {
      toast.error(`Rename failed: ${(err as Error).message}`);
    }
  };

  const createFolder = async () => {
    if (!pane.fs || !mkdirName.trim()) return;
    const target = pane.path ? `${pane.path}/${mkdirName.trim()}` : mkdirName.trim();
    try {
      await rc.mkdir(pane.fs, target);
      toast.success(`Folder "${mkdirName.trim()}" created`);
      setMkdirOpen(false);
      setMkdirName("");
      void refresh();
    } catch (err) {
      toast.error(`Could not create folder: ${(err as Error).message}`);
    }
  };

  return (
    <section
      aria-label={`Pane ${index + 1}`}
      onMouseDown={() => setActive(index)}
      className={cn(
        "bg-card flex min-h-0 flex-1 flex-col rounded-lg border",
        active ? "border-primary/50" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 border-b px-2 py-1.5">
        <Select
          value={pane.fs ?? undefined}
          onValueChange={(v) => {
            setFs(index, v);
            setSelection(EMPTY_SELECTION);
          }}
        >
          <SelectTrigger size="sm" className="w-36 shrink-0" aria-label="Location">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={LOCAL_FS}>
              <HardDrive className="size-3.5" /> Local
            </SelectItem>
            {remotes.map((r) => (
              <SelectItem key={r} value={`${r}:`}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pane.fs && (
          <Breadcrumb
            fs={pane.fs}
            path={pane.path}
            homePath={homePath}
            onNavigate={(p) => setPath(index, p)}
          />
        )}
        <div className="ml-auto flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Parent folder"
                disabled={!pane.fs || pane.path === ""}
                onClick={() => setPath(index, parentPath(pane.path))}
              >
                <ArrowUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Up</TooltipContent>
          </Tooltip>
          {pane.fs === LOCAL_FS && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Home folder"
                    onClick={() => setPath(index, homePath)}
                  >
                    <Home />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Home</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Choose folder"
                    onClick={() => void pickLocalFolder()}
                  >
                    <FolderOpen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Choose folder…</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Filter items"
                disabled={!pane.fs}
                onClick={() => {
                  setFilterOpen((open) => !open);
                  setFilterQuery("");
                }}
              >
                <FilterIcon className={cn(filterOpen && "text-primary")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New folder"
                disabled={!pane.fs}
                onClick={() => setMkdirOpen(true)}
              >
                <FolderPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Refresh"
                disabled={!pane.fs}
                onClick={() => void refresh()}
              >
                {listing.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {filterOpen && (
        <div className="flex items-center gap-1 border-b px-2 py-1">
          <Input
            autoFocus
            className="h-7 text-xs"
            placeholder="Filter this folder…"
            aria-label="Filter query"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setFilterOpen(false);
                setFilterQuery("");
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear filter"
            onClick={() => {
              setFilterOpen(false);
              setFilterQuery("");
            }}
          >
            <X />
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pane.fs === null ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4">
            <HardDrive className="size-6 opacity-50" />
            <p className="text-sm">Choose a location above to browse.</p>
          </div>
        ) : listing.isLoading ? (
          <div className="flex flex-col gap-1.5 p-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
          </div>
        ) : listing.isError ? (
          <p className="text-destructive p-4 text-sm">{(listing.error as Error).message}</p>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4">
            <Folder className="size-6 opacity-50" />
            <p className="text-sm">This folder is empty.</p>
          </div>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div>
                <div className="text-muted-foreground bg-surface sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase">
                  <span className="min-w-0 flex-1">Name</span>
                  <span className="w-24 shrink-0 text-right">Modified</span>
                  <span className="w-16 shrink-0 text-right">Size</span>
                </div>
                <ul className="p-1" role="listbox" aria-multiselectable>
                  {visibleItems.map((item, i) => {
                    const isSelected = selection.selected.has(item.Path);
                    const visual = item.IsDir ? null : fileVisual(item.Name);
                    return (
                      <li
                        key={item.Path}
                        role="option"
                        aria-selected={isSelected}
                        onClick={(e) =>
                          setSelection((s) =>
                            applyClick(s, visibleKeys, i, {
                              meta: e.metaKey || e.ctrlKey,
                              shift: e.shiftKey,
                            }),
                          )
                        }
                        onDoubleClick={() => {
                          if (item.IsDir) {
                            enterDir(item);
                          } else if (paneFs === LOCAL_FS) {
                            void import("@/features/media/watch-actions").then((m) =>
                              m
                                .openLocal(`/${item.Path}`)
                                .catch((err: Error) =>
                                  toast.error(`Could not open: ${err.message}`),
                                ),
                            );
                          }
                        }}
                        onContextMenu={() => {
                          if (!isSelected) {
                            setSelection({ selected: new Set([item.Path]), anchor: i });
                          }
                        }}
                        className={cn(
                          "flex cursor-default items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1 text-sm select-none",
                          isSelected
                            ? "border-primary bg-primary/13 text-foreground"
                            : "hover:bg-accent/50",
                        )}
                      >
                        {item.IsDir ? (
                          <Folder className="fill-primary/15 text-primary size-4 shrink-0" />
                        ) : (
                          (() => {
                            const FileIcon = visual!.icon;
                            return (
                              <FileIcon className={cn("size-4 shrink-0", visual!.className)} />
                            );
                          })()
                        )}
                        <span className="min-w-0 flex-1 truncate">{item.Name}</span>
                        {paneFs !== null &&
                          renderItemBadge?.(item, { fs: paneFs, path: pane.path })}
                        <span className="text-muted-foreground w-24 shrink-0 truncate text-right text-xs tabular-nums">
                          {item.ModTime ? formatDateTime(item.ModTime).split(",")[0] : "—"}
                        </span>
                        <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
                          {item.IsDir ? "—" : formatBytes(item.Size)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {selectedItems.length > 0 && pane.fs && (
                <>
                  {renderItemActions?.(selectedItems, { fs: paneFs!, path: pane.path })}
                  {selectedItems.length === 1 && selectedItems[0].IsDir && (
                    <ContextMenuItem onClick={() => enterDir(selectedItems[0])}>
                      Open
                    </ContextMenuItem>
                  )}
                  {selectedItems.length === 1 && (
                    <ContextMenuItem
                      onClick={() => {
                        setRenaming(selectedItems[0]);
                        setRenameValue(selectedItems[0].Name);
                      }}
                    >
                      Rename…
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        selectedItems.map((s) => `${pane.fs}${s.Path}`).join("\n"),
                      );
                    }}
                  >
                    Copy path
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onClick={() => setMkdirOpen(true)}>New folder…</ContextMenuItem>
              <ContextMenuItem onClick={() => void refresh()}>Refresh</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
      </div>

      <footer className="text-muted-foreground flex items-center justify-between border-t px-3 py-1 text-xs tabular-nums">
        <span>
          {filterOpen && filterQuery.trim() ? (
            `${visibleItems.length} of ${items.length} shown`
          ) : (
            <>
              {items.filter((i) => i.IsDir).length} folders · {items.filter((i) => !i.IsDir).length}{" "}
              files
            </>
          )}
        </span>
        <span>
          {selection.selected.size > 0
            ? `${selection.selected.size} selected · ${formatBytes(
                selectedItems.reduce((sum, i) => sum + (i.IsDir ? 0 : i.Size), 0),
              )}`
            : formatBytes(items.reduce((sum, i) => sum + (i.IsDir ? 0 : i.Size), 0))}
        </span>
      </footer>

      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            value={mkdirName}
            onChange={(e) => setMkdirName(e.target.value)}
            placeholder="Folder name"
            aria-label="Folder name"
            onKeyDown={(e) => e.key === "Enter" && void createFolder()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMkdirOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createFolder()} disabled={!mkdirName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename "{renaming?.Name}"</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            aria-label="New name"
            aria-invalid={!!renameError}
            onKeyDown={(e) => e.key === "Enter" && void submitRename()}
          />
          {renameError && renameValue !== renaming?.Name && (
            <p className="text-destructive text-xs">{renameError}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitRename()}
              disabled={!!renameError || renameValue.trim() === renaming?.Name}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
