import { useQuery } from "@tanstack/react-query";

import { rc } from "@/lib/rc-client";
import { useHostKey } from "@/lib/rc-client/host-key";

/** The fs string rclone uses for the local filesystem root. */
export const LOCAL_FS = "/";

export function useListing(fs: string | null, path: string) {
  const key = useHostKey("listing", fs, path);
  return useQuery({
    queryKey: key,

    queryFn: () => rc.list(fs!, path),
    enabled: fs !== null,
    staleTime: 30_000,
  });
}
