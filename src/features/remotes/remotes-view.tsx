import { useState } from "react";
import { FolderOpen, Loader2, Pencil, Plug, Plus, Server, Trash2 } from "lucide-react";

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
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigationStore } from "@/store/navigation";
import { useBrowserStore } from "@/store/browser";

import { RemoteWizard } from "./remote-wizard";
import { UsageCell } from "./usage-cell";
import { useDeleteRemote, useRemotes, useTestRemote } from "./use-remotes";

function IconAction({
  label,
  onClick,
  children,
  busy,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RemotesView() {
  const remotes = useRemotes();
  const deleteRemote = useDeleteRemote();
  const testRemote = useTestRemote();
  const navigate = useNavigationStore((s) => s.navigate);
  const openInBrowser = useBrowserStore((s) => s.openFs);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<{
    name: string;
    type: string;
    values: Record<string, string>;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const entries = Object.entries(remotes.data ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Remotes"
        description="Cloud storage connections managed through rclone."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setWizardOpen(true);
            }}
          >
            <Plus /> Add remote
          </Button>
        }
      />

      {remotes.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No remotes yet"
          hint="Connect S3, Google Drive, Dropbox, SFTP and 40+ other providers."
        >
          <Button
            variant="outline"
            onClick={() => {
              setEditing(null);
              setWizardOpen(true);
            }}
          >
            <Plus /> Add your first remote
          </Button>
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([name, config]) => (
              <TableRow key={name}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{config.type ?? "unknown"}</Badge>
                </TableCell>
                <TableCell>
                  <UsageCell name={name} />
                </TableCell>
                <TableCell className="text-right">
                  <IconAction
                    label="Browse"
                    onClick={() => {
                      openInBrowser(`${name}:`);
                      navigate("browser");
                    }}
                  >
                    <FolderOpen />
                  </IconAction>
                  <IconAction
                    label="Test connection"
                    busy={testRemote.isPending && testRemote.variables === name}
                    onClick={() => testRemote.mutate(name)}
                  >
                    <Plug />
                  </IconAction>
                  <IconAction
                    label="Edit"
                    onClick={() => {
                      const { type, ...values } = config;
                      setEditing({ name, type: type ?? "", values });
                      setWizardOpen(true);
                    }}
                  >
                    <Pencil />
                  </IconAction>
                  <IconAction label="Delete" onClick={() => setDeleting(name)}>
                    <Trash2 className="text-destructive" />
                  </IconAction>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RemoteWizard
        key={editing?.name ?? "create"}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editing={editing}
        existingNames={entries.map(([n]) => n)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete remote "{deleting}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the remote from your rclone config. Files on the remote itself are not
              touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleting) deleteRemote.mutate(deleting);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
