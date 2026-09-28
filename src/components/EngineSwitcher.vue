<script setup lang="ts">
// Search engine switcher — the row of engine chips under the search box. Six outlined pills (independent choices) rather than one segmented track; writes through `useSettings()` so the choice persists and `useSearch()` re-runs the pending query.
import EngineIcon from "./ui/EngineIcon.vue";
import { useSettings } from "@/composables/useSettings";
import { ENGINES, ENGINE_IDS, type EngineId } from "@/core/engines";

const { settings, update } = useSettings();

// `mousedown` (not `click`) keeps the input focused while a query is pending; `click` is kept for keyboard users and is a no-op when already selected.
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
/* `fit-content` + `align-self` so the row hugs its pills instead of stretching, but still wraps when narrow. */
.engines {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  align-self: center;
  width: fit-content;
  max-width: 100%;
}

/* 18px brand mark + name, outlined, one per engine; 32px tall (border included) to match the old track's options, so nothing below moved. */
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

/* Marked by colour, not elevation: border + label take the accent, fill steps back to the neutral inset. The weight is the one addition the build makes (accent alone is thin at 12.5px). */
.engine.is-active {
  background: var(--inset);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

/* Six pills need ~580px but the container is `min(620px, 100vw - 48px)`, so below ~640px they fold onto a second line — names drop, icons alone identify them. */
@media (max-width: 640px) {
  .name {
    display: none;
  }

  .engine {
    padding: 0 10px;
  }
}
</style>
