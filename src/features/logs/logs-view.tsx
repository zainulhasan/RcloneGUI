import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardCopy, Search, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityLevel } from "@/store/activity";
import { EmptyState, PageHeader } from "@/components/layout/page";

import { DAEMON_LEVEL_RANK, daemonLineLevel, type DaemonLevel } from "./log-level";

function CopyButton({ lines }: { lines: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={lines.length === 0}
          onClick={() => {
            void navigator.clipboard.writeText(lines.join("\n")).then(() => {
              toast.success(`Copied ${lines.length} lines`);
            });
          }}
        >
          <ClipboardCopy className="size-3.5" />
          Copy
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy visible lines to clipboard</TooltipContent>
    </Tooltip>
  );
}

function DaemonLogs() {
  const [minLevel, setMinLevel] = useState<DaemonLevel>("INFO");
  const [search, setSearch] = useState("");
  const logs = useQuery({
    queryKey: ["daemon-logs"],
    queryFn: () => invoke<string[]>("daemon_logs"),
    refetchInterval: 2000,
  });

  const lines = (logs.data ?? [])
    .filter((line) => DAEMON_LEVEL_RANK[daemonLineLevel(line)] >= DAEMON_LEVEL_RANK[minLevel])
    .filter((line) => !search || line.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={minLevel} onValueChange={(v) => setMinLevel(v as DaemonLevel)}>
          <SelectTrigger size="sm" className="w-32" aria-label="Minimum level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEBUG">Debug+</SelectItem>
            <SelectItem value="INFO">Info+</SelectItem>
            <SelectItem value="NOTICE">Notice+</SelectItem>
            <SelectItem value="ERROR">Errors</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input
            className="h-8 pl-7 text-xs"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">{lines.length} lines</span>
        <CopyButton lines={lines} />
      </div>
      {lines.length === 0 ? (
        <EmptyLogs label="No daemon log lines at this level." />
      ) : (
        <pre className="bg-card min-h-0 flex-1 overflow-auto rounded-lg border p-3 font-mono text-xs leading-5">
          {lines.map((line, i) => (
            <div key={i} className={cn(daemonLineLevel(line) === "ERROR" && "text-destructive")}>
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

const ACTIVITY_LEVEL_RANK: Record<ActivityLevel, number> = { info: 0, warning: 1, error: 2 };

function ActivityLogs() {
  const entries = useActivityStore((s) => s.entries);
  const clear = useActivityStore((s) => s.clear);
  const [minLevel, setMinLevel] = useState<ActivityLevel>("info");
  const [search, setSearch] = useState("");

  const visible = entries
    .filter((e) => ACTIVITY_LEVEL_RANK[e.level] >= ACTIVITY_LEVEL_RANK[minLevel])
    .filter(
      (e) =>
        !search ||
        e.message.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase()),
    )
    .slice()
    .reverse();

  const copyLines = visible.map(
    (e) =>
      `${formatDateTime(new Date(e.at).toISOString())} [${e.level}] ${e.category}: ${e.message}`,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={minLevel} onValueChange={(v) => setMinLevel(v as ActivityLevel)}>
          <SelectTrigger size="sm" className="w-32" aria-label="Minimum level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info+</SelectItem>
            <SelectItem value="warning">Warnings+</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input
            className="h-8 pl-7 text-xs"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">{visible.length} entries</span>
        <CopyButton lines={copyLines} />
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <EmptyLogs label="App activity (operations, cleanups, scheduler) appears here." />
      ) : (
        <div className="bg-card min-h-0 flex-1 overflow-auto rounded-lg border p-3">
          {visible.map((entry) => (
            <div key={entry.id} className="flex gap-2 font-mono text-xs leading-5">
              <span className="text-muted-foreground shrink-0">
                {formatDateTime(new Date(entry.at).toISOString())}
              </span>
              <span
                className={cn(
                  "w-16 shrink-0 uppercase",
                  entry.level === "error" && "text-destructive",
                  entry.level === "warning" && "text-warning",
                )}
              >
                {entry.level}
              </span>
              <span className="text-muted-foreground w-20 shrink-0">{entry.category}</span>
              <span className="min-w-0 break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyLogs({ label }: { label: string }) {
  return (
    <EmptyState
      icon={ScrollText}
      title="Nothing logged yet"
      hint={label}
      className="flex-1 justify-center"
    />
  );
}

export function LogsView() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader title="Logs" description="App activity and the rclone daemon's own log." />
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="daemon">rclone daemon</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="flex min-h-0 flex-1 flex-col">
          <ActivityLogs />
        </TabsContent>
        <TabsContent value="daemon" className="flex min-h-0 flex-1 flex-col">
          <DaemonLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
