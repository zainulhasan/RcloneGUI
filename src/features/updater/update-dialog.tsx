import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useUpdaterStore } from "./use-updater";

export function UpdateDialog() {
  const available = useUpdaterStore((s) => s.available);
  const installing = useUpdaterStore((s) => s.installing);
  const dismiss = useUpdaterStore((s) => s.dismiss);

  if (!available) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && !installing && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="text-primary size-4" />
            Update available: v{available.version}
          </DialogTitle>
          <DialogDescription>
            A new version of RcloneGUI is ready. The app restarts after installing.
          </DialogDescription>
        </DialogHeader>
        {available.notes && (
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {available.notes}
          </pre>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss} disabled={installing}>
            Later
          </Button>
          <Button
            onClick={() => {
              available.install().catch((err: Error) => {
                toast.error(`Update failed: ${err.message}`);
              });
            }}
            disabled={installing}
          >
            {installing && <Loader2 className="animate-spin" />}
            {installing ? "Installing…" : "Update now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
