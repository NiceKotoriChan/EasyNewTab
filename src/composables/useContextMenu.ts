/**
 * One context menu for the entire app.
 *
 * The old implementation created a separate menu element and a separate set of
 * global document listeners per module (bookmarks, history, background), which
 * is why re-renders kept stacking duplicate listeners. Here there is exactly
 * one menu instance, rendered by App.vue, and one set of global listeners.
 */

import { ref, type Ref } from "vue";

export interface MenuItem {
  label: string;
  /** Passed back to the `onPick` callback of the opening call. */
  action: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separatorBefore?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
  onPick: (action: string) => void;
}

const menu = ref<MenuState | null>(null);

export interface UseContextMenu {
  menu: Ref<MenuState | null>;
  open: (
    event: MouseEvent,
    items: MenuItem[],
    onPick: (action: string) => void,
  ) => void;
  close: () => void;
}

export function useContextMenu(): UseContextMenu {
  function open(
    event: MouseEvent,
    items: MenuItem[],
    onPick: (action: string) => void,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    if (items.length === 0) return;
    menu.value = { x: event.clientX, y: event.clientY, items, onPick };
  }

  function close(): void {
    menu.value = null;
  }

  return { menu, open, close };
}
