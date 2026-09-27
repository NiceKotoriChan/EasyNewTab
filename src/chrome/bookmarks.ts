/**
 * Chrome bookmarks API — typed wrappers.
 *
 * `chrome.bookmarks.BookmarkTreeNode` is structurally a superset of our
 * `BookmarkNode`, so results pass straight through with no re-shaping. Using
 * the platform's own type instead of a hand-rolled one is what makes the
 * tree/children/url distinctions checkable at compile time.
 */

import type { BookmarkNode, DropPosition } from "@/core/bookmarks";

export type { BookmarkNode };

export async function getTree(): Promise<BookmarkNode[]> {
  return chrome.bookmarks.getTree();
}

export async function getNode(id: string): Promise<BookmarkNode | undefined> {
  try {
    return (await chrome.bookmarks.get(id))[0];
  } catch {
    return undefined;
  }
}

/** Like `getNode`, but folders include their children. */
export async function getSubTree(
  id: string,
): Promise<BookmarkNode | undefined> {
  try {
    return (await chrome.bookmarks.getSubTree(id))[0];
  } catch {
    return undefined;
  }
}

export async function getChildren(id: string): Promise<BookmarkNode[]> {
  try {
    return await chrome.bookmarks.getChildren(id);
  } catch {
    return [];
  }
}

export async function createBookmark(input: {
  parentId: string;
  title: string;
  url?: string;
  index?: number;
}): Promise<BookmarkNode> {
  return chrome.bookmarks.create(input);
}

export async function updateBookmark(
  id: string,
  changes: { title?: string; url?: string },
): Promise<BookmarkNode> {
  return chrome.bookmarks.update(id, changes);
}

export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

export async function removeFolderTree(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}

export async function moveBookmark(
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<BookmarkNode> {
  return chrome.bookmarks.move(id, destination);
}

/** Folders only, in sidebar order, with children expanded one level. */
export async function getFolderOptions(): Promise<
  Array<{ id: string; title: string; depth: number }>
> {
  const tree = await getTree();
  const out: Array<{ id: string; title: string; depth: number }> = [];

  const walk = (nodes: BookmarkNode[], depth: number) => {
    for (const node of nodes) {
      if (node.url) continue;
      out.push({ id: node.id, title: node.title || "(untitled)", depth });
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };
  // Skip the synthetic root, keep the real top-level folders.
  for (const root of tree) walk(root.children ?? [], 0);
  return out;
}

/**
 * Subscribe to every bookmark mutation. Returns an unsubscribe function.
 * Callers are expected to debounce — a bulk import fires dozens of events.
 */
export function onBookmarksChanged(cb: () => void): () => void {
  const events = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded,
  ];
  for (const event of events) event.addListener(cb);
  return () => {
    for (const event of events) event.removeListener(cb);
  };
}

export type { DropPosition };
