/**
 * The icon set: app-level names → Material Design Icons, resolved at build time.
 *
 * Source is Iconify's offline MDI package, and `unplugin-icons` turns each import
 * below into an inline SVG component — so only the icons listed here reach the
 * bundle, and nothing is fetched over the network (`script-src 'self'` would
 * block a remote icon API anyway).
 *
 * - **Outline variants for the utility glyphs**, because MDI's solid glyph at
 *   13–15px reads a full weight heavier than the 1.6px strokes it replaced.
 * - **`folder` is a pair:** `folder` (solid) is the closed state, `folder-open`
 *   (MDI's `folder-outline`) the expanded one. A folder row is the only row whose
 *   icon says something about its own state, and the solid → hollow swap is what
 *   makes it legible.
 * - **The keys are ours, not MDI's.** Call sites say `name="folder"`, never
 *   `folder-outline`, so a typo like `name="foldr"` is a *type error* at the call
 *   site rather than an invisible empty box — see `IconName`.
 */
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
import MdiOpenInNew from "~icons/mdi/open-in-new";
import MdiTrashCanOutline from "~icons/mdi/trash-can-outline";
import MdiWeb from "~icons/mdi/web";

/** Semantic name → MDI glyph. Adding an icon means adding one line here. */
const ICONS = {
  alert: MdiAlertOutline,
  "arrow-right": MdiArrowRight,
  bookmark: MdiBookmarkOutline,
  "chevron-down": MdiChevronDown,
  "chevron-right": MdiChevronRight,
  close: MdiClose,
  external: MdiOpenInNew,
  folder: MdiFolder,
  /** The expanded half of the pair. Closed is the default everywhere else. */
  "folder-open": MdiFolderOutline,
  globe: MdiWeb,
  history: MdiHistory,
  keyboard: MdiKeyboardOutline,
  "panel-left": MdiDockLeft,
  "panel-right": MdiDockRight,
  search: MdiMagnify,
  settings: MdiCogOutline,
  trash: MdiTrashCanOutline,
} as const;

/** Every icon the app may ask for. Lists of icons type their field with this. */
export type IconName = keyof typeof ICONS;

/** `IconName` in, component out — no lookup miss is representable, so there is no
 *  "empty box" branch to forget about. */
export function resolveIcon(name: IconName): Component {
  return ICONS[name];
}
