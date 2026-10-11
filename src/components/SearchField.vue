<script setup lang="ts">
import { onMounted, ref } from "vue";
import EngineSwitcher from "./EngineSwitcher.vue";
import { useSearch } from "@/composables/useSearch";
import Icon from "./ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    autofocus?: boolean;
    large?: boolean;
    placeholder?: string;
    showEngines?: boolean;
  }>(),
  {
    autofocus: false,
    large: false,
    placeholder: "Search the web or type a URL",
    showEngines: false,
  },
);

const emit = defineEmits<{ escape: []; submitted: [] }>();

const { query, commit } = useSearch();

const input = ref<HTMLInputElement | null>(null);

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;

  switch (event.key) {
    case "Enter":
      event.preventDefault();
      event.stopPropagation();
      commit();
      emit("submitted");
      break;
    case "Escape":
      event.preventDefault();
      event.stopPropagation();
      if (query.value) clear();
      else emit("escape");
      break;
  }
}

function clear(): void {
  query.value = "";
  input.value?.focus();
}

onMounted(() => {
  if (props.autofocus) input.value?.focus();
});

defineExpose({
  focus: () => input.value?.focus(),
  blur: () => input.value?.blur(),
});
</script>

<template>
  <div class="search-field" :class="{ 'is-large': props.large }">
    <div class="field">
      <Icon name="search" :size="props.large ? 19 : 15" class="prefix" />
      <input
        ref="input"
        v-model="query"
        type="text"
        class="input"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        enterkeyhint="search"
        spellcheck="false"
        :placeholder="props.placeholder"
        @keydown="onKeydown"
      />
      <button
        v-if="query"
        type="button"
        class="clear"
        title="Clear"
        aria-label="Clear search"
        @mousedown.prevent="clear"
        @click="clear"
      >
        <Icon name="close" :size="12" />
      </button>
    </div>

    <EngineSwitcher v-if="props.showEngines" />
  </div>
</template>

<style scoped>
.search-field {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 10px 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  transition:
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}

.field:hover {
  border-color: var(--border-strong);
}

.field:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.is-large .field {
  height: 58px;
  padding: 0 12px 0 20px;
  gap: 12px;
}

.is-large .field:hover {
  border-color: var(--border-strong);
}

.prefix {
  color: var(--text-muted);
}

.is-large .prefix {
  color: var(--text-dim);
}

.field:focus-within .prefix {
  color: var(--accent);
}

.input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}

.input:focus-visible {
  box-shadow: none;
}

.is-large .input {
  font-size: 16px;
  letter-spacing: -0.1px;
}

.input::placeholder {
  color: var(--text-muted);
}

.clear {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: var(--radius-full);
  color: var(--text-muted);
}

.clear:hover {
  background: var(--hover-bg);
  color: var(--text);
}

.is-large .clear {
  width: 30px;
  height: 30px;
}
</style>
