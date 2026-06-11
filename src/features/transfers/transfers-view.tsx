import { ArrowDownUp, CheckCircle2, Loader2, Trash2, XCircle, XOctagon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rc } from "@/lib/rc-client";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useJobsStore, type TrackedJob } from "@/store/jobs";

import { HistoryTab } from "./history-tab";
import { Sparkline } from "./sparkline";
import { SPARKLINE_SAMPLES, useCoreStats, useJobStats, useSpeedSamples } from "./use-transfers";

function JobCard({ job }: { job: TrackedJob }) {
  const stats = useJobStats(job.group, !job.finished);
  const remove = useJobsStore((s) => s.remove);

  const transferring = stats.data?.transferring ?? [];
  const totalBytes = stats.data?.totalBytes ?? 0;
  const bytes = stats.data?.bytes ?? 0;
  const pct = totalBytes > 0 ? Math.min(100, (bytes / totalBytes) * 100) : 0;

  const cancel = async () => {
    try {
      await rc.jobStop(job.jobid);
      toast.info(`Cancelling job ${job.jobid}`);
    } catch (err) {
      toast.error(`Could not cancel: ${(err as Error).message}`);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
          {job.finished ? (
            job.success ? (
              <CheckCircle2 className="text-success size-4 shrink-0" />
            ) : (
              <XCircle className="text-destructive size-4 shrink-0" />
            )
          ) : (
            <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
          )}
          <span className="truncate">{job.label}</span>
          <Badge variant="secondary" className="shrink-0">
            {job.kind}
          </Badge>
        </CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          {!job.finished && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel job"
                  onClick={() => void cancel()}
                >
                  <XOctagon className="text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          )}
          {job.finished && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Dismiss job"
                  onClick={() => remove(job.jobid)}
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {job.finished ? (
          <p className="text-muted-foreground text-xs">
            {job.success ? "Completed" : (job.error ?? "Failed")}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Progress
                value={pct}
                className="flex-1 [&>[data-slot=progress-indicator]]:barberpole"
                aria-label="Job progress"
              />
              <span className="text-muted-foreground w-32 shrink-0 text-right text-xs tabular-nums">
                {formatBytes(bytes)} / {formatBytes(totalBytes)}
              </span>
            </div>
            <div className="text-muted-foreground flex gap-4 text-xs tabular-nums">
              <span>{formatSpeed(stats.data?.speed ?? 0)}</span>
              <span>ETA {formatEta(stats.data?.eta)}</span>
              {(stats.data?.errors ?? 0) > 0 && (
                <span className="text-destructive">{stats.data?.errors} errors</span>
              )}
            </div>
            {transferring.length > 0 && (
              <ul className="flex flex-col gap-1.5 border-t pt-2">
                {transferring.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-mono">{t.name}</span>
                    <Progress
                      value={t.percentage}
                      className="w-24 shrink-0"
                      aria-label={`${t.name} progress`}
                    />
                    <span className="text-muted-foreground w-20 shrink-0 text-right tabular-nums">
                      {formatSpeed(t.speedAvg || t.speed)}
                    </span>
                    <span className="text-muted-foreground w-14 shrink-0 text-right tabular-nums">
                      {formatEta(t.eta)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TransfersView() {
  const jobs = useJobsStore((s) => s.jobs);
  const clearFinished = useJobsStore((s) => s.clearFinished);
  const stats = useCoreStats();
  const samples = useSpeedSamples();

  const activeJobs = [...jobs].sort((a, b) => b.startedAt - a.startedAt);
  const hasFinished = jobs.some((j) => j.finished);

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Transfers"
        description="Live progress of running and recent jobs."
        actions={
          hasFinished ? (
            <Button variant="outline" size="sm" onClick={clearFinished}>
              Clear finished
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="flex flex-col gap-4">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-stretch">
              <div className="flex shrink-0 flex-col justify-center gap-1 py-4 pr-6 pl-5">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      (stats.data?.speed ?? 0) > 0
                        ? "bg-primary pulse-dot"
                        : "bg-muted-foreground/40",
                    )}
                  />
                  Current speed
                </span>
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatSpeed(stats.data?.speed ?? 0)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatBytes(stats.data?.bytes ?? 0)} transferred · {stats.data?.transfers ?? 0}{" "}
                  files
                  {(stats.data?.errors ?? 0) > 0 && (
                    <span className="text-destructive"> · {stats.data?.errors} errors</span>
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1 self-end" aria-hidden>
                <div className="h-20">
                  <Sparkline samples={samples} capacity={SPARKLINE_SAMPLES} />
                </div>
              </div>
            </div>
          </Card>

          {activeJobs.length === 0 ? (
            <EmptyState
              icon={ArrowDownUp}
              title="No transfers yet"
              hint="Right-click files in the Browser to copy, sync or move them."
            />
          ) : (
            activeJobs.map((job) => <JobCard key={job.jobid} job={job} />)
          )}
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
