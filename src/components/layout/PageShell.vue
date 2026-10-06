<script setup lang="ts">
// Paged: one panel fills the screen and the strip of three slides sideways under it. Only a narrow
// window takes this shape — and only there does the swipe have a screen to move to.
import { computed, ref, useTemplateRef } from "vue";
import { usePointerSwipe } from "@vueuse/core";
import PanelView from "./PanelView.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import { focusPanelSearch } from "@/composables/usePanelSearch";
import { startedInBrowserEdge, swipedSlot } from "@/core/gestures";
import { CENTRE_SLOT, type PanelId, type ShellHandle, type SidePaneId } from "@/core/panels";

const props = defineProps<{ left: SidePaneId; right: SidePaneId }>();

/** The three screens, left to right — the same order the swipe walks through. */
const slots = computed<PanelId[]>(() => [props.left, "search", props.right]);

/** Which screen is showing. A new tab opens on the search box. */
const slot = ref(CENTRE_SLOT);

const trackStyle = computed(() => ({
  transform: `translateX(${-slot.value * 100}%)`,
}));

const welcome = useTemplateRef<InstanceType<typeof WelcomePane>>("welcome");
const stage = useTemplateRef<HTMLElement>("stage");
let startedAt = 0;

// A mouse drag moves the strip as well as a finger: `usePointerSwipe` takes pointer events, which is
// also what makes this checkable away from a phone.
usePointerSwipe(stage, {
  onSwipeStart: (event) => {
    startedAt = event.clientX;
  },
  onSwipeEnd: (_event, direction) => {
    if (direction !== "left" && direction !== "right") return;
    // The browser judges where the gesture started, so the guard reads there too.
    if (startedInBrowserEdge(startedAt, window.innerWidth)) return;

    const next = swipedSlot(slot.value, direction, slots.value.length);
    if (next !== null) slot.value = next;
  },
});

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
