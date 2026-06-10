import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CheckCircle2,
  FolderTree,
  HardDrive,
  Server,
  Settings,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRcloneInfo } from "@/features/health/use-daemon";
import { useRemotes } from "@/features/remotes/use-remotes";
import { rc } from "@/lib/rc-client";
import { daemonStatus, diskFree } from "@/lib/tauri";
import { formatBytes } from "@/lib/format";
import { useActivityStore } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useNavigationStore } from "@/store/navigation";
import { useSettingsStore } from "@/store/settings";

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: typeof Server;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "hover:border-primary/40 cursor-pointer transition-colors" : undefined}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
          {title}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

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
  const recentActivity = entries.slice(-6).reverse();

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Dashboard" description="Health, activity and quick actions at a glance." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="rclone"
          value={
            <span className="flex items-center gap-2">
              {info.data?.version ?? "—"}
              {daemon.data?.running && (
                <Badge variant="secondary">
                  <CheckCircle2 className="text-success" /> daemon up
                </Badge>
              )}
            </span>
          }
          hint={paths.data ? `config: ${paths.data.config}` : undefined}
          icon={Settings}
          onClick={() => navigate("settings")}
        />
        <StatCard
          title="Remotes"
          value={remoteCount}
          hint="configured storage providers"
          icon={Server}
          onClick={() => navigate("remotes")}
        />
        <StatCard
          title="Transfers"
          value={activeJobs}
          hint="active jobs"
          icon={ArrowLeftRight}
          onClick={() => navigate("transfers")}
        />
        <StatCard
          title="Watch folder"
          value={free.data !== undefined ? `${formatBytes(free.data)} free` : "not set"}
          hint={watchFolder ?? "set one in Settings to use Watch & Auto-Clean"}
          icon={HardDrive}
          onClick={() => navigate(watchFolder ? "media" : "settings")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent activity</CardTitle>
          <CardDescription>Operations, cleanups and scheduler runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing yet. Browse a remote and start a transfer.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentActivity.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-xs">
                  <Badge
                    variant={e.level === "info" ? "secondary" : "destructive"}
                    className="w-16 justify-center"
                  >
                    {e.category}
                  </Badge>
                  <span className="text-muted-foreground truncate">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => navigate("browser")}>
          <FolderTree /> Open Browser
        </Button>
        <Button variant="outline" onClick={() => navigate("remotes")}>
          <Server /> Manage remotes
        </Button>
      </div>
    </div>
  );
}
