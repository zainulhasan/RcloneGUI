import { useEffect, useState } from "react";
import { Bookmark, CalendarClock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { setAutostart } from "@/features/background/use-background";
import { useSettingsStore } from "@/store/settings";
import { usePresetsStore, type Preset } from "@/store/presets";
import { useRunOperation } from "@/features/operations/use-operations";
import { flagsToOptions } from "@/features/operations/flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FlagsEditor } from "@/features/operations/flags-editor";
import { formatDateTime } from "@/lib/format";
import { useScheduledJobsStore, newScheduledJob, type ScheduledJob } from "@/store/scheduled-jobs";

import { validateCron } from "./cron";
import { presetToScheduledJob } from "./preset-utils";
import { executeScheduledJob } from "./use-scheduler-runner";

function JobDialog({
  job,
  template,
  onClose,
}: {
  job: ScheduledJob | null;
  template?: ScheduledJob | null;
  onClose: () => void;
}) {
  const upsert = useScheduledJobsStore((s) => s.upsert);
  const [draft, setDraft] = useState<ScheduledJob>(
    job ?? template ?? { ...newScheduledJob(), id: crypto.randomUUID() },
  );

  const cronError = validateCron(draft.cron);
  const valid = draft.name.trim() && draft.srcFs.trim() && draft.dstFs.trim() && cronError === null;

  const save = () => {
    void upsert({ ...draft, name: draft.name.trim() });
    toast.success(`Job "${draft.name.trim()}" saved`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? `Edit "${job.name}"` : "New scheduled job"}</DialogTitle>
          <DialogDescription>
            Runs while RcloneGUI is open. Paths use rclone syntax, e.g.{" "}
            <span className="font-mono">gdrive:backups</span> or{" "}
            <span className="font-mono">/Users/you/files</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-name">Name</Label>
              <Input
                id="job-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Nightly photo backup"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-kind">Operation</Label>
              <Select
                value={draft.kind}
                onValueChange={(kind) => setDraft({ ...draft, kind: kind as ScheduledJob["kind"] })}
              >
                <SelectTrigger id="job-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copy">copy</SelectItem>
                  <SelectItem value="sync">sync</SelectItem>
                  <SelectItem value="move">move</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-src">Source</Label>
            <Input
              id="job-src"
              className="font-mono text-xs"
              value={draft.srcFs}
              onChange={(e) => setDraft({ ...draft, srcFs: e.target.value })}
              placeholder="gdrive:photos"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-dst">Destination</Label>
            <Input
              id="job-dst"
              className="font-mono text-xs"
              value={draft.dstFs}
              onChange={(e) => setDraft({ ...draft, dstFs: e.target.value })}
              placeholder="/Users/you/Backups/photos"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-cron">Schedule (cron)</Label>
            <Input
              id="job-cron"
              className="font-mono text-xs"
              value={draft.cron}
              onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
              placeholder="0 3 * * *"
              aria-invalid={!!cronError}
            />
            <p className={cronError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
              {cronError ?? "minute hour day month weekday — e.g. “0 3 * * *” is daily at 03:00."}
            </p>
          </div>

          <FlagsEditor value={draft.flags} onChange={(flags) => setDraft({ ...draft, flags })} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresetsCard({ onSchedule }: { onSchedule: (template: ScheduledJob) => void }) {
  const presets = usePresetsStore((s) => s.presets);
  const removePreset = usePresetsStore((s) => s.remove);
  const run = useRunOperation();

  if (presets.length === 0) return null;

  const runNow = (p: Preset) => {
    run.mutate({
      kind: p.kind,
      srcFs: p.srcFs,
      dstFs: p.dstFs,
      options: flagsToOptions(p.flags),
      label: `${p.name} (preset)`,
      resync: p.kind === "bisync" ? false : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bookmark className="text-muted-foreground size-4" />
          Presets
        </CardTitle>
        <CardDescription>Saved transfers — run once or turn into a scheduled job.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {presets.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.kind}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-72 truncate font-mono text-xs">
                  {p.srcFs} → {p.dstFs}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Run preset ${p.name}`}
                        onClick={() => runNow(p)}
                      >
                        <Play />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run now</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Schedule preset ${p.name}`}
                        onClick={() => onSchedule(presetToScheduledJob(p, crypto.randomUUID()))}
                      >
                        <CalendarClock />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schedule…</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete preset ${p.name}`}
                        onClick={() => {
                          void removePreset(p.id);
                          toast.success(`Preset "${p.name}" deleted`);
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SchedulerView() {
  const runInBackground = useSettingsStore((s) => s.settings.runInBackground);
  const updateSettings = useSettingsStore((s) => s.update);
  const jobs = useScheduledJobsStore((s) => s.jobs);
  const remove = useScheduledJobsStore((s) => s.remove);
  const setEnabled = useScheduledJobsStore((s) => s.setEnabled);

  const hydratePresets = usePresetsStore((s) => s.hydrate);
  useEffect(() => {
    void hydratePresets();
  }, [hydratePresets]);

  const [dialog, setDialog] = useState<{
    open: boolean;
    job: ScheduledJob | null;
    template: ScheduledJob | null;
  }>({ open: false, job: null, template: null });

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Scheduler"
        description="Recurring copy/sync/move jobs that run while the app is open."
        actions={
          <Button onClick={() => setDialog({ open: true, job: null, template: null })}>
            <Plus /> New job
          </Button>
        }
      />

      <PresetsCard onSchedule={(template) => setDialog({ open: true, job: null, template })} />

      {!runInBackground && jobs.length > 0 && (
        <Alert>
          <CalendarClock className="size-4" />
          <AlertTitle>Jobs only run while RcloneGUI is running</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Enable background mode so schedules keep working after you close the window.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void updateSettings({ runInBackground: true });
                void setAutostart(true);
                toast.success("Background mode enabled — RcloneGUI stays in the tray.");
              }}
            >
              Enable
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled jobs"
          hint="Create one to back up or sync on a cron schedule."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">On</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Switch
                    checked={job.enabled}
                    onCheckedChange={(on) => void setEnabled(job.id, on)}
                    aria-label={`Enable ${job.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{job.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {job.kind}: {job.srcFs} → {job.dstFs}
                </TableCell>
                <TableCell className="font-mono text-xs">{job.cron}</TableCell>
                <TableCell className="text-xs">
                  {job.lastRunAt === null ? (
                    <span className="text-muted-foreground">never</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      {formatDateTime(new Date(job.lastRunAt).toISOString())}
                      <Badge variant={job.lastResult === "success" ? "secondary" : "destructive"}>
                        {job.lastResult}
                      </Badge>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Run ${job.name} now`}
                        onClick={() => void executeScheduledJob(job)}
                      >
                        <Play />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run now</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${job.name}`}
                        onClick={() => setDialog({ open: true, job, template: null })}
                      >
                        <Pencil />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${job.name}`}
                        onClick={() => {
                          void remove(job.id);
                          toast.success(`Job "${job.name}" deleted`);
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialog.open && (
        <JobDialog
          key={dialog.job?.id ?? dialog.template?.id ?? "new"}
          job={dialog.job}
          template={dialog.template}
          onClose={() => setDialog({ open: false, job: null, template: null })}
        />
      )}
    </div>
  );
}
