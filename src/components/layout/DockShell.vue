<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { useSidebar } from "@/composables/useSidebar";
import type { ShellHandle, SidePaneId } from "@/core/panels";
import type { SideEdge } from "@/core/settings";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();

const { widths, collapsed, resizing, toggle, expand, startResize } = useSidebar();

const leftStyle = computed(() => ({ width: widths.value.left + "px" }));
const rightStyle = computed(() => ({ width: widths.value.right + "px" }));

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
    <div class="track is-dock">
      <div class="rail" />
      <PanelView
        v-show="!collapsed.left"
        class="pane is-side"
        :style="leftStyle"
        :panel="props.left"
      />
      <div
        class="splitter"
        :class="{ 'is-active': resizing === 'left' }"
        role="separator"
        aria-orientation="vertical"
        :aria-label="`Resize ${props.left} panel`"
        title="Drag to resize"
        @pointerdown="startResize($event, 'left')"
      />

      <div class="pane is-centre" data-panel="search">
        <WelcomePane ref="welcome" />
      </div>

      <div
        class="splitter"
        :class="{ 'is-active': resizing === 'right' }"
        role="separator"
        aria-orientation="vertical"
        :aria-label="`Resize ${props.right} panel`"
        title="Drag to resize"
        @pointerdown="startResize($event, 'right')"
      />
      <PanelView
        v-show="!collapsed.right"
        class="pane is-side"
        :style="rightStyle"
        :panel="props.right"
      />
      <div class="rail" />
    </div>
  </div>
</template>

<style scoped>
.rail {
  width: var(--gutter);
  flex: none;
  background: var(--inset);
}

.splitter {
  position: relative;
  width: 0;
  flex: none;
  cursor: col-resize;
  z-index: 5;
}

.splitter::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 11px;
  transform: translateX(-50%);
  transition: background var(--dur) var(--ease);
}

.splitter::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--border);
  transition:
    background var(--dur) var(--ease),
    width var(--dur) var(--ease);
}

.splitter:hover::after {
  background: var(--accent);
}

.splitter.is-active::after {
  width: 2px;
  background: var(--accent);
}

.splitter.is-active::before {
  background: var(--accent-soft);
}
</style>
