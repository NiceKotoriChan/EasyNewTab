/** Shared, dependency-free helpers. Nothing here touches the DOM or the Vue runtime so
 *  the module stays trivially testable. */

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
function escapeHtml(str: string): string {
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

/** Favicon URL for a page. Uses Chromium's internal `_favicon` route, which resolves
 *  from the local favicon cache — no network request, no third party. */
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

/** Open a page from a click, honouring the `openInNewTab` preference. Unset counts as *on*: the
 *  preference arrives from storage after the first paint, and a click landing before it does should
 *  not navigate this page away from itself. Every place a click can open a link goes through here,
 *  so the rule has one home. */
export function openUrl(url: string, openInNewTab: boolean | undefined): void {
  if (openInNewTab === false) void chrome.tabs.update({ url });
  else void chrome.tabs.create({ url });
}

// Hardcoded: the extension ships no translations, so a browser locale would only make
// output unassertable. Every Intl call passes this explicitly.
export const UI_LOCALE = "en-US";

export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** The welcome pane's date line: `Friday, September 25` — no year, since this line is
 *  glanced at dozens of times a day and the year would be constant noise. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString(UI_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Position a fixed-position menu at (x, y), clamped so it never leaves the viewport.
 *  Returns the top-left corner to apply. */
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
