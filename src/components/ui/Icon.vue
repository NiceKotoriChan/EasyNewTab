<script setup lang="ts">
// One icon, by semantic name (see `mdi-icons.ts`). The single `<svg>` carries the call site's classes; size is width/height (filled glyphs, not stroke). `aria-hidden` is set here so an unlabelled svg doesn't get announced twice.
import { computed } from "vue";
import { resolveIcon, type IconName } from "./mdi-icons";

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number;
  }>(),
  { size: 16 },
);

const icon = computed(() => resolveIcon(props.name));
</script>

<template>
  <component
    :is="icon"
    class="icon"
    :width="props.size"
    :height="props.size"
    aria-hidden="true"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
