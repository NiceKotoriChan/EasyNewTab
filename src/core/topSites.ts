interface TopSiteLike {
  url: string;
  title?: string;
}

export interface TopSite {
  url: string;
  title: string;
}

function labelFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function selectTopSites(sites: readonly TopSiteLike[]): TopSite[] {
  const picked: TopSite[] = [];
  for (const site of sites) {
    if (!site?.url) continue;
    picked.push({ url: site.url, title: site.title?.trim() || labelFor(site.url) });
  }
  return picked;
}
