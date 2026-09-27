/**
 * The two axes the app adapts on, and why they are two rather than one.
 *
 * `isCompact` answers "is there room?". The new tab page is two sheets side by
 * side, and below about 720px the sidebar's 260px leaves the search box too
 * little to go on being the page's centrepiece, so the shell stacks them
 * instead. This is a fact about the *window*: a narrow desktop window gets it
 * too, which is correct, because the reason is room and not the device.
 *
 * `isTouch` answers "what can the input do?". A coarse pointer has no right
 * button, so the context menus need a long press to reach them, and it has no
 * hardware keyboard, so a list of bare-key bindings documents nothing. A
 * touchscreen laptop still has its mouse and its keyboard, so it gets neither —
 * which is exactly why this cannot be folded into `isCompact`.
 *
 * 720 is the boundary for *the shell* — whether two sheets fit side by side.
 * Everything about touch that only CSS has to know is asked in CSS instead
 * (`@media (pointer: coarse)` in `tokens.css`, `ContextMenu`, `ConfirmDialog`);
 * the two components carrying a width breakpoint of their own (`SidePanel` hides
 * its tab labels below 640, `EngineSwitcher` its engine names) are answering a
 * narrower question, whether their own contents fit, and are left where they
 * were. This module is for the two things JavaScript has to decide: which menu
 * to build, and whether the browser's own context menu is allowed through.
 */
import { ref, type Ref } from "vue";

const COMPACT_QUERY = "(max-width: 720px)";
const TOUCH_QUERY = "(pointer: coarse)";

const isCompact = ref(false);
const isTouch = ref(false);

let wired = false;

/**
 * Read both queries, then follow them for the life of the page.
 *
 * Synchronous on purpose: it runs during the first `setup`, before the first
 * paint, so a phone never sees a frame of the desktop shell. Under server-side
 * rendering there is no `window` and both flags stay at their initial `false` —
 * the desktop markup is what gets rendered, which is also what
 * `scripts/render-check.mjs` asserts against.
 *
 * The listeners are never removed. There is exactly one page and one pair of
 * queries; tying them to a component's lifetime would only mean the first
 * component to unmount switched the app back to desktop.
 */
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
