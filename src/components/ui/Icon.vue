<script setup lang="ts">
/**
 * One icon, by semantic name. Wraps whatever `mdi-icons.ts` maps that name to.
 *
 * The set is Iconify's Material Design Icons, resolved at build time from the
 * offline `@iconify-json/mdi` package — see `mdi-icons.ts` for why, and for the
 * outline-vs-solid choice. What matters here is that the output is still a
 * single `<svg>` carrying the classes the call site passes, so every rule that
 * was written against `.lead`, `.prefix`, `.s-icon`, `.folder-icon` keeps
 * applying unchanged.
 *
 * `icon` is a *filled* glyph, not a stroke drawing: size comes from width and
 * height, never from `stroke-width` (the icons this replaced were 1.6px
 * strokes, so any leftover stroke styling would now be dead weight).
 *
 * `aria-hidden` is set here rather than left to each call site: these icons
 * always sit inside something that already carries the accessible name (a
 * button with `aria-label`, a row with the title as text), and an unlabelled
 * `<svg>` in the tree would make screen readers announce the button twice.
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
