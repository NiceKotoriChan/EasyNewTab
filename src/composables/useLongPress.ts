/** Touch long press → the anchor a context menu opens from. Every menu is opened by
 *  a right-click and a touchscreen has no right button, so each list gets a second
 *  way in.
 *
 *  Only `pointerdown` is bound to the element; the rest of the gesture is listened
 *  for on `window`, because the finger routinely leaves the row it started on (a
 *  scroll does it immediately) and a per-element listener would lose it at exactly
 *  that moment.
 *
 *  Two events have to be swallowed or the press produces a second, wrong action:
 *  Chromium's own `contextmenu` on a touch long press, and the `click` the finger
 *  coming up produces — on a bookmark row that means "open this bookmark". The caller
 *  gets coordinates rather than an event, because at the moment the menu opens there
 *  is no mouse event, and the question that matters is "what was under the finger". */
import {
  isLongPressPointer,
  LONG_PRESS_MS,
  movedBeyondSlop,
} from "@/core/gestures";

/** How long a click stays unwelcome after the menu opened, in case none comes. */
const CLICK_GUARD_MS = 700;

export function useLongPress(
  open: (x: number, y: number) => void,
): { onPointerdown: (event: PointerEvent) => void } {
  function onPointerdown(event: PointerEvent): void {
    if (!isLongPressPointer(event.pointerType)) return;
    // A press on a text field belongs to the platform: on a touchscreen it is
    // how Paste is reached, which is also why the shell leaves the browser's own
    // menu alone there. The lists that host this have a search box inside them.
    if ((event.target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]")) {
      return;
    }

    const from = { x: event.clientX, y: event.clientY };
    let settled = false;

    // Armed for the whole gesture rather than only until the menu opens: the
    // platform's long-press menu arrives around the same moment, and it is the
    // *second* one that would double up.
    const swallowContextMenu = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    const swallowClick = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e: PointerEvent): void => {
      if (movedBeyondSlop(from, { x: e.clientX, y: e.clientY })) cancel();
    };

    /** The finger left, or wandered: nothing this press started should survive. */
    const cancel = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release();
      window.removeEventListener("contextmenu", swallowContextMenu, true);
    };

    const release = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      release();
      window.addEventListener("click", swallowClick, {
        capture: true,
        once: true,
      });
      window.setTimeout(() => {
        window.removeEventListener("click", swallowClick, true);
        window.removeEventListener("contextmenu", swallowContextMenu, true);
      }, CLICK_GUARD_MS);
      open(from.x, from.y);
    }, LONG_PRESS_MS);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("contextmenu", swallowContextMenu, true);
  }

  return { onPointerdown };
}
