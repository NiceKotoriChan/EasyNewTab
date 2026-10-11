import { nextTick } from "vue";
import type { SidePaneId } from "@/core/panels";

const focuses = new Map<SidePaneId, () => void>();

export function registerPanelSearch(
  panel: SidePaneId,
  focus: () => void,
): () => void {
  focuses.set(panel, focus);
  return () => {
    if (focuses.get(panel) === focus) focuses.delete(panel);
  };
}

export async function focusPanelSearch(panel: SidePaneId): Promise<void> {
  await nextTick();
  focuses.get(panel)?.();
}
