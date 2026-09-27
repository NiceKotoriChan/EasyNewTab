<script setup lang="ts">
/**
 * The main-area view when nothing is selected: a quiet clock and the hero search box,
 * so opening a new tab and typing still just works.
 *
 * Compact, this is the top pane of a stacked shell and shrinks to the search box and
 * its engine row — the clock and the most-visited row are ambient information a wide
 * window has room to say and a phone does not.
 *
 * The box is autofocused on mount; `focus` is also exposed for the case mount does not
 * cover — `/` pressed while this pane is being created *by* that keystroke.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import SearchField from "../SearchField.vue";
import TopSites from "./TopSites.vue";
import { usePlatform } from "@/composables/usePlatform";
import { formatDate, formatTime } from "@/core/utils";

const { isCompact } = usePlatform();

const now = ref(new Date());
let timer: number | undefined;
let stopWatching: (() => void) | null = null;

function stopClock(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** Run the tick only while the clock is on screen. A second is the resolution the clock
 *  shows, so here a tick is the whole update rather than a rounding error — and a timer
 *  whose value nothing reads is one wakeup a second for nothing, which on the device
 *  that gets the compact layout is the battery talking. */
function syncClock(): void {
  stopClock();
  if (!isCompact.value) {
    timer = window.setInterval(() => {
      now.value = new Date();
    }, 1000);
  }
}

onMounted(() => {
  syncClock();
  // Followed rather than read once: widening the window past the boundary has to bring
  // back a clock showing the right time, not the time it was mounted.
  stopWatching = watch(isCompact, syncClock);
});

onBeforeUnmount(() => {
  stopWatching?.();
  stopWatching = null;
  stopClock();
});

const clock = computed(() => formatTime(now.value));
const date = computed(() => formatDate(now.value));

const field = ref<InstanceType<typeof SearchField> | null>(null);

/** Escape pressed inside an empty search box — the field has already cleared itself, or
 *  had nothing to clear, so the last thing left to unwind is focus.
 *
 *  Load-bearing rather than cosmetic: every bare-key binding is gated behind "the caret
 *  is not in a text field", and this box autofocuses on mount, so without an Escape that
 *  actually leaves it there is no keyboard route to any shortcut at all. `/` is the way
 *  back in. */
function leaveField(): void {
  field.value?.blur();
}

defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <section class="welcome" :class="{ 'is-compact': isCompact }">
    <div class="stack">
      <div v-if="!isCompact" class="clock-block">
        <div class="clock">{{ clock }}</div>
        <div class="date">{{ date }}</div>
      </div>

      <div class="search-block">
        <SearchField ref="field" autofocus large show-engines @escape="leaveField" />
        <TopSites v-if="!isCompact" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  /* Upper third, not dead centre. A new tab is read top-down and the eye should
     land on the search box without travelling: the padding is a share of the
     viewport height so the block keeps its position as the window grows,
     instead of drifting to the middle of a tall screen. */
  padding: clamp(56px, 13vh, 150px) 24px 40px;
  overflow-y: auto;
}

/* Stacked, this is a pane rather than the page, so there is no tall window to
   put the box in the upper third of — the pane is already only as tall as its
   contents. The landing zone becomes ordinary padding. */
.welcome.is-compact {
  padding: 20px 16px 18px;
}

.stack {
  width: min(620px, 100%);
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* The input and the engine row are one control (`SearchField` owns the 14px
   between them); the most-visited row is a section of its own, so it takes 32px
   rather than the stack's 30px. */
.search-block {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.clock-block {
  text-align: center;
}

/* Thin and large, so it reads as ambient information rather than a heading —
   the search box below is the thing the eye should land on. */
.clock {
  font-size: 56px;
  font-weight: 300;
  letter-spacing: -2px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.date {
  margin-top: 10px;
  font-size: 12.5px;
  letter-spacing: 0.2px;
  color: var(--text-muted);
}
</style>
