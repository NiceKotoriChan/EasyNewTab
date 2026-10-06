<script setup lang="ts">
// The sidebar's filter bar: one line at the top of a panel, sized to the rows underneath it.
//
// It owns no filtering — the panel that renders it does — so the same bar can sit over a tree and
// over a flat list without either borrowing the other's idea of what a match is. Escape unwinds a
// level at a time, the same way the hero box does: clear, then hand focus back. That second step is
// load-bearing, because the app's shortcuts are bare keys and every one of them is gated on the
// caret not being in a text field.
import { useTemplateRef } from "vue";
import Icon from "./Icon.vue";

const model = defineModel<string>({ required: true });

defineProps<{ placeholder: string }>();

const input = useTemplateRef<HTMLInputElement>("input");

function onEscape(): void {
  if (model.value) model.value = "";
  else input.value?.blur();
}

// `preventScroll` because the caret is placed by us, after we have already brought the panel into
// view — the browser's own scroll-into-view would otherwise drag the paged shape's track sideways.
defineExpose({ focus: () => input.value?.focus({ preventScroll: true }) });
</script>

<template>
  <div class="panel-search">
    <Icon name="search" :size="13" class="prefix" />
    <input
      ref="input"
      v-model="model"
      type="text"
      class="input"
      :placeholder="placeholder"
      :aria-label="placeholder"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      @keydown.esc.prevent="onEscape"
    />
    <button
      v-if="model"
      type="button"
      class="clear"
      title="Clear"
      aria-label="Clear search"
      @mousedown.prevent="model = ''"
      @click="model = ''"
    >
      <Icon name="close" :size="12" />
    </button>
  </div>
</template>

<style scoped>
.panel-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: var(--row-h);
  /* A row's own inset, so the bar lines up with the rows under it instead of reading as a second
     toolbar that appeared from nowhere. */
  margin: 6px 6px 4px;
  padding: 0 5px 0 8px;
  background: var(--inset);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow var(--dur) var(--ease);
}

/* The ring goes round the whole bar: the bare input inside has no border to draw one on. */
.panel-search:focus-within {
  background: var(--surface);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.prefix {
  color: var(--text-muted);
}

.input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  /* 12.5px is the app's form size, not the 14px of the rows around it. */
  font-size: 12.5px;
}

.input:focus-visible {
  box-shadow: none;
}

.input::placeholder {
  color: var(--text-muted);
}

.clear {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
}

.clear:hover {
  background: var(--hover-bg);
  color: var(--text);
}
</style>
