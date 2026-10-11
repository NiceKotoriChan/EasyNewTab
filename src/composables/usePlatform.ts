import { ref, type Ref } from "vue";

const COMPACT_QUERY = "(max-width: 720px)";
const TOUCH_QUERY = "(pointer: coarse)";

const isCompact = ref(false);
const isTouch = ref(false);

let wired = false;

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
