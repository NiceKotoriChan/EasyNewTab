<script setup lang="ts">
/**
 * Main-area detail for the selected history entry — read-only apart from
 * "open" and "remove".
 */
import { computed, ref } from "vue";
import Favicon from "../ui/Favicon.vue";
import Icon from "../ui/Icon.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import { useHistory } from "@/composables/useHistory";
import { useSelection } from "@/composables/useSelection";
import { useSettings } from "@/composables/useSettings";
import { formatFullTimestamp } from "@/core/history";

const { findByUrl, remove } = useHistory();
const { selection, clear } = useSelection();
const { settings } = useSettings();

const confirmOpen = ref(false);

const item = computed(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== "history") return undefined;
  return findByUrl(sel.url);
});

function open(): void {
  const url = item.value?.url;
  if (!url) return;
  if (settings.value.openInNewTab !== false) void chrome.tabs.create({ url });
  else void chrome.tabs.update({ url });
}

async function confirmRemove(): Promise<void> {
  const url = item.value?.url;
  confirmOpen.value = false;
  if (!url) return;
  clear();
  await remove(url);
}
</script>

<template>
  <section v-if="item" class="detail">
    <header class="head">
      <Favicon :url="item.url" :size="16" />
      <span class="kind">History</span>
      <span class="spacer" />
      <button type="button" class="action is-primary" @click="open">
        <Icon name="external" :size="13" />
        Open
      </button>
      <button type="button" class="action is-danger" @click="confirmOpen = true">
        <Icon name="trash" :size="13" />
        Remove
      </button>
    </header>

    <div class="body">
      <h2 class="title">{{ item.title || item.url }}</h2>

      <div class="field">
        <span class="label">URL</span>
        <span class="value mono">{{ item.url }}</span>
      </div>
      <div class="field">
        <span class="label">Last visited</span>
        <span class="value">{{ formatFullTimestamp(item.lastVisitTime) }}</span>
      </div>
      <div class="field">
        <span class="label">Visits</span>
        <span class="value">{{ item.visitCount ?? 0 }}</span>
      </div>
      <div class="field">
        <span class="label">Typed</span>
        <span class="value">{{ item.typedCount ?? 0 }} time(s)</span>
      </div>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      title="Remove this page from history?"
      message="Only this page is removed. Other visits are left untouched."
      confirm-label="Remove"
      danger
      @cancel="confirmOpen = false"
      @confirm="confirmRemove"
    />
  </section>

  <section v-else class="detail is-empty">
    <p class="pane-empty">Select an entry to see its details.</p>
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px;
  flex: none;
  border-bottom: 1px solid var(--border);
}

.kind {
  font-size: 12px;
  color: var(--text-muted);
}

.spacer {
  flex: 1;
}

.action {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  font-size: 12.5px;
  color: var(--text-dim);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
}

.action:hover {
  background: var(--hover-bg);
  border-color: var(--text-muted);
  color: var(--text);
}

.action.is-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
  box-shadow: var(--shadow-xs);
}

.action.is-primary:hover {
  filter: brightness(1.08);
}

.action.is-danger {
  color: var(--danger);
  border-color: transparent;
}

.action.is-danger:hover {
  background: var(--danger-soft);
  border-color: transparent;
  color: var(--danger);
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 640px;
}

.title {
  margin: 0 0 2px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: -0.2px;
  word-break: break-word;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-muted);
}

.value {
  font-size: 12.5px;
  color: var(--text-dim);
  word-break: break-all;
}

.is-empty {
  display: grid;
  place-items: center;
}
</style>
