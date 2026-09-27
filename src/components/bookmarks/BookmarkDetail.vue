<script setup lang="ts">
/**
 * Main-area detail/editor for the selected bookmark or folder.
 *
 * Both title and URL are editable because `chrome.bookmarks.update` accepts
 * either — the old UI only exposed rename via a `prompt()` on the context menu.
 */
import { computed, ref, watch } from "vue";
import Favicon from "../ui/Favicon.vue";
import Icon from "../ui/Icon.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import { useBookmarks } from "@/composables/useBookmarks";
import { useSelection } from "@/composables/useSelection";
import { useSettings } from "@/composables/useSettings";
import { folderPath, isFolder, nodeKind } from "@/core/bookmarks";
import { prettyUrl } from "@/core/utils";

const { selection, clear } = useSelection();
const { tree, findNode, updateNode, removeNode } = useBookmarks();
const { settings } = useSettings();

const node = computed(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== "bookmark") return undefined;
  return findNode(sel.id);
});

const title = ref("");
const url = ref("");
const confirmOpen = ref(false);

// Reset the form only when a *different* node is selected. Keying this on the
// node object would wipe whatever the user is typing the moment the tree
// reloads (which happens after every mutation).
watch(
  () => node.value?.id,
  () => {
    title.value = node.value?.title ?? "";
    url.value = node.value?.url ?? "";
  },
  { immediate: true },
);

const isFolderNode = computed(() => (node.value ? isFolder(node.value) : false));

const path = computed(() => {
  const current = node.value;
  if (!current) return "";
  const trail = folderPath(tree.value, current.id);
  if (!trail) return "";
  return [...trail, current.title].join("  /  ");
});

const dirty = computed(() => {
  const current = node.value;
  if (!current) return false;
  return (
    title.value !== (current.title ?? "") ||
    (!isFolderNode.value && url.value !== (current.url ?? ""))
  );
});

async function save(): Promise<void> {
  const current = node.value;
  if (!current || !dirty.value) return;
  const changes: { title?: string; url?: string } = { title: title.value };
  if (!isFolderNode.value) changes.url = url.value;
  await updateNode(current.id, changes);
}

function open(): void {
  const current = node.value;
  if (!current?.url) return;
  if (settings.value.openInNewTab !== false) {
    void chrome.tabs.create({ url: current.url });
  } else {
    void chrome.tabs.update({ url: current.url });
  }
}

async function confirmRemove(): Promise<void> {
  const current = node.value;
  confirmOpen.value = false;
  if (!current) return;
  clear();
  await removeNode(current);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void save();
  }
}
</script>

<template>
  <section v-if="node" class="detail">
    <header class="head">
      <Favicon v-if="!isFolderNode" :url="node.url" :size="16" />
      <Icon v-else name="folder" :size="16" class="folder-icon" />
      <span class="kind">{{ nodeKind(node) === "folder" ? "Folder" : "Bookmark" }}</span>
      <span class="spacer" />
      <button type="button" class="action" :disabled="!dirty" @click="save">
        Save
      </button>
      <button
        v-if="node.url"
        type="button"
        class="action is-primary"
        @click="open"
      >
        <Icon name="external" :size="13" />
        Open
      </button>
      <button type="button" class="action is-danger" @click="confirmOpen = true">
        <Icon name="trash" :size="13" />
        Delete
      </button>
    </header>

    <div class="body">
      <label class="field">
        <span class="label">Name</span>
        <input
          v-model="title"
          class="input"
          type="text"
          spellcheck="false"
          @keydown="onKeydown"
        />
      </label>

      <label v-if="!isFolderNode" class="field">
        <span class="label">URL</span>
        <input
          v-model="url"
          class="input mono"
          type="text"
          spellcheck="false"
          @keydown="onKeydown"
        />
      </label>

      <div class="field">
        <span class="label">Location</span>
        <span class="value mono">{{ path || "—" }}</span>
      </div>

      <div v-if="!isFolderNode" class="field">
        <span class="label">Host</span>
        <span class="value mono">{{ prettyUrl(node.url) || "—" }}</span>
      </div>

      <p v-if="dirty" class="hint">
        Press Enter or click Save to apply changes.
      </p>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :title="`Delete “${node.title || 'item'}”?`"
      :message="
        isFolderNode
          ? 'The folder and everything inside it will be removed. This cannot be undone.'
          : 'This bookmark will be removed. This cannot be undone.'
      "
      confirm-label="Delete"
      danger
      @cancel="confirmOpen = false"
      @confirm="confirmRemove"
    />
  </section>

  <section v-else class="detail is-empty">
    <p class="pane-empty">Select a bookmark to see its details.</p>
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

/* No expanded state here: the detail view is a form about a folder, not the
   folder's row, so it always shows the closed glyph in the shared tint. */
.folder-icon {
  color: var(--icon-folder);
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

.action:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--text-muted);
  color: var(--text);
}

.action:disabled {
  opacity: 0.4;
  cursor: default;
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

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-muted);
}

.input {
  height: 34px;
  padding: 0 11px;
  background: var(--input-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  font-size: 13px;
}

.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.value {
  font-size: 12.5px;
  color: var(--text-dim);
  word-break: break-all;
}

.hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.is-empty {
  display: grid;
  place-items: center;
}
</style>
