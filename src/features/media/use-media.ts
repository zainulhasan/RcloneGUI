import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { logActivity } from "@/store/activity";
import { useSettingsStore } from "@/store/settings";

import type { MediaItem } from "./types";
import { deleteLocalCopy } from "./watch-actions";
import { getWatchedDb } from "./watched-db";

export function useRecentMedia() {
  return useQuery({
    queryKey: ["media", "recent"],
    queryFn: async () => (await getWatchedDb()).recent(50),
  });
}

/** Watched remote paths for one fs — drives badges in the browser. */
export function useWatchedPaths(fs: string | null) {
  return useQuery({
    queryKey: ["media", "watched-paths", fs],
    queryFn: async () => (await getWatchedDb()).watchedPaths(fs!),
    enabled: fs !== null,
    select: (set) => set,
    staleTime: 10_000,
  });
}

export function useMarkWatched() {
  const queryClient = useQueryClient();
  const deleteOnMarkWatched = useSettingsStore((s) => s.settings.deleteOnMarkWatched);
  return useMutation({
    mutationFn: async (item: MediaItem) => {
      const db = await getWatchedDb();
      await db.markWatched(item.remoteFs, item.remotePath);
      logActivity("info", "media", `Marked "${item.name}" watched`);
      if (deleteOnMarkWatched && item.localPath) {
        await deleteLocalCopy(item.localPath, item.name);
        await db.markLocalDeleted(item.id);
      }
    },
    onSuccess: (_d, item) => {
      toast.success(`"${item.name}" marked watched`);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err) => toast.error(`Could not mark watched: ${err.message}`),
  });
}

export function useMarkUnwatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: MediaItem) => {
      const db = await getWatchedDb();
      await db.markUnwatched(item.remoteFs, item.remotePath);
    },
    onSuccess: (_d, item) => {
      toast.success(`"${item.name}" marked unwatched`);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
}

export function useDeleteLocalCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: MediaItem) => {
      if (!item.localPath) throw new Error("no local copy");
      const db = await getWatchedDb();
      await deleteLocalCopy(item.localPath, item.name);
      await db.markLocalDeleted(item.id);
    },
    onSuccess: (_d, item) => {
      toast.success(`Local copy of "${item.name}" deleted`);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err) => toast.error(`Could not delete local copy: ${err.message}`),
  });
}
