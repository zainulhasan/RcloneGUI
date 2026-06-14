import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  FolderTree,
  HardDrive,
  Info,
  Plus,
  Server,
  Share2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page";
import { useRcloneInfo } from "@/features/health/use-daemon";
import { useRemotes } from "@/features/remotes/use-remotes";
import { Sparkline } from "@/features/transfers/sparkline";
import {
  SPARKLINE_SAMPLES,
  useCoreStats,
  useSpeedSamples,
} from "@/features/transfers/use-transfers";
import { daemonStatus, diskFree } from "@/lib/tauri";
import { formatBytes, formatSpeed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityLevel } from "@/store/activity";
import { useJobsStore } from "@/store/jobs";
import { useNavigationStore } from "@/store/navigation";
import { useSettingsStore } from "@/store/settings";

// ── remote color chip ─────────────────────────────────────────────────────────
const CHIP_COLORS = [
  "oklch(0.66 0.18 257)",
  "oklch(0.72 0.14 145)",
  "oklch(0.78 0.15 60)",
  "oklch(0.69 0.16 300)",
  "oklch(0.64 0.2 20)",
  "oklch(0.72 0.14 192)",
];

function chipColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}

function RemoteChip({ name }: { name: string }) {
  const color = chipColor(name);
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ── stat card ─────────────────────────────────────────────────────────────────
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
      className={cn(
        "relative gap-3 overflow-hidden",
        onClick && "hover:border-primary/40 cursor-pointer transition-colors",
      )}
      onClick={onClick}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-[2px]",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "default" && "bg-primary",
        )}
      />
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-[5px]",
            tone === "success" && "bg-success/12 text-success",
            tone === "warning" && "bg-warning/15 text-warning",
            tone === "default" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium">{title}</span>
          <span className="truncate text-[26px] leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {hint && <span className="text-muted-foreground truncate text-xs">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── activity level styles ─────────────────────────────────────────────────────
const LEVEL_ICON: Record<ActivityLevel, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};
const LEVEL_COLOR: Record<ActivityLevel, { fg: string; bg: string }> = {
  info: { fg: "oklch(0.66 0.18 257)", bg: "oklch(0.66 0.18 257 / 0.12)" },
  warning: { fg: "oklch(0.79 0.15 73)", bg: "oklch(0.79 0.15 73 / 0.12)" },
  error: { fg: "oklch(0.635 0.205 23)", bg: "oklch(0.635 0.205 23 / 0.12)" },
};

// ── quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: Plus, label: "Add remote", view: "remotes" },
  { icon: ArrowLeftRight, label: "New sync", view: "browser" },
  { icon: HardDrive, label: "Mount drive", view: "mounts" },
  { icon: Share2, label: "Serve files", view: "serve" },
] as const;

