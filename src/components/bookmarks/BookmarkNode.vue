<script setup lang="ts">
// One bookmark row + its children (recursive). One click is the whole gesture; row height is a fixed `--row-h` so the drop-zone maths stays predictable. Drag logic lives in `src/dnd/tree.ts`.
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
const isBlocked = computed(() => ctx.blockedIds.value.has(props.node.id));
const isDropInside = computed(
  () =>
    ctx.dropTarget.value?.id === props.node.id &&
    ctx.dropTarget.value.position === "inside",
);

// Mirrored into `data-action` so the click contract is visible to the render check.
const activation = computed(() => resolveRowActivation(props.node));

const showChildren = computed(
  () => isFolder.value && hasChildren.value && expanded.value,
);

// Solid when shut, hollow when open. Guarded by `hasChildren`: an empty folder still lands in `expandedIds` on first load but has nothing to reveal.
const folderIcon = computed<"folder" | "folder-open">(() =>
  showChildren.value ? "folder-open" : "folder",
);

let unregister: (() => void) | null = null;

onMounted(() => {
  const el = row.value;
  if (!el) return;
  unregister = ctx.registerRow(el, {
    // Read lazily: the node object is replaced on every reload, but the registration lives as long as the element does.
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

      <!-- The row's only delete. Folders get no inline delete — removing a branch shouldn't be one stray click away. -->
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

/* The one tinted glyph in the app (see `--icon-folder`); it returns to `inherit` on a selected/drop-inside row, where the row's own colour is the signal. */
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
