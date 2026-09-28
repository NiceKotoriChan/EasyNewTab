/**
 * The two decisions a touch long press makes, as pure functions: whether the
 * press is ours at all, and whether the finger has already left it behind.
 */

/** Chrome's own long press is 500ms. */
export const LONG_PRESS_MS = 500;

/** How far the finger may drift and still count as a press. A scroll view starts
 *  moving within a couple of pixels, so this sits above "the finger twitched" and
 *  below "this is a scroll". */
export const PRESS_SLOP = 10;

/** A mouse and a pen both have a right button, and a right-click already opens the
 *  menu — only a finger needs the stand-in. This also keeps a long press from
 *  fighting the tree's drag, which arrives on the mouse. */
export function isLongPressPointer(pointerType: string): boolean {
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
