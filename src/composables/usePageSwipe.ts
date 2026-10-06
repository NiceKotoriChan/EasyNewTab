import { ref, type MaybeRefOrGetter, type Ref } from "vue";
import { usePointerSwipe, useSwipe, type UseSwipeDirection } from "@vueuse/core";
import { startedInBrowserEdge, swipedSlot } from "@/core/gestures";

const SWIPE_THRESHOLD = 48;

type SwipeTarget = MaybeRefOrGetter<HTMLElement | null | undefined>;

/** Keep page navigation independent from the shell that renders the pages. */
export function usePageSwipe(
  target: SwipeTarget,
  count: number,
  initial: number,
): { slot: Ref<number> } {
  const slot = ref(initial);
  let startX = 0;

  function move(direction: UseSwipeDirection): void {
    if (direction !== "left" && direction !== "right") return;
    if (startedInBrowserEdge(startX, window.innerWidth)) return;

    const next = swipedSlot(slot.value, direction, count);
    if (next !== null) slot.value = next;
  }

  // Touch events are the reliable path on mobile browsers. Preventing the browser's
  // horizontal gesture only after the axis is known keeps vertical panel scrolling intact.
  useSwipe(target, {
    threshold: SWIPE_THRESHOLD,
    passive: false,
    onSwipeStart: (event) => {
      startX = event.touches[0]?.clientX ?? 0;
    },
    onSwipeEnd: (_event, direction) => move(direction),
  });

  // Keep mouse/pen dragging for narrow desktop windows, but exclude touch so one finger cannot
  // complete the same page change twice through the two browser event models.
  usePointerSwipe(target, {
    threshold: SWIPE_THRESHOLD,
    disableTextSelect: true,
    pointerTypes: ["mouse", "pen"],
    onSwipeStart: (event) => {
      startX = event.clientX;
    },
    onSwipeEnd: (_event, direction) => move(direction),
  });

  return { slot };
}
