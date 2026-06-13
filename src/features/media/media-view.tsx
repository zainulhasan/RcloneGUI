import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BrushCleaning,
  Check,
  ChevronLeft,
  Clapperboard,
  Eye,
  FolderOpen,
  FolderSearch,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/layout/page";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc, type RcListItem } from "@/lib/rc-client";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";

import { isVideoFile, parseFilename } from "./filename-parser";
import { searchMovie, type TmdbMovie } from "./tmdb";
import { runCleanupNow } from "./use-cleanup-runner";
import { useMarkWatched, useWatchedPaths } from "./use-media";
import { startWatchSync } from "./watch-actions";

// ── persistence ───────────────────────────────────────────────────────────────
const PERSIST_KEY = "media-library-v1";

function loadSaved(): { fs: string | null; path: string } {
  try {
    const s = localStorage.getItem(PERSIST_KEY);
    if (s) return JSON.parse(s) as { fs: string | null; path: string };
  } catch {
    // ignore malformed JSON
  }
  return { fs: null, path: "" };
}

// ── poster gradient (deterministic per title) ─────────────────────────────────
function posterGrad(seed: string): string {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  const hA = x % 360;
  const hB = (hA + 40 + ((x >> 8) % 60)) % 360;
  return `linear-gradient(150deg, oklch(0.55 0.13 ${hA}), oklch(0.30 0.09 ${hB}))`;
}

// ── types ──────────────────────────────────────────────────────────────────────
interface LibraryEntry {
  item: RcListItem;
  title: string;
  year: number | null;
  movie: TmdbMovie | null;
}

// ── data hooks ────────────────────────────────────────────────────────────────
function useLibrary(fs: string | null, path: string, scanKey: number) {
  const tmdbApiKey = useSettingsStore((s) => s.settings.tmdbApiKey);
  return useQuery({
    queryKey: ["media", "library", fs, path, scanKey],
    enabled: fs !== null && scanKey > 0,
    queryFn: async (): Promise<LibraryEntry[]> => {
      const listing = await rc.list(fs!, path);
      const videos = listing.filter((i) => !i.IsDir && isVideoFile(i.Name));
      return Promise.all(
        videos.map(async (item) => {
          const { title, year } = parseFilename(item.Name);
          let movie: TmdbMovie | null = null;
          if (tmdbApiKey) {
            movie = await searchMovie(tmdbApiKey, title, year).catch(() => null);
          }
          return { item, title, year, movie };
        }),
      );
    },
  });
}

function useBrowseDirs(fs: string | null, browsePath: string, enabled: boolean) {
  return useQuery({
    queryKey: ["media", "browse-dirs", fs, browsePath],
    enabled: enabled && fs !== null,
    queryFn: () => rc.list(fs!, browsePath).then((items) => items.filter((i) => i.IsDir)),
    staleTime: 30_000,
  });
}

