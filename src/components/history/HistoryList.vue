<script setup lang="ts">
/**
 * History sidebar panel — grouped by day, newest first.
 *
 * One click opens an entry in a new tab; nothing is selected, so the search box
 * in the main area is never replaced by a click. The row's other action is its
 * own delete button, and that is the whole surface: this panel has no context
 * menu, on rows or on the blank space, because a list you read and prune does not
 * need one — every action it has is already on the row that has it.
 *
 * The list is unbounded — everything in the profile is requested and every row
 * rendered, which stays cheap because off-screen rows opt out of layout and paint
 * (see `.row` below).
 */
import Favicon from "../ui/Favicon.vue";
import Icon from "../ui/Icon.vue";
import { useHistory } from "@/composables/useHistory";
import { useSettings } from "@/composables/useSettings";
import { formatVisitStamp } from "@/core/history";

const { groups, loading, failed, remove } = useHistory();
const { settings } = useSettings();

function openItem(url?: string): void {
  if (!url) return;
  if (settings.value.openInNewTab !== false) void chrome.tabs.create({ url });
  else void chrome.tabs.update({ url });
}

/** `HistoryItem.url` is optional in the API's own types, so the guard is real. */
function removeItem(url?: string): void {
  if (!url) return;
  void remove(url);
}
</script>

<template>
  <div class="history-panel">
    <div class="list scroll">
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
          :title="item.url"
          @click="openItem(item.url)"
        >
          <Favicon :url="item.url" :size="14" />
          <span class="label">{{ item.title || item.url }}</span>
          <span class="time">{{ formatVisitStamp(item.lastVisitTime) }}</span>
          <button
            type="button"
            class="remove"
            title="Remove from history"
            aria-label="Remove from history"
            @click.stop="removeItem(item.url)"
          >
            <Icon name="close" :size="12" />
          </button>
        </div>
      </template>
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
  padding: 0 4px 0 8px;
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

.remove {
  display: none;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
}

.row:hover .remove {
  display: grid;
}

.remove:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* A cursor reveals the button on hover; a finger has no hover, so there it is
   always there. Without this the row would have no delete at all on a
   touchscreen, because the button is the only one it has. */
@media (pointer: coarse) {
  .remove {
    display: grid;
  }
}
</style>
