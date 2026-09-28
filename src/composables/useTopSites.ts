// Most-visited sites for the welcome pane's shortcut row. Loaded once per page (a fresh
// instance each new tab, so once-per-load is already as fresh as it gets).
import { ref, type Ref } from "vue";
import { selectTopSites, type TopSite } from "@/core/topSites";

/**
 * An unavailable list is not an error worth showing: no history yet, incognito,
 * and a build without the permission all mean the same thing here — no row.
 */
async function getTopSites() {
  try {
    return await chrome.topSites.get();
  } catch (err) {
    console.warn("Failed to load top sites:", err);
    return [];
  }
}

const sites = ref<TopSite[]>([]);
let bootstrapped = false;

// Exposed as a seam so the render check can drive the empty case.
async function reload(): Promise<void> {
  sites.value = selectTopSites(await getTopSites());
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void reload();
}

export function useTopSites(): {
  sites: Ref<TopSite[]>;
  reload: () => Promise<void>;
} {
  bootstrap();
  return { sites, reload };
}
