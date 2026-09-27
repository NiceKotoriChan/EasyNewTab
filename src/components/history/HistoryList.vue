<script setup lang="ts">
/**
 * History sidebar panel — grouped by day, newest first.
 *
 * One click opens an entry in a new tab; nothing is selected, so the search box
 * in the main area is never replaced by a click. The read-only detail view is
 * behind the row's context menu — which a touchscreen reaches by long press, the
 * same way every other menu in the app is reached there.
 *
 * The list is unbounded — everything in the profile is requested and every row
 * rendered, which stays cheap because off-screen rows opt out of layout and paint
 * (see `.row` below). Clearing it all goes through a context menu and a
 * confirmation dialog.
 */
import { computed, ref } from "vue";
import Favicon from "../ui/Favicon.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import { useHistory } from "@/composables/useHistory";
import { useSelection } from "@/composables/useSelection";
import { useContextMenu } from "@/composables/useContextMenu";
import { useLongPress } from "@/composables/useLongPress";
import { usePlatform } from "@/composables/usePlatform";
import { useSettings } from "@/composables/useSettings";
import { formatVisitStamp } from "@/core/history";
import { emptyHistoryMenu, historyMenu } from "@/core/menus";

const { groups, loading, failed, remove, clearAll } = useHistory();
const { selection, select, clear } = useSelection();
const { open: openMenu } = useContextMenu();
const { isTouch } = usePlatform();
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

function itemContextMenu(x: number, y: number, url?: string): void {
  if (!url) return;
  openMenu(
    x,
    y,
    historyMenu({ showDetails: !isTouch.value }),
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

/** The space between and below the rows — rows stop the event themselves. */
function blankContextMenu(x: number, y: number): void {
  openMenu(x, y, emptyHistoryMenu(), () => {
    confirmClear.value = true;
  });
}

/**
 * The touch way into both menus.
 *
 * One press listener for the whole list rather than one per entry: the list can
 * hold thousands of rows, and the point the finger stopped at is enough to say
 * which of them — or none of them — was under it.
 */
const longPress = useLongPress((x, y) => {
  const row = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-url]");
  const url = row?.dataset.url;
  if (url) itemContextMenu(x, y, url);
  else blankContextMenu(x, y);
});

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
    <div
      class="list scroll"
      @contextmenu="blankContextMenu($event.clientX, $event.clientY)"
      @click="onListClick"
      v-on="longPress"
    >
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
          :data-url="item.url"
          @click="openItem(item.url)"
          @contextmenu.stop="
            itemContextMenu($event.clientX, $event.clientY, item.url)
          "
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
