/**
 * History state — shared by the sidebar list and the panel switch.
 *
 * The cap is the user's (`Settings.historyLimit`, 100 by default), because
 * `chrome.history.search` will happily answer with a whole profile's worth of rows. The other two
 * query fields are deliberate: `startTime: 0`, because the API's own default is the last 24 hours,
 * and `text: ""`, which is what means "match everything". The API's order is kept as-is.
 */
import { ref, type Ref } from "vue";
import { type HistoryItemLike } from "@/core/history";
import { normalizeSettings } from "@/core/settings";
import { debounce } from "@/core/utils";
import { useSettings } from "./useSettings";

async function searchHistory(limit: number): Promise<HistoryItemLike[]> {
  try {
    return await chrome.history.search({
      text: "",
      startTime: 0,
      maxResults: limit,
    });
  } catch (err) {
    console.error("Failed to load history:", err);
    return [];
  }
}

function onHistoryChanged(cb: () => void): () => void {
  chrome.history.onVisited.addListener(cb);
  chrome.history.onVisitRemoved.addListener(cb);
  return () => {
    chrome.history.onVisited.removeListener(cb);
    chrome.history.onVisitRemoved.removeListener(cb);
  };
}

/**
 * The cap is a setting, so a settings write is the one thing this store watches for — and watching
 * storage is what it does instead of holding a `watch` on the ref, which is a no-op when the module
 * is first evaluated during a server render.
 */
function onSettingsChanged(cb: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "sync" || !changes.settings) return;
    // Compared against the cap already on screen rather than applied blindly: this page hears
    // about *every* settings write, and re-querying because the docking side moved is unasked-for work.
    const next = normalizeSettings(changes.settings.newValue).historyLimit;
    if (next !== shownLimit) cb();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

const { settings, whenReady } = useSettings();

const items = ref<HistoryItemLike[]>([]);
const loading = ref(true);
const failed = ref(false);

let bootstrapped = false;

// The cap the on-screen rows were fetched with, or null before the first fetch.
let shownLimit: number | null = null;

const scheduleReload = debounce(() => void reload(), 300);

async function reload(): Promise<void> {
  loading.value = true;
  try {
    // The cap lives in storage and this run starts while that read is still in flight, so without
    // the wait the first list would be built from the default — a profile asking for 300 rows would
    // show 100 of them until something else happened to reload it.
    await whenReady();
    const limit = settings.value.historyLimit;
    items.value = await searchHistory(limit);
    shownLimit = limit;
    failed.value = false;
  } catch (err) {
    console.error("Failed to load history:", err);
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void reload();
  // Visits and removals arrive in bursts — a bulk delete fires once per URL.
  onHistoryChanged(scheduleReload);
  onSettingsChanged(scheduleReload);
}

export function useHistory(): {
  items: Ref<HistoryItemLike[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  reload: () => Promise<void>;
} {
  bootstrap();

  return {
    items,
    loading,
    failed,
    reload,
  };
}
