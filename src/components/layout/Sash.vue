<script setup lang="ts">
/**
 * Draggable divider: the hairline between the two panes, and the accent it turns on hover.
 *
 * Rendered in the side-by-side layout both expanded and collapsed, because collapsing
 * *is* the same drag as resizing and the element under the pointer has to outlive the
 * state change it causes. The shell drops it once the panes are stacked: there is no
 * column to drag across, and the lower pane grows a top border instead. The negative
 * margin and the hint text both depend on
 * `position` — the divider cancels the *sidebar's* gutter, which is on its left when
 * docked left and on its right when docked right.
 */
import { computed } from "vue";
import type { SidebarPosition } from "@/core/settings";

const props = defineProps<{
  collapsed: boolean;
  position: SidebarPosition;
}>();

const isRight = computed(() => props.position === "right");
/** The direction that makes the sidebar narrower, i.e. toward its docked edge. */
const toward = computed(() => (isRight.value ? "right" : "left"));
const away = computed(() => (isRight.value ? "left" : "right"));

/**
 * The tooltip describes the drag and nothing else — no key hint. The binding is a
 * bare letter that only fires when the caret is not in a text field, and a
 * tooltip read while hovering says nothing about where the caret is. Keys are
 * documented as a set in the settings page's Shortcuts list.
 */
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
  /* Cancels the sidebar's own margin on the side it sits on, so the handle
     overlays the gap without widening the layout. With the sidebar hidden that
     negative margin is what puts the handle on the window edge instead of
     beside it. */
  margin-left: calc(-1 * var(--gutter));
  cursor: col-resize;
  z-index: 5;
}

.sash.is-right {
  margin-left: 0;
  margin-right: calc(-1 * var(--gutter));
}

/* What the pointer lands on. The handle's own width *is* the gutter, and the gutter is
   0 — so the box is empty and the 1px line inside it is all there is to aim at. An 11px
   strip centred on the line gives the drag back its target without costing a pixel of
   layout: it is absolutely positioned inside a box that already exists, a press on it
   lands on `.sash`, and that is what carries the drag. */
.sash::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 11px;
  transform: translateX(-50%);
}

/* The line itself. It runs the full height so it reads as a divider rather than as a
   widget, and hovering recolours it rather than growing it: the drag lands where the
   line already is. */
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

/* Collapsed there is no second pane to divide, so the line becomes the way back
   instead: a short dash at the window edge, which the pointer finds long before
   the tooltip does. */
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
