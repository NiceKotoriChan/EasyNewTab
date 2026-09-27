/** Chrome's "most visited" list, reduced to what a shortcut row can show. Pure, so
 *  the rules are pinned by `tests/topSites.test.ts`. Ranking is left alone: Chrome's
 *  order is the whole reason to use this API, so nothing here sorts — it takes the
 *  first `limit` distinct sites as they arrive. */

/** A page Chrome considers one of the most visited. */
interface TopSiteLike {
  url: string;
  title?: string;
}

/** A row entry: navigable, de-duplicated, labelled. */
export interface TopSite {
  url: string;
  title: string;
}

/** Eight, because that is two tidy rows of four under the search box. */
export const TOP_SITE_LIMIT = 8;

/**
 * The site a URL belongs to, or `null` if a new tab should not offer it.
 * `www.` is stripped so `www.zhihu.com` and `zhihu.com` are one site.
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

/** The list the row renders. Three visible rules: the first entry for a host wins
 *  (Chrome ranks the page it thinks you want most, and its title labels the site
 *  better than a later one's); a blank title falls back to the host, since plenty of
 *  pages declare none; and only `http:`/`https:` — `chrome://` and `file://` are not
 *  places a new tab can send you. */
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
