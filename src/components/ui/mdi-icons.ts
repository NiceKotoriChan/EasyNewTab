/**
 * The icon set: app-level names → Material Design Icons, resolved at build time.
 *
 * Source is Iconify's offline MDI package (`@iconify-json/mdi`, 7638 icons,
 * 24x24). `unplugin-icons` turns each import below into an inline SVG
 * component, so only the icons listed here reach the bundle — no runtime icon
 * library, no data for the other 7622, and nothing fetched over the network
 * (`script-src 'self'` would block a remote icon API anyway).
 *
 * Three deliberate choices:
 *
 * - **Outline variants for the utility glyphs** (`bookmark-outline`,
 *   `trash-can-outline`, `cog-outline`, `keyboard-outline`, `alert-outline`).
 *   The set this replaced was drawn as 1.6px strokes, and MDI's solid glyph at
 *   13–15px reads a full weight heavier. The outline variants keep the same
 *   visual weight while still being MDI.
 * - **`folder` is the exception, and it is a pair.** `folder` (solid) is the
 *   closed state, `folder-open` (MDI's `folder-outline`) is the expanded state —
 *   the same two glyphs the pre-rewrite build drew. A folder row is the only row
 *   whose icon says something about the row's own state, so it is the only icon
 *   that needs two of them. The outline half of the pair is what makes the swap
 *   legible: solid → hollow, rather than one solid glyph changing into another.
 * - **The keys are ours, not MDI's.** Call sites say `name="folder"` or
 *   `name="folder-open"`, never `folder-outline`, so nobody has to know or care
 *   which set is behind it. It also means a typo like `name="foldr"` is a *type
 *   error* at the call site rather than an invisible empty box — see `IconName`.
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

/**
 * `IconName` in, component out — no lookup miss is representable, so there is no
 * "empty box" branch to forget about.
 */
export function resolveIcon(name: IconName): Component {
  return ICONS[name];
}
