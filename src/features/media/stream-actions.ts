import { tauriTransport, type RcListItem } from "@/lib/rc-client";

/**
 * Try to get a direct streaming URL for the given file from the remote backend.
 * Returns the URL string on success, null if the backend does not support public links.
 */
export async function getStreamUrl(fs: string, item: RcListItem): Promise<string | null> {
  try {
    const res = (await tauriTransport("operations/publiclink", {
      fs,
      remote: item.Path,
    })) as { url: string };
    return res.url ?? null;
  } catch {
    return null;
  }
}
