/** Chrome's "most visited" list, reduced to what a shortcut row can show: the first `limit` entries
 *  in the order Chrome ranked them, each with a label. Pure, so the rules are pinned by
 *  `tests/topSites.test.ts`.
 *
 *  Those two steps are the whole reduction, and Chrome's ranking passes through untouched — its
 *  order is the reason to use this API instead of ranking `history` counts ourselves. */

/** A page Chrome considers one of the most visited. */
interface TopSiteLike {
  url: string;
  title?: string;
}

/** A row entry: the URL Chrome gave, plus a label. */
export interface TopSite {
  url: string;
  title: string;
}

/** Eight, because that is two tidy rows of four under the search box. An upper bound on how much of
 *  Chrome's list is drawn, not a quota to fill. */
export const TOP_SITE_LIMIT = 8;

/** The label a blank title falls back to. Chrome hands back an empty title for pages that never
 *  declared one, and a tile with no label is an icon in a void. `www.` is stripped so the fallback
 *  reads like a site name rather than a host record. */
function labelFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The first `limit` entries, in the order Chrome ranked them, each one labelled. A row with no `url`
 * is skipped: there would be nothing to navigate to, so it cannot be a tile.
 */
export function selectTopSites(
  sites: readonly TopSiteLike[],
  limit: number = TOP_SITE_LIMIT,
): TopSite[] {
  const picked: TopSite[] = [];
  for (const site of sites) {
    if (picked.length >= limit) break;
    if (!site?.url) continue;
    picked.push({ url: site.url, title: site.title?.trim() || labelFor(site.url) });
  }
  return picked;
}
