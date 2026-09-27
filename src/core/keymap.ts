/**
 * What a keydown means.
 *
 * The shell's handler used to be a chain of `if`s over the event, which left
 * the one thing users actually care about — the mapping from key to action —
 * as the only part of it nothing could test: `onKeydown` runs from a window
 * listener, and the headless check has no window. The mapping is a pure
 * function of the event's fields, so it lives here, and the shell is left with
 * the part that needs state (`dismiss` unwinding the search box and then the
 * selection) and the parts that need the DOM.
 *
 * `typing` is passed in rather than read off `event.target`: "is the caret in a
 * text field" is a DOM question, and the shell is the side that can answer it.
 */

export type ShortcutAction =
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
 * 1. Escape is checked first and regardless of focus. It is the one key that has
 *    to reach the shell from inside a text field, which is why `SearchField`
 *    stops propagation only for the presses it handles itself.
 * 2. Everything else is a *character* first and a shortcut second, so it is
 *    checked last and behind `typing`. `/`, `p`, `s`, `b` and `h` are all
 *    letters someone may be in the middle of typing.
 *
 * **No binding uses a modifier**, which is a decision rather than an oversight.
 * The panel switches were `Ctrl+1` / `Ctrl+2`, and those are also the browser's
 * "go to tab N" — a collision not worth having on the single page where someone
 * is most likely to be mid-sentence. Dropping the modifiers also means there is
 * exactly one rule for the whole map instead of two opposite ones, and it makes
 * `Ctrl+<letter>` fall through to the browser again, which is what a page should
 * do with a combination it does not own.
 *
 * The cost is that nothing here fires while the caret is in a text field, and
 * the new tab page autofocuses one. Escape is the way out: it clears the query
 * first, then leaves the field, and the bindings become live.
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
