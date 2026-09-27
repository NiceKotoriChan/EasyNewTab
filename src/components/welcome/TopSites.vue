<script setup lang="ts">
/**
 * The most-visited row: up to eight sites, under the search box.
 *
 * The tiles are Chromium's, not invented here. The built-in new tab page mounts
 * `cr-most-visited` (`ui/webui/resources/cr_components/most_visited`, with
 * `single-row reflow-on-overflow`), and everyone has already seen what that
 * looks like: a 112px tile holding a 48px filled circle with a 24px favicon
 * centred in it, a 12px label under the circle, the whole tile washing to a
 * translucent grey on hover. Every number below is that component's own default
 * — `--tile-size` 112px, `--icon-size` 48px, 16px above the icon, 6px above the
 * label, a 32px title box, a 4px tile radius — so "the same as Chrome" stays
 * checkable against its source instead of against memory.
 *
 * Two things are deliberately not copied:
 *
 * - **The single reflowing row.** Chromium lays the shortcuts out in one line
 *   and lets that line run wider than the search box. This pane is 620px, where
 *   a fifth column would fold eight sites into an uneven 5+3, so the grid stays
 *   two rows of four — the balanced form of the same grid.
 * - **The add/edit affordances.** No `+` tile, no per-tile `⋮` menu, no
 *   drag-to-reorder. Shortcuts are Chrome's list; the sidebar is where a new
 *   tab gets edited. Nothing is drawn when there is nothing to show, either:
 *   no placeholder, no explanation. An empty row is not a feature.
 *
 * Clicking obeys the same setting the sidebar does (`openInNewTab`), because a
 * shortcut that opened differently from a bookmark would be a trap. The element
 * is a real `<a>` so the URL preview and modifier-clicks keep working; the
 * handler only takes over the plain left click, whose default would navigate
 * *this* tab off the new tab page.
 *
 * `data-site-url` is the render check's handle on one entry. It needs one: the
 * URL also appears percent-encoded inside the favicon's query string, so a
 * document-wide search for the host would be answered by the icon even if the
 * label were blank — which is the exact mistake the label fallback exists to
 * prevent. (`label` in the check has to tolerate `data-v-…` between the class
 * and the `>`, because scoped CSS puts one on every element.)
 */
import { useSettings } from "@/composables/useSettings";
import { useTopSites } from "@/composables/useTopSites";
import Favicon from "../ui/Favicon.vue";

const { sites } = useTopSites();
const { settings } = useSettings();

function open(url: string, event: MouseEvent): void {
  // Cmd/Ctrl click means "a tab of its own" and the browser already does that
  // from the `href`. Only the plain click needs intercepting.
  if (event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  if (settings.value.openInNewTab !== false) void chrome.tabs.create({ url });
  else void chrome.tabs.update({ url });
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
  /* Chromium's `--tile-size` default, and the unit the whole row is built from:
     the track width, the tile, and the label's own ellipsis box. */
  --tile-size: 112px;
  display: grid;
  /* Fixed tracks rather than `1fr`: the tiles are a fixed size in Chromium, and
     stretching them would push the labels past the `--tile-size - 10px` box its
     ellipsis rule is written against. */
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
  /* The app has no link reset, so the browser's blue-and-underlined default has
     to be turned off here — this is a tile, not a link somebody pasted. Chromium
     also uses the *primary* foreground for the label, so this is `--text` and
     not the muted grey the eye would expect under a search box. */
  color: var(--text);
  text-decoration: none;
}

/* Chromium washes the entire tile, not just the circle: the 112px square is the
   hit area, and the hover is what says so. The text colour does not change. */
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
  /* Chromium pushes the icon 16px down inside the tile rather than centring the
     tile's contents, which is what leaves the slack at the bottom. */
  margin-top: 16px;
  border-radius: var(--radius-full);
  background: var(--tile-bg);
}

/* Chromium's title box: 32px tall around a 16px line, so the single line lands
   in the middle; the padding is symmetric for the same reason. The ellipsis sits
   on the box itself — Chromium nests a span inside it to handle RTL, and there
   is nothing to reverse here, so the extra element would only cost the render
   check its label slice. */
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

/* Four 112px tiles plus the welcome pane's 24px gutters; narrower than that the
   row folds the way Chromium's own grid does when the columns stop fitting. */
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
