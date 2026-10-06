<script setup lang="ts">
// The hairline between the centre and a side column, and the drag that resizes — or retracts — both
// columns at once. Rendered expanded and collapsed alike, because collapsing *is* the same drag: the
// element under the pointer has to outlive the state change it causes.
import { computed } from "vue";
import type { SideEdge } from "@/core/settings";

const props = defineProps<{ side: SideEdge; collapsed: boolean }>();

// The direction that narrows the columns, i.e. the way this panel's inner edge travels. Collapsed,
// the same edge is the way back, so the hint asks for the other direction.
const narrows = computed(() => props.side);
const widens = computed(() => (props.side === "right" ? "left" : "right"));

// No key hint: the divider is a pointer gesture and has no binding, so a keystroke in this text
// would advertise something that does not exist.
const hint = computed(() =>
  props.collapsed
    ? `Drag ${widens.value} to show the panels`
    : `Drag to resize — drag ${narrows.value} to hide`,
);
</script>

<template>
  <div
    class="sash"
    :class="{ 'is-collapsed': props.collapsed }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="props.collapsed ? 'Show panels' : 'Resize panels'"
    :title="hint"
  >
    <span class="grip" />
  </div>
</template>

<style scoped>
.sash {
  position: relative;
  /* Zero-width and off the layout: `--gutter` is 0, so the two panes meet at the line and the pane
     colour is what makes them read as one surface. */
  width: var(--gutter);
  flex: none;
  cursor: col-resize;
  z-index: 5;
}

/* The 1px line is all there is to aim at; an 11px strip centred on it gives the drag its target
   without costing layout, since a press lands on `.sash`. */
.sash::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 11px;
  transform: translateX(-50%);
}

/* Full-height line reads as a divider, not a widget; hovering recolours it, and the drag lands
   where the line already is. */
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

/* Retracted, there is no second pane, so the line becomes the way back: a short dash at the edge
   the pointer finds before the tooltip. */
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
