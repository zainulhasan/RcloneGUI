import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, HardDrive, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc } from "@/lib/rc-client";
import { formatDateTime } from "@/lib/format";
import { logActivity } from "@/store/activity";

function useMounts() {
  return useQuery({
    queryKey: ["mounts"],
    queryFn: () => rc.listMounts(),
    refetchInterval: 5000,
  });
}

async function pickDirectory(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

export function MountsView() {
  const remotes = useRemotes();
  const mounts = useMounts();
  const queryClient = useQueryClient();

  const [fs, setFs] = useState("");
  const [mountPoint, setMountPoint] = useState("");

  const mount = useMutation({
    mutationFn: () => rc.mount(fs, mountPoint),
    onSuccess: () => {
      toast.success(`Mounted ${fs} at ${mountPoint}`);
      logActivity("info", "operation", `Mounted ${fs} at ${mountPoint}`);
      setMountPoint("");
      void queryClient.invalidateQueries({ queryKey: ["mounts"] });
    },
    onError: (err) =>
      toast.error("Mount failed", {
        description: `${err.message}. Mounting needs FUSE (macFUSE on macOS, WinFsp on Windows).`,
      }),
  });

  const unmount = useMutation({
    mutationFn: (point: string) => rc.unmount(point),
    onSuccess: (_d, point) => {
      toast.success(`Unmounted ${point}`);
      logActivity("info", "operation", `Unmounted ${point}`);
      void queryClient.invalidateQueries({ queryKey: ["mounts"] });
    },
    onError: (err) => toast.error(`Unmount failed: ${err.message}`),
  });

  const remoteNames = Object.keys(remotes.data ?? {}).sort();
  const active = mounts.data ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Mounts</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mount a remote</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex w-44 flex-col gap-1.5">
            <Label htmlFor="mount-remote">Remote</Label>
            <Select value={fs || undefined} onValueChange={setFs}>
              <SelectTrigger id="mount-remote" className="w-full">
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
            <Label htmlFor="mount-point">Mount point</Label>
            <div className="flex gap-2">
              <Input
                id="mount-point"
                value={mountPoint}
                onChange={(e) => setMountPoint(e.target.value)}
                placeholder="/Users/you/mnt/remote"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Choose folder"
                onClick={() => {
                  void pickDirectory().then((dir) => dir && setMountPoint(dir));
                }}
              >
                <FolderOpen />
              </Button>
            </div>
          </div>
          <Button
            onClick={() => mount.mutate()}
            disabled={!fs || !mountPoint.trim() || mount.isPending}
          >
            {mount.isPending ? <Loader2 className="animate-spin" /> : <HardDrive />}
            Mount
          </Button>
        </CardContent>
      </Card>

      {active.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16">
          <HardDrive className="size-8" />
          <p className="text-sm">No active mounts.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Remote</TableHead>
              <TableHead>Mount point</TableHead>
              <TableHead>Mounted</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((m) => (
              <TableRow key={m.MountPoint}>
                <TableCell className="font-medium">{m.Fs}</TableCell>
                <TableCell className="font-mono text-xs">{m.MountPoint}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDateTime(m.MountedOn)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unmount.isPending}
                    onClick={() => unmount.mutate(m.MountPoint)}
                  >
                    <Unplug /> Unmount
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