// ── main view ─────────────────────────────────────────────────────────────────
export function DashboardView() {
  const navigate = useNavigationStore((s) => s.navigate);
  const info = useRcloneInfo();
  const remotes = useRemotes();
  const jobs = useJobsStore((s) => s.jobs);
  const entries = useActivityStore((s) => s.entries);
  const watchFolder = useSettingsStore((s) => s.settings.watchFolder);

  const stats = useCoreStats();
  const speedSamples = useSpeedSamples();

  const daemon = useQuery({ queryKey: ["daemon-status"], queryFn: () => daemonStatus() });
  const free = useQuery({
    queryKey: ["watch-free", watchFolder],
    queryFn: () => diskFree(watchFolder!),
    enabled: watchFolder !== null,
  });

  const remoteCount = Object.keys(remotes.data ?? {}).length;
  const activeJobs = jobs.filter((j) => !j.finished).length;
  const recentActivity = [...entries].reverse();
  const daemonUp = daemon.data?.running ?? false;
  const currentSpeed = stats.data?.speed ?? 0;

  const remoteList = useMemo(() => Object.keys(remotes.data ?? {}), [remotes.data]);

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
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

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="rclone daemon"
          tone={daemonUp ? "success" : "warning"}
          icon={daemonUp ? CheckCircle2 : XCircle}
          value={info.data?.version ?? "—"}
          hint={daemonUp ? "running" : "stopped"}
          onClick={() => navigate("settings")}
        />
        <StatCard
          title="Remotes"
          icon={Server}
          value={remoteCount}
          hint={remoteCount === 0 ? "none configured" : "providers connected"}
          onClick={() => navigate("remotes")}
        />
        <StatCard
          title="Active transfers"
          icon={ArrowLeftRight}
          value={activeJobs}
          hint={
            currentSpeed > 0
              ? formatSpeed(currentSpeed)
              : activeJobs === 0
                ? "nothing running"
                : "jobs in flight"
          }
          onClick={() => navigate("transfers")}
        />
        <StatCard
          title="Watch folder"
          icon={HardDrive}
          tone={watchFolder ? "default" : "warning"}
          value={
            free.data !== undefined ? (
              formatBytes(free.data)
            ) : (
              <span className="text-muted-foreground text-xl font-normal">not set</span>
            )
          }
          hint={free.data !== undefined ? "free · " + (watchFolder ?? "") : "set in Settings"}
          onClick={() => navigate(watchFolder ? "media" : "settings")}
        />
      </div>

      {/* ── two-column main grid — fills the remaining vertical space ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        {/* Left: throughput sparkline + activity feed (feed expands to fill) */}
        <div className="flex min-h-0 flex-col gap-4">
          {/* Throughput strip */}
          <Card className="shrink-0 gap-0 overflow-hidden py-0">
            <div className="flex items-stretch">
              <div className="flex shrink-0 flex-col justify-center gap-1 p-4 pr-5">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] uppercase">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      currentSpeed > 0 ? "bg-primary pulse-dot" : "bg-muted-foreground/40",
                    )}
                  />
                  Throughput
                </span>
                <span className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">
                  {formatSpeed(currentSpeed)}
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
                <div className="h-[72px]">
                  <Sparkline samples={speedSamples} capacity={SPARKLINE_SAMPLES} />
                </div>
              </div>
            </div>
          </Card>

          {/* Activity feed — fills remaining height */}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="text-muted-foreground size-4" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Nothing yet — operations, cleanups and scheduler runs will appear here.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {recentActivity.map((e, idx) => {
                    const LevelIcon = LEVEL_ICON[e.level];
                    const colors = LEVEL_COLOR[e.level];
                    return (
                      <li
                        key={e.id}
                        className={cn(
                          "flex items-center gap-3 py-2.5 text-sm",
                          idx < recentActivity.length - 1 && "border-b border-border",
                        )}
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-[5px]"
                          style={{ background: colors.bg, color: colors.fg }}
                        >
                          <LevelIcon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{e.message}</span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {new Date(e.at).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: quick actions + remotes list (remotes expands to fill) */}
        <div className="flex min-h-0 flex-col gap-4">
          {/* Quick actions */}
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map(({ icon: Icon, label, view }) => (
                  <button
                    key={view}
                    onClick={() => navigate(view)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-primary/15 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="text-[12px] font-medium leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Remotes list — fills remaining height, scrollable */}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span>Remotes</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                  {remoteCount}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {remoteList.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-4">
                  <p className="text-muted-foreground text-center text-xs">No remotes yet.</p>
                  <button
                    className="text-primary text-xs hover:underline"
                    onClick={() => navigate("remotes")}
                  >
                    Add one →
                  </button>
                </div>
              ) : (
                <div className="-mx-1 flex flex-col gap-0.5">
                  {remoteList.map((name) => {
                    const type = remotes.data?.[name]?.type ?? "remote";
                    return (
                      <button
                        key={name}
                        className="flex w-full items-center gap-2.5 rounded-[5px] px-1 py-1.5 text-left transition-colors hover:bg-accent"
                        onClick={() => navigate("remotes")}
                      >
                        <RemoteChip name={name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{name}:</div>
                          <div className="text-muted-foreground text-xs">{type}</div>
                        </div>
                        <span className="size-1.5 shrink-0 rounded-full bg-success" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
