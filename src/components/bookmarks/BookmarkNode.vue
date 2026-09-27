<script setup lang="ts">
/**
 * One bookmark row + its children (recursive).
 *
 * One click is the whole gesture — a bookmark opens, a folder folds (see
 * `resolveRowActivation`). No double click and no selection: clicking the sidebar
 * must never take the main area away from the search box.
 *
 * Expansion and the selected id come from the tree context. Row height is a fixed
 * `--row-h` so the drop-zone maths in the tree stays predictable.
 *
 * The row carries no drag logic: it hands its element to the tree once on mount
 * and reports what happens to it — hover, leave, dwell, drag start/end — then
 * reads back what to draw. All of that lives in `src/dnd/tree.ts`.
 */
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../ui/Icon.vue";
import Favicon from "../ui/Favicon.vue";
import { BOOKMARK_TREE } from "@/composables/bookmarkTree";
import { resolveRowActivation, type BookmarkNode } from "@/core/bookmarks";

const props = defineProps<{ node: BookmarkNode; depth: number }>();

const ctx = inject(BOOKMARK_TREE)!;

const row = ref<HTMLElement | null>(null);
const dragging = ref(false);

const isFolder = computed(() => !props.node.url);
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0);
const expanded = computed(() => ctx.isExpanded(props.node.id));
const isSelected = computed(() => ctx.selectedId.value === props.node.id);
const isBlocked = computed(() => ctx.blockedIds.value.has(props.node.id));
const isDropInside = computed(
  () =>
    ctx.dropTarget.value?.id === props.node.id &&
    ctx.dropTarget.value.position === "inside",
);

/** Mirrored into `data-action` so the click contract is visible to the render check. */
const activation = computed(() => resolveRowActivation(props.node));

const showChildren = computed(
  () => isFolder.value && hasChildren.value && expanded.value,
);

/**
 * Solid when shut, hollow when open — the pair the pre-rewrite build used.
 * Guarded by `hasChildren` rather than `expanded` alone: an empty folder is
 * still put into `expandedIds` by the first-load sweep, and it has nothing to
 * reveal, so it must not advertise itself as open.
 */
const folderIcon = computed<"folder" | "folder-open">(() =>
  showChildren.value ? "folder-open" : "folder",
);

let unregister: (() => void) | null = null;

onMounted(() => {
  const el = row.value;
  if (!el) return;
  unregister = ctx.registerRow(el, {
    // Read lazily: the node object behind this row is replaced on every reload,
    // while the registration lives as long as the element does.
    data: () => ({
      id: props.node.id,
      kind: isFolder.value ? "folder" : "bookmark",
    }),
    canDrop: () => !isBlocked.value,
    // Only a collapsed folder with children is worth spring-loading open.
    canExpand: () => isFolder.value && hasChildren.value && !expanded.value,
    onHover: (hover) => ctx.hoverRow(props.node, hover),
    onLeave: () => ctx.leaveRow(props.node),
    onDwell: () => ctx.toggleExpanded(props.node.id),
    onDragStart: () => {
      dragging.value = true;
    },
    onDragEnd: () => {
      dragging.value = false;
    },
  });
});

onBeforeUnmount(() => {
  unregister?.();
  unregister = null;
});
</script>

<template>
  <div class="node">
    <div
      ref="row"
      class="row"
      :class="{
        'is-selected': isSelected,
        'is-drop-inside': isDropInside,
        'is-blocked': isBlocked,
        dragging,
      }"
      :style="{ paddingLeft: props.depth * 14 + 4 + 'px' }"
      :data-node-id="props.node.id"
      :data-kind="isFolder ? 'folder' : 'bookmark'"
      :data-action="activation"
      :title="props.node.url || props.node.title"
      @click="ctx.activate(props.node)"
      @contextmenu.stop="
        ctx.nodeContextMenu($event.clientX, $event.clientY, props.node)
      "
    >
      <button
        v-if="isFolder"
        type="button"
        class="twisty"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click.stop="ctx.toggleExpanded(props.node.id)"
      >
        <Icon
          v-if="hasChildren"
          :name="expanded ? 'chevron-down' : 'chevron-right'"
          :size="12"
        />
      </button>
      <span v-else class="twisty is-empty" />

      <Icon v-if="isFolder" class="lead is-folder" :name="folderIcon" :size="14" />
      <Favicon v-else class="lead" :url="props.node.url" :size="14" />

      <span class="label">{{ props.node.title || props.node.url }}</span>

      <!-- Delete is deliberately not offered for folders: removing a branch
           of the tree should not be one stray click away. -->
      <button
        v-if="!isFolder"
        type="button"
        class="remove"
        title="Delete bookmark"
        aria-label="Delete bookmark"
        @click.stop="ctx.deleteNode(props.node)"
      >
        <Icon name="close" :size="12" />
      </button>
    </div>

    <div v-if="showChildren" class="children">
      <BookmarkNode
        v-for="child in props.node.children"
        :key="child.id"
        :node="child"
        :depth="props.depth + 1"
      />
    </div>
  </div>
</template>

<style scoped>
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

.row.is-selected {
  background: var(--selection-bg);
  color: var(--selection-fg);
}

/* The node is going *into* this folder, which is a different outcome from the
   line drawn between rows. So it is a full-row fill rather than a thinner
   version of the same signal — a hairline was too easy to miss and left the
   user unsure which of the two they were about to get. */
.row.is-drop-inside {
  background: var(--accent-soft);
  color: var(--selection-fg);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.row.is-drop-inside .twisty,
.row.is-drop-inside .lead.is-folder {
  color: inherit;
}

/* Refuses the drop: the dragged node itself, or somewhere inside it. The
   cursor says the same thing — `canDrop()` returns false for these rows. */
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

.row.is-selected .twisty {
  color: inherit;
}

.twisty.is-empty {
  cursor: inherit;
}

.lead {
  flex: none;
}

/* The one tinted glyph in the app (see `--icon-folder`). It goes back to
   `inherit` on a selected or drop-inside row, where the row's own colour — not
   a second blue — is the signal. */
.lead.is-folder {
  color: var(--icon-folder);
}

.row.is-selected .lead.is-folder {
  color: inherit;
}

.label {
  flex: 1;
  min-width: 0;
  /* 14px to match the history panel's row label: the two panels are siblings in
     the same column, so a different size in each reads as a bug. The detail
     views behind the context menu are deliberately still smaller (12.5px) —
     they are a form, not a list. */
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

.row.is-selected .remove {
  color: inherit;
}
</style>
