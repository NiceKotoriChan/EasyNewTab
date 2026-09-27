/**
 * Bookmark tree logic — pure functions only, so every rule here is pinned by
 * `tests/bookmarks.test.ts` rather than by looking at what got rendered.
 *
 * Nothing here second-guesses the platform: `computeMoveTarget` hands
 * `chrome.bookmarks.move` an index in the coordinate space that method
 * documents, and leaves Chromium's own index adjustment to Chromium.
 */

/** Minimal shape of `chrome.bookmarks.BookmarkTreeNode` used by this module. */
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
  /** Omitted means "append to the end of parentId". */
  index?: number;
}

export function isFolder(node: BookmarkNode): boolean {
  return !node.url;
}

/** What a left-click on a tree row does. */
type RowActivation = "toggle" | "open";

/**
 * The click contract for a bookmark row: a bookmark opens, a folder folds.
 *
 * Deliberately *not* a selection — the main area holds the search box, and a
 * click in the sidebar must not swap it for something else. Details are a
 * context-menu action instead.
 *
 * A node with an empty URL counts as a folder, the same way `isFolder` treats
 * it: that is what `getTree()` hands back for a folder row.
 */
export function resolveRowActivation(node: BookmarkNode): RowActivation {
  return isFolder(node) ? "toggle" : "open";
}

/**
 * Chrome's id for the built-in "Other bookmarks" folder. Matched on the id, not
 * the title: `getTree()` returns a *localized* title ("其他书签" on a Chinese
 * Chrome), so a title match would silently stop working outside English.
 */
const OTHER_BOOKMARKS_ID = "2";

/** Root nodes to render: `getTree()` returns one synthetic root ("0") whose
 *  children are the real top-level folders (Bookmarks bar, Other bookmarks). */
export function topLevelNodes(tree: readonly BookmarkNode[]): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const root of tree) {
    for (const child of root.children ?? []) out.push(child);
  }
  return out;
}

/** Top-level folders to render, honouring the "Other bookmarks" preference. */
export function visibleTopLevelNodes(
  tree: readonly BookmarkNode[],
  showOtherBookmarks: boolean,
): BookmarkNode[] {
  const roots = topLevelNodes(tree);
  return showOtherBookmarks
    ? roots
    : roots.filter((node) => node.id !== OTHER_BOOKMARKS_ID);
}

/** The first top-level folder — used as the parent for empty-area "New folder".
 *  Reads the *raw* tree so hiding "Other bookmarks" cannot move the target. */
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

// ============================================================
// Search
// ============================================================

/**
 * Does this node answer the query? Title *or* URL, case-insensitive — pages
 * titled "Index" or "Untitled" are otherwise unfindable, and a bookmark search
 * that cannot find them is not worth the key it is bound to.
 *
 * The query is expected pre-lowered: `searchBookmarks` does it once per
 * keystroke rather than once per node.
 */
export function matchesQuery(node: BookmarkNode, needle: string): boolean {
  return (
    node.title.toLowerCase().includes(needle) ||
    (node.url ?? "").toLowerCase().includes(needle)
  );
}

interface BookmarkSearch {
  /** True while a query is in effect. False means "draw the whole tree". */
  active: boolean;
  /** The tree to draw: the matches, plus the folders on the way down to them. */
  nodes: BookmarkNode[];
  /** The folders the search has to open. Empty when inactive. */
  reveal: Set<string>;
}

