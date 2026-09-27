/**
 * History state — shared by the sidebar list and the detail pane.
 */
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { groupHistory, type HistoryGroup, type HistoryItemLike } from "@/core/history";
import { debounce } from "@/core/utils";

/**
 * Every page ever visited, newest first. Three of `history.search`'s four fields
 * default to something narrower than "everything": `maxResults` is 100,
 * `startTime` is 24 hours ago, and `text: ""` is what means "match all". One
 * million stands in for "no limit" — the API throws on anything below 1.
 */
const NO_LIMIT = 1_000_000;

async function searchHistory(): Promise<HistoryItemLike[]> {
  try {
    return await chrome.history.search({
      text: "",
      startTime: 0,
      maxResults: NO_LIMIT,
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

const items = ref<HistoryItemLike[]>([]);
const loading = ref(true);
const failed = ref(false);

let bootstrapped = false;

const scheduleReload = debounce(() => void reload(), 300);

async function reload(): Promise<void> {
  loading.value = true;
  try {
    items.value = await searchHistory();
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
}

export function useHistory(): {
  items: Ref<HistoryItemLike[]>;
  groups: ComputedRef<HistoryGroup[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  findByUrl: (url: string) => HistoryItemLike | undefined;
  reload: () => Promise<void>;
  remove: (url: string) => Promise<void>;
  clearAll: () => Promise<void>;
} {
  bootstrap();

  const groups = computed(() => groupHistory(items.value));

  function findByUrl(url: string): HistoryItemLike | undefined {
    return items.value.find((item) => item.url === url);
  }

  async function remove(url: string): Promise<void> {
    await chrome.history.deleteUrl({ url });
    await reload();
  }

  async function clearAll(): Promise<void> {
    await chrome.history.deleteAll();
    await reload();
  }

  return {
    items,
    groups,
    loading,
    failed,
    findByUrl,
    reload,
    remove,
    clearAll,
  };
}
