<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  type Directive,
} from "vue";
import ConfirmDialog from "./ui/ConfirmDialog.vue";
import Favicon from "./ui/Favicon.vue";
import Icon from "./ui/Icon.vue";
import PanelSearch from "./ui/PanelSearch.vue";
import { useBookmarks } from "@/composables/useBookmarks";
import { useContextMenu } from "@/composables/useContextMenu";
import { useLongPress } from "@/composables/useLongPress";
import { registerPanelSearch } from "@/composables/usePanelSearch";
import { useSettings } from "@/composables/useSettings";
import { emptyTreeMenu, folderMenu } from "@/core/menus";
import {
  dragBlockedIds,
  isFolder,
  resolveRowActivation,
  type BookmarkNode,
  type DropPosition,
} from "@/core/bookmarks";
import { openUrl } from "@/core/utils";
import {
  watchTree,
  wireRow,
  type Cleanup,
  type RowRegistration,
} from "@/dnd/tree";

const {
  tree,
  visibleTree,
  searchActive,
  searchQuery,
  loading,
  failed,
  rootFolderId,
  findNode,
  isExpanded,
  toggleExpanded,
  moveNode,
  moveToEnd,
  createFolder,
  rename,
  removeNode,
} = useBookmarks();
const { settings } = useSettings();
const { open: openMenu } = useContextMenu();

const container = ref<HTMLElement | null>(null);
const pendingDelete = ref<BookmarkNode | null>(null);

const search = useTemplateRef<InstanceType<typeof PanelSearch>>("search");
const stopSearch = registerPanelSearch("bookmarks", () => search.value?.focus());

const dragId = ref<string | null>(null);

interface DropTarget {
  id: string;
  position: DropPosition;
  rect: DOMRect;
}

const dropTarget = ref<DropTarget | null>(null);

const blockedIds = computed(() => {
  const id = dragId.value;
  return dragBlockedIds(id ? (findNode(id) ?? null) : null);
});

interface Row {
  node: BookmarkNode;
  depth: number;
  folder: boolean;
  kids: boolean;
  open: boolean;
}

const rows = computed(() => {
  const out: Row[] = [];
  const walk = (nodes: readonly BookmarkNode[], depth: number): void => {
    for (const node of nodes) {
      const folder = isFolder(node);
      const kids = (node.children?.length ?? 0) > 0;
      const open = folder && kids && isExpanded(node.id);
      out.push({ node, depth, folder, kids, open });
      if (open) walk(node.children ?? [], depth + 1);
    }
  };
  walk(visibleTree.value, 0);
  return out;
});

function isDropInside(id: string): boolean {
  return (
    dropTarget.value?.id === id && dropTarget.value.position === "inside"
  );
}

function registrationFor(id: string): RowRegistration {
  return {
    data: () => {
      const node = findNode(id);
      return { id, kind: node && isFolder(node) ? "folder" : "bookmark" };
    },
    canDrop: () => !blockedIds.value.has(id),
    canExpand: () => {
      const node = findNode(id);
      return (
        !!node &&
        isFolder(node) &&
        (node.children?.length ?? 0) > 0 &&
        !isExpanded(id)
      );
    },
    isDragging: () => dragId.value !== null,
    onHover: (hover) => {
      dropTarget.value = { id, position: hover.position, rect: hover.rect };
    },
    onLeave: () => {
      if (dropTarget.value?.id === id) dropTarget.value = null;
    },
    onDwell: () => toggleExpanded(id),
    onDragStart: () => {
      dragId.value = id;
    },
    onDragEnd: () => {
      dragId.value = null;
      dropTarget.value = null;
    },
  };
}

const cleanups = new WeakMap<HTMLElement, Cleanup>();

const vRowDrag: Directive<HTMLElement, string> = {
  mounted: (el, { value: id }) => {
    cleanups.set(el, wireRow(el, registrationFor(id)));
  },
  unmounted: (el) => {
    cleanups.get(el)?.();
    cleanups.delete(el);
  },
};

const indicator = computed(() => {
  const target = dropTarget.value;
  const el = container.value;
  if (!target || target.position === "inside" || !el) return null;
  const box = el.getBoundingClientRect();
  return {
    left: target.rect.left - box.left + el.scrollLeft,
    top:
      (target.position === "before" ? target.rect.top : target.rect.bottom) -
      box.top +
      el.scrollTop -
      1,
    width: target.rect.width,
  };
});

function activate(node: BookmarkNode): void {
  if (resolveRowActivation(node) === "toggle") {
    toggleExpanded(node.id);
    return;
  }
  if (node.url) openUrl(node.url, settings.value.openInNewTab);
}

function nodeContextMenu(x: number, y: number, node: BookmarkNode): void {
  if (!isFolder(node)) return;
  openMenu(x, y, folderMenu(), (action) => void handleNodeAction(action, node));
}

function blankMenu(x: number, y: number): void {
  const parentId = rootFolderId.value;
  if (!parentId) return;

  openMenu(x, y, emptyTreeMenu(), () => {
    void (async () => {
      const name = prompt("Folder name:");
      if (!name) return;
      await createFolder(parentId, name);
    })();
  });
}

function onBlankContextMenu(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest(".row")) return;
  blankMenu(event.clientX, event.clientY);
}

