<script setup lang="ts">
/**
 * The main-area view when nothing is selected: a quiet clock and the hero search
 * box, so opening a new tab and typing still just works. The search box is the
 * only thing here that takes input.
 *
 * The box is autofocused on mount, which covers a plain new tab; it is also
 * exposed for the case mount does not cover — `/` pressed while a detail view was
 * open, where this pane is created *by* the keystroke.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import SearchField from "../SearchField.vue";
import TopSites from "./TopSites.vue";
import { formatDate, formatTime } from "@/core/utils";

const now = ref(new Date());
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer);
});

const clock = computed(() => formatTime(now.value));
const date = computed(() => formatDate(now.value));

const field = ref<InstanceType<typeof SearchField> | null>(null);

/**
 * Escape pressed inside an empty search box — the field has already cleared
 * itself, or had nothing to clear, so the last thing left to unwind is focus.
 *
 * Load-bearing rather than cosmetic: every bare-key binding is gated behind "the
 * caret is not in a text field", and this box autofocuses on mount, so without
 * an Escape that actually leaves it there is no keyboard route to any shortcut at
 * all. `/` is the way back in.
 */
function leaveField(): void {
  field.value?.blur();
}

defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <section class="welcome">
    <div class="stack">
      <div class="clock-block">
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
  /* Upper third, not dead centre. A new tab is read top-down and the eye should
     land on the search box without travelling: the padding is a share of the
     viewport height so the block keeps its position as the window grows,
     instead of drifting to the middle of a tall screen. */
  padding: clamp(56px, 13vh, 150px) 24px 40px;
  overflow-y: auto;
}

.stack {
  width: min(620px, 100%);
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* The input and the engine row are one control (`SearchField` owns the 14px
   between them); the shortcut tiles below are a section of their own, so they do
   not reuse the stack's 30px — they take 32px. That is not all of the air that
   changed: the tile reserves a further 16px above its icon, so the distance from
   the engine row to the first circle grows from 18px to 48px. */
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
