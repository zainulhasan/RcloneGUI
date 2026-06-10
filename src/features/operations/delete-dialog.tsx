import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useDeleteItems, type DeleteRequest } from "./use-operations";

export function DeleteDialog({
  state,
  onClose,
}: {
  state: Omit<DeleteRequest, "dryRun"> | null;
  onClose: () => void;
}) {
  const [dryRun, setDryRun] = useState(false);
  const del = useDeleteItems();

  if (state === null) return null;
  const what =
    state.items.length === 1 ? `"${state.items[0].name}"` : `${state.items.length} items`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {what}?</DialogTitle>
          <DialogDescription>
            This permanently deletes from <span className="font-mono">{state.fs}</span>. Folders are
            removed with all their contents.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs">
          {state.items.map((i) => (
            <li key={i.path} className="truncate leading-5">
              {i.path}
              {i.isDir ? "/" : ""}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="delete-dry-run">Dry run</Label>
          <Switch id="delete-dry-run" checked={dryRun} onCheckedChange={setDryRun} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            variant={dryRun ? "default" : "destructive"}
            disabled={del.isPending}
            onClick={() => del.mutate({ ...state, dryRun }, { onSuccess: onClose })}
          >
            {del.isPending && <Loader2 className="animate-spin" />}
            {dryRun ? "Dry run delete" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
