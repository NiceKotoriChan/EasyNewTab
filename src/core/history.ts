// Pure. chrome.history.search returns one flat newest-first array — no day bucketing,
// since a Today/Earlier split would be ours to invent.

import { UI_LOCALE } from "./utils.ts";

export interface HistoryItemLike {
  id: string;
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "14:32" for today, "Sep 25" for anything older. */
export function formatVisitStamp(
  timestamp: number | undefined,
  now: number = Date.now(),
): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const t = date.getTime();
  if (t >= startOfDay(now)) {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  return date.toLocaleDateString(UI_LOCALE, { month: "short", day: "numeric" });
}

/**
 * The list as the search box should draw it. A flat list, so this is a filter and not a prune —
 * the one place the history panel's search differs from the bookmark tree's. Title *or* URL, since a
 * page with no title of its own is only findable by its address. The API's order is kept: a match
 * from this morning still belongs below one from a minute ago.
 */
export function filterHistory(
  items: readonly HistoryItemLike[],
  query: string,
): HistoryItemLike[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter(
    (item) =>
      (item.title ?? "").toLowerCase().includes(needle) ||
      (item.url ?? "").toLowerCase().includes(needle),
  );
}
