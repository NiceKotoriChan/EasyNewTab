<script setup lang="ts">
/**
 * Search input + engine switcher + suggestion dropdown.
 *
 * Used by the welcome pane (hero size, autofocused). All state comes from
 * `useSearch()`, so every entry point shares one engine choice and one
 * behaviour definition.
 *
 * The hero variant is deliberately large — 58px tall, fully rounded, floating
 * on its own shadow — because this box is the one interactive thing on a page
 * whose entire purpose is "open a tab and type". Its hover and focus states
 * are the only elevation changes in the app.
 *
 * `showEngines` puts the engine row back under the input (it lives in the
 * search box, not in a settings screen — that is where you look when a query
 * came back from the wrong engine).
 */
import { computed, onMounted, ref } from "vue";
import EngineSwitcher from "./EngineSwitcher.vue";
import { useSearch } from "@/composables/useSearch";
import { highlightMatch } from "@/core/utils";
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

const { query, suggestions, activeIndex, canSuggest, move, commit, pick } =
  useSearch();

const input = ref<HTMLInputElement | null>(null);
const focused = ref(false);

/** No dropdown for engines without a suggestion endpoint (GitHub). */
const dropdownOpen = computed(
  () => focused.value && canSuggest.value && query.value.trim().length > 0,
);

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      move(1);
      break;
    case "ArrowUp":
      event.preventDefault();
      move(-1);
      break;
    case "Enter":
      event.preventDefault();
      // Keep the shell from also acting on this keystroke.
      event.stopPropagation();
      commit();
      emit("submitted");
      break;
    case "Escape":
      event.preventDefault();
      // Escape unwinds a level at a time: the first press clears the query, the
      // next one hands the field back. Propagation always stops here, so the
      // shell's window-level Escape does not also fire on the same press.
      event.stopPropagation();
      if (query.value) clear();
      else emit("escape");
      break;
  }
}

function choose(index: number): void {
  pick(index);
  emit("submitted");
}

function clear(): void {
  query.value = "";
  // The `useSearch` watcher empties suggestions and resets activeIndex.
  input.value?.focus();
}

onMounted(() => {
  if (props.autofocus) input.value?.focus();
});

/**
 * Both directions are exposed because the field is the page's `typing` state:
 * `focus` is what `/` calls, and `blur` is what Escape calls to hand the
 * keyboard back, without which none of the shell's bare-key bindings can be
 * reached on a page whose search box autofocuses on mount.
 */
defineExpose({
  focus: () => input.value?.focus(),
  blur: () => input.value?.blur(),
});
</script>

<template>
  <div class="search-field" :class="{ 'is-large': props.large }">
    <div class="field-wrap">
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
          spellcheck="false"
          :placeholder="props.placeholder"
          @keydown="onKeydown"
          @focus="focused = true"
          @blur="focused = false"
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

      <ul v-if="dropdownOpen" class="suggestions">
        <li v-if="suggestions.length === 0" class="none">No suggestions</li>
        <li v-for="(item, index) in suggestions" :key="item + index">
          <button
            type="button"
            class="suggestion"
            :class="{ 'is-active': index === activeIndex }"
            @mousedown.prevent="choose(index)"
            @mouseenter="activeIndex = index"
          >
            <Icon name="arrow-right" :size="13" class="s-icon" />
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="s-text" v-html="highlightMatch(item, query)" />
          </button>
        </li>
      </ul>
    </div>

    <EngineSwitcher v-if="props.showEngines" />
  </div>
</template>

<style scoped>
.search-field {
  display: flex;
  flex-direction: column;
  /* Input ↔ engine row. 14px was the original build's value and is what both
     variants inherited; at 58px tall the hero box made the row underneath read
     as crowded, so it is 20px now — still well inside the 32px that separates
     the shortcut tiles, because the engine row belongs to the box and the tiles
     do not. */
  gap: 20px;
  width: 100%;
}

/* Anchors the dropdown to the input specifically, so the engine row below
   stays outside its positioning context. */
.field-wrap {
  position: relative;
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
  box-shadow: var(--shadow-xs);
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

/* --- Hero variant ------------------------------------------------- */
.is-large .field {
  height: 58px;
  padding: 0 12px 0 20px;
  gap: 12px;
  box-shadow: var(--shadow-md);
}

.is-large .field:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-raise);
}

.is-large .field:focus-within {
  box-shadow: 0 0 0 4px var(--accent-soft), var(--shadow-raise);
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

/* The wrapper already draws the focus ring. */
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

/* --- Suggestions --------------------------------------------------- */
.suggestions {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 300px;
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.suggestion {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text);
}

.is-large .suggestion {
  padding: 10px 12px;
  font-size: 13.5px;
}

.s-icon {
  color: var(--text-muted);
  opacity: 0.65;
}

.s-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion.is-active,
.suggestion:hover {
  background: var(--selection-bg);
  color: var(--selection-fg);
}

.suggestion.is-active .s-icon,
.suggestion:hover .s-icon {
  color: inherit;
  opacity: 1;
}

.suggestion.is-active :deep(.hl),
.suggestion:hover :deep(.hl) {
  color: inherit;
}

.none {
  padding: 10px 12px;
  color: var(--text-muted);
  font-size: 12.5px;
}
</style>
