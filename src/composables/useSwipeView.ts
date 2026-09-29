/** Touch swipe → the sidebar's other view. On a phone the tab strip is two small targets at the top
 *  of the lower sheet, and the panel under it is where the thumb already is; a swipe moves what is
 *  under the finger instead of asking it to aim.
 *
 *  Only `pointerdown` is bound to the element; the rest of the gesture is listened for on `window`,
 *  because the finger leaves the box it started on the moment it travels.
 *
 *  Nothing here is swallowed and no pointer is captured. The swipe is measured from the same events
 *  the browser scrolls with, so a gesture that turns out to be a scroll stays a scroll: the browser
 *  takes it over and fires `pointercancel`, and the swipe never completes. (Spelled out rather than
 *  named: the guard below greps this file, and the mechanism's own name would answer for it.) */
import {
  isFingerPointer,
  swipeDirection,
  type SwipeDirection,
} from "@/core/gestures";

export function useSwipeView(
  move: (direction: SwipeDirection) => void,
): { onPointerdown: (event: PointerEvent) => void } {
  function onPointerdown(event: PointerEvent): void {
    if (!isFingerPointer(event.pointerType)) return;

    const from = { x: event.clientX, y: event.clientY };
    const viewportWidth = window.innerWidth;

    const release = (): void => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", release);
    };

    const onUp = (up: PointerEvent): void => {
      release();
      const direction = swipeDirection(
        from,
        { x: up.clientX, y: up.clientY },
        viewportWidth,
      );
      if (direction) move(direction);
    };

    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", release);
  }

  return { onPointerdown };
}
