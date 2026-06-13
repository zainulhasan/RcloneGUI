import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, HardDrive, Loader2, Play, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/layout/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc } from "@/lib/rc-client";
import { useHostKey } from "@/lib/rc-client/host-key";
import { formatDateTime } from "@/lib/format";
import { logActivity } from "@/store/activity";
import { useSavedMountsStore } from "@/store/saved-mounts";

import { DEFAULT_MOUNT_OPTIONS, toRcMountOptions, type MountFormOptions } from "./mount-options";
import { mountSaved } from "./use-auto-mounts";

const CACHE_MODE_HELP: Record<MountFormOptions["cacheMode"], string> = {
  off: "Direct streaming. Some apps can't seek or write.",
  minimal: "Caches only files opened for read/write.",
  writes: "Caches writes; reads stream directly. Good default.",
  full: "Caches everything it reads. Best compatibility, uses disk.",
};

function useMounts() {
  const key = useHostKey("mounts");
  return useQuery({
    queryKey: key,
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
  const saved = useSavedMountsStore((s) => s.mounts);
  const upsertSaved = useSavedMountsStore((s) => s.upsert);
  const removeSaved = useSavedMountsStore((s) => s.remove);
  const setAutoMount = useSavedMountsStore((s) => s.setAutoMount);

  const [fs, setFs] = useState("");
  const [mountPoint, setMountPoint] = useState("");
  const [options, setOptions] = useState<MountFormOptions>(DEFAULT_MOUNT_OPTIONS);
  const [remember, setRemember] = useState(true);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["mounts"] });

  const mount = useMutation({
    mutationFn: async () => {
      const { vfsOpt, mountOpt } = toRcMountOptions(options);
      await rc.mount(fs, mountPoint, { vfsOpt, mountOpt });
    },
    onSuccess: () => {
      toast.success(`Mounted ${fs} at ${mountPoint}`);
      logActivity("info", "operation", `Mounted ${fs} at ${mountPoint}`);
      if (remember) {
        void upsertSaved({
          id: `${fs}|${mountPoint}`,
          fs,
          mountPoint,
          options,
          autoMount: false,
        });
      }
      setMountPoint("");
      refresh();
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
      refresh();
    },
    onError: (err) => toast.error(`Unmount failed: ${err.message}`),
  });

  const remoteNames = Object.keys(remotes.data ?? {}).sort();
  const active = mounts.data ?? [];
  const activePoints = new Set(active.map((m) => m.MountPoint));

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Mounts"
        description="Mount any remote as a local drive · configurable VFS cache"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New mount</CardTitle>
          <CardDescription>Needs FUSE (macFUSE / WinFsp / fuse3).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Field
              label="Remote"
              htmlFor="mount-remote"
              help="Which configured remote to attach as a drive."
              className="w-44"
            >
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
            </Field>
            <Field
              label="Mount point"
              htmlFor="mount-point"
              help="An empty local folder where the remote will appear. Pick or type a path."
              className="flex-1"
            >
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
            </Field>
          </div>

          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 lg:grid-cols-4">
            <Field
              label="Cache mode"
              htmlFor="cache-mode"
              help="How much the mount caches on local disk. 'writes' is the safe default; 'full' also caches reads — best for streaming video or apps that seek a lot; 'off' streams directly but some apps can't save or seek."
              hint={CACHE_MODE_HELP[options.cacheMode]}
            >
              <Select
                value={options.cacheMode}
                onValueChange={(v) =>
                  setOptions({ ...options, cacheMode: v as MountFormOptions["cacheMode"] })
                }
              >
                <SelectTrigger id="cache-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">off</SelectItem>
                  <SelectItem value="minimal">minimal</SelectItem>
                  <SelectItem value="writes">writes</SelectItem>
                  <SelectItem value="full">full</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Cache max size"
              htmlFor="cache-max-size"
              help="Cap for the on-disk cache, e.g. 10G or 500M. When the cache grows past this, the least-recently-used files are evicted. Empty = unlimited."
            >
              <Input
                id="cache-max-size"
                placeholder="e.g. 10G — empty = unlimited"
                value={options.cacheMaxSize}
                onChange={(e) => setOptions({ ...options, cacheMaxSize: e.target.value })}
              />
            </Field>
            <Field
              label="Cache max age"
              htmlFor="cache-max-age"
              help="How long cached files are kept since last use, e.g. 1h, 24h, 7d. Older entries are removed. Empty = rclone's default (1h)."
            >
              <Input
                id="cache-max-age"
                placeholder="e.g. 24h — empty = default"
                value={options.cacheMaxAge}
                onChange={(e) => setOptions({ ...options, cacheMaxAge: e.target.value })}
              />
            </Field>
            <Field
              label="Volume name"
              htmlFor="volume-name"
              help="The drive name shown in Finder / Explorer. Optional — defaults to the remote's name."
            >
              <Input
                id="volume-name"
                placeholder="optional"
                value={options.volumeName}
                onChange={(e) => setOptions({ ...options, volumeName: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={options.readOnly}
                onCheckedChange={(v) => setOptions({ ...options, readOnly: v })}
                aria-label="Read only"
              />
              Read-only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={remember}
                onCheckedChange={setRemember}
                aria-label="Remember mount"
              />
              Remember this mount
            </label>
            <Button
              className="ml-auto"
              onClick={() => mount.mutate()}
              disabled={!fs || !mountPoint.trim() || mount.isPending}
            >
              {mount.isPending ? <Loader2 className="animate-spin" /> : <HardDrive />}
              Mount
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── right: tables ── */}
      <div className="flex flex-col gap-4">
        {active.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active mounts</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {saved.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Saved mounts</CardTitle>
              <CardDescription>
                Auto-mount runs when RcloneGUI starts. Cache settings are remembered per mount.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Remote</TableHead>
                    <TableHead>Mount point</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Auto-mount</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saved.map((m) => {
                    const isActive = activePoints.has(m.mountPoint);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {m.fs}
                            {isActive && (
                              <Badge variant="running">
                                <span className="size-1.5 rounded-full bg-current" />
                                mounted
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.mountPoint}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.options.cacheMode}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={m.autoMount}
                            onCheckedChange={(v) => void setAutoMount(m.id, v)}
                            aria-label={`Auto-mount ${m.fs}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {!isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Mount ${m.fs}`}
                                  onClick={() => {
                                    mountSaved(m)
                                      .then(() => {
                                        toast.success(`Mounted ${m.fs}`);
                                        refresh();
                                      })
                                      .catch((err: Error) =>
                                        toast.error(`Mount failed: ${err.message}`),
                                      );
                                  }}
                                >
                                  <Play />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mount now</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Forget ${m.fs}`}
                                onClick={() => void removeSaved(m.id)}
                              >
                                <Trash2 className="text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Forget</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {active.length === 0 && saved.length === 0 && (
          <EmptyState
            icon={HardDrive}
            title="No mounts yet"
            hint="Mounted remotes appear in Finder/Explorer like normal drives."
          />
        )}
      </div>
      {/* tables */}
    </div>
  );
}
