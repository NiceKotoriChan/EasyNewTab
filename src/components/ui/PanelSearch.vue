<script setup lang="ts">
import { useTemplateRef } from "vue";
import Icon from "./Icon.vue";

const model = defineModel<string>({ required: true });

defineProps<{ placeholder: string }>();

const input = useTemplateRef<HTMLInputElement>("input");

function onEscape(): void {
  if (model.value) model.value = "";
  else input.value?.blur();
}

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
  margin: 6px 6px 4px;
  padding: 0 5px 0 8px;
  background: var(--inset);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow var(--dur) var(--ease);
}

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
