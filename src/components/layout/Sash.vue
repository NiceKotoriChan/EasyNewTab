<script setup lang="ts">
/**
 * Draggable divider: invisible in the gutter, a 2px accent bar on hover.
 *
 * Rendered unconditionally — expanded *and* collapsed. Collapsing the sidebar is
 * the same drag as resizing it, so the element under the pointer has to outlive
 * the state change it causes (see `useSidebar.startResize`). Collapsed, the
 * sidebar hides with `v-show` and this handle ends up flush against the window
 * edge, which is where the hand already is.
 *
 * The negative margin that puts it there depends on `position`, and so does the
 * hint text: the divider cancels the *sidebar's* gutter, which is on the
 * divider's left when docked left and on its right when docked right.
 *
 * The native listener is bound by the parent and forwarded by Vue, so the drag
 * logic lives in `useSidebar`.
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

.grip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 32px;
  transform: translate(-50%, -50%);
  border-radius: var(--radius-full);
  background: transparent;
  transition: background var(--dur) var(--ease);
}

.sash:hover .grip,
.sash:active .grip {
  background: var(--accent);
}

/* Collapsed this handle is the only way back, so it keeps a resting hint
   instead of appearing solely on hover: a short dash at the window edge, which
   the pointer finds long before the tooltip does. */
.sash.is-collapsed .grip {
  height: 56px;
  background: var(--border-strong);
}

.sash.is-collapsed:hover .grip,
.sash.is-collapsed:active .grip {
  background: var(--accent);
}
</style>
