/**
 * Settings + layout persistence.
 *
 * Settings live in `storage.sync` (they follow the user's Chrome profile).
 * Layout lives in `storage.local` (per machine — window sizes shouldn't sync).
 *
 * The split is "what the user prefers" vs "how big this window happens to be".
 * Which edge the sidebar docks to is a preference, so it syncs; how wide it is
 * and whether it is folded away are measurements of one window, so they don't.
 */

import { DEFAULT_ENGINE_ID, isEngineId, type EngineId } from "./search/engines.ts";

/** Which window edge the sidebar docks to. */
export type SidebarPosition = "left" | "right";

export function isSidebarPosition(value: unknown): value is SidebarPosition {
  return value === "left" || value === "right";
}

export interface Settings {
  searchEngine: EngineId;
  openInNewTab: boolean;
  /** Show Chrome's "Other bookmarks" folder in the sidebar tree. */
  showOtherBookmarks: boolean;
  /**
   * Docking side. Everything directional derives from this — the divider's
   * gutter, which way a drag has to go to shut the sidebar, and which window
   * edge the collapsed handle waits on.
   */
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

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: DEFAULT_ENGINE_ID,
  openInNewTab: true,
  showOtherBookmarks: true,
  sidebarPosition: "left",
};

export const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarCollapsed: false,
  activeView: "bookmarks",
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Coerce whatever is in storage into a valid Settings object.
 *
 * This is the single place that decides what's valid, so a stale or
 * hand-edited value can never reach the rest of the app as a surprise type —
 * the bug class that a plain-JS version kept hitting.
 *
 * Unknown keys are dropped, which is how a leftover `historyCount` from an
 * older build disappears on the next write.
 */
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
