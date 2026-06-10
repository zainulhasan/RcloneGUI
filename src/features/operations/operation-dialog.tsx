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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { EMPTY_FLAGS, flagsToOptions, type FlagsValue } from "./flags";
import { FlagsEditor } from "./flags-editor";
import type { OperationSource } from "./selection-to-operation";
import { useRunOperation, type DirOperationRequest } from "./use-operations";

export interface OperationDialogState {
  kind: DirOperationRequest["kind"];
  source: OperationSource;
  dstFs: string;
}

const KIND_COPY: Record<DirOperationRequest["kind"], { title: string; description: string }> = {
  copy: { title: "Copy", description: "Copy files to the destination. Source is unchanged." },
  sync: {
    title: "Sync",
    description:
      "Make the destination identical to the source. Files only in the destination are DELETED.",
  },
  move: { title: "Move", description: "Copy to the destination, then delete from the source." },
  bisync: {
    title: "Bisync",
    description: "Two-way sync. Changes on both sides are propagated.",
  },
};

export function OperationDialog({
  state,
  defaults,
  onClose,
}: {
  state: OperationDialogState | null;
  defaults?: Partial<FlagsValue>;
  onClose: () => void;
}) {
  const [flags, setFlags] = useState<FlagsValue>({ ...EMPTY_FLAGS, ...defaults });
  const [resync, setResync] = useState(false);
  const run = useRunOperation();

  if (state === null) return null;
  const copyText = KIND_COPY[state.kind];

  const submit = () => {
    const options = flagsToOptions(flags);
    if (state.source.includeRules.length > 0) {
      options.filter = {
        ...options.filter,
        IncludeRule: [...state.source.includeRules, ...(options.filter?.IncludeRule ?? [])],
      };
    }
    run.mutate(
      {
        kind: state.kind,
        srcFs: state.source.srcFs,
        dstFs: state.dstFs,
        options,
        label: `${state.source.label} → ${state.dstFs}`,
        resync: state.kind === "bisync" ? resync : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copyText.title}</DialogTitle>
          <DialogDescription>{copyText.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border px-3 py-2 text-sm">
          <div className="grid grid-cols-[60px_1fr] gap-1">
            <span className="text-muted-foreground">From</span>
            <span className="truncate font-mono text-xs leading-5">
              {state.source.srcFs}
              {state.source.includeRules.length > 0 && (
                <span className="text-muted-foreground"> ({state.source.label})</span>
              )}
            </span>
            <span className="text-muted-foreground">To</span>
            <span className="truncate font-mono text-xs leading-5">{state.dstFs}</span>
          </div>
        </div>

        {state.kind === "sync" && (
          <Alert variant="destructive">
            <AlertTitle>Sync deletes</AlertTitle>
            <AlertDescription>
              Files in the destination that do not exist in the source will be removed. Use Copy if
              you only want to add files, or enable Dry run first.
            </AlertDescription>
          </Alert>
        )}

        {state.kind === "bisync" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={resync} onChange={(e) => setResync(e.target.checked)} />
            First run for this pair (resync)
          </label>
        )}

        <FlagsEditor value={flags} onChange={setFlags} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={run.isPending}>
            {run.isPending && <Loader2 className="animate-spin" />}
            {flags.dryRun
              ? `Dry run ${copyText.title.toLowerCase()}`
              : `Start ${copyText.title.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
