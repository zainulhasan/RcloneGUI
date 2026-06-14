import { tauriTransport, type RcListItem } from "@/lib/rc-client";
import { logActivity } from "@/store/activity";

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
    const url = res.url ?? null;
    if (url) {
      logActivity("info", "media", `publiclink OK for ${fs}${item.Path}: ${url}`);
    } else {
      logActivity("warning", "media", `publiclink returned no URL for ${fs}${item.Path}`);
    }
    return url;
  } catch (err) {
    logActivity(
      "warning",
      "media",
      `publiclink failed for ${fs}${item.Path}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
