<script setup lang="ts">
// Sidebar pane: a segmented switch (bookmarks / history) above a scrolling body. The switch lives here because there are only two panels and it's the header's only content.
import { useTemplateRef } from "vue";
import { usePointerSwipe } from "@vueuse/core";
import Icon from "../ui/Icon.vue";
import type { IconName } from "../ui/mdi-icons";
import type { LayoutState } from "@/core/settings";
import { startedInBrowserEdge, swipedIndex } from "@/core/gestures";

const props = defineProps<{ active: LayoutState["activeView"] }>();
const emit = defineEmits<{ select: [view: LayoutState["activeView"]] }>();

const TABS: Array<{
  view: LayoutState["activeView"];
  icon: IconName;
  label: string;
}> = [
  { view: "bookmarks", icon: "bookmark", label: "Bookmarks" },
  { view: "history", icon: "history", label: "History" },
];

// A second way in, on the same axis the switch already lays the two panels out on: the strip's order
// *is* the swipe's order, so advancing means the next tab along and the panel that arrives is the
// one that was off that edge. The ends hold — there is no third panel to wrap to.
//
// The recognition is VueUse's `usePointerSwipe`, not ours: it takes pointer events (so a mouse drag
// moves the panels too, which is what makes this testable away from a phone), captures the pointer
// so the finger may leave the box, and treats a diagonal as up/down, leaving only a sideways
// gesture to reach here. What stays below is the two things it cannot know: the edge strip the
// browser owns, and which panel a direction means.
const panel = useTemplateRef<HTMLElement>("panel");
let startedAt = 0;

usePointerSwipe(panel, {
  onSwipeStart: (event) => {
    startedAt = event.clientX;
  },
  onSwipeEnd: (_event, direction) => {
    if (direction !== "left" && direction !== "right") return;
    // The browser judges where the gesture started, so the guard reads there too.
    if (startedInBrowserEdge(startedAt, window.innerWidth)) return;

    const next = swipedIndex(
      TABS.findIndex((tab) => tab.view === props.active),
      direction,
      TABS.length,
    );
    if (next !== null) emit("select", TABS[next].view);
  },
});
</script>

<template>
  <section ref="panel" class="side-panel">
    <header class="panel-head">
      <div class="tabs" role="tablist" aria-label="Sidebar view">
        <button
          v-for="tab in TABS"
          :key="tab.view"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': props.active === tab.view }"
          :aria-selected="props.active === tab.view"
          @click="emit('select', tab.view)"
        >
          <Icon :name="tab.icon" :size="13" />
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </header>

    <div class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* No border: the pane is the page colour and the line beside it belongs to the sash. */
.side-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  /* A sideways drag has to be ours from the first pixel. With `auto`, Chromium claims the touch to
     find out whether it should pan, and the gesture arrives as `pointercancel` instead of surviving —
     which is what a swipe cannot recover from. `pan-y` names the one axis the panel still scrolls on,
     so the list scrolls as before and the swipe gets through. The cost is real and accepted: no
     pinch-zoom inside the panel. */
  touch-action: pan-y;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 0;
  flex: none;
}

.tabs {
  display: flex;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding: 2px;
  background: var(--inset);
  border-radius: var(--radius-md);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  font-size: 12px;
}

.tab:hover {
  color: var(--text);
}

.tab.is-active {
  background: var(--surface);
  color: var(--accent);
  font-weight: 500;
  box-shadow: var(--shadow-xs);
}

.tab-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-body {
  /* Panels own their scrolling so toolbars/filters stay pinned. */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

/* Below the sidebar's minimum width the labels would clip anyway. */
@media (max-width: 640px) {
  .tab-label {
    display: none;
  }
}
</style>
