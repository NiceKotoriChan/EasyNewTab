<script setup lang="ts">
/**
 * One icon, by semantic name. See `mdi-icons.ts` for the set and why it is
 * resolved at build time.
 *
 * The output is a single `<svg>` carrying the classes the call site passes, so
 * rules written against `.lead`, `.prefix` and friends keep applying unchanged.
 * Size comes from width and height, never from `stroke-width`: these are filled
 * glyphs, not strokes.
 *
 * `aria-hidden` is set here rather than at each call site — these icons always
 * sit inside something that already carries the accessible name, and an
 * unlabelled `<svg>` would make a screen reader announce the control twice.
 */
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
