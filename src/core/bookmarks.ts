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

type RowActivation = "toggle" | "open";

export function resolveRowActivation(node: BookmarkNode): RowActivation {
  return isFolder(node) ? "toggle" : "open";
}

const OTHER_BOOKMARKS_ID = "2";

export function topLevelNodes(tree: readonly BookmarkNode[]): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const root of tree) {
    for (const child of root.children ?? []) out.push(child);
  }
  return out;
}

export function visibleTopLevelNodes(
  tree: readonly BookmarkNode[],
  showOtherBookmarks: boolean,
): BookmarkNode[] {
  const roots = topLevelNodes(tree);
  return showOtherBookmarks
    ? roots
    : roots.filter((node) => node.id !== OTHER_BOOKMARKS_ID);
}

export function pickRootFolderId(tree: readonly BookmarkNode[]): string | null {
  const roots = topLevelNodes(tree);
  return roots[0]?.id ?? null;
}

function matchesQuery(node: BookmarkNode, needle: string): boolean {
  return (
    node.title.toLowerCase().includes(needle) ||
    (node.url ?? "").toLowerCase().includes(needle)
  );
}

interface BookmarkSearch {
  active: boolean;
  nodes: BookmarkNode[];
  reveal: Set<string>;
}

export function searchBookmarks(
  nodes: readonly BookmarkNode[],
  query: string,
): BookmarkSearch {
  const needle = query.trim().toLowerCase();
  if (!needle) return { active: false, nodes: [...nodes], reveal: new Set() };

  const reveal = new Set<string>();

  function prune(list: readonly BookmarkNode[]): BookmarkNode[] {
    const kept: BookmarkNode[] = [];
    for (const node of list) {
      const children = node.children ?? [];
      const survivors = children.length ? prune(children) : [];
      if (!matchesQuery(node, needle) && survivors.length === 0) continue;
      kept.push(children.length ? { ...node, children: survivors } : { ...node });
      if (survivors.length) reveal.add(node.id);
    }
    return kept;
  }

  return { active: true, nodes: prune(nodes), reveal };
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

export function dragBlockedIds(node: BookmarkNode | null): Set<string> {
  return node ? collectIds([node], new Set()) : new Set();
}

export function computeMoveTarget(opts: {
  dragId: string;
  targetId: string;
  targetParentId?: string;
  position: DropPosition;
  rootFolderId: string | null;
  siblings: readonly BookmarkNode[];
}): MoveTarget | null {
  const { dragId, targetId, targetParentId, position, rootFolderId, siblings } =
    opts;

  if (dragId === targetId) return null;

  if (position === "inside") {
    if (targetParentId === dragId) return null;
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
