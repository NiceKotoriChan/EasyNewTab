/**
 * What the main area is showing.
 *
 * `null` → the welcome pane (clock + search box).
 * Otherwise → the detail view for one bookmark or history entry.
 *
 * Nothing sets this on a click. A click in the sidebar opens or folds a row and
 * leaves the search box alone; a detail view is something you ask for
 * explicitly, from the row's context menu. So this is the one piece of state
 * that lets the search box and the detail view share the same real estate
 * without either being cramped, while staying out of the way the rest of the
 * time.
 */

import { ref, type Ref } from "vue";

export type Selection =
  | { kind: "bookmark"; id: string }
  | { kind: "history"; url: string };

const selection = ref<Selection | null>(null);

export interface UseSelection {
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
