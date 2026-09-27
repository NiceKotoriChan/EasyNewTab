/**
 * Context shared between BookmarkTree and the (recursive) BookmarkNode rows.
 *
 * Passing this through `provide`/`inject` keeps the recursive component
 * signature down to `node` + `depth`, so rows stay cheap to render.
 *
 * Drag state lives here rather than in each row because a drag is a property of
 * the tree as a whole: which node is being carried, which row the pointer is on,
 * and which rows currently have to refuse a drop. Rows only report what happens
 * to them (`registerRow`) and read back what to draw.
 */

import type { ComputedRef, InjectionKey, Ref } from "vue";
import type { BookmarkNode, DropPosition } from "@/core/bookmarks";
import type { Cleanup, RowHover, RowRegistration } from "@/dnd/tree";

/** The row the pointer is currently hovering as a drop target. */
export interface DropTarget {
  id: string;
  position: DropPosition;
  /** The row's box, used to place the indicator line. */
  rect: DOMRect;
}

export interface BookmarkTreeContext {
  isExpanded(id: string): boolean;
  toggleExpanded(id: string): void;
  /**
   * Id of the row whose details the main area is showing. Only ever set from a
   * context menu — a plain click opens or folds, it never selects.
   */
  selectedId: ComputedRef<string | null>;
  /** The row under the pointer, or null. */
  dropTarget: Ref<DropTarget | null>;
  /**
   * Rows that must refuse the current drop: the dragged node and its subtree.
   * Empty while nothing is being dragged.
   */
  blockedIds: ComputedRef<Set<string>>;
  /** Left-click: open a bookmark, fold/unfold a folder. See `resolveRowActivation`. */
  activate(node: BookmarkNode): void;
  nodeContextMenu(event: MouseEvent, node: BookmarkNode): void;
  deleteNode(node: BookmarkNode): void;
  /** Hand a row's DOM element to the tree. Returns the cleanup for unmount. */
  registerRow(el: HTMLElement, reg: RowRegistration): Cleanup;
  /** A row reports that the pointer is on it. */
  hoverRow(node: BookmarkNode, hover: RowHover): void;
  /** A row reports that the pointer has left it. */
  leaveRow(node: BookmarkNode): void;
}

export const BOOKMARK_TREE: InjectionKey<BookmarkTreeContext> = Symbol(
  "bookmark-tree",
);
