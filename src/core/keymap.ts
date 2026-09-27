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
  | "search-bookmarks"
  /** Escape. What it unwinds is the shell's business, not this function's. */
  | "dismiss"
  | null;

export interface KeyEventLike {
  /** As reported by the browser — the resolver compares case-insensitively. */
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  /** True when the keystroke is going into an input, textarea or editor. */
  typing: boolean;
}

/** Resolve a keystroke, or `null` for every key the shell does not answer to.
 *  Escape is checked first and regardless of focus — the one key that has to reach
 *  the shell from inside a text field. Everything else is a *character* first and a
 *  shortcut second, so it sits behind `typing`; and nothing is bound with a
 *  modifier, so `Ctrl+P` stays the browser's print dialog rather than opening the
 *  bookmark search. */
export function resolveShortcut(event: KeyEventLike): ShortcutAction {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key.toLowerCase();

  if (key === "escape") return "dismiss";

  if (mod || event.typing) return null;

  if (event.key === "/") return "focus-search";
  if (key === "p") return "search-bookmarks";
  if (key === "s") return "toggle-sidebar";
  if (key === "b") return "show-bookmarks";
  if (key === "h") return "show-history";
  return null;
}
