/** Who to call to put the caret in a side panel's search box. A registry rather than a chain of
 *  template refs: the three shapes arrange the panels three different ways, and none of them should
 *  have to know that a panel has a search box, let alone reach through a slot to find it. */
import { nextTick } from "vue";
import type { SidePaneId } from "@/core/panels";

const focuses = new Map<SidePaneId, () => void>();

/** Called by a panel while it is being set up. Returns the way to withdraw it. */
export function registerPanelSearch(
  panel: SidePaneId,
  focus: () => void,
): () => void {
  focuses.set(panel, focus);
  return () => {
    // Guarded: a remount registers before the outgoing instance lets go.
    if (focuses.get(panel) === focus) focuses.delete(panel);
  };
}

/**
 * Put the caret in `panel`'s search box.
 *
 * Awaits a tick first, because the caller has usually just revealed the panel in the same breath: a
 * retracted docked column is `display: none` and a hover layer is `visibility: hidden` until the
 * class lands, and neither of those can take focus.
 */
export async function focusPanelSearch(panel: SidePaneId): Promise<void> {
  await nextTick();
  focuses.get(panel)?.();
}
