/** Settings, layout, and the sidebar's drag geometry. Settings live in `storage.sync` (they follow
 *  the profile); layout in `storage.local` (per machine — window sizes should not sync). */

import { DEFAULT_ENGINE_ID, isEngineId, type EngineId } from "./engines.ts";

/** Which window edge the sidebar docks to. */
export type SidebarPosition = "left" | "right";

function isSidebarPosition(value: unknown): value is SidebarPosition {
  return value === "left" || value === "right";
}

export interface Settings {
  searchEngine: EngineId;
  openInNewTab: boolean;
  /** Show Chrome's "Other bookmarks" folder in the sidebar tree. */
  showOtherBookmarks: boolean;
  /** How many history entries the sidebar asks Chrome for. Capped because
   *  `chrome.history.search` answers a whole profile's worth of rows. */
  historyLimit: number;
  /** Everything directional derives from this: the divider's gutter, which way a drag shuts the
   *  sidebar, and which edge the collapsed handle waits on. */
  sidebarPosition: SidebarPosition;
}

export interface LayoutState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  /** Panel shown in the sidebar, restored across new tabs. */
  activeView: "bookmarks" | "history";
}

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 260;

// Well below SIDEBAR_MIN, so closing takes real intent, not one stray pixel.
export const SIDEBAR_COLLAPSE_AT = 110;

// The floor doubles as the stepper's step, so every reachable value is a whole nudge apart and a
// typo cannot ask the API for a report-sized list.
export const HISTORY_LIMIT_MIN = 50;
export const HISTORY_LIMIT_MAX = 1000;

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: DEFAULT_ENGINE_ID,
  openInNewTab: true,
  showOtherBookmarks: true,
  historyLimit: 100,
  sidebarPosition: "left",
};

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarCollapsed: false,
  activeView: "bookmarks",
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Coerce whatever is in storage into a valid Settings. The single place that decides what is
 *  valid, so a stale or hand-edited value can never reach the app as a surprise type. Unknown
 *  keys are dropped, which is how a leftover field disappears on the next write. */
export function normalizeSettings(raw: unknown): Settings {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    searchEngine: isEngineId(o.searchEngine)
      ? (o.searchEngine as EngineId)
      : DEFAULT_SETTINGS.searchEngine,
    openInNewTab:
      typeof o.openInNewTab === "boolean"
        ? o.openInNewTab
        : DEFAULT_SETTINGS.openInNewTab,
    showOtherBookmarks:
      typeof o.showOtherBookmarks === "boolean"
        ? o.showOtherBookmarks
        : DEFAULT_SETTINGS.showOtherBookmarks,
    historyLimit: clampInt(
      o.historyLimit,
      HISTORY_LIMIT_MIN,
      HISTORY_LIMIT_MAX,
      DEFAULT_SETTINGS.historyLimit,
    ),
    sidebarPosition: isSidebarPosition(o.sidebarPosition)
      ? o.sidebarPosition
      : DEFAULT_SETTINGS.sidebarPosition,
  };
}

export function normalizeLayout(raw: unknown): LayoutState {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    sidebarWidth: clampInt(
      o.sidebarWidth,
      SIDEBAR_MIN,
      SIDEBAR_MAX,
      DEFAULT_LAYOUT.sidebarWidth,
    ),
    sidebarCollapsed:
      typeof o.sidebarCollapsed === "boolean"
        ? o.sidebarCollapsed
        : DEFAULT_LAYOUT.sidebarCollapsed,
    activeView: o.activeView === "history" ? "history" : "bookmarks",
  };
}

type SidebarDrag =
  | { kind: "resize"; width: number }
  | { kind: "collapse" }
  | { kind: "expand"; width: number }
  | { kind: "idle" };

export function clampSidebarWidth(value: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

/** How wide the sidebar becomes if the divider is dragged to `clientX`. The divider sits on the
 *  sidebar's *inner* edge, so mirroring comes down to the sign of the delta: while collapsed it
 *  hugs the docked edge and describes a width of zero, and the same arithmetic still works. */
export function dragWidth(
  startWidth: number,
  startX: number,
  clientX: number,
  position: SidebarPosition,
): number {
  const delta = position === "right" ? startX - clientX : clientX - startX;
  return startWidth + delta;
}

/** Turn "where the divider would land" into an instruction. The expand threshold (`SIDEBAR_MIN`)
 *  is deliberately above the collapse one (`SIDEBAR_COLLAPSE_AT`): with one shared boundary a
 *  pointer resting on it flips on every pixel of jitter. `collapsed` is read live rather than
 *  frozen at pointerdown, so one drag can close the sidebar and reopen it on the way out. */
export function resolveSidebarDrag(
  pointerWidth: number,
  collapsed: boolean,
): SidebarDrag {
  if (collapsed) {
    // There is nothing to resize while shut; it only returns at a usable width.
    return pointerWidth >= SIDEBAR_MIN
      ? { kind: "expand", width: clampSidebarWidth(pointerWidth) }
      : { kind: "idle" };
  }
  if (pointerWidth < SIDEBAR_COLLAPSE_AT) return { kind: "collapse" };
  return { kind: "resize", width: clampSidebarWidth(pointerWidth) };
}
