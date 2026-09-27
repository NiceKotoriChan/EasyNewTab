<script setup lang="ts">
/**
 * Search engine switcher — the row of engine chips that sits under the
 * search box (same six engines as the original build; GitHub has no suggestion
 * endpoint).
 *
 * Six separate outlined pills. That is what this row looked like before the
 * round-five restyle folded it into a segmented track, and what it looked like
 * in the vanilla build the app was rewritten from (`src/card/search.css`,
 * `.engine-btn` — the values below are that rule's, mapped onto the current
 * token names). Restored at the user's request, so the shape is a *revert*
 * rather than a new idea; the two differ in one thing, where the border lives:
 *
 * - a **track** draws one border around the whole row and raises the current
 *   option on a surface-coloured pill, so the row reads as one control with a
 *   current value;
 * - **pills** give every engine its own border, and the current one is marked
 *   by colour instead (accent border and text, on the neutral `--inset` wash
 *   the original's `--bg-active` was).
 *
 * Six independent choices is what this row actually is, which is the argument
 * for the second shape.
 *
 * It writes through `useSettings()` like every other control, so the choice is
 * persisted and immediately visible to whichever search field is on screen.
 * No search state lives here: `useSearch()` watches the engine and re-runs the
 * pending query, so the two never need to know about each other.
 */
import EngineIcon from "./ui/EngineIcon.vue";
import { useSettings } from "@/composables/useSettings";
import { ENGINES, ENGINE_IDS, type EngineId } from "@/core/engines";

const { settings, update } = useSettings();

/**
 * `mousedown` rather than `click` so the input keeps focus (and the dropdown
 * stays open while a query is pending); `click` is kept for keyboard users,
 * and is a no-op the second time because of the guard below.
 */
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
/* `fit-content` + `align-self` so the row hugs its pills instead of stretching
   to the search box width, while still wrapping when narrow. */
.engines {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  align-self: center;
  width: fit-content;
  max-width: 100%;
}

/* The original pill: an 18px brand mark plus the name, outlined, one per
   engine. It is 32px tall including the border — the same height the track's
   options had, so nothing below this row moved. */
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

/* Marked by colour rather than by elevation: the border and the label take the
   accent, and the fill steps back to the neutral inset. The weight is the one
   addition the current build makes to the original rule — the accent alone is
   a thin signal at 12.5px. */
.engine.is-active {
  background: var(--inset);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

/* Six named pills need about 580px; the row's own container is
   `min(620px, 100vw - 48px)`, so below ~640px they would fold onto a second
   line. Icons alone identify the engines, so the names go first. */
@media (max-width: 640px) {
  .name {
    display: none;
  }

  .engine {
    padding: 0 10px;
  }
}
</style>
