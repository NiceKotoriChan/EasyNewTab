/**
 * The gesture decisions that are ours. Detection is not one of them: a swipe's threshold
 * and axis lock belong to `usePointerSwipe` (VueUse), a long press's timing to the platform.
 * What is left is the two things no library can know — whether a gesture belongs to us at
 * all, and where it lands.
 */

import type { SideEdge } from "./settings.ts";

/** Chrome's own long press is 500ms. */
export const LONG_PRESS_MS = 500;

/** How far the finger may drift and still count as a press. A scroll view starts
 *  moving within a couple of pixels, so this sits above "the finger twitched" and
 *  below "this is a scroll". */
const PRESS_SLOP = 10;

/** The strip along each screen edge belongs to the browser: Android's system back gesture and
 *  Chromium's own edge swipe both live there, and a panel switch that fights either one loses — the
 *  page would move *and* navigate. */
const SWIPE_EDGE = 24;

/** A mouse and a pen both have a right button, and a right-click already opens the menu — only a
 *  finger needs the stand-in. The swipe deliberately does not ask this: it takes a primary-button
 *  drag from any pointer, so a mouse can move the panels too. */
export function isFingerPointer(pointerType: string): boolean {
  return pointerType === "touch";
}

export function movedBeyondSlop(
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  return (
    Math.abs(to.x - from.x) > PRESS_SLOP || Math.abs(to.y - from.y) > PRESS_SLOP
  );
}

/** Read from where the gesture *started*, because that is what the browser judges: a drag that
 *  begins outside the strip stays ours all the way across, and one that begins inside it is the
 *  browser's even if it then travels far. */
export function startedInBrowserEdge(x: number, viewportWidth: number): boolean {
  return x < SWIPE_EDGE || x > viewportWidth - SWIPE_EDGE;
}

/** Whether a pointer at `x` is inside the band that reveals a side panel: `width` in from `side`.
 *  Not the same question as `startedInBrowserEdge` — that strip belongs to the browser, this band
 *  is ours, and the two numbers are unrelated on purpose. */
export function inSideBand(
  x: number,
  viewportWidth: number,
  width: number,
  side: SideEdge,
): boolean {
  return side === "left" ? x <= width : x >= viewportWidth - width;
}

/** The way the finger went: "left" is the finger moving left, so the slot that answers is the one
 *  docked on the left — and the setting decides which panel that is. */
type SwipeDirection = "left" | "right";

/** Where a swipe lands in a strip of `count` slots, or `null` if there is nothing that way. The
 *  finger asks for the *side* it travelled toward, so swapping the two panels over swaps the swipe
 *  with them and the gesture is never re-learned. The ends hold rather than wrap. */
export function swipedSlot(
  current: number,
  direction: SwipeDirection,
  count: number,
): number | null {
  const next = current + (direction === "left" ? -1 : 1);
  return next < 0 || next >= count ? null : next;
}
