<script setup lang="ts">
// Bookmark sidebar panel: filter bar, the indented list of visible rows, drag & drop. One click is
// the whole gesture; one listener covers right-click + long-press for the whole list (a finger may
// not stay on its row). Row height is a fixed `--row-h` so the drop-zone maths stays predictable.
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

// `b` is the way in; the panel is the one that registers where that lands.
const search = useTemplateRef<InstanceType<typeof PanelSearch>>("search");
const stopSearch = registerPanelSearch("bookmarks", () => search.value?.focus());

// The id in flight — feeds `blockedIds`; the row's own drag styling is the `.dragging` class.
const dragId = ref<string | null>(null);

interface DropTarget {
  id: string;
  position: DropPosition;
  /** The row's box, so the indicator line can be placed without re-querying. */
  rect: DOMRect;
}

// Row under the pointer; null means no valid drop target right now.
const dropTarget = ref<DropTarget | null>(null);

// Recomputed from the live tree, so a node deleted mid-drag simply stops being blocked.
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

/**
 * The visible tree flattened to what the DOM needs: one entry per row, with its depth. Drawn as an
 * indented list rather than nested groups — nothing a row does depends on its parent, and one
 * element per node is what lets a drag registration live exactly as long as its row.
 */
const rows = computed(() => {
  const out: Row[] = [];
  const walk = (nodes: readonly BookmarkNode[], depth: number): void => {
    for (const node of nodes) {
      const folder = isFolder(node);
      const kids = (node.children?.length ?? 0) > 0;
      // Guarded by `kids`: an empty folder still lands in `expandedIds` on first load but has
      // nothing to reveal.
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

/**
 * Answered from the live tree by id, so a registration outlives the node object it was made for.
 */
function registrationFor(id: string): RowRegistration {
  return {
    data: () => {
      const node = findNode(id);
      return { id, kind: node && isFolder(node) ? "folder" : "bookmark" };
    },
    canDrop: () => !blockedIds.value.has(id),
    // Only a collapsed folder with children is worth spring-loading open.
    canExpand: () => {
      const node = findNode(id);
      return (
        !!node &&
        isFolder(node) &&
        (node.children?.length ?? 0) > 0 &&
        !isExpanded(id)
      );
    },
    // Answered here: the row can't tell if the drag it's hovered by is still alive.
    isDragging: () => dragId.value !== null,
    onHover: (hover) => {
      dropTarget.value = { id, position: hover.position, rect: hover.rect };
    },
    // Identity-guarded: nested rows also receive "leave" when entering a child, so clearing blindly
    // would flicker the indicator.
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

// Hand each row to the drag adapter for as long as its element lives. Not a `:ref` callback: Vue
// re-invokes one on *every* patch of the vnode, and these rows re-patch on every hover — each call
// would tear down a registration that is mid-drag.
const vRowDrag: Directive<HTMLElement, string> = {
  mounted: (el, { value: id }) => {
    cleanups.set(el, wireRow(el, registrationFor(id)));
  },
  unmounted: (el) => {
    cleanups.get(el)?.();
    cleanups.delete(el);
  },
};

// Drawn in the scroller's content space (not the viewport) so it scrolls with the row, and this
// computed need not re-run on scroll.
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
function activate(node: BookmarkNode): void {
  if (resolveRowActivation(node) === "toggle") {
    toggleExpanded(node.id);
    return;
  }
  if (node.url) openUrl(node.url, settings.value.openInNewTab);
}

// Anchored by coordinates: long-press has no MouseEvent, only right-click does.
function nodeContextMenu(x: number, y: number, node: BookmarkNode): void {
  // Only a folder has a menu; a bookmark right-click opens nothing, not the blank-space menu.
  if (!isFolder(node)) return;
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
      <!-- Checked after "you have none": the difference between that and "none match" is the whole
           reason the box is worth having. -->
      <div
        v-else-if="searchActive && visibleTree.length === 0"
        class="pane-empty"
      >
        No matches
      </div>
      <template v-else>
        <!-- Keyed by id, so a row keeps its element — and its drag registration — across a reload. -->
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

          <!-- Solid when shut, hollow when open. -->
          <Icon
            v-if="row.folder"
            class="lead is-folder"
            :name="row.open ? 'folder-open' : 'folder'"
            :size="14"
          />
          <Favicon v-else class="lead" :url="row.node.url" :size="14" />

          <span class="label">{{ row.node.title || row.node.url }}</span>

          <!-- The row's only delete. Folders get no inline delete — removing a branch shouldn't be
               one stray click away. -->
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

/* Positioned in the scroller's content space, so it scrolls with its row. */
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
  /* A click does something on every row — opens a bookmark, folds a folder. */
  cursor: pointer;
  color: var(--text);
  user-select: none;
}

.row:hover {
  background: var(--hover-bg);
}

/* Going *into* the folder is a different outcome from the line between rows, so it's a full-row fill — a hairline was too easy to miss. */
.row.is-drop-inside {
  background: var(--accent-soft);
  color: var(--selection-fg);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.row.is-drop-inside .twisty,
.row.is-drop-inside .lead.is-folder {
  color: inherit;
}

/* Refuses the drop: the dragged node itself, or somewhere inside it. The cursor echoes `canDrop()` returning false. */
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

/* The one tinted glyph in the app (see `--icon-folder`); it returns to `inherit` on a drop-inside row, where the row's own colour is the signal. */
.lead.is-folder {
  color: var(--icon-folder);
}

.label {
  flex: 1;
  min-width: 0;
  /* 14px to match the history panel's row label; the two panels share a column, so a differing size reads as a bug. */
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

/* A cursor reveals the button on hover; a finger has no hover, so on touch it's simply always there. */
@media (pointer: coarse) {
  .remove {
    display: grid;
  }
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
