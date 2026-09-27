/**
 * Chrome top sites API — typed wrapper.
 *
 * This is "most visited" as Chrome itself scores it: the same list the built-in
 * new tab page's shortcuts are drawn from, and the one thing on this page that
 * is a fact about where you have been rather than a guess about what you want.
 *
 * Using the platform's list instead of counting visits ourselves is the point.
 * `chrome.history` (already granted) could be aggregated into something that
 * looks similar, but it would rank a site you passed through twenty redirects
 * above one you type every morning, and it would still need a notion of "site"
 * and a tie-break of its own — see `core/topSites.ts` for the part of that
 * which is unavoidable anyway.
 *
 * The list is short and unpaged (Chromium caps it), so there is nothing to
 * paginate and no reason to cache it beyond one page load.
 */

import type { TopSiteLike } from "@/core/topSites";

export type { TopSiteLike };

/**
 * An unavailable list is not an error worth showing anyone.
 *
 * A profile with no history yet, an incognito window, and a build shipped
 * without the `topSites` permission all arrive here, and all three mean the
 * same thing to the page: there is no row to draw. Hence `[]` rather than a
 * failure flag — the caller has no second thing it could do about it, and an
 * empty row is not a feature.
 */
export async function getTopSites(): Promise<TopSiteLike[]> {
  try {
    return await chrome.topSites.get();
  } catch (err) {
    console.warn("Failed to load top sites:", err);
    return [];
  }
}
