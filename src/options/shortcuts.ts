/**
 * The Shortcuts list, as data.
 *
 * It sits outside the SFC for one reason: `scripts/render-check.mjs` imports it
 * to feed each row's keys through `resolveShortcut` and assert the mapping
 * answers. That cross-check is what keeps this table from describing a binding
 * the shell no longer has — the failure mode of any list of prose *about*
 * behaviour, which is what a shortcut table is.
 *
 * It used to have a second reason: the rows lived behind a nav click that
 * nothing headless could click, so this module was the only way to reach the
 * copy. The options page no longer pages, so the rows render straight into the
 * page and the render check asserts on the markup too. The module is now only
 * about the cross-check.
 *
 * One row per thing the shell can actually be asked to do, and every row has to
 * be a keystroke. That last rule is why the divider gesture — which used to sit
 * at the bottom of this list, labelled "Drag the divider" — is gone: it is a
 * mouse gesture, and it never belonged in a column of things a person can press.
 * Its one fact worth knowing (which way counts as "shut") follows the docked
 * edge, and it now lives nowhere in the UI: the General panel's rows are labels
 * and controls with no explanatory paragraphs under them, and this table is
 * keystrokes only. The hover text on the divider itself is the remaining hint.
 */

export interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  // No modifiers, deliberately: `Ctrl+1` / `Ctrl+2` are also the browser's "go
  // to tab N". Every key here is a character first, so none of them fire while
  // the caret is in a text field — which is what the `Esc` row is for.
  { keys: "/", label: "Focus the search bar" },
  { keys: "p", label: "Search bookmarks" },
  { keys: "s", label: "Show or hide the sidebar" },
  { keys: "b", label: "Switch to the bookmarks panel" },
  { keys: "h", label: "Switch to the history panel" },
  {
    keys: "Esc",
    label:
      "Step out one level — the search bar, the bookmark search, then the selection",
  },
];
