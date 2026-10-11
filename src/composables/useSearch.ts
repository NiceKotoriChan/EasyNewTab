import { computed, ref, type ComputedRef, type Ref } from "vue";
import { buildSearchUrl, looksLikeUrl, normalizeUrl, type EngineId } from "@/core/engines";
import { openUrl } from "@/core/utils";
import { useSettings } from "./useSettings";

interface UseSearch {
  query: Ref<string>;
  engine: ComputedRef<EngineId>;
  commit: () => void;
  reset: () => void;
}

export function useSearch(): UseSearch {
  const { settings } = useSettings();

  const query = ref("");
  const engine = computed(() => settings.value.searchEngine);

  function run(text: string): void {
    const value = text.trim();
    if (!value) return;
    const url = looksLikeUrl(value) ? normalizeUrl(value) : buildSearchUrl(engine.value, value);
    openUrl(url, settings.value.openSearchInNewTab);
  }

  function commit(): void {
    run(query.value);
    reset();
  }

  function reset(): void {
    query.value = "";
  }

  return {
    query,
    engine,
    commit,
    reset,
  };
}
