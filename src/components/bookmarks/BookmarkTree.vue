<script setup lang="ts">
// Bookmark sidebar panel: tree, drag & drop. Click is the whole gesture; one listener
// covers right-click + long-press for the whole tree (a finger may not stay on its row).
import { computed, onBeforeUnmount, onMounted, provide, ref } from "vue";
import BookmarkRow from "./BookmarkNode.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import { useBookmarks } from "@/composables/useBookmarks";
import { useContextMenu } from "@/composables/useContextMenu";
import { useLongPress } from "@/composables/useLongPress";
import { useSettings } from "@/composables/useSettings";
import { BOOKMARK_TREE, type BookmarkTreeContext, type DropTarget } from "@/composables/bookmarkTree";
import { emptyTreeMenu, folderMenu } from "@/core/menus";
import { dragBlockedIds, isFolder as isFolderNode, resolveRowActivation, type BookmarkNode } from "@/core/bookmarks";
import { openUrl } from "@/core/utils";
import { watchTree, wireRow, type Cleanup, type RowHover, type RowRegistration } from "@/dnd/tree";

const {
  tree,
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

// The id in flight — feeds `blockedIds`; the row's own drag styling lives on the row.
const dragId = ref<string | null>(null);

// Row under the pointer; null means no valid drop target right now.
const dropTarget = ref<DropTarget | null>(null);

// Recomputed from the live tree, so a node deleted mid-drag simply stops being blocked.
const blockedIds = computed(() => {
  const id = dragId.value;
  return dragBlockedIds(id ? (findNode(id) ?? null) : null);
});

// Drawn in the scroller's content space (not the viewport) so it scrolls with the row, and this computed need not re-run on scroll.
const indicator = computed(() => {
  const target = dropTarget.value;
  const el = container.value;
  if (!target || target.position === "inside" || !el) return null;
  const box = el.getBoundingClientRect();
  return {
    left: target.rect.left - box.left + el.scrollLeft,
    // `- 1` centres the 2px line on the seam.
    top:
      (target.position === "before" ? target.rect.top : target.rect.bottom) -
      box.top +
      el.scrollTop -
      1,
    width: target.rect.width,
  };
});

// One click does the whole job; nothing is selected, so the search box stays.
function activateNode(node: BookmarkNode): void {
  if (resolveRowActivation(node) === "toggle") {
    toggleExpanded(node.id);
    return;
  }
  openNode(node);
}

function openNode(node: BookmarkNode): void {
  if (!node.url) return;
  openUrl(node.url, settings.value.openInNewTab);
}

async function deleteNode(node: BookmarkNode): Promise<void> {
  await removeNode(node);
}

// Anchored by coordinates: long-press has no MouseEvent, only right-click does.
function nodeContextMenu(x: number, y: number, node: BookmarkNode): void {
  // Only a folder has a menu; a bookmark right-click opens nothing, not the blank-space menu.
  if (!isFolderNode(node)) return;
  openMenu(x, y, folderMenu(), (action) => void handleNodeAction(action, node));
}

// The blank space under the tree — where a top-level folder is made.
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
  // Gaps between rows are still blank space and open this menu (rows stop the event themselves).
  if ((event.target as HTMLElement).closest(".row")) return;
  blankMenu(event.clientX, event.clientY);
}

// Touch entry: ask the element under the finger for its `data-node-id`; anything else is blank space.
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
        isFolderNode(node) ? "Rename folder:" : "Rename bookmark:",
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

function hoverRow(node: BookmarkNode, hover: RowHover): void {
  dropTarget.value = { id: node.id, position: hover.position, rect: hover.rect };
}

function leaveRow(node: BookmarkNode): void {
  // Identity-guarded: nested rows also receive "leave" when entering a child, so clearing blindly would flicker the indicator.
  if (dropTarget.value?.id === node.id) dropTarget.value = null;
}

// Hands the row to the drag adapter; tree-level callbacks own the drag as a whole (so `blockedIds` can be computed).
function registerRow(el: HTMLElement, row: RowRegistration): Cleanup {
  return wireRow(el, {
    ...row,
    // Answered here: the row can't tell if the drag it's hovered by is still alive.
    isDragging: () => dragId.value !== null,
    onDragStart: () => {
      dragId.value = row.data().id;
      row.onDragStart();
    },
    onDragEnd: () => {
      dragId.value = null;
      dropTarget.value = null;
      row.onDragEnd();
    },
  });
}

let unwatch: Cleanup | null = null;

onMounted(() => {
  const el = container.value;
  if (!el) return;
  unwatch = watchTree(el, {
    container: () => container.value,
    onMove: (draggedId, targetId, position) =>
      void moveNode(draggedId, targetId, position),
    // Blank space under the last row: append to the top-level folder.
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
});

const context: BookmarkTreeContext = {
  isExpanded,
  toggleExpanded,
  dropTarget,
  blockedIds,
  activate: activateNode,
  nodeContextMenu,
  deleteNode: (node) => void deleteNode(node),
  registerRow,
  hoverRow,
  leaveRow,
};
provide(BOOKMARK_TREE, context);
</script>

<template>
  <div class="bookmark-panel">
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
      <template v-else>
        <BookmarkRow
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :depth="0"
        />
      </template>

      <!-- Kept inside the scroller so it scrolls with the rows it points at. -->
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
      @confirm="
        () => {
          const node = pendingDelete;
          pendingDelete = null;
          if (node) void deleteNode(node);
        }
      "
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

/* Positioned in the scroller's content space, so it scrolls with its row. */
.drop-line {
  position: absolute;
  z-index: 2;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--accent);
  pointer-events: none;
}
</style>

<style>
/* A clone of the row, appended to `body`, outside any scoped subtree — so it reads as a thing being carried, not a row in a list. */
.drag-ghost {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  opacity: 1;
}
</style>
