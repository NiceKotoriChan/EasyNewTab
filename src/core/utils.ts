/**
 * Shared, dependency-free helpers. Nothing here touches the DOM or the Vue
 * runtime so the module stays trivially testable.
 */

export function debounce<F extends (...args: never[]) => void>(
  fn: F,
  delay: number,
): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<F>) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Escape a string for safe interpolation into an innerHTML fragment. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrap occurrences of `query` in `<mark>`. Returns escaped HTML. */
export function highlightMatch(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const q = query.trim();
  if (!q) return escaped;
  const safe = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(
    new RegExp(`(${safe})`, "gi"),
    '<mark class="hl">$1</mark>',
  );
}

/**
 * Favicon URL for a page. Uses Chromium's internal `_favicon` route, which
 * resolves from the local favicon cache — no network request, no third party.
 */
export function getFaviconUrl(url: string | undefined, size = 32): string {
  if (!url) return "";
  return (
    chrome.runtime.getURL("_favicon") +
    "?pageUrl=" +
    encodeURIComponent(url) +
    "&size=" +
    size
  );
}

/** Strip the scheme and trailing slash so rows show `example.com/x`. */
export function prettyUrl(url: string | undefined): string {
  if (!url) return "";
  return url.replace(/^[a-z]+:\/\//i, "").replace(/\/$/, "");
}

/**
 * The one locale the interface is written in.
 *
 * Every `Intl` call in the app passes this explicitly rather than leaving the
 * locale `undefined`. The extension ships no translations — there is no
 * `_locales` directory, no `chrome.i18n` call, and no `default_locale` in the
 * manifest — so reading the browser's locale would not translate anything. It
 * would only let a handful of strings (the welcome pane's date line, the two
 * history timestamps in `history.ts`) change shape and language depending on who
 * opened the page. The side effect that matters for maintenance: with the locale
 * fixed, those functions have an output that can be asserted, which they did
 * not while it moved with the host.
 */
export const UI_LOCALE = "en-US";

/** HH:MM, 24h, zero-padded. */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * The welcome pane's date line: `Friday, September 25`.
 *
 * No year, which is the lock-screen convention rather than a preference: this
 * line is glanced at dozens of times a day, and the year is constant
 * information taking up room in it. iOS cannot even display one there. The
 * detail view's `formatFullTimestamp` keeps its year for the opposite reason —
 * it is read deliberately, once.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString(UI_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Position a fixed-position menu at (x, y), clamped so it never leaves the
 * viewport. Returns the top-left corner to apply.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 4,
): { left: number; top: number } {
  return {
    left: Math.max(margin, Math.min(x, viewportWidth - menuWidth - margin)),
    top: Math.max(margin, Math.min(y, viewportHeight - menuHeight - margin)),
  };
}
