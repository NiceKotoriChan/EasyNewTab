<script setup lang="ts">
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
  overflow-y: auto;
}

.welcome:not(.is-compact)::before {
  content: "";
  flex: 4 1 0;
}

.welcome:not(.is-compact)::after {
  content: "";
  flex: 6 1 0;
}

.welcome.is-compact {
  padding-top: 20px;
}

.stack {
  flex: none;
  width: min(620px, 100%);
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.search-block {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.clock-block {
  text-align: center;
}

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
