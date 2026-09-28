/**
 * The two axes the app adapts on, deliberately kept separate:
 *
 * - `isCompact` (≤720px) — is there room? Two panes stop fitting side by side, so the shell stacks
 *   them. A fact about the *window*: a narrow desktop window gets it too.
 * - `isTouch` (coarse pointer) — what can the input do? No right button (so menus need a long
 *   press) and no hardware keyboard. A touchscreen laptop has both a mouse and a keyboard, so it
 *   gets neither.
 *
 * Merging them would make one of the two devices wrong. The two components with a width breakpoint
 * of their own (`SidePanel` below 640, `EngineSwitcher` its engine names) answer whether *their own*
 * contents fit and are left alone.
 */
import { ref, type Ref } from "vue";

const COMPACT_QUERY = "(max-width: 720px)";
const TOUCH_QUERY = "(pointer: coarse)";

const isCompact = ref(false);
const isTouch = ref(false);

let wired = false;

// Synchronous on first setup (a phone never sees a desktop frame; under SSR there's no
// window so both stay false). Listeners are never removed: one page, one pair of queries.
function wire(): void {
  if (wired) return;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }
  wired = true;
  const queries: Array<[string, Ref<boolean>]> = [
    [COMPACT_QUERY, isCompact],
    [TOUCH_QUERY, isTouch],
  ];
  for (const [query, flag] of queries) {
    const list = window.matchMedia(query);
    flag.value = list.matches;
    list.addEventListener("change", (event) => {
      flag.value = event.matches;
    });
  }
}

export function usePlatform(): {
  isCompact: Ref<boolean>;
  isTouch: Ref<boolean>;
} {
  wire();
  return { isCompact, isTouch };
}
