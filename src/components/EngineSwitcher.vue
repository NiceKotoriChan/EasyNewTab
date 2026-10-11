<script setup lang="ts">
import EngineIcon from "./ui/EngineIcon.vue";
import { useSettings } from "@/composables/useSettings";
import { ENGINES, ENGINE_IDS, type EngineId } from "@/core/engines";

const { settings, update } = useSettings();

function choose(id: EngineId): void {
  if (id === settings.value.searchEngine) return;
  void update({ searchEngine: id });
}
</script>

<template>
  <div class="engines" role="group" aria-label="Search engine">
    <button
      v-for="id in ENGINE_IDS"
      :key="id"
      type="button"
      class="engine"
      :class="{ 'is-active': settings.searchEngine === id }"
      :title="`Search with ${ENGINES[id].name}`"
      :aria-pressed="settings.searchEngine === id"
      @mousedown.prevent="choose(id)"
      @click="choose(id)"
    >
      <EngineIcon :engine="id" :size="18" />
      <span class="name">{{ ENGINES[id].name }}</span>
    </button>
  </div>
</template>

<style scoped>
.engines {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  align-self: center;
  width: fit-content;
  max-width: 100%;
}

.engine {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-dim);
  font-size: 12.5px;
  white-space: nowrap;
}

.engine:hover {
  background: var(--hover-bg);
  border-color: var(--border-strong);
}

.engine.is-active {
  background: var(--inset);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

@media (max-width: 640px) {
  .name {
    display: none;
  }

  .engine {
    padding: 0 10px;
  }
}
</style>
