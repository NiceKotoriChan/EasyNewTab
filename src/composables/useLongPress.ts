import {
  isFingerPointer,
  LONG_PRESS_MS,
  movedBeyondSlop,
} from "@/core/gestures";

const CLICK_GUARD_MS = 700;

export function useLongPress(
  open: (x: number, y: number) => void,
): { onPointerdown: (event: PointerEvent) => void } {
  function onPointerdown(event: PointerEvent): void {
    if (!isFingerPointer(event.pointerType)) return;
    if ((event.target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]")) {
      return;
    }

    const from = { x: event.clientX, y: event.clientY };
    let settled = false;

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
