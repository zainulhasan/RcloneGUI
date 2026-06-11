import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes, formatDateTime, formatEta } from "@/lib/format";

import { getJobHistoryDb } from "./history-db";

export function HistoryTab() {
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["job-history"],
    queryFn: async () => (await getJobHistoryDb()).recent(200),
  });

  const entries = history.data ?? [];

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No finished transfers yet"
        hint="Completed jobs are kept here (newest 500) across restarts."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void getJobHistoryDb()
              .then((db) => db.clear())
              .then(() => queryClient.invalidateQueries({ queryKey: ["job-history"] }))
              .then(() => toast.success("History cleared"));
          }}
        >
          <Trash2 /> Clear history
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Transferred</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="max-w-72 truncate font-medium">{e.label}</TableCell>
              <TableCell>
                <Badge variant="secondary">{e.kind}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDateTime(new Date(e.finishedAt).toISOString())}
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {formatEta((e.finishedAt - e.startedAt) / 1000)}
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {e.bytes > 0 ? formatBytes(e.bytes) : "—"}
              </TableCell>
              <TableCell>
                {e.success ? (
                  <Badge variant="done">
                    <span className="size-1.5 rounded-full bg-current" />
                    done
                  </Badge>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="failed">
                        <span className="size-1.5 rounded-full bg-current" />
                        failed
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-80">{e.error}</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
