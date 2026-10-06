/** The Shortcuts list, as data: one row per thing the shell can be asked to do, and
 *  every row has to be a keystroke. That rule is why the divider drag is not here —
 *  it is a mouse gesture, and its one fact worth knowing (which way counts as "shut")
 *  is left to its hover text. */

interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  // No modifiers, deliberately: `Ctrl+1`/`Ctrl+2` are the browser's "go to tab N". Every
  // key here is a character first, so none of them fire while the caret is in a text
  // field — leaving a field is the field's own Escape, which is not a shell binding and
  // so is not listed here.
  { keys: "/", label: "Focus the search bar" },
  // Asking for a named panel means the same thing in all three shapes: bring that one into view,
  // whether that is a column that was retracted, an overlay pinned open, or a page to swipe to.
  { keys: "s", label: "Show or hide the side panels" },
  { keys: "b", label: "Open the bookmarks panel" },
  { keys: "h", label: "Open the history panel" },
];
