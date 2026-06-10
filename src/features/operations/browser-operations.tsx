import { useState } from "react";

import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { BrowserView } from "@/features/browser/browser-view";
import type { RcListItem } from "@/lib/rc-client";
import { useBrowserStore } from "@/store/browser";

import { DeleteDialog } from "./delete-dialog";
import { OperationDialog, type OperationDialogState } from "./operation-dialog";
import { selectionToOperation } from "./selection-to-operation";
import type { DeleteRequest } from "./use-operations";
import type { DirOperationRequest } from "./use-operations";

/** The dual-pane browser with copy/sync/move/bisync/delete wired in. */
export function BrowserWithOperations({
  renderItemActions,
  renderItemBadge,
}: {
  renderItemActions?: (items: RcListItem[], pane: { fs: string; path: string }) => React.ReactNode;
  renderItemBadge?: (item: RcListItem, pane: { fs: string; path: string }) => React.ReactNode;
}) {
  const panes = useBrowserStore((s) => s.panes);
  const active = useBrowserStore((s) => s.active);
  const [operation, setOperation] = useState<OperationDialogState | null>(null);
  const [deleting, setDeleting] = useState<Omit<DeleteRequest, "dryRun"> | null>(null);

  const otherPane = panes[active === 0 ? 1 : 0];

  const startOperation = (
    kind: DirOperationRequest["kind"],
    items: RcListItem[],
    pane: { fs: string; path: string },
  ) => {
    if (otherPane.fs === null) return;
    const dstFs =
      otherPane.path === ""
        ? otherPane.fs
        : `${otherPane.fs}${otherPane.fs.endsWith(":") || otherPane.fs.endsWith("/") ? "" : "/"}${otherPane.path}`;
    setOperation({ kind, source: selectionToOperation(pane.fs, pane.path, items), dstFs });
  };

  return (
    <>
      <BrowserView
        renderItemBadge={renderItemBadge}
        renderItemActions={(items, pane) => (
          <>
            {renderItemActions?.(items, pane)}
            {otherPane.fs !== null && (
              <>
                <ContextMenuItem onClick={() => startOperation("copy", items, pane)}>
                  Copy to other pane…
                </ContextMenuItem>
                <ContextMenuItem onClick={() => startOperation("move", items, pane)}>
                  Move to other pane…
                </ContextMenuItem>
                {items.length === 1 && items[0].IsDir && (
                  <>
                    <ContextMenuItem onClick={() => startOperation("sync", items, pane)}>
                      Sync to other pane…
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => startOperation("bisync", items, pane)}>
                      Bisync with other pane…
                    </ContextMenuItem>
                  </>
                )}
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem
              variant="destructive"
              onClick={() =>
                setDeleting({
                  fs: pane.fs,
                  items: items.map((i) => ({ path: i.Path, name: i.Name, isDir: i.IsDir })),
                })
              }
            >
              Delete…
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
      />
      <OperationDialog
        key={operation ? `${operation.kind}-${operation.source.srcFs}` : "op"}
        state={operation}
        onClose={() => setOperation(null)}
      />
      <DeleteDialog
        key={deleting ? `del-${deleting.fs}-${deleting.items.length}` : "del"}
        state={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
