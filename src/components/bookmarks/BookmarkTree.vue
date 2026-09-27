<script setup lang="ts">
/**
 * Bookmark sidebar panel: tree, drag & drop.
 *
 * A left click is the whole gesture — `resolveRowActivation` decides whether it
 * opens a bookmark or folds a folder. It never selects, so the search box in the
 * main area is never swapped out from under a click; the detail editor lives
 * behind the row's context menu.
 *
 * The search box appears above the tree only when asked for (`p`, then Esc or
 * its ×), because a filter bar that is always there costs a row of the panel
 * forever. It filters with `searchBookmarks`, which prunes the tree rather than
 * hiding rows.
 *
 * This component owns drag *state* — which node is in the air, which row the
 * pointer is on. The gestures live in `src/dnd/tree.ts`; the zone maths stays in
 * `core/` as a pure function.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import BookmarkRow from "./BookmarkNode.vue";
import ConfirmDialog from "../ui/ConfirmDialog.vue";
import Icon from "../ui/Icon.vue";
import { useBookmarks } from "@/composables/useBookmarks";
import { useContextMenu, type MenuItem } from "@/composables/useContextMenu";
import { useSelection } from "@/composables/useSelection";
import { useSettings } from "@/composables/useSettings";
import { BOOKMARK_TREE, type BookmarkTreeContext, type DropTarget } from "@/composables/bookmarkTree";
import { dragBlockedIds, isFolder as isFolderNode, resolveRowActivation, type BookmarkNode } from "@/core/bookmarks";
import { watchTree, wireRow, type Cleanup, type RowHover, type RowRegistration } from "@/dnd/tree";

const {
  tree,
  visibleTree,
  searchActive,
  searchOpen,
  searchQuery,
  closeSearch,
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
const { selection, select, clear } = useSelection();
const { settings } = useSettings();
const { open: openMenu } = useContextMenu();

const container = ref<HTMLElement | null>(null);
const pendingDelete = ref<BookmarkNode | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

/**
 * Put the caret in the search box.
 *
 * The box only exists while `searchOpen`, and that flag is flipped by the shell
 * rather than here — so the input has to be waited for. Mount is the other way
 * in: `p` pressed while the history panel was showing switches to this one, and
 * then the panel mounts with the box already open.
 */
async function focusSearchInput(): Promise<void> {
  await nextTick();
  searchInput.value?.focus();
}

watch(searchOpen, (open) => {
  if (open) void focusSearchInput();
});

/**
 * The id being carried. Not part of the context: nothing renders from it, it
 * only feeds `blockedIds`. The row's own "am I the one in the air" styling is
 * local to the row, set from its drag start/end callbacks.
 */
const dragId = ref<string | null>(null);

/** The row the pointer is over. Null means "no valid target right now". */
const dropTarget = ref<DropTarget | null>(null);

/**
 * Rows that have to say no to the current drag. Recomputed from the live tree,
 * so a node that was deleted mid-drag simply stops being blocked.
 */
const blockedIds = computed(() => {
  const id = dragId.value;
  return dragBlockedIds(id ? (findNode(id) ?? null) : null);
});

/**
 * The line between rows. Only meaningful for `before` / `after` — "inside" fills
 * the target row itself, which is a different outcome and so a different signal.
 *
 * Coordinates are converted into the scroller's *content* space rather than
 * pinned to the viewport: the row rects are captured while hovering, so a
 * viewport-fixed line would sit still while the list autoscrolled underneath it.
 * In content space it travels with the row for free, and this computed does not
 * re-run on scroll.
 */
const indicator = computed(() => {
  const target = dropTarget.value;
  const el = container.value;
  if (!target || target.position === "inside" || !el) return null;
  const box = el.getBoundingClientRect();
  return {
    left: target.rect.left - box.left + el.scrollLeft,
    // `- 1` straddles the seam: the 2px line is centred on the boundary.
    top:
      (target.position === "before" ? target.rect.top : target.rect.bottom) -
      box.top +
      el.scrollTop -
      1,
    width: target.rect.width,
  };
});

const selectedId = computed(() => {
  const sel = selection.value;
  return sel?.kind === "bookmark" ? sel.id : null;
});

// --- Activation / open -----------------------------------------------

function activateNode(node: BookmarkNode): void {
  // One click does the whole job: a folder folds/unfolds, a bookmark opens.
  // Nothing is selected, so the main area keeps showing the search box — the
  // detail editor is reachable from the context menu instead.
  if (resolveRowActivation(node) === "toggle") {
    toggleExpanded(node.id);
    return;
  }
  openNode(node);
}

function openNode(node: BookmarkNode): void {
  if (!node.url) return;
  if (settings.value.openInNewTab !== false) {
    void chrome.tabs.create({ url: node.url });
  } else {
    void chrome.tabs.update({ url: node.url });
  }
}

async function deleteNode(node: BookmarkNode): Promise<void> {
  if (selectedId.value === node.id) clear();
  await removeNode(node);
}

// --- Context menu ----------------------------------------------------

function nodeContextMenu(event: MouseEvent, node: BookmarkNode): void {
  // Stop here so an unhandled right-click on a bookmark can't also open the
  // empty-area menu underneath it.
  event.stopPropagation();

  // Leaf bookmarks used to get no menu at all: renaming or editing one meant
  // going through the detail editor, which a left click can no longer reach.
  // They get the same menu now, minus the folder-only command.
  const folder = isFolderNode(node);
  const items: MenuItem[] = [
    folder
      ? { label: "New folder", action: "new-folder" }
      : { label: "Open", action: "open" },
    // The only action here that a click cannot do: it is where the URL and
    // title are edited.
    { label: "Edit details", action: "details" },
    { label: "Rename", action: "rename" },
    { label: "Delete", action: "delete", danger: true, separatorBefore: true },
  ];

  openMenu(event, items, (action) => void handleNodeAction(action, node));
}

