// App-level names → Material Design Icons, resolved at build time. `unplugin-icons` inlines each into an SVG component (no network fetch); our keys make a typo a type error, not an empty box.
import type { Component } from "vue";
import MdiAlertOutline from "~icons/mdi/alert-outline";
import MdiArrowRight from "~icons/mdi/arrow-right";
import MdiBookmarkOutline from "~icons/mdi/bookmark-outline";
import MdiChevronDown from "~icons/mdi/chevron-down";
import MdiChevronRight from "~icons/mdi/chevron-right";
import MdiClose from "~icons/mdi/close";
import MdiCogOutline from "~icons/mdi/cog-outline";
import MdiDockLeft from "~icons/mdi/dock-left";
import MdiDockRight from "~icons/mdi/dock-right";
import MdiFolder from "~icons/mdi/folder";
import MdiFolderOutline from "~icons/mdi/folder-outline";
import MdiHistory from "~icons/mdi/history";
import MdiKeyboardOutline from "~icons/mdi/keyboard-outline";
import MdiMagnify from "~icons/mdi/magnify";
import MdiMinus from "~icons/mdi/minus";
import MdiOpenInNew from "~icons/mdi/open-in-new";
import MdiPlus from "~icons/mdi/plus";
import MdiTrashCanOutline from "~icons/mdi/trash-can-outline";
import MdiWeb from "~icons/mdi/web";

// Semantic name → MDI glyph. Adding an icon means adding one line here.
const ICONS = {
  alert: MdiAlertOutline,
  "arrow-right": MdiArrowRight,
  bookmark: MdiBookmarkOutline,
  "chevron-down": MdiChevronDown,
  "chevron-right": MdiChevronRight,
  close: MdiClose,
  external: MdiOpenInNew,
  folder: MdiFolder,
  // The expanded half of the pair; `folder` is the closed state everywhere else.
  "folder-open": MdiFolderOutline,
  globe: MdiWeb,
  history: MdiHistory,
  keyboard: MdiKeyboardOutline,
  minus: MdiMinus,
  "panel-left": MdiDockLeft,
  "panel-right": MdiDockRight,
  plus: MdiPlus,
  search: MdiMagnify,
  settings: MdiCogOutline,
  trash: MdiTrashCanOutline,
} as const;

// Every icon the app may ask for; lists of icons type their field with this.
export type IconName = keyof typeof ICONS;

export function resolveIcon(name: IconName): Component {
  return ICONS[name];
}
