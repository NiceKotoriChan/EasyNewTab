<script setup lang="ts">
// Hover: the sides are not in the strip at all — they are layers floating over the centre, one fixed
// width each because a layer covers content instead of displacing it. See `OverlayPanel` for the
// band that reveals one, and the pin that holds it.
import { ref, useTemplateRef } from "vue";
import OverlayPanel from "./OverlayPanel.vue";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { OVERLAY_WIDTH, type SideEdge } from "@/core/settings";
import type { ShellHandle, SidePaneId } from "@/core/panels";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();

const LABELS: Record<SidePaneId, string> = {
  bookmarks: "Bookmarks",
  history: "History",
};

/** Which overlay the keyboard pinned open. Transient on purpose: a reload should not open a panel. */
const pinned = ref<SideEdge | null>(null);

const welcome = useTemplateRef<InstanceType<typeof WelcomePane>>("welcome");

const edgeOf = (panel: SidePaneId): SideEdge =>
  panel === props.left ? "left" : "right";

defineExpose<ShellHandle>({
  focusPanel: (panel) => {
    // Pinning is what makes the layer visible, and a hidden layer cannot take focus — the caret
    // lands on the tick after this.
    pinned.value = edgeOf(panel);
    void focusPanelSearch(panel);
  },
  toggle: () => {
    pinned.value = null;
  },
  focusSearch: () => welcome.value?.focus(),
});
</script>

<template>
  <div class="stage">
    <div class="track is-hover">
      <div class="pane is-centre" data-panel="search">
        <WelcomePane ref="welcome" />
      </div>
    </div>

    <OverlayPanel
      side="left"
      :width="OVERLAY_WIDTH"
      :label="LABELS[props.left]"
      :pinned="pinned === 'left'"
      @close="pinned = null"
    >
      <PanelView :panel="props.left" />
    </OverlayPanel>
    <OverlayPanel
      side="right"
      :width="OVERLAY_WIDTH"
      :label="LABELS[props.right]"
      :pinned="pinned === 'right'"
      @close="pinned = null"
    >
      <PanelView :panel="props.right" />
    </OverlayPanel>
  </div>
</template>
