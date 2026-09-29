/**
 * Touch gestures, as pure functions: which pointers are ours at all, and what the finger did —
 * held still, scrolled away, or travelled sideways.
 */

/** Chrome's own long press is 500ms. */
export const LONG_PRESS_MS = 500;

/** How far the finger may drift and still count as a press. A scroll view starts
 *  moving within a couple of pixels, so this sits above "the finger twitched" and
 *  below "this is a scroll". */
export const PRESS_SLOP = 10;

/** How far a swipe has to travel. Well above `PRESS_SLOP` on purpose: a thumb settling onto a row
 *  is not a swipe, and a threshold that low would make the panels twitch under the finger. */
export const SWIPE_MIN_X = 48;

/** The vertical drift a swipe may carry. Past this the finger was scrolling the list, and a scroll
 *  is the one thing a swipe must never win against. */
export const SWIPE_MAX_Y = 40;

/** The strip along each screen edge belongs to the browser: Chromium's own edge swipe is
 *  back/forward, and a tab switch fighting it loses to the browser anyway. */
export const SWIPE_EDGE = 24;

/** A mouse and a pen both have a right button, and a right-click already opens the menu — only a
 *  finger needs the stand-in. The same answer covers the swipe: a mouse drag is how the tree's
 *  adapter moves a row, and how text gets selected. */
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

/** The way the finger went. "left" is the finger moving left, so the panel that arrives is the one
 *  that was off the right-hand edge. */
export type SwipeDirection = "left" | "right";

/**
 * Whether a gesture was a swipe, and which way — from where it started and where it ended.
 *
 * `null` covers the three ways it is not one: it began in the browser's edge strip, it did not
 * travel, or it went further up or down than sideways, which makes it a scroll. All three are read
 * off the two points rather than off events, so the answer holds however the gesture was delivered.
 */
export function swipeDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  viewportWidth: number,
): SwipeDirection | null {
  if (from.x < SWIPE_EDGE || from.x > viewportWidth - SWIPE_EDGE) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < SWIPE_MIN_X) return null;
  if (Math.abs(dy) > SWIPE_MAX_Y || Math.abs(dy) > Math.abs(dx)) return null;
  return dx < 0 ? "left" : "right";
}

/**
 * Where a swipe lands in a row of `count` positions, or `null` if there is nothing that way. The
 * ends hold rather than wrap: there is no panel past either one, and wrapping would send the thumb
 * across the whole strip for a single flick.
 */
export function swipedIndex(
  current: number,
  direction: SwipeDirection,
  count: number,
): number | null {
  const next = current + (direction === "left" ? 1 : -1);
  return next < 0 || next >= count ? null : next;
}
