/**
 * Context shared between BookmarkTree and the recursive BookmarkNode rows, which
 * keeps their signature down to `node` + `depth`. Drag state lives here because a
 * drag belongs to the tree rather than to a row — rows only report what happens.
 */

import type { ComputedRef, InjectionKey, Ref } from "vue";
import type { BookmarkNode, DropPosition } from "@/core/bookmarks";
import type { Cleanup, RowHover, RowRegistration } from "@/dnd/tree";

/** The row the pointer is currently hovering as a drop target. */
export interface DropTarget {
  id: string;
  position: DropPosition;
  /** The row's box, for placing the indicator line. */
  rect: DOMRect;
}

export interface BookmarkTreeContext {
  isExpanded(id: string): boolean;
  toggleExpanded(id: string): void;
  /** The row under the pointer, or null. */
  dropTarget: Ref<DropTarget | null>;
  /**
   * Rows that must refuse the current drop: the dragged node and its subtree.
   * Empty while nothing is being dragged.
   */
  blockedIds: ComputedRef<Set<string>>;
  /** Left-click: open a bookmark, fold/unfold a folder. See `resolveRowActivation`. */
  activate(node: BookmarkNode): void;
  /** A row's context menu, anchored at a point. Coordinates rather than an event
   *  because the tree also opens it by long press, which has no mouse event to read
   *  them from. Only a folder has a menu; anything else returns without opening. */
  nodeContextMenu(x: number, y: number, node: BookmarkNode): void;
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
