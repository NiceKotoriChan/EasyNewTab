<script setup lang="ts">
// A side panel that floats on its own layer over the centre instead of taking a column. Fixed width,
// and the way in is the band of that same width against this side of the window. The band is
// measured off the pointer rather than built from an element: at this width an element would sit on
// top of the centre's own edge and swallow the clicks that land there.
//
// `pinned` is the keyboard's way in, and the layer stays open while the pointer is on the panel,
// because a panel you must keep pointing at is one you cannot scroll.
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useElementHover, useEventListener } from "@vueuse/core";
import Icon from "../ui/Icon.vue";
import { inSideBand } from "@/core/gestures";
import type { SideEdge } from "@/core/settings";

const props = defineProps<{
  side: SideEdge;
  width: number;
  label: string;
  pinned: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

// The pointer only has to be in the band for a moment: long enough that a sweep across it on the way
// to the search box does not flash the panel open, short enough to still feel immediate.
const ENTER_MS = 120;
const LEAVE_MS = 180;

const inBand = ref(false);
const resting = ref(false);
let timer: number | undefined;

// `useEventListener` with a bare event name listens on `window`, and does it without touching
// `window` until there is one — passing `window` here instead would throw during SSR.
useEventListener("pointermove", (event: PointerEvent) => {
  inBand.value = inSideBand(
    event.clientX,
    window.innerWidth,
    props.width,
    props.side,
  );
});

watch(inBand, (entered) => {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(
    () => {
      timer = undefined;
      resting.value = entered;
    },
    entered ? ENTER_MS : LEAVE_MS,
  );
});

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearTimeout(timer);
});

const layer = useTemplateRef<HTMLElement>("layer");
const onLayer = useElementHover(layer, { delayLeave: 260 });

const shown = computed(() => props.pinned || resting.value || onLayer.value);
</script>

<template>
  <div
    class="overlay"
    :class="[props.side === 'left' ? 'is-left' : 'is-right', { 'is-shown': shown }]"
  >
    <aside
      ref="layer"
      class="layer"
      :style="{ width: props.width + 'px' }"
      :aria-label="props.label"
    >
      <button
        v-if="props.pinned"
        type="button"
        class="unpin"
        :aria-label="`Hide the ${props.label}`"
        @click="emit('close')"
      >
        <Icon name="close" :size="14" />
      </button>
      <slot />
    </aside>
  </div>
</template>

<style scoped>
/* A zero-width anchor against the window edge; the layer hangs off it. */
.overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  z-index: 20;
}

.is-left {
  left: 0;
}

.is-right {
  right: 0;
}

.layer {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
  background: var(--surface);
  /* Hidden rather than unmounted, and `visibility` rather than opacity: an off-screen layer can
     still take Tab focus, which would put its rows in the tab order while nobody can see it. The
     delayed `visibility` on the way out is what lets the slide finish before it disappears. */
  visibility: hidden;
  transition:
    transform var(--dur) var(--ease),
    visibility 0s linear var(--dur);
}

.is-left .layer {
  left: 0;
  transform: translateX(-100%);
  border-right: 1px solid var(--border);
}

.is-right .layer {
  right: 0;
  transform: translateX(100%);
  border-left: 1px solid var(--border);
}

.is-shown .layer {
  visibility: visible;
  transform: none;
  transition:
    transform var(--dur) var(--ease),
    visibility 0s;
}

.unpin {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-muted);
  border-radius: var(--radius-full);
}

.unpin:hover {
  color: var(--text);
  background: var(--inset);
}
</style>
