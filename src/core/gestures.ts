/**
 * The gesture decisions that are ours. The *detection* is not one of them: a swipe's threshold and
 * axis lock belong to `usePointerSwipe` (VueUse), and a long press's timing is the platform's.
 *
 * What is left here is the two things no library can know — whether a gesture belongs to us at all,
 * and where it lands.
 */

/** Chrome's own long press is 500ms. */
export const LONG_PRESS_MS = 500;

/** How far the finger may drift and still count as a press. A scroll view starts
 *  moving within a couple of pixels, so this sits above "the finger twitched" and
 *  below "this is a scroll". */
export const PRESS_SLOP = 10;

/** The strip along each screen edge belongs to the browser: Android's system back gesture and
 *  Chromium's own edge swipe both live there, and a panel switch that fights either one loses — the
 *  page would move *and* navigate. */
export const SWIPE_EDGE = 24;

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

/**
 * Whether a gesture that started at `x` began in a strip the browser owns.
 *
 * Read from where the finger *started*, because that is what the browser judges: a drag that begins
 * outside the strip stays ours all the way across, and one that begins inside it is the browser's
 * even if it then travels far.
 */
export function startedInBrowserEdge(x: number, viewportWidth: number): boolean {
  return x < SWIPE_EDGE || x > viewportWidth - SWIPE_EDGE;
}

/** The way the finger went. "left" is the finger moving left, so the panel that arrives is the one
 *  that was off the right-hand edge. */
export type SwipeDirection = "left" | "right";

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
