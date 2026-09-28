// One app-wide menu, one instance rendered by App.vue with global dismissal listeners.
// `open` takes coordinates (not a MouseEvent): a right-click carries them, a long press doesn't.
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