// ── folder browser popover ────────────────────────────────────────────────────
function FolderBrowser({ fs, onSelect }: { fs: string | null; onSelect: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const dirs = useBrowseDirs(fs, browsePath, open);

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (!o) setBrowsePath("");
  };

  const navigateInto = (path: string) => {
    setBrowsePath(path);
    onSelect(path);
  };

  const goUp = () => {
    const parent = browsePath.split("/").slice(0, -1).join("/");
    setBrowsePath(parent);
    onSelect(parent);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={fs === null}
          aria-label="Browse remote folders"
        >
          <FolderOpen className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        {/* Path bar */}
        <div className="flex items-center gap-1 px-1 pb-1">
          {browsePath && (
            <Button variant="ghost" size="icon-sm" onClick={goUp} aria-label="Go up">
              <ChevronLeft className="size-3.5" />
            </Button>
          )}
          <span className="text-muted-foreground font-mono text-[11px] truncate flex-1">
            /{browsePath || ""}
          </span>
        </div>
        <div className="border-b border-border mb-1" />

        {/* Directory list */}
        {dirs.isFetching ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
        ) : !dirs.data?.length ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No subfolders here</div>
        ) : (
          <div className="flex flex-col max-h-52 overflow-y-auto">
            {dirs.data.map((d) => (
              <button
                key={d.Path}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] hover:bg-accent transition-colors"
                onClick={() => navigateInto(d.Path)}
              >
                <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.Name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Select button */}
        <div className="border-t border-border mt-1 pt-1">
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              onSelect(browsePath);
              setOpen(false);
            }}
          >
            Select "{browsePath || "root"}"
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── poster card ───────────────────────────────────────────────────────────────
function PosterCard({ entry, fs, watched }: { entry: LibraryEntry; fs: string; watched: boolean }) {
  const [hover, setHover] = useState(false);
  const markWatched = useMarkWatched();
  const title = entry.movie?.title ?? entry.title;
  const year = entry.movie?.year ?? entry.year;

  const handlePlay = () => {
    void startWatchSync(entry.item, { fs });
  };

  return (
    <div
      className="group flex flex-col gap-2 cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="relative aspect-[2/3] rounded-[var(--radius-lg)] overflow-hidden border border-border shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5"
        style={{ background: posterGrad(title) }}
      >
        {/* Sheen */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(120% 80% at 50% 0%, oklch(1 0 0 / 0.16), transparent 60%)",
          }}
        />
        {/* TMDB poster */}
        {entry.movie?.posterUrl && (
          <img
            src={entry.movie.posterUrl}
            alt={`${title} poster`}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {/* Fallback icon (no TMDB) */}
        {!entry.movie?.posterUrl && (
          <div className="absolute inset-0 flex items-end pb-3 px-3">
            <div
              className="text-white text-[13px] font-semibold leading-tight tracking-tight"
              style={{ textShadow: "0 1px 4px oklch(0 0 0 / 0.5)" }}
            >
              {title}
            </div>
          </div>
        )}
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <span className="px-1.5 h-[18px] inline-flex items-center rounded-[5px] bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold font-mono uppercase">
            {entry.item.Name.match(/\b(4K|2160p)\b/i)
              ? "4K"
              : entry.item.Name.match(/\b1080p\b/i)
                ? "1080p"
                : entry.item.Name.match(/\b720p\b/i)
                  ? "720p"
                  : "HD"}
          </span>
          {watched && (
            <span className="size-5 inline-flex items-center justify-center rounded-full bg-success/90 text-success-foreground shadow-sm">
              <Check className="size-3" />
            </span>
          )}
        </div>

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/32 transition-opacity duration-200",
            hover ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <button
              className="size-12 rounded-full bg-white/92 text-gray-900 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
              onClick={handlePlay}
              aria-label={`Watch ${title}`}
            >
              <Play className="size-5 ml-0.5" />
            </button>
            {!watched && (
              <button
                className="px-2 py-0.5 rounded-[5px] bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium hover:bg-black/70 transition-colors flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  markWatched.mutate({
                    id: 0,
                    remoteFs: fs,
                    remotePath: entry.item.Path,
                    name: entry.item.Name,
                    size: entry.item.Size,
                    localPath: null,
                    syncedAt: null,
                    watchedAt: null,
                    localDeletedAt: null,
                  });
                }}
              >
                <Eye className="size-3" /> Mark watched
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Below poster */}
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground tabular-nums px-0.5">
        <span>{year ?? "—"}</span>
        {watched && (
          <span className="ml-auto text-success flex items-center gap-1">
            <Eye className="size-3" /> Watched
          </span>
        )}
      </div>
    </div>
  );
}

// ── main view ─────────────────────────────────────────────────────────────────
type FilterTab = "all" | "watched" | "unwatched";

