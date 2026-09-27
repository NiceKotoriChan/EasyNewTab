/** History list logic — pure functions only. */

import { UI_LOCALE } from "./utils.ts";

export interface HistoryItemLike {
  id: string;
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

export interface HistoryGroup<T extends HistoryItemLike = HistoryItemLike> {
  /** Stable key for `v-for`. */
  key: "today" | "yesterday" | "earlier";
  label: string;
  items: T[];
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local-midnight label buckets: Today / Yesterday / Earlier. */
export function groupHistory<T extends HistoryItemLike>(
  items: readonly T[],
  now: number = Date.now(),
): HistoryGroup<T>[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86_400_000;

  const today: T[] = [];
  const yesterday: T[] = [];
  const earlier: T[] = [];

  for (const item of items) {
    const t = item.lastVisitTime ?? 0;
    if (t >= todayStart) today.push(item);
    else if (t >= yesterdayStart) yesterday.push(item);
    else earlier.push(item);
  }

  return (
    [
      { key: "today", label: "Today", items: today },
      { key: "yesterday", label: "Yesterday", items: yesterday },
      { key: "earlier", label: "Earlier", items: earlier },
    ] as HistoryGroup<T>[]
  ).filter((g) => g.items.length > 0);
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