/**
 * The tree as the search box should draw it: the matches, plus the folders on
 * the way down to them.
 *
 * Matches plus *ancestors*, not plus descendants. A matched folder could equally
 * well open to show everything inside it — but the top-level folder is called
 * "Bookmarks bar", so a search for "book" would dump the whole tree and the
 * filter would look broken. Keeping only the path down to a hit also means the
 * row component needs no change: the nodes it is handed have already lost their
 * non-matching children, so `hasChildren`, the twisty and the folder state are
 * right by construction rather than by a flag.
 *
 * A pruned *copy*, not a set of hidden ids: the alternative renders everything
 * and marks the survivors, putting a second definition of "is this row real"
 * next to the one the DOM already has.
 *
 * `reveal` is returned rather than written — folder state the user set by hand
 * is not the search's to overwrite, so the caller unions the two and clearing the
 * query gives back exactly the folds they had.
 *
 * The tree handed in has already been through `visibleTopLevelNodes`, so a
 * hidden "Other bookmarks" is not searchable either. Deliberate: the results
 * would otherwise point at rows the sidebar refuses to draw.
 */
export function searchBookmarks(
  nodes: readonly BookmarkNode[],
  query: string,
): BookmarkSearch {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { active: false, nodes: [...nodes], reveal: new Set() };
  }

  const reveal = new Set<string>();

  function prune(list: readonly BookmarkNode[]): BookmarkNode[] {
    const kept: BookmarkNode[] = [];
    for (const node of list) {
      const children = node.children ?? [];
      const survivors = children.length ? prune(children) : [];
      const self = matchesQuery(node, needle);
      if (!self && survivors.length === 0) continue;
      kept.push(children.length ? { ...node, children: survivors } : { ...node });
      // Only folders that kept something need opening; a folder that matched on
      // its own has nothing to reveal and stays however the user left it.
      if (survivors.length) reveal.add(node.id);
    }
    return kept;
  }

  return { active: true, nodes: prune(nodes), reveal };
}

// ============================================================
// Drag & drop
// ============================================================

/**
 * Which drop zone the cursor is in. Folder rows split into equal thirds (top →
 * before, middle → inside, bottom → after); bookmark rows split at the midpoint
 * and never accept "inside".
 *
 * Thirds rather than quarters, deliberately: with quarters the outer bands were
 * 7px on a 28px row while "inside" took the middle *half*, so reordering two
 * folders side by side meant hitting a 7px target — and missing it dropped the
 * folder *inside* its neighbour.
 *
 * Geometry is passed in rather than read from an element so this is testable.
 */
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

/**
 * Ids that must refuse a drop while `node` is being dragged: the node itself
 * (dropping a row onto where it already is means nothing) plus everything inside
 * it (`chrome.bookmarks.move` would detach the branch — a folder cannot become
 * its own descendant).
 */
export function dragBlockedIds(node: BookmarkNode | null): Set<string> {
  return node ? collectIds([node], new Set()) : new Set();
}

/**
 * Resolve the arguments for `chrome.bookmarks.move`.
 *
 * `index` is a position among the target folder's children **as they are right
 * now**, counted before the dragged node is lifted out. The obvious "helpful"
 * adjustment for a same-folder move is wrong, and it is wrong quietly:
 * `chrome.bookmarks.move` already removes the node before inserting it, itself —
 *
 *     if (old_parent == new_parent && index > old_index) index--;
 *
 *   — `BookmarkModel::Move`, components/bookmarks/browser/bookmark_model.cc
 *
 * Subtracting one here as well cancels that out, and because the error only
 * exists on downward moves it presents as a broken feature rather than an
 * off-by-one. `tests/bookmarks.test.ts` runs every ordered pair through a
 * transcription of Chromium's rules, so it cannot come back.
 *
 * A consequence worth knowing at the call site: dropping just before the row
 * that already follows the dragged one is a genuine no-op, not a failure — that
 * drop asks for the order the list is already in.
 *
 * `inside` omits `index` on purpose: the API substitutes
 * `parent.children().size()`, i.e. append, the only sane reading of a drop onto a
 * folder's middle third.
 *
 * @returns `{ parentId, index? }`, or null when the move is impossible.
 */
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

/** True when `id` is `ancestor` itself or lives anywhere inside its subtree. */
export function subtreeContains(ancestor: BookmarkNode, id: string): boolean {
  if (ancestor.id === id) return true;
  return (ancestor.children ?? []).some((child) => subtreeContains(child, id));
}
