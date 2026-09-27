/**
 * Most-visited sites — loaded once per page, for the welcome pane's shortcut row.
 *
 * There is no `onChanged` for this list and none is missed: a new tab page is a
 * fresh instance every time one is opened, so "once per page load" already *is*
 * "as fresh as the data gets". Re-reading on focus would be churn with nothing
 * visible to show for it.
 *
 * `reload` is exposed as a seam, not as a feature — the render check drives it
 * to prove the empty case (a profile with no history, or a build without the
 * permission) draws nothing at all rather than an empty box. Same reason
 * `useBookmarks` exposes `toggleExpanded`.
 */

import { ref, type Ref } from "vue";
import * as api from "@/chrome/topSites";
import { selectTopSites, type TopSite } from "@/core/topSites";

const sites = ref<TopSite[]>([]);

let bootstrapped = false;

async function reload(): Promise<void> {
  sites.value = selectTopSites(await api.getTopSites());
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void reload();
}

export interface UseTopSites {
  sites: Ref<TopSite[]>;
  reload: () => Promise<void>;
}

export function useTopSites(): UseTopSites {
  bootstrap();
  return { sites, reload };
}
