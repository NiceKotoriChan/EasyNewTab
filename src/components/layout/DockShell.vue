<script setup lang="ts">
// Docked: three columns side by side, each side as wide as the last drag left it. Both hairlines
// drive the one width, and dragging either of them shut retracts both columns.
import { computed, useTemplateRef } from "vue";
import Sash from "./Sash.vue";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { useSidebar } from "@/composables/useSidebar";
import type { ShellHandle, SidePaneId } from "@/core/panels";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();

const { width, collapsed, toggle, startResize } = useSidebar();

const sideStyle = computed(() => ({ width: width.value + "px" }));

const welcome = useTemplateRef<InstanceType<typeof WelcomePane>>("welcome");

// A docked panel is on screen already, so the only thing left for the shell to do about "show me
// this one" is make sure the columns are not retracted.
defineExpose<ShellHandle>({
  focusPanel: (panel) => {
    if (collapsed.value) toggle();
    void focusPanelSearch(panel);
  },
  toggle,
  focusSearch: () => welcome.value?.focus(),
});
</script>

<template>
  <div class="stage">
    <div class="track is-dock">
      <!-- Hidden rather than unmounted: the divider that reopens the columns has to outlive the
           state change it causes. -->
      <PanelView
        v-show="!collapsed"
        class="pane is-side"
        :style="sideStyle"
        :panel="props.left"
      />
      <Sash
        side="left"
        :collapsed="collapsed"
        @pointerdown="startResize($event, 'left')"
      />

      <div class="pane is-centre" data-panel="search">
        <WelcomePane ref="welcome" />
      </div>

      <Sash
        side="right"
        :collapsed="collapsed"
        @pointerdown="startResize($event, 'right')"
      />
      <PanelView
        v-show="!collapsed"
        class="pane is-side"
        :style="sideStyle"
        :panel="props.right"
      />
    </div>
  </div>
</template>
