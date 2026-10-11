import { computed, ref, type ComputedRef, type Ref } from "vue";
import { filterHistory, type HistoryItemLike } from "@/core/history";
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

function onSettingsChanged(cb: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "sync" || !changes.settings) return;
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

const searchQuery = ref("");

const visibleItems = computed(() => filterHistory(items.value, searchQuery.value));

const searchActive = computed(() => searchQuery.value.trim().length > 0);

let bootstrapped = false;

let shownLimit: number | null = null;

const scheduleReload = debounce(() => void reload(), 300);

async function reload(): Promise<void> {
  loading.value = true;
  try {
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
  onHistoryChanged(scheduleReload);
  onSettingsChanged(scheduleReload);
}

export function useHistory(): {
  items: Ref<HistoryItemLike[]>;
  visibleItems: ComputedRef<HistoryItemLike[]>;
  searchActive: ComputedRef<boolean>;
  searchQuery: Ref<string>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  reload: () => Promise<void>;
} {
  bootstrap();

  return {
    items,
    visibleItems,
    searchActive,
    searchQuery,
    loading,
    failed,
    reload,
  };
}
