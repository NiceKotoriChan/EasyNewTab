/** Sidebar geometry: width + collapsed flag, persisted to `storage.local` — the width of
 *  a window should not follow the profile to another machine.
 *
 *  There is no collapse button: dragging the divider shut *is* the gesture, so this drag
 *  handler is also the collapse handler. */
import { ref, type Ref } from "vue";
import { useSettings } from "@/composables/useSettings";
import {
  clampSidebarWidth,
  dragWidth,
  normalizeLayout,
  resolveSidebarDrag,
  SIDEBAR_DEFAULT,
  type LayoutState,
} from "@/core/settings";
import { debounce } from "@/core/utils";

async function loadLayout(): Promise<LayoutState> {
  const { layout } = await chrome.storage.local.get("layout");
  return normalizeLayout(layout);
}

async function saveLayout(patch: Partial<LayoutState>): Promise<void> {
  const next = normalizeLayout({ ...(await loadLayout()), ...patch });
  await chrome.storage.local.set({ layout: next });
}

const width = ref(SIDEBAR_DEFAULT);
const collapsed = ref(false);
let bootstrapped = false;

const persistWidth = debounce((value: number) => {
  void saveLayout({ sidebarWidth: value });
}, 200);

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void loadLayout()
    .then((layout) => {
      width.value = layout.sidebarWidth;
      collapsed.value = layout.sidebarCollapsed;
    })
    .catch((err) => console.warn("Failed to load layout:", err));
}

export function useSidebar(): {
  width: Ref<number>;
  collapsed: Ref<boolean>;
  toggle(): void;
  setWidth(value: number): void;
  startResize(event: PointerEvent): void;
} {
  bootstrap();
  const { settings } = useSettings();

  function setWidth(value: number): void {
    width.value = clampSidebarWidth(value);
    persistWidth(width.value);
  }

  function toggle(): void {
    collapsed.value = !collapsed.value;
    void saveLayout({ sidebarCollapsed: collapsed.value });
  }

  function startResize(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    // Collapsed, the divider hugs the window edge, so the width it describes
    // starts at zero and the drag is measured from where the pointer went down.
    const startWidth = collapsed.value ? 0 : width.value;
    // Read once, at pointerdown: the docking side cannot change mid-drag.
    const position = settings.value.sidebarPosition;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const drag = resolveSidebarDrag(
        dragWidth(startWidth, startX, e.clientX, position),
        collapsed.value,
      );
      if (drag.kind === "collapse") {
        collapsed.value = true;
        return;
      }
      if (drag.kind === "idle") return;
      collapsed.value = false;
      width.value = drag.width;
    };

    // The listeners live on the handle, and the handle therefore has to outlive
    // the state change it causes: a divider that unmounted when the sidebar
    // collapsed would take its own listeners with it, leaving the drag stuck.
    // `Sash.vue` is rendered unconditionally for exactly this reason.
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      target.releasePointerCapture?.(event.pointerId);
      void saveLayout({
        sidebarWidth: width.value,
        sidebarCollapsed: collapsed.value,
      });
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return { width, collapsed, toggle, setWidth, startResize };
}

/** Persist the active panel without spinning up the whole geometry store. */
export function persistActiveView(view: LayoutState["activeView"]): void {
  void saveLayout({ activeView: view });
}

export function loadActiveView(): Promise<LayoutState> {
  return loadLayout();
}