export function MediaView() {
  const saved = loadSaved();
  const [fs, setFs] = useState<string | null>(saved.fs);
  const [path, setPath] = useState(saved.path);
  // Start at 1 if we have a saved selection so the library query fires immediately on mount.
  const [scanKey, setScanKey] = useState(() => (saved.fs !== null ? 1 : 0));
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [cleaning, setCleaning] = useState(false);

  const remotes = useRemotes();
  const tmdbApiKey = useSettingsStore((s) => s.settings.tmdbApiKey);
  const remoteNames = Object.keys(remotes.data ?? {}).sort();

  const library = useLibrary(fs, path, scanKey);
  const watchedPaths = useWatchedPaths(fs);

  // Persist fs + path whenever they change
  useEffect(() => {
    if (fs !== null) {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ fs, path }));
    }
  }, [fs, path]);

  const allEntries = library.data ?? [];
  const watchedSet = watchedPaths.data ?? new Set<string>();
  const watchedCount = allEntries.filter((e) => watchedSet.has(e.item.Path)).length;
  const unwatchedCount = allEntries.length - watchedCount;

  const filtered = allEntries.filter((e) => {
    const isWatched = watchedSet.has(e.item.Path);
    if (tab === "watched" && !isWatched) return false;
    if (tab === "unwatched" && isWatched) return false;
    if (search) {
      const q = search.toLowerCase();
      const title = (e.movie?.title ?? e.title).toLowerCase();
      if (!title.includes(q)) return false;
    }
    return true;
  });

  const subtitle = fs
    ? `${allEntries.length} films on ${fs}${path ? path : ""} · ${watchedCount} watched`
    : "Select a remote and folder to browse your media library";

  return (
    <div className="mx-auto max-w-[1180px] p-6">
      {/* ── page header ── */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">Media library</h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Remote selector */}
          <Select
            value={fs ?? undefined}
            onValueChange={(v) => {
              setFs(v);
              setScanKey(0);
            }}
          >
            <SelectTrigger className="w-[180px]" aria-label="Media remote">
              <SelectValue placeholder="Choose remote…" />
            </SelectTrigger>
            <SelectContent>
              {remoteNames.map((r) => (
                <SelectItem key={r} value={`${r}:`}>
                  {r}:
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Folder path + browse */}
          <div className="flex items-center gap-1">
            <Input
              className="font-mono text-xs w-36"
              placeholder="path/to/films"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              aria-label="Remote folder path"
            />
            <FolderBrowser fs={fs} onSelect={setPath} />
          </div>

          {/* Scan */}
          <Button
            onClick={() => setScanKey((k) => k + 1)}
            disabled={fs === null || library.isFetching}
          >
            {library.isFetching ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <FolderSearch className="size-4" />
            )}
            Scan
          </Button>

          {/* Cleanup */}
          <Button
            variant="outline"
            disabled={cleaning}
            onClick={() => {
              setCleaning(true);
              void runCleanupNow()
                .then((n) => {
                  if (n === 0) toast.info("Nothing to clean up.");
                })
                .finally(() => setCleaning(false));
            }}
          >
            {cleaning ? <Check className="size-4" /> : <BrushCleaning className="size-4" />}
            Clean up
          </Button>
        </div>
      </div>

      {!tmdbApiKey && fs !== null && (
        <p className="text-muted-foreground text-xs mb-4">
          No TMDB API key — filenames only. Add a free key in Settings for poster art.
        </p>
      )}

      {/* ── filter + search bar ── */}
      <div className="flex items-center justify-between mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">
              All{" "}
              <span className="ml-1.5 text-muted-foreground tabular-nums">{allEntries.length}</span>
            </TabsTrigger>
            <TabsTrigger value="watched">
              Watched{" "}
              <span className="ml-1.5 text-muted-foreground tabular-nums">{watchedCount}</span>
            </TabsTrigger>
            <TabsTrigger value="unwatched">
              To watch{" "}
              <span className="ml-1.5 text-muted-foreground tabular-nums">{unwatchedCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search films…"
            className="pl-8 h-8 text-[13px]"
          />
        </div>
      </div>

      {/* ── content ── */}
      {library.isFetching ? (
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      ) : library.isError ? (
        <p className="text-destructive text-sm">{(library.error as Error).message}</p>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-6 gap-4">
          {filtered.map((entry) => (
            <PosterCard
              key={entry.item.Path}
              entry={entry}
              fs={fs!}
              watched={watchedSet.has(entry.item.Path)}
            />
          ))}
        </div>
      ) : allEntries.length > 0 && search ? (
        <div className="py-16 text-center">
          <p className="text-[14px] font-semibold">No films match "{search}"</p>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            Try a different search or filter.
          </p>
        </div>
      ) : scanKey > 0 ? (
        <p className="text-muted-foreground text-sm py-10 text-center">
          No video files found in this folder.
        </p>
      ) : (
        <EmptyState
          icon={Clapperboard}
          title="Scan a media folder"
          hint="Pick a remote and folder path above, then press Scan."
        />
      )}
    </div>
  );
}
