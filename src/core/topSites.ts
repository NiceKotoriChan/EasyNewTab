interface TopSiteLike {
  url: string;
  title?: string;
}

export interface TopSite {
  url: string;
  title: string;
}

const TOP_SITE_LIMIT = 8;

function labelFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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
