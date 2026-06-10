import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Eye, Film, FolderSearch, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc, type RcListItem } from "@/lib/rc-client";
import { useSettingsStore } from "@/store/settings";

import { isVideoFile, parseFilename } from "./filename-parser";
import { searchMovie, type TmdbMovie } from "./tmdb";
import { useMarkWatched, useWatchedPaths } from "./use-media";
import { startWatchSync } from "./watch-actions";

interface LibraryEntry {
  item: RcListItem;
  title: string;
  year: number | null;
  movie: TmdbMovie | null;
}

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

function PosterCard({ entry, fs, watched }: { entry: LibraryEntry; fs: string; watched: boolean }) {
  const markWatched = useMarkWatched();
  const title = entry.movie?.title ?? entry.title;
  const year = entry.movie?.year ?? entry.year;

  return (
    <div className="bg-card group flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-muted relative aspect-2/3 w-full">
        {entry.movie?.posterUrl ? (
          <img
            src={entry.movie.posterUrl}
            alt={`${title} poster`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <Film className="size-10" />
          </div>
        )}
        {watched && (
          <Badge className="absolute top-2 right-2" variant="secondary">
            <Eye /> watched
          </Badge>
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            onClick={() => void startWatchSync(entry.item, { fs })}
            aria-label={`Watch ${title}`}
          >
            <Play /> Watch
          </Button>
          {!watched && (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Mark ${title} watched`}
              onClick={() =>
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
                })
              }
            >
              <Eye />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-sm font-medium" title={title}>
          {title}
        </span>
        <span className="text-muted-foreground text-xs">{year ?? "—"}</span>
      </div>
    </div>
  );
}

export function LibraryView() {
  const remotes = useRemotes();
  const tmdbApiKey = useSettingsStore((s) => s.settings.tmdbApiKey);

  const [fs, setFs] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [scanKey, setScanKey] = useState(0);

  const library = useLibrary(fs, path, scanKey);
  const watchedPaths = useWatchedPaths(fs);
  const remoteNames = Object.keys(remotes.data ?? {}).sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex w-40 flex-col gap-1.5">
          <span className="text-sm font-medium">Remote</span>
          <Select value={fs ?? undefined} onValueChange={(v) => setFs(v)}>
            <SelectTrigger className="w-full" aria-label="Library remote">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {remoteNames.map((r) => (
                <SelectItem key={r} value={`${r}:`}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Folder</span>
          <Input
            className="font-mono text-xs"
            placeholder="films"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setScanKey((k) => k + 1)}
          disabled={fs === null || library.isFetching}
        >
          <FolderSearch /> Scan
        </Button>
      </div>

      {!tmdbApiKey && (
        <p className="text-muted-foreground text-xs">
          No TMDB API key set — showing file names without posters. Add a free key in Settings for
          artwork and metadata.
        </p>
      )}

      {library.isFetching ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
          ))}
        </div>
      ) : library.isError ? (
        <p className="text-destructive text-sm">{(library.error as Error).message}</p>
      ) : library.data && library.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {library.data.map((entry) => (
            <PosterCard
              key={entry.item.Path}
              entry={entry}
              fs={fs!}
              watched={watchedPaths.data?.has(entry.item.Path) ?? false}
            />
          ))}
        </div>
      ) : library.data ? (
        <p className="text-muted-foreground text-sm">No video files in this folder.</p>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16">
          <Clapperboard className="size-8" />
          <p className="text-sm">Pick a remote folder with films and press Scan.</p>
        </div>
      )}
    </div>
  );
}
