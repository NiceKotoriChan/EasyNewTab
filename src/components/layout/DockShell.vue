<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useElementSize } from "@vueuse/core";
import {
  Pane,
  Splitpanes,
  type SplitpanesResizePayload,
  type SplitpanesResizedPayload,
} from "splitpanes";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { useSidebar } from "@/composables/useSidebar";
import type { ShellHandle, SidePaneId } from "@/core/panels";
import type { SideEdge } from "@/core/settings";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();

const track = useTemplateRef<HTMLElement>("track");
const { width: trackWidth } = useElementSize(track);

const { collapsed, paneSizes, paneMax, toggle, expand, applyResize } =
  useSidebar(trackWidth);

const SPLITTER_SIDES = ["left", "right"] as const;
const SIDE_PANES = { left: 0, right: 2 } as const;

const dragging = ref<SideEdge | null>(null);

function sideAt(index: number | undefined): SideEdge | undefined {
  return index === 0 || index === 1 ? SPLITTER_SIDES[index] : undefined;
}

function onResize(payload: SplitpanesResizePayload): void {
  dragging.value = sideAt(payload.index) ?? null;
}

function onResized(payload: SplitpanesResizedPayload): void {
  const side = sideAt(payload.index);
  dragging.value = null;
  if (side === undefined) return;
  applyResize(side, payload.panes[SIDE_PANES[side]]?.size ?? 0);
}

function sideVisible(side: SideEdge): boolean {
  return !collapsed.value[side] || dragging.value === side;
}

function sideOf(panel: SidePaneId): SideEdge {
  return props.left === panel ? "left" : "right";
}

const welcome = useTemplateRef<InstanceType<typeof WelcomePane>>("welcome");

defineExpose<ShellHandle>({
  focusPanel: (panel) => {
    expand(sideOf(panel));
    void focusPanelSearch(panel);
  },
  toggle,
  focusSearch: () => welcome.value?.focus(),
});
</script>

<template>
  <div class="stage">
    <div ref="track" class="track">
      <Splitpanes
        v-if="trackWidth > 0"
        :push-other-panes="false"
        :maximize-panes="false"
        @resize="onResize"
        @resized="onResized"
      >
        <Pane
          :size="paneSizes.left"
          :min-size="0"
          :max-size="paneMax"
        >
          <div v-show="sideVisible('left')" class="pane">
            <PanelView :panel="props.left" />
          </div>
        </Pane>

        <Pane :size="paneSizes.centre" :min-size="0" :max-size="100">
          <div class="pane">
            <WelcomePane ref="welcome" />
          </div>
        </Pane>

        <Pane
          :size="paneSizes.right"
          :min-size="0"
          :max-size="paneMax"
        >
          <div v-show="sideVisible('right')" class="pane">
            <PanelView :panel="props.right" />
          </div>
        </Pane>
      </Splitpanes>
    </div>
  </div>
</template>
