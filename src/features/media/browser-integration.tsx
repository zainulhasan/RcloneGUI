import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import type { RcListItem } from "@/lib/rc-client";
import { LOCAL_FS } from "@/features/browser/use-listing";
import { useIsLocalHost } from "@/store/host";

import { useWatchedPaths } from "./use-media";
import { startWatchSync } from "./watch-actions";

/** "Watched" badge for browser rows (remote panes only). */
export function WatchedBadge({
  item,
  pane,
}: {
  item: RcListItem;
  pane: { fs: string; path: string };
}) {
  const isLocal = useIsLocalHost();
  const watched = useWatchedPaths(!isLocal || pane.fs === LOCAL_FS ? null : pane.fs);
  if (!isLocal || !watched.data?.has(item.Path)) return null;
  return (
    <Badge variant="secondary" className="shrink-0">
      <Eye /> watched
    </Badge>
  );
}

/** "Watch" context-menu entry for a single remote file/folder. */
export function WatchMenuItems({
  items,
  pane,
}: {
  items: RcListItem[];
  pane: { fs: string; path: string };
}) {
  const isLocal = useIsLocalHost();
  if (!isLocal || pane.fs === LOCAL_FS || items.length !== 1) return null;
  const item = items[0];
  return (
    <>
      <ContextMenuItem onClick={() => void startWatchSync(item, pane)}>
        <Eye /> Watch (sync locally)
      </ContextMenuItem>
      <ContextMenuSeparator />
    </>
  );
}
