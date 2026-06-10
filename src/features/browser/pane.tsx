import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  Loader2,
  RefreshCw,
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
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { absoluteToLocalPath, parentPath, useBrowserStore, type PaneIndex } from "@/store/browser";

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
  const keys = useMemo(() => items.map((i) => i.Path), [items]);

  const [rawSelection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");

  // Derive instead of syncing state: stale keys vanish on refresh/navigation.
  const selection = useMemo(() => pruneSelection(rawSelection, keys), [rawSelection, keys]);

  const selectedItems = items.filter((i) => selection.selected.has(i.Path));

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["listing", pane.fs, pane.path] });

  const enterDir = (item: RcListItem) => {
    if (item.IsDir) {
      setPath(index, item.Path);
      setSelection(EMPTY_SELECTION);
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pane.fs === null ? (
          <p className="text-muted-foreground p-4 text-sm">Choose a location to browse.</p>
        ) : listing.isLoading ? (
          <div className="flex flex-col gap-1.5 p-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
          </div>
        ) : listing.isError ? (
          <p className="text-destructive p-4 text-sm">{(listing.error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Empty folder.</p>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <ul className="p-1" role="listbox" aria-multiselectable>
                {items.map((item, i) => {
                  const isSelected = selection.selected.has(item.Path);
                  return (
                    <li
                      key={item.Path}
                      role="option"
                      aria-selected={isSelected}
                      onClick={(e) =>
                        setSelection((s) =>
                          applyClick(s, keys, i, {
                            meta: e.metaKey || e.ctrlKey,
                            shift: e.shiftKey,
                          }),
                        )
                      }
                      onDoubleClick={() => enterDir(item)}
                      onContextMenu={() => {
                        if (!isSelected) {
                          setSelection({ selected: new Set([item.Path]), anchor: i });
                        }
                      }}
                      className={cn(
                        "flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm select-none",
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                    >
                      {item.IsDir ? (
                        <Folder className="text-primary size-4 shrink-0" />
                      ) : (
                        <File className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.Name}</span>
                      {paneFs !== null && renderItemBadge?.(item, { fs: paneFs, path: pane.path })}
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {item.IsDir ? "—" : formatBytes(item.Size)}
                      </span>
                    </li>
                  );
                })}
              </ul>
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

      <footer className="text-muted-foreground border-t px-3 py-1 text-xs">
        {items.length} items
        {selection.selected.size > 0 && <> · {selection.selected.size} selected</>}
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
    </section>
  );
}
