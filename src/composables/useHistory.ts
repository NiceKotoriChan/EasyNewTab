/**
 * History state — shared by the sidebar list and the detail pane.
 *
 * There is no "how many items" setting any more: the whole history is
 * requested in one go (`chrome/history.ts`), so there is nothing to keep
 * re-querying when a preference changes. The item count that used to be
 * published here existed only for the status bar.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import * as api from "@/chrome/history";
import { groupHistory, type HistoryGroup, type HistoryItemLike } from "@/core/history";
import { debounce } from "@/core/utils";

const items = ref<HistoryItemLike[]>([]);
const loading = ref(true);
const failed = ref(false);

let bootstrapped = false;

const scheduleReload = debounce(() => void reload(), 300);

async function reload(): Promise<void> {
  loading.value = true;
  try {
    items.value = await api.searchHistory();
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
  // Visits and removals arrive in bursts (a bulk delete fires once per URL).
  api.onHistoryChanged(scheduleReload);
}

export interface UseHistory {
  items: Ref<HistoryItemLike[]>;
  groups: ComputedRef<HistoryGroup[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  findByUrl: (url: string) => HistoryItemLike | undefined;
  reload: () => Promise<void>;
  remove: (url: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useHistory(): UseHistory {
  bootstrap();

  const groups = computed(() => groupHistory(items.value));

  function findByUrl(url: string): HistoryItemLike | undefined {
    return items.value.find((item) => item.url === url);
  }

  async function remove(url: string): Promise<void> {
    await api.deleteUrl(url);
    await reload();
  }

  async function clearAll(): Promise<void> {
    await api.deleteAllHistory();
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