async function handleNodeAction(action: string, node: BookmarkNode): Promise<void> {
  switch (action) {
    case "open":
      openNode(node);
      break;
    case "details":
      select({ kind: "bookmark", id: node.id });
      break;
    case "new-folder": {
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

function onEmptyContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest(".row")) return; // rows handle their own
  const parentId = rootFolderId.value;
  if (!parentId) return;

  openMenu(event, [{ label: "New folder", action: "new-folder" }], () => {
    void (async () => {
      const name = prompt("Folder name:");
      if (!name) return;
      await createFolder(parentId, name);
    })();
  });
}

// --- Drag & drop -----------------------------------------------------

function hoverRow(node: BookmarkNode, hover: RowHover): void {
  dropTarget.value = { id: node.id, position: hover.position, rect: hover.rect };
}

function leaveRow(node: BookmarkNode): void {
  // Identity-guarded, and it has to be: rows are nested, so a parent folder row
  // also receives a "leave" when the pointer moves onto one of its children.
  // Clearing unconditionally would wipe the state the child had just set and
  // the indicator would flicker.
  if (dropTarget.value?.id === node.id) dropTarget.value = null;
}

/**
 * Hand a row to the drag adapter, and take over the drag's lifetime.
 *
 * The row's own callbacks are about the row (dimming itself while it is in the
 * air); the tree's are about the drag as a whole (which node is in the air,
 * which is why `blockedIds` can be computed at all).
 */
function registerRow(el: HTMLElement, row: RowRegistration): Cleanup {
  return wireRow(el, {
    ...row,
    // Answered here rather than by the row: the row has no idea whether the
    // drag it is being hovered by is still alive, and a dwell timer that
    // outlives its drag opens a folder nobody is dragging into.
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
  if (searchOpen.value) void focusSearchInput();
  const el = container.value;
  if (!el) return;
  unwatch = watchTree(el, {
    container: () => container.value,
    onMove: (draggedId, targetId, position) =>
      void moveNode(draggedId, targetId, position),
    // Blank space under the last row: append to the top-level folder. The
    // list's own end, which is what that gesture looks like it should do.
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
  selectedId,
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

// Drop a stale selection if the bookmarked node disappears (deleted here, or
// synced away from another device).
watch(tree, () => {
  const sel = selection.value;
  if (sel?.kind === "bookmark" && !findNode(sel.id)) clear();
});
</script>

<template>
  <div class="bookmark-panel">
    <!-- On demand only: `p` reveals it, Esc or the × puts it away and clears
         the query. Never written to storage — a filter is a moment, not a
         mode — and it survives a trip to the history panel the same way the
         tree's own folds do. -->
    <div v-if="searchOpen" class="search">
      <Icon name="search" :size="13" class="search-icon" />
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search bookmarks"
        aria-label="Search bookmarks"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        @keydown.esc.prevent.stop="closeSearch"
      />
      <button
        type="button"
        class="search-close"
        title="Close search"
        aria-label="Close search"
        @click="closeSearch"
      >
        <Icon name="close" :size="12" />
      </button>
    </div>

    <div ref="container" class="tree scroll" @contextmenu="onEmptyContextMenu">
      <div v-if="loading && tree.length === 0" class="pane-empty">Loading…</div>
      <div v-else-if="failed" class="pane-empty is-error">
        Failed to load bookmarks
      </div>
      <div v-else-if="tree.length === 0" class="pane-empty">No bookmarks yet</div>
      <!-- Checked before the rows, and only while a query is running: the
           difference between "you have no bookmarks" and "none match" is the
           whole reason the box is worth opening. -->
      <div v-else-if="searchActive && visibleTree.length === 0" class="pane-empty">
        No matches
      </div>
      <template v-else>
        <BookmarkRow
          v-for="node in visibleTree"
          :key="node.id"
          :node="node"
          :depth="0"
        />
      </template>

      <!-- Inside the scroller on purpose: it is positioned in content space,
           so it has to scroll with the rows it points at. -->
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

/* The rows are the whole panel now — no bar above them, so nothing to pin. */
.tree {
  position: relative;
  flex: 1;
  min-height: 0;
  padding-bottom: 8px;
}

/* The search box borrows the panel's own rhythm — a row's height, the same 6px
   side inset as a row — so it lines up with the rows below it instead of
   reading as a second toolbar that appeared from nowhere. */
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--row-h);
  flex: none;
  margin: 6px 6px 4px;
  padding: 0 5px 0 8px;
  background: var(--inset);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow var(--dur) var(--ease);
}

/* The focus ring belongs to the whole field, not to the bare input inside it:
   the input has no border of its own to draw one on. */
.search:focus-within {
  background: var(--surface);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.search-icon {
  flex: none;
  color: var(--text-muted);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  /* 12.5px is the app's form/menu size, not the 14px of the rows around it:
     this is an input, and the app keeps to three text sizes rather than a
     ladder of them. */
  font-size: 12.5px;
}

.search-input:focus-visible {
  /* The global ring would outline the text box inside the field. */
  box-shadow: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-close {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
}

.search-close:hover {
  background: var(--hover-bg);
  color: var(--text);
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
/* The drag preview is a clone of the row, appended to a container the library
   puts on `body` — outside every scoped subtree that styles it. It carries the
   row's classes, so the row's own rules still apply; what is added here is what
   a row never needs: to read as a thing being carried rather than a row
   sitting in a list. */
.drag-ghost {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  opacity: 1;
}
</style>
