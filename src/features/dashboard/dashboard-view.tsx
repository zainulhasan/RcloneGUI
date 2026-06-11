import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  FolderTree,
  HardDrive,
  Server,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page";
import { useRcloneInfo } from "@/features/health/use-daemon";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc } from "@/lib/rc-client";
import { daemonStatus, diskFree } from "@/lib/tauri";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityLevel } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useNavigationStore } from "@/store/navigation";
import { useSettingsStore } from "@/store/settings";

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: typeof Server;
  tone?: "default" | "success" | "warning";
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn("gap-3", onClick && "hover:border-primary/40 cursor-pointer transition-colors")}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "success" && "bg-success/12 text-success",
            tone === "warning" && "bg-warning/15 text-warning-foreground",
            tone === "default" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4.5" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium">{title}</span>
          <span className="truncate text-lg leading-tight font-semibold tracking-tight">
            {value}
          </span>
          {hint && <span className="text-muted-foreground truncate text-xs">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

const LEVEL_DOT: Record<ActivityLevel, string> = {
  info: "bg-chart-1",
  warning: "bg-warning",
  error: "bg-destructive",
};

export function DashboardView() {
  const navigate = useNavigationStore((s) => s.navigate);
  const info = useRcloneInfo();
  const remotes = useRemotes();
  const jobs = useJobsStore((s) => s.jobs);
  const entries = useActivityStore((s) => s.entries);
  const watchFolder = useSettingsStore((s) => s.settings.watchFolder);

  const daemon = useQuery({ queryKey: ["daemon-status"], queryFn: () => daemonStatus() });
  const paths = useQuery({ queryKey: ["config-paths"], queryFn: () => rc.configPaths() });
  const free = useQuery({
    queryKey: ["watch-free", watchFolder],
    queryFn: () => diskFree(watchFolder!),
    enabled: watchFolder !== null,
  });

  const remoteCount = Object.keys(remotes.data ?? {}).length;
  const activeJobs = jobs.filter((j) => !j.finished).length;
  const recentActivity = entries.slice(-8).reverse();
  const daemonUp = daemon.data?.running ?? false;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <PageHeader
        title="Dashboard"
        description="Health, activity and quick actions at a glance."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("remotes")}>
              <Server /> Manage remotes
            </Button>
            <Button onClick={() => navigate("browser")}>
              <FolderTree /> Open Browser
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="rclone daemon"
          tone={daemonUp ? "success" : "warning"}
          icon={daemonUp ? CheckCircle2 : XCircle}
          value={
            <span className="flex items-baseline gap-1.5">
              {info.data?.version ?? "—"}
              <span
                className={cn(
                  "text-xs font-medium",
                  daemonUp ? "text-success" : "text-destructive",
                )}
              >
                {daemonUp ? "running" : "stopped"}
              </span>
            </span>
          }
          hint={paths.data?.config}
          onClick={() => navigate("settings")}
        />
        <StatCard
          title="Remotes"
          icon={Server}
          value={remoteCount}
          hint={remoteCount === 0 ? "none yet" : "providers connected"}
          onClick={() => navigate("remotes")}
        />
        <StatCard
          title="Active transfers"
          icon={ArrowLeftRight}
          value={activeJobs}
          hint={activeJobs === 0 ? "nothing running" : "jobs in flight"}
          onClick={() => navigate("transfers")}
        />
        <StatCard
          title="Watch folder"
          icon={HardDrive}
          tone={watchFolder ? "default" : "warning"}
          value={
            free.data !== undefined ? (
              `${formatBytes(free.data)} free`
            ) : (
              <span className="text-muted-foreground font-normal">not set</span>
            )
          }
          hint={watchFolder ?? "set in Settings"}
          onClick={() => navigate(watchFolder ? "media" : "settings")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="text-muted-foreground size-4" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nothing yet — operations, cleanups and scheduler runs will appear here.
            </p>
          ) : (
            <ul className="divide-border -mx-1 divide-y">
              {recentActivity.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-1 py-2 text-sm">
                  <span className={cn("size-1.5 shrink-0 rounded-full", LEVEL_DOT[e.level])} />
                  <span className="min-w-0 flex-1 truncate">{e.message}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {new Date(e.at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
