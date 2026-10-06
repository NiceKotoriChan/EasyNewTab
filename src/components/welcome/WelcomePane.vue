<script setup lang="ts">
// Main-area view: a quiet clock and the hero search box. Compact drops the clock and keeps the box, the engine row and the most-visited row — the last of those is the one part of this pane that is a destination rather than a decoration, so a phone gets it too; the box autofocuses, and `focus` is exposed for when mount doesn't cover it.
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

// The clock only ticks while on screen; on the compact device that's the battery talking.
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
  // Followed, not read once: widening past the boundary must bring back a correctly-timed clock.
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

// Load-bearing: the box autofocuses, so without an Escape that actually leaves it, no bare-key binding is ever reachable. `/` is the way back in.
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
        <TopSites />
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
  padding: 40px 24px;
  overflow-y: auto;
}

/* Desktop: the block sits above dead centre, upper 4 to lower 6. Two flex spacers rather than auto
   margins, because the share is deliberately uneven; a window shorter than the block collapses them
   to nothing and scrolls from the top instead of clipping the clock. */
.welcome:not(.is-compact)::before {
  content: "";
  flex: 4 1 0;
}

.welcome:not(.is-compact)::after {
  content: "";
  flex: 6 1 0;
}

/* Stacked, this pane is only as tall as its contents, so the landing zone is ordinary padding. */
.welcome.is-compact {
  padding: 20px 16px 18px;
}

.stack {
  /* Never squashed: the block keeps its height and the container scrolls instead. */
  flex: none;
  width: min(620px, 100%);
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* The input + engine row are one control (14px owned by `SearchField`); the most-visited row is its own section, so it takes 32px not the stack's 30px. */
.search-block {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.clock-block {
  text-align: center;
}

/* Thin and large, so it reads as ambient information, not a heading — the search box below should catch the eye. */
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
