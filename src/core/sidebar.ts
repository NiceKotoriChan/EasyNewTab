/**
 * Sidebar drag geometry — the part worth testing without a browser.
 *
 * Collapsing is no longer a button, it is the continuation of a resize: the
 * divider follows the pointer, and once the sidebar *would* be narrower than
 * `SIDEBAR_COLLAPSE_AT` it snaps shut. Dragging back out past the sidebar's
 * minimum width brings it back.
 *
 * The two thresholds are deliberately different. With one shared boundary a
 * pointer resting exactly on it flips state on every pixel of jitter, so the
 * dead band between "too narrow to use" and "wide enough to come back" is what
 * makes the gesture feel stable.
 */

import { SIDEBAR_MAX, SIDEBAR_MIN, type SidebarPosition } from "./settings.ts";

/**
 * How narrow the sidebar has to get before the drag shuts it. Well below
 * `SIDEBAR_MIN`, so closing it takes real intent rather than one stray pixel.
 */
export const SIDEBAR_COLLAPSE_AT = 110;

export type SidebarDrag =
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
 * The divider always sits on the sidebar's *inner* edge — its right side when
 * docked left, its left side when docked right — so "pull the divider toward
 * the edge the sidebar is docked to" is a leftward drag in the first case and
 * a rightward one in the second. Mirroring therefore comes down to the sign of
 * the delta, which is why this is a pure function and not a branch inside the
 * pointer handler.
 *
 * While collapsed the divider hugs the docked edge and describes a width of
 * zero, so the same arithmetic works from either state.
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
 * `collapsed` is read live rather than frozen at pointerdown, so one drag can
 * close the sidebar on the way in and reopen it on the way out — which is how
 * the gesture reads to anyone performing it.
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
