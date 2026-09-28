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
  dropTarget: Ref<DropTarget | null>;
  // Rows that must refuse the drop: the dragged node and its subtree; empty while idle.
  blockedIds: ComputedRef<Set<string>>;
  activate(node: BookmarkNode): void;
  // Coordinates, not an event: the tree also opens this by long press, which has no mouse
  // event. Only a folder has a menu; anything else returns without opening.
  nodeContextMenu(x: number, y: number, node: BookmarkNode): void;
  deleteNode(node: BookmarkNode): void;
  registerRow(el: HTMLElement, reg: RowRegistration): Cleanup;
  hoverRow(node: BookmarkNode, hover: RowHover): void;
  leaveRow(node: BookmarkNode): void;
}

export const BOOKMARK_TREE: InjectionKey<BookmarkTreeContext> = Symbol(
  "bookmark-tree",
);
