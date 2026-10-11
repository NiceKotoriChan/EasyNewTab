import { DEFAULT_ENGINE_ID, isEngineId, type EngineId } from "./engines.ts";
import type { SideOrder } from "./panels.ts";

export type SideEdge = "left" | "right";

function isSideOrder(value: unknown): value is SideOrder {
  return value === "bookmarks-left" || value === "history-left";
}

export interface Settings {
  searchEngine: EngineId;
  openBookmarksInNewTab: boolean;
  openSearchInNewTab: boolean;
  openHistoryInNewTab: boolean;
  openTopSitesInNewTab: boolean;
  showOtherBookmarks: boolean;
  historyLimit: number;
  sideOrder: SideOrder;
}

export type SideWidths = Record<SideEdge, number>;

export type SideCollapsed = Record<SideEdge, boolean>;

export interface LayoutState {
  sidebarWidth: SideWidths;
  sidebarCollapsed: SideCollapsed;
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 260;

const SIDEBAR_COLLAPSE_AT = 110;

export const HISTORY_LIMIT_MIN = 50;
export const HISTORY_LIMIT_MAX = 1000;

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: DEFAULT_ENGINE_ID,
  openBookmarksInNewTab: true,
  openSearchInNewTab: true,
  openHistoryInNewTab: true,
  openTopSitesInNewTab: true,
  showOtherBookmarks: true,
  historyLimit: 100,
  sideOrder: "bookmarks-left",
};

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeSettings(raw: unknown): Settings {
  const o = (raw ?? {}) as Record<string, unknown>;
  const legacy = typeof o.openInNewTab === "boolean" ? o.openInNewTab : undefined;
  return {
    searchEngine: isEngineId(o.searchEngine)
      ? (o.searchEngine as EngineId)
      : DEFAULT_SETTINGS.searchEngine,
    openBookmarksInNewTab: readBool(
      o.openBookmarksInNewTab,
      legacy ?? DEFAULT_SETTINGS.openBookmarksInNewTab,
    ),
    openSearchInNewTab: readBool(
      o.openSearchInNewTab,
      legacy ?? DEFAULT_SETTINGS.openSearchInNewTab,
    ),
    openHistoryInNewTab: readBool(
      o.openHistoryInNewTab,
      legacy ?? DEFAULT_SETTINGS.openHistoryInNewTab,
    ),
    openTopSitesInNewTab: readBool(
      o.openTopSitesInNewTab,
      legacy ?? DEFAULT_SETTINGS.openTopSitesInNewTab,
    ),
    showOtherBookmarks: readBool(o.showOtherBookmarks, DEFAULT_SETTINGS.showOtherBookmarks),
    historyLimit: clampInt(
      o.historyLimit,
      HISTORY_LIMIT_MIN,
      HISTORY_LIMIT_MAX,
      DEFAULT_SETTINGS.historyLimit,
    ),
    sideOrder: isSideOrder(o.sideOrder)
      ? o.sideOrder
      : DEFAULT_SETTINGS.sideOrder,
  };
}

function readWidth(raw: unknown, side: SideEdge, fallback: number): number {
  if (typeof raw === "number") {
    return clampInt(raw, SIDEBAR_MIN, SIDEBAR_MAX, fallback);
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  return clampInt(o[side], SIDEBAR_MIN, SIDEBAR_MAX, fallback);
}

function readCollapsed(raw: unknown, side: SideEdge, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  const o = (raw ?? {}) as Record<string, unknown>;
  return typeof o[side] === "boolean" ? (o[side] as boolean) : fallback;
}

export function normalizeLayout(raw: unknown): LayoutState {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    sidebarWidth: {
      left: readWidth(o.sidebarWidth, "left", SIDEBAR_DEFAULT),
      right: readWidth(o.sidebarWidth, "right", SIDEBAR_DEFAULT),
    },
    sidebarCollapsed: {
      left: readCollapsed(o.sidebarCollapsed, "left", false),
      right: readCollapsed(o.sidebarCollapsed, "right", false),
    },
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

export function dragWidth(
  startWidth: number,
  startX: number,
  clientX: number,
  side: SideEdge,
): number {
  const delta = side === "right" ? startX - clientX : clientX - startX;
  return startWidth + delta;
}

export function resolveSidebarDrag(
  pointerWidth: number,
  collapsed: boolean,
): SidebarDrag {
  if (collapsed) {
    return pointerWidth >= SIDEBAR_MIN
      ? { kind: "expand", width: clampSidebarWidth(pointerWidth) }
      : { kind: "idle" };
  }
  if (pointerWidth < SIDEBAR_COLLAPSE_AT) return { kind: "collapse" };
  return { kind: "resize", width: clampSidebarWidth(pointerWidth) };
}
