import type { RcListItem } from "@/lib/rc-client";
import { joinFsPath } from "@/lib/rc-client";

/**
 * Map a browser selection onto rclone directory-operation arguments.
 *
 * - One selected directory → operate on that directory itself.
 * - Anything else (files, mixed, multiple) → operate on the containing
 *   directory with include rules narrowing to the selected entries.
 */
export interface OperationSource {
  srcFs: string;
  /** Include rules to add to the filter; empty = whole directory. */
  includeRules: string[];
  /** Human description, e.g. "3 items" or "films/". */
  label: string;
}

/** Escape rclone filter special characters in a literal file name. */
export function escapeFilterLiteral(name: string): string {
  return name.replace(/[\\*?[\]{}]/g, (c) => `\\${c}`);
}

export function selectionToOperation(
  paneFs: string,
  panePath: string,
  items: RcListItem[],
): OperationSource {
  if (items.length === 1 && items[0].IsDir) {
    return {
      srcFs: joinFsPath(paneFs, items[0].Path),
      includeRules: [],
      label: `${items[0].Name}/`,
    };
  }

  const includeRules = items.map((item) =>
    item.IsDir ? `/${escapeFilterLiteral(item.Name)}/**` : `/${escapeFilterLiteral(item.Name)}`,
  );

  return {
    srcFs: joinFsPath(paneFs, panePath),
    includeRules,
    label: items.length === 1 ? items[0].Name : `${items.length} items`,
  };
}
