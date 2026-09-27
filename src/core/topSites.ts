/**
 * Chrome's "most visited" list, reduced to what a shortcut row can show.
 *
 * The API hands back *pages*, and a page is not a site: one host can appear
 * twice (a landing page and a deep link into it), a title can be blank because
 * the page never declared one, and not everything Chrome scores is navigable
 * from a new tab. This module is the filter between that list and the row. It
 * is pure, so the rules below are pinned by `tests/topSites.test.ts` rather
 * than by looking at what got rendered.
 *
 * Ranking is deliberately left alone. Chrome's order is the entire reason to
 * use this API instead of counting visits ourselves, so nothing here sorts: it
 * takes the first `limit` *distinct sites in the order they arrived*, which is
 * what keeps "the order means something" true.
 */

/** A page Chrome considers one of the most visited. */
export interface TopSiteLike {
  url: string;
  title?: string;
}

/** A row entry: navigable, de-duplicated, labelled. */
export interface TopSite {
  url: string;
  title: string;
}

/**
 * How many the row shows.
 *
 * Chromium caps its own list well above this. Eight is what fits two tidy rows
 * of four under the search box, and the row is a shortcut rather than an
 * inventory — the sidebar is where the full list lives.
 */
export const TOP_SITE_LIMIT = 8;

/**
 * The site a URL belongs to, or `null` if a new tab should not offer it.
 *
 * `www.` is stripped so `www.zhihu.com` and `zhihu.com` are one site: Chrome
 * treats them as one, and a row showing both would read as a bug rather than
 * as two places.
 */
function siteKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.hostname.replace(/^www\./, "").toLowerCase();
}

/**
 * The list the row renders.
 *
 * Three rules, all of them visible:
 *
 * - **The first entry for a host wins.** Chrome ranks the *page* it thinks you
 *   want most, and that page's title is the better label of the two; keeping
 *   the later one would swap a site's name for the name of one of its pages.
 * - **A blank title falls back to the host.** `title` is whatever the page
 *   declared, and plenty declare nothing — without the fallback those entries
 *   render as an icon beside empty space.
 * - **Only `http:` / `https:`.** A new tab offers places to go; `chrome://`,
 *   `file://` and `javascript:` are not places it can send you from here.
 */
export function selectTopSites(
  sites: readonly TopSiteLike[],
  limit: number = TOP_SITE_LIMIT,
): TopSite[] {
  const seen = new Set<string>();
  const picked: TopSite[] = [];
  for (const site of sites) {
    if (picked.length >= limit) break;
    if (!site || typeof site.url !== "string") continue;
    const key = siteKey(site.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push({ url: site.url, title: site.title?.trim() || key });
  }
  return picked;
}
