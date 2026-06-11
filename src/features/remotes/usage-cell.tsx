import { useQuery } from "@tanstack/react-query";

import { Progress } from "@/components/ui/progress";
import { rc } from "@/lib/rc-client";
import { useHostKey } from "@/lib/rc-client/host-key";
import { formatBytes } from "@/lib/format";

/** Storage usage for one remote; "—" for backends without `about` support. */
export function UsageCell({ name }: { name: string }) {
  const about = useQuery({
    queryKey: useHostKey("remote-about", name),
    queryFn: () => rc.about(`${name}:`),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (about.isLoading) {
    return <span className="text-muted-foreground text-xs">…</span>;
  }
  const used = about.data?.used;
  const total = about.data?.total;

  if (about.isError || used === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (total === undefined || total === 0) {
    return <span className="text-muted-foreground text-xs">{formatBytes(used)} used</span>;
  }
  return (
    <div className="flex w-44 flex-col gap-1">
      <span className="text-muted-foreground text-xs tabular-nums">
        {formatBytes(used)} / {formatBytes(total)}
      </span>
      <Progress value={(used / total) * 100} aria-label={`${name} usage`} className="h-1.5" />
    </div>
  );
}
