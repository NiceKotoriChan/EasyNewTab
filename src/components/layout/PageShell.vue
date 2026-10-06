<script setup lang="ts">
// Paged: one panel fills the screen and the strip of three slides sideways under it. Only a narrow
// window takes this shape — and only there does the swipe have a screen to move to.
import { computed, useTemplateRef } from "vue";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { usePageSwipe } from "@/composables/usePageSwipe";
import { CENTRE_SLOT, type PanelId, type ShellHandle, type SidePaneId } from "@/core/panels";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();
const PAGE_COUNT = 3;

/** The three screens, left to right — the same order the swipe walks through. */
const slots = computed<PanelId[]>(() => [props.left, "search", props.right]);

/** Which screen is showing. A new tab opens on the search box. */
const stage = useTemplateRef<HTMLElement>("stage");
const { slot } = usePageSwipe(stage, PAGE_COUNT, CENTRE_SLOT);

const trackStyle = computed(() => ({
  transform: `translateX(${-slot.value * 100}%)`,
}));

const welcome = useTemplateRef<InstanceType<typeof WelcomePane>>("welcome");

defineExpose<ShellHandle>({
  focusPanel: (panel) => {
    slot.value = slots.value.indexOf(panel);
    void focusPanelSearch(panel);
  },
  toggle: () => {
    slot.value = CENTRE_SLOT;
  },
  focusSearch: () => welcome.value?.focus(),
});
</script>

<template>
  <div ref="stage" class="stage">
    <div class="track is-page" :style="trackStyle">
      <PanelView class="pane is-side" :panel="props.left" />
      <div class="pane is-centre" data-panel="search">
        <WelcomePane ref="welcome" />
      </div>
      <PanelView class="pane is-side" :panel="props.right" />
    </div>
  </div>
</template>