const longPress = useLongPress((x, y) => {
  const row = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-node-id]");
  const id = row?.dataset.nodeId;
  const node = id ? findNode(id) : undefined;
  if (node) nodeContextMenu(x, y, node);
  else blankMenu(x, y);
});

async function handleNodeAction(action: string, node: BookmarkNode): Promise<void> {
  switch (action) {
    case "new": {
      const name = prompt("Folder name:");
      if (!name) return;
      await createFolder(node.id, name);
      break;
    }
    case "rename": {
      const next = prompt(
        isFolder(node) ? "Rename folder:" : "Rename bookmark:",
        node.title,
      );
      if (next === null) return;
      await rename(node.id, next || node.title);
      break;
    }
    case "delete":
      pendingDelete.value = node;
      break;
  }
}

function confirmDelete(): void {
  const node = pendingDelete.value;
  pendingDelete.value = null;
  if (node) void removeNode(node);
}

let unwatch: Cleanup | null = null;

onMounted(() => {
  const el = container.value;
  if (!el) return;
  unwatch = watchTree(el, {
    container: () => container.value,
    onMove: (draggedId, targetId, position) =>
      void moveNode(draggedId, targetId, position),
    onAppend: (draggedId) => void moveToEnd(draggedId),
    onFinish: () => {
      dragId.value = null;
      dropTarget.value = null;
    },
  });
});

onBeforeUnmount(() => {
  unwatch?.();
  unwatch = null;
  stopSearch();
});
</script>

<template>
  <div class="bookmark-panel">
    <PanelSearch ref="search" v-model="searchQuery" placeholder="Search bookmarks" />

    <div
      ref="container"
      class="tree scroll"
      @contextmenu="onBlankContextMenu"
      v-on="longPress"
    >
      <div v-if="loading && tree.length === 0" class="pane-empty">Loading…</div>
      <div v-else-if="failed" class="pane-empty is-error">
        Failed to load bookmarks
      </div>
      <div v-else-if="tree.length === 0" class="pane-empty">No bookmarks yet</div>
      <div
        v-else-if="searchActive && visibleTree.length === 0"
        class="pane-empty"
      >
        No matches
      </div>
      <template v-else>
        <div
          v-for="row in rows"
          :key="row.node.id"
          v-row-drag="row.node.id"
          class="row"
          :class="{
            'is-drop-inside': isDropInside(row.node.id),
            'is-blocked': blockedIds.has(row.node.id),
            dragging: dragId === row.node.id,
          }"
          :style="{ paddingLeft: row.depth * 14 + 4 + 'px' }"
          :data-node-id="row.node.id"
          :title="row.node.url || row.node.title"
          @click="activate(row.node)"
          @contextmenu.stop="
            nodeContextMenu($event.clientX, $event.clientY, row.node)
          "
        >
          <button
            v-if="row.folder"
            type="button"
            class="twisty"
            :aria-label="row.open ? 'Collapse' : 'Expand'"
            @click.stop="toggleExpanded(row.node.id)"
          >
            <Icon
              v-if="row.kids"
              :name="row.open ? 'chevron-down' : 'chevron-right'"
              :size="12"
            />
          </button>
          <span v-else class="twisty is-empty" />

          <Icon
            v-if="row.folder"
            class="lead is-folder"
            :name="row.open ? 'folder-open' : 'folder'"
            :size="14"
          />
          <Favicon v-else class="lead" :url="row.node.url" :size="14" />

          <span class="label">{{ row.node.title || row.node.url }}</span>

          <button
            v-if="!row.folder"
            type="button"
            class="remove"
            title="Delete bookmark"
            aria-label="Delete bookmark"
            @click.stop="removeNode(row.node)"
          >
            <Icon name="close" :size="12" />
          </button>
        </div>
      </template>

      <div
        v-if="indicator"
        class="drop-line"
        :style="{
          left: indicator.left + 'px',
          top: indicator.top + 'px',
          width: indicator.width + 'px',
        }"
      />
    </div>

    <ConfirmDialog
      :open="pendingDelete !== null"
      :title="`Delete “${pendingDelete?.title || 'folder'}”?`"
      message="The folder and everything inside it will be removed. This cannot be undone."
      confirm-label="Delete"
      danger
      @cancel="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.bookmark-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.tree {
  position: relative;
  flex: 1;
  min-height: 0;
  padding-bottom: 8px;
}

.drop-line {
  position: absolute;
  z-index: 2;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--accent);
  pointer-events: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--row-h);
  margin: 0 6px;
  padding-right: 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text);
  user-select: none;
}

.row:hover {
  background: var(--hover-bg);
}

.row.is-drop-inside {
  background: var(--accent-soft);
  color: var(--selection-fg);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.row.is-drop-inside .twisty,
.row.is-drop-inside .lead.is-folder {
  color: inherit;
}

.row.is-blocked {
  opacity: 0.4;
}

.row.is-blocked:hover {
  background: transparent;
}

.row.dragging {
  opacity: 0.45;
}

.twisty {
  display: grid;
  place-items: center;
  width: 14px;
  height: 100%;
  flex: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
}

.twisty:hover {
  color: var(--text);
}

.twisty.is-empty {
  cursor: inherit;
}

.lead {
  flex: none;
}

.lead.is-folder {
  color: var(--icon-folder);
}

.label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

@media (pointer: coarse) {
  .remove {
    display: grid;
  }
}
</style>

<style>
.drag-ghost {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  opacity: 1;
}
</style>
