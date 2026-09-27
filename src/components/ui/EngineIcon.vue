<script setup lang="ts">
/**
 * Brand marks for the search engines — inline SVG, zero network round trips.
 */
import { computed } from "vue";
import type { EngineId } from "@/core/engines";

interface Mark {
  viewBox: string;
  html: string;
}

const MARKS: Record<EngineId, Mark> = {
  google: {
    viewBox: "0 0 24 24",
    html:
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>',
  },
  bing: {
    viewBox: "0 0 24 24",
    html:
      '<path fill="#00809D" d="M4.8 2.4 3 21.6l8.4-1.2V2.4H4.8z"/>' +
      '<path fill="#00BCF2" d="M11.4 20.4 21 21.6V2.4h-9.6v18z"/>',
  },
  duckduckgo: {
    viewBox: "0 0 24 24",
    html:
      '<circle cx="12" cy="12" r="10" fill="#DE5833"/>' +
      '<path fill="#FFF" d="M12 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>' +
      '<path fill="#FFF" d="M8 11h1v2H8zm7 0h1v2h-1zm-2.5 4-1 1.5h1l.5-.5.5.5h1l-1-1.5z"/>',
  },
  yandex: {
    viewBox: "0 0 24 24",
    html:
      '<circle cx="12" cy="12" r="11" fill="#FC3F1D"/>' +
      '<text x="12" y="16.5" text-anchor="middle" fill="#FFF" font-size="12" font-weight="bold" font-family="Arial, sans-serif">Ya</text>',
  },
  bilibili: {
    viewBox: "0 0 24 24",
    html:
      '<path fill="none" stroke="#FB7299" stroke-width="2" stroke-linecap="round" d="M7.5 6.5 5.2 4.2M16.5 6.5l2.3-2.3"/>' +
      '<rect x="3" y="7" width="18" height="13" rx="3" fill="#FB7299"/>' +
      '<path fill="none" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="m8.6 12.2-1.7 1.7 1.7 1.7m6.8-3.4 1.7 1.7-1.7 1.7"/>',
  },
  github: {
    viewBox: "0 0 16 16",
    html:
      '<path fill="#57606a" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>',
  },
};

const props = withDefaults(
  defineProps<{ engine: EngineId; size?: number }>(),
  { size: 16 },
);

const mark = computed(() => MARKS[props.engine] ?? MARKS.google);
</script>

<template>
  <svg
    class="engine-mark"
    :width="props.size"
    :height="props.size"
    :viewBox="mark.viewBox"
    aria-hidden="true"
    v-html="mark.html"
  />
</template>

<style scoped>
.engine-mark {
  display: block;
  flex: none;
}
</style>
