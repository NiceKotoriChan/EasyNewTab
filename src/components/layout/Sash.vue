<script setup lang="ts">
// Draggable divider: the hairline between panes. Rendered expanded and collapsed alike, because collapsing *is* the same drag — the element under the pointer must outlive the state change. The negative margin cancels the sidebar's gutter (left when docked left, right when docked right).
import { computed } from "vue";
import type { SidebarPosition } from "@/core/settings";

const props = defineProps<{
  collapsed: boolean;
  position: SidebarPosition;
}>();

const isRight = computed(() => props.position === "right");
// The direction that narrows the sidebar, i.e. toward its docked edge.
const toward = computed(() => (isRight.value ? "right" : "left"));
const away = computed(() => (isRight.value ? "left" : "right"));

// No key hint: the binding is a bare letter that only fires when the caret is out of a text field, and a hovering tooltip says nothing about that.
const hint = computed(() =>
  props.collapsed
    ? `Drag ${away.value} to show the sidebar`
    : `Drag to resize — drag ${toward.value} to hide`,
);
</script>

<template>
  <div
    class="sash"
    :class="{ 'is-collapsed': props.collapsed, 'is-right': isRight }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="props.collapsed ? 'Show sidebar' : 'Resize sidebar'"
    :title="hint"
  >
    <span class="grip" />
  </div>
</template>

<style scoped>
.sash {
  position: relative;
  width: var(--gutter);
  flex: none;
  /* Cancels the sidebar's margin on its side, overlaying the gap; with the sidebar hidden that negative margin puts the handle on the window edge. */
  margin-left: calc(-1 * var(--gutter));
  cursor: col-resize;
  z-index: 5;
}

.sash.is-right {
  margin-left: 0;
  margin-right: calc(-1 * var(--gutter));
}

/* The 1px line is all there is to aim at (the gutter is 0); an 11px strip centred on it gives the drag its target without costing layout, since a press lands on `.sash`. */
.sash::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 11px;
  transform: translateX(-50%);
}

/* Full-height line reads as a divider, not a widget; hovering recolours it, the drag lands where the line already is. */
.grip {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--border);
  transition: background var(--dur) var(--ease);
}

.sash:hover .grip,
.sash:active .grip {
  background: var(--accent);
}

/* Collapsed, there's no second pane, so the line becomes the way back: a short dash at the edge the pointer finds before the tooltip. */
.sash.is-collapsed .grip {
  top: 50%;
  bottom: auto;
  height: 56px;
  transform: translate(-50%, -50%);
  background: var(--border-strong);
}

.sash.is-collapsed:hover .grip,
.sash.is-collapsed:active .grip {
  background: var(--accent);
}
</style>
