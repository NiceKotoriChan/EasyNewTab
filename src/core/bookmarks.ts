// Pure bookmark-tree logic; pinned by tests/bookmarks.test.ts.

export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

export type NodeKind = "folder" | "bookmark";

export type DropPosition = "before" | "after" | "inside";

interface MoveTarget {
  parentId: string;
  index?: number;
}

export function isFolder(node: BookmarkNode): boolean {
  return !node.url;
}

/** What a left-click on a tree row does. */
type RowActivation = "toggle" | "open";

/** The click contract for a bookmark row: a bookmark opens, a folder folds. Deliberately not a
 *  selection — a sidebar click must not swap the main area's search box. A node with an empty URL
 *  counts as a folder, the same way `isFolder` treats it. */
export function resolveRowActivation(node: BookmarkNode): RowActivation {
  return isFolder(node) ? "toggle" : "open";
}

/** Chrome's id for "Other bookmarks". Matched on id, not title: `getTree()` returns a *localized*
 *  title ("其他书签" on Chinese Chrome), so a title match would silently break outside English. */
const OTHER_BOOKMARKS_ID = "2";

/** Root nodes to render: `getTree()` returns one synthetic root ("0") holding the real folders. */
export function topLevelNodes(tree: readonly BookmarkNode[]): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const root of tree) {
    for (const child of root.children ?? []) out.push(child);
  }
  return out;
}

// Honours the "Other bookmarks" preference.
export function visibleTopLevelNodes(
  tree: readonly BookmarkNode[],
  showOtherBookmarks: boolean,
): BookmarkNode[] {
  const roots = topLevelNodes(tree);
  return showOtherBookmarks
    ? roots
    : roots.filter((node) => node.id !== OTHER_BOOKMARKS_ID);
}

/** The first top-level folder — what blank-space "New" makes into. Reads the *raw* tree so hiding
 *  "Other bookmarks" cannot move the target. */
export function pickRootFolderId(tree: readonly BookmarkNode[]): string | null {
  const roots = topLevelNodes(tree);
  return roots[0]?.id ?? null;
}

function collectIds(
  nodes: readonly BookmarkNode[],
  into: Set<string> = new Set(),
): Set<string> {
  for (const node of nodes) {
    into.add(node.id);
    if (node.children?.length) collectIds(node.children, into);
  }
  return into;
}

/** Which drop zone the cursor is in. Folder rows split into equal thirds (before / inside / after);
 *  bookmark rows split at the midpoint and never accept "inside". Thirds rather than quarters:
 *  quarters made the outer bands 7px on a 28px row while "inside" took the middle *half*, so
 *  reordering two folders meant hitting a 7px target — and missing dropped the folder *inside* its
 *  neighbour. Geometry is passed in rather than read from an element so this is testable. */
export function computeDropPosition(opts: {
  kind: NodeKind;
  top: number;
  height: number;
  cursorY: number;
}): DropPosition {
  const { kind, top, height, cursorY } = opts;
  if (kind === "folder") {
    const third = height / 3;
    if (cursorY < top + third) return "before";
    if (cursorY > top + height - third) return "after";
    return "inside";
  }
  return cursorY < top + height / 2 ? "before" : "after";
}

/** Ids that must refuse a drop while `node` is dragged: the node itself, plus everything inside it
 *  — `chrome.bookmarks.move` would detach the branch, since a folder cannot become its own
 *  descendant. */
export function dragBlockedIds(node: BookmarkNode | null): Set<string> {
  return node ? collectIds([node], new Set()) : new Set();
}

// index counts positions as they are now; Chromium already decrements it for a
// downward same-parent move, so adding 1 here would cancel that correction.
export function computeMoveTarget(opts: {
  dragId: string;
  targetId: string;
  targetParentId?: string;
  position: DropPosition;
  rootFolderId: string | null;
  /** Current children of the target's parent (not used for `inside`). */
  siblings: readonly BookmarkNode[];
}): MoveTarget | null {
  const { dragId, targetId, targetParentId, position, rootFolderId, siblings } =
    opts;

  if (dragId === targetId) return null;

  if (position === "inside") {
    if (targetParentId === dragId) return null; // can't drop into own child
    return { parentId: targetId };
  }

  const parentId = targetParentId ?? rootFolderId;
  if (!parentId) return null;
  if (parentId === dragId) return null;

  const targetIdx = siblings.findIndex((s) => s.id === targetId);
  if (targetIdx === -1) return null;

  return {
    parentId,
    index: position === "before" ? targetIdx : targetIdx + 1,
  };
}

export function subtreeContains(ancestor: BookmarkNode, id: string): boolean {
  if (ancestor.id === id) return true;
  return (ancestor.children ?? []).some((child) => subtreeContains(child, id));
}
