import type { Component } from "vue";
import MdiAlertOutline from "~icons/mdi/alert-outline";
import MdiArrowRight from "~icons/mdi/arrow-right";
import MdiBookmarkOutline from "~icons/mdi/bookmark-outline";
import MdiChevronDown from "~icons/mdi/chevron-down";
import MdiChevronRight from "~icons/mdi/chevron-right";
import MdiClose from "~icons/mdi/close";
import MdiCogOutline from "~icons/mdi/cog-outline";
import MdiFolder from "~icons/mdi/folder";
import MdiFolderOutline from "~icons/mdi/folder-outline";
import MdiHistory from "~icons/mdi/history";
import MdiKeyboardOutline from "~icons/mdi/keyboard-outline";
import MdiMagnify from "~icons/mdi/magnify";
import MdiMinus from "~icons/mdi/minus";
import MdiOpenInNew from "~icons/mdi/open-in-new";
import MdiPlus from "~icons/mdi/plus";
import MdiTrashCanOutline from "~icons/mdi/trash-can-outline";
import MdiViewColumn from "~icons/mdi/view-column";
import MdiWeb from "~icons/mdi/web";

const ICONS = {
  alert: MdiAlertOutline,
  "arrow-right": MdiArrowRight,
  bookmark: MdiBookmarkOutline,
  "chevron-down": MdiChevronDown,
  "chevron-right": MdiChevronRight,
  close: MdiClose,
  external: MdiOpenInNew,
  folder: MdiFolder,
  "folder-open": MdiFolderOutline,
  globe: MdiWeb,
  history: MdiHistory,
  keyboard: MdiKeyboardOutline,
  "layout-docked": MdiViewColumn,
  minus: MdiMinus,
  plus: MdiPlus,
  search: MdiMagnify,
  settings: MdiCogOutline,
  trash: MdiTrashCanOutline,
} as const;

export type IconName = keyof typeof ICONS;

export function resolveIcon(name: IconName): Component {
  return ICONS[name];
}
