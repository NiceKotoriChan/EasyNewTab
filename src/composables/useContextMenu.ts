/**
 * One context menu for the entire app.
 *
 * The old implementation created a separate menu element and a separate set of
 * global document listeners per module (bookmarks, history, background), which
 * is why re-renders kept stacking duplicate listeners. Here there is exactly
 * one menu instance, rendered by App.vue, and one set of global listeners.
 *
 * `open` takes an anchor rather than a `MouseEvent`, because there are two ways
 * in: a right-click, whose event carries the coordinates, and a touch long press
 * (`useLongPress`), which has no mouse event to hand over. Neither has to
 * suppress the browser's own menu here either — the shell swallows that once,
 * for the whole document.
 */
import { ref, type Ref } from "vue";
import type { MenuItem } from "@/core/menus";

interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
  onPick: (action: string) => void;
}

const menu = ref<MenuState | null>(null);

interface UseContextMenu {
  menu: Ref<MenuState | null>;
  open: (
    x: number,
    y: number,
    items: MenuItem[],
    onPick: (action: string) => void,
  ) => void;
  close: () => void;
}

export function useContextMenu(): UseContextMenu {
  function open(
    x: number,
    y: number,
    items: MenuItem[],
    onPick: (action: string) => void,
  ): void {
    if (items.length === 0) return;
    menu.value = { x, y, items, onPick };
  }

  function close(): void {
    menu.value = null;
  }

  return { menu, open, close };
}
