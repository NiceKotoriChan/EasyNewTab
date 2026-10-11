import { ref, type Ref } from "vue";
import {
  dragWidth,
  normalizeLayout,
  resolveSidebarDrag,
  SIDEBAR_DEFAULT,
  type LayoutState,
  type SideCollapsed,
  type SideEdge,
  type SideWidths,
} from "@/core/settings";

async function loadLayout(): Promise<LayoutState> {
  const { layout } = await chrome.storage.local.get("layout");
  return normalizeLayout(layout);
}

async function saveLayout(patch: Partial<LayoutState>): Promise<void> {
  const next = normalizeLayout({ ...(await loadLayout()), ...patch });
  await chrome.storage.local.set({ layout: next });
}

const widths = ref<SideWidths>({
  left: SIDEBAR_DEFAULT,
  right: SIDEBAR_DEFAULT,
});
const collapsed = ref<SideCollapsed>({ left: false, right: false });
const resizing = ref<SideEdge | null>(null);
let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void loadLayout()
    .then((layout) => {
      widths.value = layout.sidebarWidth;
      collapsed.value = layout.sidebarCollapsed;
    })
    .catch((err) => console.warn("Failed to load layout:", err));
}

export function useSidebar(): {
  widths: Ref<SideWidths>;
  collapsed: Ref<SideCollapsed>;
  resizing: Ref<SideEdge | null>;
  toggle(): void;
  expand(side: SideEdge): void;
  startResize(event: PointerEvent, side: SideEdge): void;
} {
  bootstrap();

  function setCollapsed(side: SideEdge, value: boolean): void {
    collapsed.value = { ...collapsed.value, [side]: value };
  }

  function toggle(): void {
    const bothVisible = !collapsed.value.left && !collapsed.value.right;
    collapsed.value = { left: bothVisible, right: bothVisible };
    void saveLayout({ sidebarCollapsed: collapsed.value });
  }

  function expand(side: SideEdge): void {
    if (!collapsed.value[side]) return;
    setCollapsed(side, false);
    void saveLayout({ sidebarCollapsed: collapsed.value });
  }

  function startResize(event: PointerEvent, side: SideEdge): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = collapsed.value[side] ? 0 : widths.value[side];
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    resizing.value = side;
    document.body.classList.add("is-resizing");

    const onMove = (e: PointerEvent) => {
      const drag = resolveSidebarDrag(
        dragWidth(startWidth, startX, e.clientX, side),
        collapsed.value[side],
      );
      if (drag.kind === "collapse") {
        setCollapsed(side, true);
        return;
      }
      if (drag.kind === "idle") return;
      setCollapsed(side, false);
      widths.value = { ...widths.value, [side]: drag.width };
    };

    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      target.releasePointerCapture?.(event.pointerId);
      resizing.value = null;
      document.body.classList.remove("is-resizing");
      void saveLayout({
        sidebarWidth: widths.value,
        sidebarCollapsed: collapsed.value,
      });
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return { widths, collapsed, resizing, toggle, expand, startResize };
}
