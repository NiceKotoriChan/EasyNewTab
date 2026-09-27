/** One context menu for the entire app: exactly one instance, rendered by `App.vue`,
 *  with one set of global dismissal listeners. `open` takes coordinates rather than a
 *  `MouseEvent`, because there are two ways in — a right-click, whose event carries
 *  them, and a touch long press, which has no mouse event to hand over. */
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
