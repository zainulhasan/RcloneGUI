import { useState } from "react";
import {
  BrushCleaning,
  Check,
  Clapperboard,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes, formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/layout/page";
import type { MediaItem } from "./types";
import { LibraryView } from "./library-view";
import { runCleanupNow } from "./use-cleanup-runner";
import { useDeleteLocalCopy, useMarkUnwatched, useMarkWatched, useRecentMedia } from "./use-media";
import { openLocal } from "./watch-actions";

function WatchList() {
  const recent = useRecentMedia();
  const markWatched = useMarkWatched();
  const markUnwatched = useMarkUnwatched();
  const deleteLocal = useDeleteLocalCopy();
  const [confirmDelete, setConfirmDelete] = useState<MediaItem | null>(null);

  const items = recent.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="Nothing here yet"
        hint="Right-click a file in the Browser and choose “Watch” to sync it locally."
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Synced</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-36 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-60 truncate font-medium">{item.name}</TableCell>
              <TableCell className="text-xs tabular-nums">
                {item.size > 0 ? formatBytes(item.size) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {item.syncedAt ? formatDateTime(new Date(item.syncedAt).toISOString()) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-52 truncate font-mono text-xs">
                {item.remoteFs}
                {item.remotePath}
              </TableCell>
              <TableCell>
                <span className="flex gap-1">
                  {item.watchedAt !== null && <Badge variant="watched">watched</Badge>}
                  {item.localPath !== null ? (
                    <Badge variant="outline">local</Badge>
                  ) : item.localDeletedAt !== null ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      cleaned
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {item.localPath && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${item.name}`}
                        onClick={() => {
                          openLocal(item.localPath!).catch((err: Error) =>
                            toast.error(`Could not open: ${err.message}`),
                          );
                        }}
                      >
                        <ExternalLink />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open</TooltipContent>
                  </Tooltip>
                )}
                {item.watchedAt === null ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Mark ${item.name} watched`}
                        onClick={() => markWatched.mutate(item)}
                      >
                        <Eye />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark watched</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Mark ${item.name} unwatched`}
                        onClick={() => markUnwatched.mutate(item)}
                      >
                        <EyeOff />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark unwatched</TooltipContent>
                  </Tooltip>
                )}
                {item.localPath && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete local copy of ${item.name}`}
                        onClick={() => setConfirmDelete(item)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete local copy</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete local copy of "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <span className="font-mono">{confirmDelete?.localPath}</span> from your Watch
              Folder. The original on {confirmDelete?.remoteFs} is not touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) deleteLocal.mutate(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete local copy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MediaView() {
  const [cleaning, setCleaning] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Media"
        description="Watch & Auto-Clean: sync, watch in your player, clean up after."
        actions={
          <Button
            variant="outline"
            size="sm"
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
            {cleaning ? <Check /> : <BrushCleaning />} Run cleanup now
          </Button>
        }
      />

      <Tabs defaultValue="watchlist">
        <TabsList>
          <TabsTrigger value="watchlist">Now / Recently watched</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>
        <TabsContent value="watchlist">
          <WatchList />
        </TabsContent>
        <TabsContent value="library">
          <LibraryView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
