<script setup lang="ts">
import { useSettings } from "@/composables/useSettings";
import { useTopSites } from "@/composables/useTopSites";
import { openUrl } from "@/core/utils";
import Favicon from "../ui/Favicon.vue";

const { sites } = useTopSites();
const { settings } = useSettings();

function open(url: string, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  openUrl(url, settings.value.openTopSitesInNewTab);
}
</script>

<template>
  <nav v-if="sites.length" class="top-sites" aria-label="Most visited sites">
    <a
      v-for="site in sites"
      :key="site.url"
      class="site"
      :href="site.url"
      :title="site.url"
      :data-site-url="site.url"
      @click="open(site.url, $event)"
    >
      <span class="site-icon">
        <Favicon :url="site.url" :size="24" />
      </span>
      <span class="label">{{ site.title }}</span>
    </a>
  </nav>
</template>

<style scoped>
.top-sites {
  --tile-size: 112px;
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--tile-size));
  justify-content: center;
}

.site {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: var(--tile-size);
  height: var(--tile-size);
  border-radius: var(--radius-xs);
  cursor: pointer;
  user-select: none;
  color: var(--text);
  text-decoration: none;
}

.site:hover {
  background: var(--tile-hover);
}

.site-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 48px;
  height: 48px;
  margin-top: 16px;
  border-radius: var(--radius-full);
  background: var(--tile-bg);
}

.label {
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: calc(var(--tile-size) - 10px);
  height: 32px;
  margin-top: 6px;
  padding: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}
</style>
