import { useState } from "react";
import { CalendarClock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { executeScheduledJob } from "./use-scheduler-runner";

function JobDialog({ job, onClose }: { job: ScheduledJob | null; onClose: () => void }) {
  const upsert = useScheduledJobsStore((s) => s.upsert);
  const [draft, setDraft] = useState<ScheduledJob>(
    job ?? { ...newScheduledJob(), id: crypto.randomUUID() },
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

export function SchedulerView() {
  const jobs = useScheduledJobsStore((s) => s.jobs);
  const remove = useScheduledJobsStore((s) => s.remove);
  const setEnabled = useScheduledJobsStore((s) => s.setEnabled);

  const [dialog, setDialog] = useState<{ open: boolean; job: ScheduledJob | null }>({
    open: false,
    job: null,
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Scheduler</h1>
        <Button onClick={() => setDialog({ open: true, job: null })}>
          <Plus /> New job
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16">
          <CalendarClock className="size-8" />
          <p className="text-sm">No scheduled jobs. Jobs run while the app is open.</p>
        </div>
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
                        onClick={() => setDialog({ open: true, job })}
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
          key={dialog.job?.id ?? "new"}
          job={dialog.job}
          onClose={() => setDialog({ open: false, job: null })}
        />
      )}
    </div>
  );
}
