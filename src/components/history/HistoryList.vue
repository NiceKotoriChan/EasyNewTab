<script setup lang="ts">
// History sidebar panel — one flat list, newest first. One click opens an entry in a new tab; opening is the row's only action (no delete, no menu). How much it lists is the shell's `historyLimit`.
import Favicon from "../ui/Favicon.vue";
import { useHistory } from "@/composables/useHistory";
import { useSettings } from "@/composables/useSettings";
import { formatVisitStamp } from "@/core/history";
import { openUrl } from "@/core/utils";

const { items, loading, failed } = useHistory();
const { settings } = useSettings();

// `url` is optional in the history API's types, so this guard is real.
function openItem(url?: string): void {
  if (url) openUrl(url, settings.value.openInNewTab);
}
</script>

<template>
  <div class="history-panel">
    <div class="list scroll">
      <div v-if="loading && items.length === 0" class="pane-empty">
        Loading…
      </div>
      <div v-else-if="failed" class="pane-empty is-error">
        Failed to load history
      </div>
      <div v-else-if="items.length === 0" class="pane-empty">
        No history yet
      </div>

      <div
        v-for="item in items"
        :key="item.url ?? item.id"
        class="row"
        :title="item.url"
        @click="openItem(item.url)"
      >
        <Favicon :url="item.url" :size="14" />
        <span class="label">{{ item.title || item.url }}</span>
        <span class="time">{{ formatVisitStamp(item.lastVisitTime) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.list {
  flex: 1;
  min-height: 0;
  padding-bottom: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--row-h);
  margin: 0 6px;
  /* Both sides get the same inset so the row is balanced and the timestamp column lines up down the list. */
  padding: 0 8px;
  border-radius: var(--radius-sm);
  /* A click opens the entry. */
  cursor: pointer;
  user-select: none;
  /* A long list is the normal case (the cap is a setting away); `content-visibility: auto` skips off-screen work so the panel opens instantly, and the intrinsic size keeps the scrollbar exact. */
  content-visibility: auto;
  contain-intrinsic-size: auto var(--row-h);
}

.row:hover {
  background: var(--hover-bg);
}

.label {
  flex: 1;
  min-width: 0;
  /* Kept at 14px to match the bookmark tree's row label (same column); the timestamp stays 11px so it reads as metadata, not competing content. */
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  flex: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
</style>
