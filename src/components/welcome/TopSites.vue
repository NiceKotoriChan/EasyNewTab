<script setup lang="ts">
// The most-visited row: Chrome's own top entries, up to eight of them, under the search box. The tile is Chromium's `cr-most-visited` (sizes copied from its source); `data-site-url` is the render check's handle on one entry.
import { useSettings } from "@/composables/useSettings";
import { useTopSites } from "@/composables/useTopSites";
import { openUrl } from "@/core/utils";
import Favicon from "../ui/Favicon.vue";

const { sites } = useTopSites();
const { settings } = useSettings();

function open(url: string, event: MouseEvent): void {
  // Cmd/Ctrl click already opens its own tab via the `href`; only the plain click needs intercepting.
  if (event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  openUrl(url, settings.value.openInNewTab);
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
  /* Chromium's `--tile-size` default, and the unit the whole row is built from (track, tile, label ellipsis box). */
  --tile-size: 112px;
  display: grid;
  /* Fixed tracks, not `1fr`: stretching would push labels past the `--tile-size - 10px` ellipsis box Chromium's rule is written against. */
  grid-template-columns: repeat(4, var(--tile-size));
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
  /* No link reset in the app, so turn off the browser's blue underline here; Chromium uses `--text` (the primary fg) for the label, not the muted grey. */
  color: var(--text);
  text-decoration: none;
}

/* Chromium washes the whole tile, not just the circle: the 112px square is the hit area, and the hover says so. */
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
  /* Chromium pushes the icon 16px down inside the tile rather than centring contents, leaving the slack at the bottom. */
  margin-top: 16px;
  border-radius: var(--radius-full);
  background: var(--tile-bg);
}

/* Chromium's title box: 32px tall around a 16px line (symmetric padding). The ellipsis sits on the box — Chromium nests a span for RTL, but there's nothing to reverse here, so the extra element would only cost the render check its label slice. */
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

/* Four 112px tiles plus the 24px gutters; narrower than that the row folds, like Chromium's own grid when columns stop fitting. */
@media (max-width: 495px) {
  .top-sites {
    grid-template-columns: repeat(3, var(--tile-size));
  }
}

@media (max-width: 383px) {
  .top-sites {
    grid-template-columns: repeat(2, var(--tile-size));
  }
}
</style>
