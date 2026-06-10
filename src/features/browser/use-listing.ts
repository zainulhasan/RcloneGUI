import { useQuery } from "@tanstack/react-query";

import { rc } from "@/lib/rc-client";

/** The fs string rclone uses for the local filesystem root. */
export const LOCAL_FS = "/";

export function useListing(fs: string | null, path: string) {
  return useQuery({
    queryKey: ["listing", fs, path],

    queryFn: () => rc.list(fs!, path),
    enabled: fs !== null,
    staleTime: 30_000,
  });
}
