export const LONG_PRESS_MS = 500;

const PRESS_SLOP = 10;

const SWIPE_EDGE = 24;

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

export function startedInBrowserEdge(x: number, viewportWidth: number): boolean {
  return x < SWIPE_EDGE || x > viewportWidth - SWIPE_EDGE;
}

type SwipeDirection = "left" | "right";

export function swipedSlot(
  current: number,
  direction: SwipeDirection,
  count: number,
): number | null {
  const next = current + (direction === "left" ? 1 : -1);
  return next < 0 || next >= count ? null : next;
}
