import { ref, type Ref } from "vue";
import { selectTopSites, type TopSite } from "@/core/topSites";

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
