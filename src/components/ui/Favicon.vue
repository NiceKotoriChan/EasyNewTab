<script setup lang="ts">
// Page favicon with a graceful fallback. Uses Chromium's internal `_favicon` route (the `favicon` permission), so rendering a list never hits the network or leaks the browsing list to a third party.
import { ref, watch } from "vue";
import { getFaviconUrl } from "@/core/utils";
import Icon from "./Icon.vue";

const props = withDefaults(defineProps<{ url?: string; size?: number }>(), {
  size: 16,
});

const failed = ref(false);

watch(
  () => props.url,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <img
    v-if="props.url && !failed"
    class="favicon"
    :src="getFaviconUrl(props.url, props.size)"
    :width="props.size"
    :height="props.size"
    alt=""
    @error="failed = true"
  />
  <Icon v-else class="favicon is-fallback" name="globe" :size="props.size - 2" />
</template>

<style scoped>
.favicon {
  display: block;
  flex: none;
  border-radius: 2px;
}

.favicon.is-fallback {
  color: var(--text-muted);
}
</style>
