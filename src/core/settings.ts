/**
 * Settings, layout, and the sidebar's drag geometry — the pure half of "how the
 * shell is shaped".
 *
 * Settings live in `storage.sync` (they follow the Chrome profile); layout lives
 * in `storage.local` (per machine — window sizes should not sync). The split is
 * "what the user prefers" vs "how big this window happens to be": which edge the
 * sidebar docks to is a preference, how wide it is is a measurement of one
 * window.
 */

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
  /**
   * Everything directional derives from this: the divider's gutter, which way a
   * drag has to go to shut the sidebar, and which window edge the collapsed
   * handle waits on.
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

/**
 * How narrow the sidebar has to get before the drag shuts it. Well below
 * `SIDEBAR_MIN`, so closing it takes real intent rather than one stray pixel.
 */
export const SIDEBAR_COLLAPSE_AT = 110;

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: DEFAULT_ENGINE_ID,
  openInNewTab: true,
  showOtherBookmarks: true,
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

/**
 * Coerce whatever is in storage into a valid Settings object. This is the single
 * place that decides what is valid, so a stale or hand-edited value can never
 * reach the app as a surprise type. Unknown keys are dropped, which is how a
 * leftover field from an older build disappears on the next write.
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

// ---------------------------------------------------------------- drag geometry

type SidebarDrag =
  | { kind: "resize"; width: number }
  | { kind: "collapse" }
  | { kind: "expand"; width: number }
  | { kind: "idle" };

export function clampSidebarWidth(value: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

/**
 * How wide the sidebar becomes if the divider is dragged to `clientX`.
 *
 * The divider always sits on the sidebar's *inner* edge, so "pull the divider
 * toward the edge the sidebar is docked to" is a leftward drag when docked left
 * and a rightward one when docked right. Mirroring therefore comes down to the
 * sign of the delta. While collapsed the divider hugs the docked edge and
 * describes a width of zero, so the same arithmetic works from either state.
 */
export function dragWidth(
  startWidth: number,
  startX: number,
  clientX: number,
  position: SidebarPosition,
): number {
  const delta = position === "right" ? startX - clientX : clientX - startX;
  return startWidth + delta;
}

/**
 * Turn "where the divider would land" into an instruction.
 *
 * The expand threshold (`SIDEBAR_MIN`) is deliberately higher than the collapse
 * one (`SIDEBAR_COLLAPSE_AT`): with a single shared boundary, a pointer resting
 * on it flips state on every pixel of jitter.
 *
 * `collapsed` is read live rather than frozen at pointerdown, so one drag can
 * close the sidebar on the way in and reopen it on the way out.
 */
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
