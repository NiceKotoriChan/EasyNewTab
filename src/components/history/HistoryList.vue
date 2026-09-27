<script setup lang="ts">
/**
 * History sidebar panel — grouped by day, newest first.
 *
 * One click opens an entry in a new tab: no double click, and nothing is
 * selected, so the search box in the main area is never replaced by a click.
 * The read-only detail view is behind the row's context menu.
 *
 * The list is unbounded: everything in the profile is requested and every row
 * is rendered, which stays cheap because off-screen rows opt out of layout and
 * paint (see `.row` below). No pagination, no "load more".
 *
 * Clearing everything is behind both a context menu and a confirmation
 * dialog. Previously it was a bare `d` key with no prompt.
 */
import { computed, ref } from "vue";
import Favicon from "../ui/Favicon.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import { useHistory } from "@/composables/useHistory";
import { useSelection } from "@/composables/useSelection";
import { useContextMenu } from "@/composables/useContextMenu";
import { useSettings } from "@/composables/useSettings";
import { formatVisitStamp } from "@/core/history";

const { groups, loading, failed, remove, clearAll } = useHistory();
const { selection, select, clear } = useSelection();
const { open: openMenu } = useContextMenu();
const { settings } = useSettings();

const confirmClear = ref(false);

const selectedUrl = computed(() => {
  const sel = selection.value;
  return sel?.kind === "history" ? sel.url : null;
});

function openItem(url?: string): void {
  if (!url) return;
  if (settings.value.openInNewTab !== false) void chrome.tabs.create({ url });
  else void chrome.tabs.update({ url });
}

function itemContextMenu(event: MouseEvent, url?: string): void {
  if (!url) return;
  openMenu(
    event,
    [
      { label: "Open", action: "open" },
      { label: "Details", action: "details" },
      {
        label: "Remove from history",
        action: "remove",
        danger: true,
        separatorBefore: true,
      },
    ],
    (action) => {
      if (action === "open") openItem(url);
      // The main area is the search box by default; details are asked for
      // explicitly rather than triggered by a stray click.
      if (action === "details") select({ kind: "history", url });
      if (action === "remove") {
        if (selectedUrl.value === url) clear();
        void remove(url);
      }
    },
  );
}

function blankContextMenu(event: MouseEvent): void {
  openMenu(
    event,
    [{ label: "Clear all history…", action: "clear", danger: true }],
    () => {
      confirmClear.value = true;
    },
  );
}

function onListClick(event: MouseEvent): void {
  if (!(event.target as HTMLElement).closest(".row")) clear();
}

async function confirmClearAll(): Promise<void> {
  confirmClear.value = false;
  clear();
  await clearAll();
}
</script>

<template>
  <div class="history-panel">
    <div class="list scroll" @contextmenu="blankContextMenu" @click="onListClick">
      <div v-if="loading && groups.length === 0" class="pane-empty">
        Loading…
      </div>
      <div v-else-if="failed" class="pane-empty is-error">
        Failed to load history
      </div>
      <div v-else-if="groups.length === 0" class="pane-empty">
        No history yet
      </div>

      <template v-for="group in groups" :key="group.key">
        <div class="group">{{ group.label }}</div>
        <div
          v-for="item in group.items"
          :key="item.url ?? item.id"
          class="row"
          :class="{ 'is-selected': item.url === selectedUrl }"
          :title="item.url"
          @click="openItem(item.url)"
          @contextmenu="itemContextMenu($event, item.url)"
        >
          <Favicon :url="item.url" :size="14" />
          <span class="label">{{ item.title || item.url }}</span>
          <span class="time">{{ formatVisitStamp(item.lastVisitTime) }}</span>
        </div>
      </template>
    </div>

    <ConfirmDialog
      :open="confirmClear"
      title="Clear all browsing history?"
      message="Every visited page will be removed from Chrome's history. This cannot be undone."
      confirm-label="Clear all"
      danger
      @cancel="confirmClear = false"
      @confirm="confirmClearAll"
    />
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

.group {
  padding: 12px 14px 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--row-h);
  margin: 0 6px;
  padding: 0 8px 0 8px;
  border-radius: var(--radius-sm);
  /* A click opens the entry, so say so. */
  cursor: pointer;
  user-select: none;
  /* The history query is unbounded, so a decade-old profile can hand back tens
     of thousands of rows. Skipping layout and paint for the off-screen ones is
     what keeps the panel opening instantly; the intrinsic size keeps the
     scrollbar height exact. */
  content-visibility: auto;
  contain-intrinsic-size: auto var(--row-h);
}

.row:hover {
  background: var(--hover-bg);
}

.row.is-selected {
  background: var(--selection-bg);
  color: var(--selection-fg);
}

.label {
  flex: 1;
  min-width: 0;
  /* Kept in step with the bookmark tree's row label — same column, same scale.
     The timestamp and the day header stay at 11px so they read as metadata
     beside it rather than as competing content. */
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

.row.is-selected .time {
  color: inherit;
  opacity: 0.8;
}
</style>
