/**
 * Chrome history API — typed wrappers.
 */

import type { HistoryItemLike } from "@/core/history";

export type { HistoryItemLike };

/**
 * Every page ever visited, newest first.
 *
 * Three of the four query fields would otherwise narrow the result in ways
 * nothing in the UI asks for:
 *   - `maxResults` defaults to 100 (and the API throws on anything below 1),
 *     so "no limit" has to be spelled as a number no real profile can reach.
 *   - `startTime` defaults to 24 hours ago — `0` means "since the epoch".
 *   - `text: ""` means "match everything".
 *
 * The list is rendered with `content-visibility`, so a large result set costs
 * memory but not layout; see `HistoryList.vue`.
 */
const NO_LIMIT = 1_000_000;

export async function searchHistory(): Promise<HistoryItemLike[]> {
  try {
    return await chrome.history.search({
      text: "",
      startTime: 0,
      maxResults: NO_LIMIT,
    });
  } catch (err) {
    console.error("Failed to load history:", err);
    return [];
  }
}

export async function deleteUrl(url: string): Promise<void> {
  await chrome.history.deleteUrl({ url });
}

export async function deleteAllHistory(): Promise<void> {
  await chrome.history.deleteAll();
}

/** Subscribe to visits + removals. Returns an unsubscribe function. */
export function onHistoryChanged(cb: () => void): () => void {
  chrome.history.onVisited.addListener(cb);
  chrome.history.onVisitRemoved.addListener(cb);
  return () => {
    chrome.history.onVisited.removeListener(cb);
    chrome.history.onVisitRemoved.removeListener(cb);
  };
}
