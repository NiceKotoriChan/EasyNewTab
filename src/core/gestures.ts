/**
 * The two decisions a touch long press makes, as pure functions.
 *
 * They are here rather than inline in `useLongPress` because both are the
 * difference between a menu that opens when it was asked for and one that opens
 * while the list is being scrolled: `isLongPressPointer` decides whether a press
 * is ours at all, and `movedBeyondSlop` decides whether the finger has already
 * left the press behind.
 */

/** How long a finger has to rest before the press counts. Chrome's own is 500ms. */
export const LONG_PRESS_MS = 500;

/**
 * How far the finger may drift and still be a press. A scroll view starts moving
 * on a couple of pixels, so this is well above "the finger twitched" and well
 * below "this is a scroll" — the band where the two are genuinely ambiguous is
 * where the menu is easier to dismiss than to live with.
 */
export const PRESS_SLOP = 10;

/**
 * A mouse and a pen both have a right button, and a right-click already opens
 * the menu. Only a finger needs the stand-in.
 *
 * This is also what keeps a long press from fighting the tree's drag: the drag
 * adapter is mouse-driven, so arming a press for touch and nothing else leaves
 * the two gestures on separate inputs.
 */
export function isLongPressPointer(pointerType: string): boolean {
  return pointerType === "touch";
}

/** Whether the pointer has travelled far enough to stop being a press. */
export function movedBeyondSlop(
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  return (
    Math.abs(to.x - from.x) > PRESS_SLOP || Math.abs(to.y - from.y) > PRESS_SLOP
  );
}
