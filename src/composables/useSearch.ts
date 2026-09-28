/** Search state machine for the main search box, driven by the welcome pane's hero
 *  box — `/` is the only way to reach that box when it is not already in front. State
 *  is per-instance: it belongs to whichever field called it. */

import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";
import {
  buildSearchUrl,
  fetchSuggestions,
  looksLikeUrl,
  normalizeUrl,
  supportsSuggestions,
  type EngineId,
} from "@/core/engines";
import { useSettings } from "./useSettings";

const SUGGEST_DEBOUNCE_MS = 200;

interface UseSearch {
  query: Ref<string>;
  suggestions: Ref<string[]>;
  activeIndex: Ref<number>;
  loading: Ref<boolean>;
  engine: ComputedRef<EngineId>;
  canSuggest: ComputedRef<boolean>;
  move: (delta: number) => void;
  /** Open the highlighted suggestion, or run the raw query. */
  commit: () => void;
  pick: (index: number) => void;
  reset: () => void;
}

export function useSearch(): UseSearch {
  const { settings } = useSettings();

  const query = ref("");
  const suggestions = ref<string[]>([]);
  const activeIndex = ref(-1);
  const loading = ref(false);

  const engine = computed(() => settings.value.searchEngine);
  const canSuggest = computed(() => supportsSuggestions(engine.value));

  let controller: AbortController | null = null;
  let timer: number | undefined;

  function cancelPending(): void {
    controller?.abort();
    controller = null;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function request(text: string): Promise<void> {
    cancelPending();
    const q = text.trim();
    if (!q || !supportsSuggestions(engine.value)) {
      suggestions.value = [];
      activeIndex.value = -1;
      return;
    }

    controller = new AbortController();
    const signal = controller.signal;
    loading.value = true;
    const list = await fetchSuggestions(q, engine.value, signal);
    if (signal.aborted) return; // a newer keystroke already won
    loading.value = false;
    suggestions.value = list;
    activeIndex.value = -1;
  }

  // Only the query drives the debounce.
  watch(query, (value) => {
    cancelPending();
    if (!value.trim()) {
      suggestions.value = [];
      activeIndex.value = -1;
      return;
    }
    timer = window.setTimeout(() => void request(value), SUGGEST_DEBOUNCE_MS);
  });

  // The engine can change from the switcher under the search box, from the
  // status bar, or from the options page — none of which know about this
  // composable. Watching settings here is what keeps the dropdown honest for
  // all three, and it stays strictly local: nothing outside this composable
  // is invalidated, so bookmark/history views are untouched.
  watch(engine, () => {
    if (query.value.trim()) void request(query.value);
    else {
      suggestions.value = [];
      activeIndex.value = -1;
    }
  });

  function move(delta: number): void {
    if (suggestions.value.length === 0) return;
    const next = activeIndex.value + delta;
    activeIndex.value = Math.max(-1, Math.min(suggestions.value.length - 1, next));
  }

  function openNewTab(url: string): void {
    // Always a new tab: the new tab page itself must stay put (the sidebar preference doesn't reach here).
    void chrome.tabs.create({ url });
  }

  function run(text: string): void {
    const value = text.trim();
    if (!value) return;
    openNewTab(looksLikeUrl(value) ? normalizeUrl(value) : buildSearchUrl(engine.value, value));
  }

  function commit(): void {
    const highlighted = suggestions.value[activeIndex.value];
    run(highlighted ?? query.value);
    reset();
  }

  function pick(index: number): void {
    const value = suggestions.value[index];
    if (value === undefined) return;
    run(value);
    reset();
  }

  function reset(): void {
    cancelPending();
    query.value = "";
    suggestions.value = [];
    activeIndex.value = -1;
    loading.value = false;
  }

  onScopeDispose(cancelPending);

  return {
    query,
    suggestions,
    activeIndex,
    loading,
    engine,
    canSuggest,
    move,
    commit,
    pick,
    reset,
  };
}
