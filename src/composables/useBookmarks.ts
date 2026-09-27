/**
 * Bookmark tree state — shared by the sidebar tree and the detail pane.
 *
 * Design note: every mutation reloads from the API (debounced) instead of
 * patching the DOM by hand. The previous implementation kept ~150 lines of
 * targeted DOM surgery (moveDomNode / insertNewNode / captureCollapsedState)
 * purely to avoid a reload. With rendering driven by data those helpers
 * disappear: expand/collapse lives in `expandedIds` rather than in CSS
 * classes, so a rebuild cannot lose it.
 *
 * The "Other bookmarks" preference is applied as a *view* over the raw tree
 * rather than at load time, so flipping it in the options page takes effect
 * without another `chrome.bookmarks.getTree()` round-trip — and the hidden
 * nodes stay in `rawTree` for when it is switched back on.
 *
 * The search box is a second view, layered the same way: `searchBookmarks`
 * prunes a *copy* to render, `reveal` opens the folders on the way to a hit
 * without touching the user's own folds, and the unfiltered `tree` stays
 * exported because the detail pane and every move resolve against real nodes.
 * A search is only ever a way of looking at the tree.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import * as api from "@/chrome/bookmarks";
import {
  computeMoveTarget,
  isFolder,
  pickRootFolderId,
  searchBookmarks,
  subtreeContains,
  topLevelNodes,
  visibleTopLevelNodes,
  type BookmarkNode,
  type DropPosition,
} from "@/core/bookmarks";
import { debounce } from "@/core/utils";
import { useSettings } from "./useSettings";

/** Raw `getTree()` result — one synthetic root whose children are the folders. */
const rawTree = ref<BookmarkNode[]>([]);
const loading = ref(true);
const failed = ref(false);
const expandedIds = ref<Set<string>>(new Set());

let bootstrapped = false;

// Subscribed once for the module: `tree` is a shared computed, so the watcher
// has to outlive whichever component happened to call `useBookmarks()` first.
const { settings } = useSettings();
const showOtherBookmarks = computed(() => settings.value.showOtherBookmarks);

/** What the sidebar renders — top-level folders minus the hidden ones. */
const tree = computed(() =>
  visibleTopLevelNodes(rawTree.value, showOtherBookmarks.value),
);

/**
 * The sidebar's search box. `searchOpen` is whether it is on screen; the query
 * survives it being hidden only until `closeSearch` runs, which clears both.
 */
const searchOpen = ref(false);
const searchQuery = ref("");

const search = computed(() => searchBookmarks(tree.value, searchQuery.value));

/** What the sidebar actually draws: the tree, or a query's slice of it. */
const visibleTree = computed(() =>
  search.value.active ? search.value.nodes : tree.value,
);

const scheduleReload = debounce(() => void reload(), 200);

/** Flat lookup built once per tree change. */
const index = computed(() => {
  const map = new Map<string, BookmarkNode>();
  const walk = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(tree.value);
  return map;
});

const rootFolderId = computed(() => pickRootFolderId(rawTree.value));

