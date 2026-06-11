import type { RcListItem } from "@/lib/rc-client";

/** Case-insensitive substring filter on item names. Empty query = all. */
export function filterListing(items: RcListItem[], query: string): RcListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.Name.toLowerCase().includes(q));
}
