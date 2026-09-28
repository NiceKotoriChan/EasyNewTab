/**
 * What a keydown means — a pure function of the event's fields, so it can be
 * tested without a window. `typing` is passed in rather than read off
 * `event.target`: "is the caret in a text field" is a DOM question.
 */

type ShortcutAction =
  | "toggle-sidebar"
  | "show-bookmarks"
  | "show-history"
  | "focus-search"
  | null;

export interface KeyEventLike {
  /** As reported by the browser — the resolver compares case-insensitively. */
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  /** True when the keystroke is going into an input, textarea or editor. */
  typing: boolean;
}

// Character shortcuts only, gated behind `typing`; no modifier (so Ctrl+S stays the
// browser's). Escape is unbound: it only unwound the deleted bookmarks filter, which a
// text field handles itself.
export function resolveShortcut(event: KeyEventLike): ShortcutAction {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key.toLowerCase();

  if (mod || event.typing) return null;

  if (event.key === "/") return "focus-search";
  if (key === "s") return "toggle-sidebar";
  if (key === "b") return "show-bookmarks";
  if (key === "h") return "show-history";
  return null;
}
