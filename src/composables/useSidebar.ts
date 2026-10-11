import { computed, ref, type ComputedRef, type Ref } from "vue";
import {
  normalizeLayout,
  percentToPx,
  pxToPercent,
  resolveSidebarDrag,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
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

interface PaneSizes {
  left: number;
  centre: number;
  right: number;
}

export function useSidebar(baseWidth: Ref<number>): {
  collapsed: Ref<SideCollapsed>;
  paneSizes: ComputedRef<PaneSizes>;
  paneMax: ComputedRef<number>;
  toggle(): void;
  expand(side: SideEdge): void;
  applyResize(side: SideEdge, percent: number): void;
} {
  bootstrap();

  const base = computed(() => baseWidth.value || 1);

  const paneMax = computed(() =>
    Math.min(100, pxToPercent(SIDEBAR_MAX, base.value)),
  );

  const paneSizes = computed<PaneSizes>(() => {
    const left = collapsed.value.left
      ? 0
      : pxToPercent(widths.value.left, base.value);
    const right = collapsed.value.right
      ? 0
      : pxToPercent(widths.value.right, base.value);
    return {
      left,
      centre: Math.max(0, 100 - left - right),
      right,
    };
  });

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

  function applyResize(side: SideEdge, percent: number): void {
    const drag = resolveSidebarDrag(
      percentToPx(percent, base.value),
      collapsed.value[side],
    );
    if (drag.kind === "collapse") {
      setCollapsed(side, true);
    } else {
      setCollapsed(side, false);
      widths.value = { ...widths.value, [side]: drag.width };
    }
    void saveLayout({
      sidebarWidth: widths.value,
      sidebarCollapsed: collapsed.value,
    });
  }

  return { collapsed, paneSizes, paneMax, toggle, expand, applyResize };
}
