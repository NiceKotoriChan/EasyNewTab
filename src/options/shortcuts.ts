/** The Shortcuts list, as data. It lives outside the SFC so
 *  `scripts/render-check.mjs` can feed each row's keys through `resolveShortcut`
 *  and assert the mapping answers — the only thing that keeps a table of prose
 *  *about* behaviour from describing a binding the shell does not have. One row per
 *  thing the shell can be asked to do, and every row has to be a keystroke: that
 *  rule is why the divider drag is not here — it is a mouse gesture, and its one
 *  fact worth knowing (which way counts as "shut") is left to its hover text. */

interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  // No modifiers, deliberately: `Ctrl+1`/`Ctrl+2` are the browser's "go to tab N". Every
  // key here is a character first, so none fire while the caret is in a text field — which
  // is what the `Esc` row is for.
  { keys: "/", label: "Focus the search bar" },
  { keys: "p", label: "Search bookmarks" },
  { keys: "s", label: "Show or hide the sidebar" },
  { keys: "b", label: "Switch to the bookmarks panel" },
  { keys: "h", label: "Switch to the history panel" },
  {
    keys: "Esc",
    label: "Clear the search box, then leave it",
  },
];
