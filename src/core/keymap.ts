/**
 * What a keydown means — a pure function of the event's fields.
 *
 * The mapping from key to action lives here rather than in the shell's handler so
 * that it can be tested at all: `onKeydown` runs from a window listener, and the
 * headless check has no window. `typing` is passed in rather than read off
 * `event.target`, because "is the caret in a text field" is a DOM question and
 * the shell is the side that can answer it.
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

/**
 * Resolve a keystroke, or `null` for every key the shell does not answer to.
 *
 * Two rules, in this order:
 *
 * 1. Escape is checked first and regardless of focus — the one key that has to
 *    reach the shell from inside a text field.
 * 2. Everything else is a *character* first and a shortcut second, so it is
 *    checked behind `typing`. `/`, `p`, `s`, `b` and `h` are all letters someone
 *    may be in the middle of typing.
 *
 * No binding uses a modifier, deliberately: `Ctrl+1` / `Ctrl+2` are also the
 * browser's "go to tab N", and a page should let `Ctrl+<letter>` fall through
 * rather than take a combination it does not own.
 *
 * The cost is that nothing here fires while the caret is in a text field, and the
 * new tab page autofocuses one. Escape is the way out: it clears the field, then
 * leaves it, and the bindings become live.
 */
export function resolveShortcut(event: KeyEventLike): ShortcutAction {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key.toLowerCase();

  if (key === "escape") return "dismiss";

  // A modified key is not ours to take: nothing is bound with a modifier, so
  // `Ctrl+P` has to stay the browser's print dialog rather than open the
  // bookmark search.
  if (mod || event.typing) return null;

  if (event.key === "/") return "focus-search";
  if (key === "p") return "search-bookmarks";
  if (key === "s") return "toggle-sidebar";
  if (key === "b") return "show-bookmarks";
  if (key === "h") return "show-history";
  return null;
}