async function reload(): Promise<void> {
  loading.value = true;
  try {
    const raw = await api.getTree();
    const isFirstLoad = rawTree.value.length === 0;
    rawTree.value = raw;
    if (isFirstLoad) {
      // Open the top-level folders so the sidebar isn't a wall of collapsed
      // rows on first run. Deeper folders stay closed.
      expandedIds.value = new Set(topLevelNodes(raw).map((n) => n.id));
    }
    failed.value = false;
  } catch (err) {
    console.error("Failed to load bookmarks:", err);
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void reload();
  api.onBookmarksChanged(scheduleReload);
}

export interface UseBookmarks {
  tree: ComputedRef<BookmarkNode[]>;
  /** `tree`, pruned down to a search's hits while one is running. */
  visibleTree: ComputedRef<BookmarkNode[]>;
  /** True while the query is actually filtering — empty box means "no filter". */
  searchActive: ComputedRef<boolean>;
  searchOpen: Ref<boolean>;
  searchQuery: Ref<string>;
  /** Reveal the search box. The caret is the panel's job — see `BookmarkTree`. */
  openSearch: () => void;
  /** Hide the box and drop the query, putting the tree back as it was. */
  closeSearch: () => void;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  rootFolderId: ComputedRef<string | null>;
  findNode: (id: string) => BookmarkNode | undefined;
  isExpanded: (id: string) => boolean;
  toggleExpanded: (id: string) => void;
  reload: () => Promise<void>;
  moveNode: (dragId: string, targetId: string, position: DropPosition) => Promise<void>;
  /** Append to the end of the first top-level folder (the "empty area" drop). */
  moveToEnd: (dragId: string) => Promise<void>;
  createFolder: (parentId: string, title: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  updateNode: (id: string, changes: { title?: string; url?: string }) => Promise<void>;
  removeNode: (node: BookmarkNode) => Promise<void>;
}

export function useBookmarks(): UseBookmarks {
  bootstrap();

  function findNode(id: string): BookmarkNode | undefined {
    return index.value.get(id);
  }

  function isExpanded(id: string): boolean {
    if (expandedIds.value.has(id)) return true;
    // A running search also opens the folders on the path to its hits. Read
    // from `reveal` rather than written into `expandedIds` so that clearing the
    // query gives the user back exactly the folds they had.
    return search.value.active && search.value.reveal.has(id);
  }

  function toggleExpanded(id: string): void {
    const next = new Set(expandedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds.value = next;
  }

  function openSearch(): void {
    searchOpen.value = true;
  }

  function closeSearch(): void {
    searchOpen.value = false;
    searchQuery.value = "";
  }

  async function moveNode(
    dragId: string,
    targetId: string,
    position: DropPosition,
  ): Promise<void> {
    const dragNode = findNode(dragId);
    const targetNode = findNode(targetId);
    if (!dragNode || !targetNode || dragId === targetId) return;

    // Never drop a folder into its own subtree — it would detach the branch.
    if (isFolder(dragNode) && subtreeContains(dragNode, targetId)) return;

    // Where the node currently sits is deliberately not passed on: the index
    // `chrome.bookmarks.move` wants is measured against the list as it stands,
    // and Chromium applies its own correction for a same-folder move. See
    // `computeMoveTarget` for what happens when both sides "help".
    const siblings =
      position === "inside" ? [] : await api.getChildren(targetNode.parentId ?? "");

    const destination = computeMoveTarget({
      dragId,
      targetId,
      targetParentId: targetNode.parentId,
      position,
      rootFolderId: rootFolderId.value,
      siblings,
    });
    if (!destination) return;

    await api.moveBookmark(dragId, destination);
    await reload();
  }

  /**
   * Send a node to the end of the first top-level folder.
   *
   * This is what a drop in the panel's blank space means. `index` is left out
   * on purpose — `chrome.bookmarks.move` reads a missing index as "append",
   * which is one fewer index correction to get wrong than reusing
   * `computeMoveTarget` against a synthetic target.
   */
  async function moveToEnd(dragId: string): Promise<void> {
    const parentId = rootFolderId.value;
    const dragNode = findNode(dragId);
    if (!parentId || !dragNode) return;
    // Dropping a folder into its own subtree would detach the branch, and the
    // first top-level folder is a possible subtree of the node being dragged.
    if (isFolder(dragNode) && subtreeContains(dragNode, parentId)) return;

    const siblings = await api.getChildren(parentId);
    if (siblings[siblings.length - 1]?.id === dragId) return;

    await api.moveBookmark(dragId, { parentId });
    await reload();
  }

  async function createFolder(parentId: string, title: string): Promise<void> {
    await api.createBookmark({ parentId, title });
    await reload();
  }

  async function rename(id: string, title: string): Promise<void> {
    await api.updateBookmark(id, { title });
    await reload();
  }

  async function updateNode(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<void> {
    await api.updateBookmark(id, changes);
    await reload();
  }

  async function removeNode(node: BookmarkNode): Promise<void> {
    if (isFolder(node)) await api.removeFolderTree(node.id);
    else await api.removeBookmark(node.id);
    await reload();
  }

  return {
    tree,
    visibleTree,
    searchActive: computed(() => search.value.active),
    searchOpen,
    searchQuery,
    openSearch,
    closeSearch,
    loading,
    failed,
    rootFolderId,
    findNode,
    isExpanded,
    toggleExpanded,
    reload,
    moveNode,
    moveToEnd,
    createFolder,
    rename,
    updateNode,
    removeNode,
  };
}
