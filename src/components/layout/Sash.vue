<script setup lang="ts">
/**
 * Draggable divider that sits invisibly in the gutter, showing a 2px accent bar
 * on hover.
 *
 * It is rendered unconditionally — expanded *and* collapsed. The drag that
 * collapses the sidebar is the same gesture as the drag that resizes it, so the
 * element under the pointer has to outlive the state change it causes (see the
 * note in `useSidebar.startResize`). Collapsed, the sidebar hides itself with
 * `v-show` and this handle ends up flush against the window edge it is docked
 * to, which is exactly where the hand already is when you want the sidebar back.
 *
 * Which edge that is depends on `position`, and so does the negative margin
 * that puts it there: the divider cancels the *sidebar's* gutter, and the
 * sidebar's gutter is on the divider's left when docked left and on its right
 * when docked right. The hint text mirrors with it, because "drag left to hide"
 * is only true half the time.
 *
 * Intentional hole for native listeners: the parent binds `@pointerdown` and
 * Vue forwards it to this element, so the drag logic lives in `useSidebar`.
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
 * The tooltip describes the drag and nothing else.
 *
 * It used to end with the key that does the same thing from the keyboard. That
 * was dropped along with the modifier: the binding is now `s`, a bare letter
 * that only fires when the caret is *not* in a text field — and this tooltip is
 * read while hovering, which says nothing about where the caret is. On a new tab
 * the caret starts in the search box, so the old tooltip could promise a key
 * that would type an `s` instead. Keys are documented where they can be read as
 * a set, in the settings page's Shortcuts list; `/` and `p` have never had a
 * tooltip either.
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
