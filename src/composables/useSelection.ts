/**
 * What the main area is showing: the welcome pane (`null`), or the detail view
 * for one bookmark or history entry.
 *
 * Nothing sets this on a click — a click in the sidebar opens or folds a row and
 * leaves the search box alone, and a detail view is asked for explicitly from the
 * row's context menu. That is what lets the search box and the detail view share
 * the same real estate.
 */

import { ref, type Ref } from "vue";

type Selection =
  | { kind: "bookmark"; id: string }
  | { kind: "history"; url: string };

const selection = ref<Selection | null>(null);

interface UseSelection {
  selection: Ref<Selection | null>;
  select(next: Selection): void;
  clear(): void;
}

export function useSelection(): UseSelection {
  return {
    selection,
    select(next) {
      selection.value = next;
    },
    clear() {
      selection.value = null;
    },
  };
}
