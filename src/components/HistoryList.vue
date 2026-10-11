<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef } from "vue";
import Favicon from "./ui/Favicon.vue";
import PanelSearch from "./ui/PanelSearch.vue";
import { useHistory } from "@/composables/useHistory";
import { registerPanelSearch } from "@/composables/usePanelSearch";
import { useSettings } from "@/composables/useSettings";
import { formatVisitStamp } from "@/core/history";
import { openUrl } from "@/core/utils";

const { items, visibleItems, searchActive, searchQuery, loading, failed } =
  useHistory();
const { settings } = useSettings();

const search = useTemplateRef<InstanceType<typeof PanelSearch>>("search");
const stopSearch = registerPanelSearch("history", () => search.value?.focus());

onBeforeUnmount(stopSearch);

function openItem(url?: string): void {
  if (url) openUrl(url, settings.value.openHistoryInNewTab);
}

function openFirstMatch(): void {
  openItem(visibleItems.value[0]?.url);
}
</script>

<template>
  <div class="history-panel">
    <PanelSearch
      ref="search"
      v-model="searchQuery"
      placeholder="Search history"
      @submit="openFirstMatch"
    />

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
        v-else-if="searchActive && visibleItems.length === 0"
        class="pane-empty"
      >
        No matches
      </div>

      <div
        v-for="item in visibleItems"
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
  padding: 0 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  content-visibility: auto;
  contain-intrinsic-size: auto var(--row-h);
}

.row:hover {
  background: var(--hover-bg);
}

.label {
  flex: 1;
  min-width: 0;
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
