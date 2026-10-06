/** Settings, layout, and the drag geometry of the divider between docked columns. Settings live in
 *  `storage.sync` (they follow the profile); layout in `storage.local` (per machine — window sizes
 *  should not sync). */

import { DEFAULT_ENGINE_ID, isEngineId, type EngineId } from "./engines.ts";
import type { PanelMode, SideOrder } from "./panels.ts";

/** Which window edge a divider is, i.e. how a drag says which one it grabbed. */
export type SideEdge = "left" | "right";

function isPanelMode(value: unknown): value is PanelMode {
  return value === "docked" || value === "hover";
}

function isSideOrder(value: unknown): value is SideOrder {
  return value === "bookmarks-left" || value === "history-left";
}

export interface Settings {
  searchEngine: EngineId;
  openInNewTab: boolean;
  showOtherBookmarks: boolean;
  /** How many history entries the panel asks Chrome for. Capped because `chrome.history.search`
   *  answers a whole profile's worth of rows. */
  historyLimit: number;
  /** Wide window only: three columns, or a panel that floats over them. */
  panelMode: PanelMode;
  /** Which side panel sits left of the centre. Every shape reads it, so this is the one setting
   *  that moves a panel relative to a swipe. */
  sideOrder: SideOrder;
}

export interface LayoutState {
  sidebarWidth: number;
  /** Docked shape only: the two columns are retracted, leaving the centre alone. The other two
   *  shapes ignore it, so the flag survives a resize that crosses the breakpoint. */
  sidebarCollapsed: boolean;
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 260;

// Well below SIDEBAR_MIN, so closing takes real intent, not one stray pixel.
const SIDEBAR_COLLAPSE_AT = 110;

/** The hover shape's one width, used twice: the band against each window side that reveals a panel,
 *  and the panel itself. Not draggable — the panel covers content rather than displacing it. */
export const OVERLAY_WIDTH = 300;

// The floor doubles as the stepper's step, so every reachable value is a whole nudge apart and a
// typo cannot ask the API for a report-sized list.
export const HISTORY_LIMIT_MIN = 50;
export const HISTORY_LIMIT_MAX = 1000;

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: DEFAULT_ENGINE_ID,
  openInNewTab: true,
  showOtherBookmarks: true,
  historyLimit: 100,
  panelMode: "docked",
  sideOrder: "bookmarks-left",
};

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarCollapsed: false,
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
    panelMode: isPanelMode(o.panelMode)
      ? o.panelMode
      : DEFAULT_SETTINGS.panelMode,
    sideOrder: isSideOrder(o.sideOrder)
      ? o.sideOrder
      : DEFAULT_SETTINGS.sideOrder,
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

/** How wide a column becomes if its divider is dragged to `clientX`. Both dividers drive the same
 *  width, so mirroring comes down to the sign of the delta: the left column's edge is on its right
 *  and the right column's on its left. */
export function dragWidth(
  startWidth: number,
  startX: number,
  clientX: number,
  side: SideEdge,
): number {
  const delta = side === "right" ? startX - clientX : clientX - startX;
  return startWidth + delta;
}

/** Turn "where the divider would land" into an instruction. The expand threshold is deliberately
 *  above the collapse one: with one shared boundary a pointer resting on it flips on every pixel of
 *  jitter. `collapsed` is read live rather than frozen at pointerdown, so one drag can shut the
 *  columns and reopen them on the way out. */
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
