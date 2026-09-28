/**
 * Bookmark tree state — shared by the sidebar tree and the panel switch.
 *
 * Every mutation reloads from the API (debounced) rather than patching the DOM: that is what lets
 * expansion live in `expandedIds` instead of CSS classes, so a rebuild cannot lose it. "Other
 * bookmarks" is a view over `rawTree`, so hiding it costs no extra `getTree()` round-trip.
 */
import { computed, ref, type ComputedRef, type Ref } from "vue";
import {
  computeMoveTarget,
  isFolder,
  pickRootFolderId,
  subtreeContains,
  topLevelNodes,
  visibleTopLevelNodes,
  type BookmarkNode,
  type DropPosition,
} from "@/core/bookmarks";
import { debounce } from "@/core/utils";
import { useSettings } from "./useSettings";

/** Subscribe to every bookmark mutation. Callers must debounce — a bulk import fires dozens. */
function onBookmarksChanged(cb: () => void): () => void {
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

/** Children of a folder, or `[]` if the folder is gone. */
async function getChildren(id: string): Promise<BookmarkNode[]> {
  try {
    return await chrome.bookmarks.getChildren(id);
  } catch {
    return [];
  }
}

/** Raw `getTree()` result — one synthetic root whose children are the folders. */
const rawTree = ref<BookmarkNode[]>([]);
const loading = ref(true);
const failed = ref(false);
const expandedIds = ref<Set<string>>(new Set());

let bootstrapped = false;

// Subscribed once at module scope: `tree` is a shared computed, so it outlives any one component.
const { settings } = useSettings();
const showOtherBookmarks = computed(() => settings.value.showOtherBookmarks);

const tree = computed(() =>
  visibleTopLevelNodes(rawTree.value, showOtherBookmarks.value),
);

const scheduleReload = debounce(() => void reload(), 200);

// Flat id→node lookup, rebuilt once per tree change.
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
    const raw = await chrome.bookmarks.getTree();
    const isFirstLoad = rawTree.value.length === 0;
    rawTree.value = raw;
    if (isFirstLoad) {
      // Open the top-level folders so the first run is not a wall of collapsed rows.
      expandedIds.value = new Set(topLevelNodes(raw).map((n) => n.id));
    }    failed.value = false;
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
  onBookmarksChanged(scheduleReload);
}

export function useBookmarks(): {
  tree: ComputedRef<BookmarkNode[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  rootFolderId: ComputedRef<string | null>;
  findNode: (id: string) => BookmarkNode | undefined;
  isExpanded: (id: string) => boolean;
  toggleExpanded: (id: string) => void;
  reload: () => Promise<void>;
  moveNode: (
    dragId: string,
    targetId: string,
    position: DropPosition,
  ) => Promise<void>;
  moveToEnd: (dragId: string) => Promise<void>;
  createFolder: (parentId: string, title: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  updateNode: (
    id: string,
    changes: { title?: string; url?: string },
  ) => Promise<void>;
  removeNode: (node: BookmarkNode) => Promise<void>;
} {
  bootstrap();

  function findNode(id: string): BookmarkNode | undefined {
    return index.value.get(id);
  }

  function isExpanded(id: string): boolean {
    return expandedIds.value.has(id);
  }

  function toggleExpanded(id: string): void {
    const next = new Set(expandedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds.value = next;
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

    // Where the node sits is deliberately not passed on: the index `chrome.bookmarks.move` wants is
    // measured against the list as it stands, and Chromium corrects a same-folder move itself.
    const siblings =
      position === "inside" ? [] : await getChildren(targetNode.parentId ?? "");

    const destination = computeMoveTarget({
      dragId,
      targetId,
      targetParentId: targetNode.parentId,
      position,
      rootFolderId: rootFolderId.value,
      siblings,
    });
    if (!destination) return;

    await chrome.bookmarks.move(dragId, destination);
    await reload();
  }

  /**
   * Send a node to the end of the first top-level folder — what a drop in the blank space means.
   * `index` is omitted on purpose: the API reads a missing index as "append".
   */
  async function moveToEnd(dragId: string): Promise<void> {
    const parentId = rootFolderId.value;
    const dragNode = findNode(dragId);
    if (!parentId || !dragNode) return;
    // The first top-level folder may itself sit inside the node being dragged.
    if (isFolder(dragNode) && subtreeContains(dragNode, parentId)) return;

    const siblings = await getChildren(parentId);
    if (siblings[siblings.length - 1]?.id === dragId) return;

    await chrome.bookmarks.move(dragId, { parentId });
    await reload();
  }

  async function createFolder(parentId: string, title: string): Promise<void> {
    await chrome.bookmarks.create({ parentId, title });
    await reload();
  }

  async function rename(id: string, title: string): Promise<void> {
    await chrome.bookmarks.update(id, { title });
    await reload();
  }

  async function updateNode(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<void> {
    await chrome.bookmarks.update(id, changes);
    await reload();
  }

  async function removeNode(node: BookmarkNode): Promise<void> {
    if (isFolder(node)) await chrome.bookmarks.removeTree(node.id);
    else await chrome.bookmarks.remove(node.id);
    await reload();
  }
  return {
    tree,
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
