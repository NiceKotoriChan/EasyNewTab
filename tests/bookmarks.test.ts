/**
 * Unit tests for the pure bookmark logic.
 *
 * Run with `npm test` (Node's built-in runner; the `.ts` files are executed
 * via native type stripping — no test framework dependency).
 *
 * The drag-and-drop index correction is the reason this file exists: it was
 * derived by trial and error against a real Chrome profile, and a silent
 * regression there is invisible until a bookmark lands one slot off.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDropPosition,
  computeMoveTarget,
  dragBlockedIds,
  matchesQuery,
  pickRootFolderId,
  resolveRowActivation,
  searchBookmarks,
  subtreeContains,
  topLevelNodes,
  visibleTopLevelNodes,
  type BookmarkNode,
} from "../src/core/bookmarks.ts";

/** a, b, c are siblings in folder P. */
function siblings(): BookmarkNode[] {
  return [
    { id: "a", parentId: "P", title: "A" },
    { id: "b", parentId: "P", title: "B" },
    { id: "c", parentId: "P", title: "C" },
  ];
}

function move(opts: {
  dragId: string;
  targetId: string;
  targetParentId?: string;
  position: "before" | "after" | "inside";
  siblings?: BookmarkNode[];
}) {
  return computeMoveTarget({
    ...opts,
    rootFolderId: "P",
    siblings: opts.siblings ?? siblings(),
  });
}

/**
 * Chromium's move rules, transcribed from the platform that enforces them.
 *
 * `BookmarkModel::Move` (components/bookmarks/browser/bookmark_model.cc) does
 * two things before it touches the list: it treats `index == old_index` and
 * `index == old_index + 1` in the same folder as "already there, nothing to
 * do", and it decrements the index when the node is moving later in the same
 * folder. Reproducing it here is the only way to test our index arithmetic:
 * the number `computeMoveTarget` returns is meaningless on its own, and an
 * assertion like "index === 2" happily passes while the result is wrong.
 */
function chromiumMove<T>(list: readonly T[], from: number, index: number): T[] {
  if (index === from || index === from + 1) return [...list];
  const at = index > from ? index - 1 : index;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(at, 0, moved);
  return next;
}

/**
 * Where a drop is supposed to land, stated without reference to any index
 * convention: lift the dragged row out, then put it back immediately before or
 * after the target row. Both positions are in the list as it was before the
 * lift, which is the same frame the indicator line is drawn in.
 */
function intended<T>(
  list: readonly T[],
  from: number,
  target: number,
  position: "before" | "after",
): T[] {
  const rest = list.filter((_, i) => i !== from);
  const anchor = rest.indexOf(list[target]);
  const at = position === "before" ? anchor : anchor + 1;
  return [...rest.slice(0, at), list[from], ...rest.slice(at)];
}

test("every ordered drop lands exactly where the indicator promised", () => {
  // Downward moves were the broken half. `computeMoveTarget` used to subtract
  // one for a same-folder move — which is the adjustment Chromium makes itself,
  // so the two cancelled out: one slot down became a no-op, two slots down
  // moved one. Upward moves were unaffected (the platform's decrement does not
  // fire when the node is moving earlier), and that asymmetry is exactly what
  // made it read as "the drop was ignored" instead of as an off-by-one.
  const list = ["a", "b", "c", "d"];
  const rows: BookmarkNode[] = list.map((id) => ({
    id,
    parentId: "P",
    title: id.toUpperCase(),
  }));

  for (let from = 0; from < list.length; from += 1) {
    for (let target = 0; target < list.length; target += 1) {
      if (from === target) continue;
      for (const position of ["before", "after"] as const) {
        const label = `${list[from]} ${position} ${list[target]}`;
        const destination = move({
          dragId: list[from],
          targetId: list[target],
          targetParentId: "P",
          position,
          siblings: rows,
        });
        assert.ok(destination, `${label}: should be allowed`);
        // A missing index becomes -1, which `splice` turns into a real (wrong)
        // insertion — so this fails loudly instead of quietly lining up.
        const index = destination.index ?? -1;
        assert.equal(
          JSON.stringify(chromiumMove(list, from, index)),
          JSON.stringify(intended(list, from, target, position)),
          `${label} (asked for index ${index})`,
        );
      }
    }
  }
});

test("the index is named in the frame the list is in before the move", () => {
  // The correction belongs to Chromium, but the frame is still ours to get
  // right: a downward drop names the slot as counted *before* the node is
  // lifted out. Both of these land the same way round; only the index differs.
  assert.deepEqual(
    move({
      dragId: "a",
      targetId: "b",
      targetParentId: "P",
      position: "after",
    }),
    { parentId: "P", index: 2 },
  );
  assert.deepEqual(
    move({
      dragId: "a",
      targetId: "c",
      targetParentId: "P",
      position: "before",
    }),
    { parentId: "P", index: 2 },
  );
});

test("a drop after the last row may name the append slot", () => {
  // Chromium accepts `index == children().size()` (`IsValidIndex(..., true)`),
  // so the one-past-the-end index is legal and must not be clamped away.
  assert.deepEqual(
    move({
      dragId: "a",
      targetId: "c",
      targetParentId: "P",
      position: "after",
    }),
    { parentId: "P", index: 3 },
  );
});

test("inside appends to the folder (no index)", () => {
  assert.deepEqual(
    move({
      dragId: "a",
      targetId: "b",
      targetParentId: "P",
      position: "inside",
    }),
    { parentId: "b" },
  );
});

test("dropping a node onto itself is rejected", () => {
  assert.equal(
    move({
      dragId: "a",
      targetId: "a",
      targetParentId: "P",
      position: "before",
    }),
    null,
  );
});

test("a target that is not among its parent's children is rejected", () => {
  // Belt and braces for a reload race: the row is on screen but the sibling
  // list no longer has it, so there is no index to name. Better to do nothing
  // than to guess a slot.
  assert.deepEqual(
    computeMoveTarget({
      dragId: "x",
      targetId: "top",
      targetParentId: undefined,
      position: "before",
      rootFolderId: "P",
      siblings: siblings(),
    }),
    null,
  );
});

test("computeDropPosition splits folder rows into thirds", () => {
  const top = 100;
  const height = 22;
  assert.equal(
    computeDropPosition({ kind: "folder", top, height, cursorY: top + 2 }),
    "before",
  );
  assert.equal(
    computeDropPosition({ kind: "folder", top, height, cursorY: top + 11 }),
    "inside",
  );
  assert.equal(
    computeDropPosition({ kind: "folder", top, height, cursorY: top + 20 }),
    "after",
  );
});

test("computeDropPosition never reports inside for bookmark rows", () => {
  const top = 100;
  const height = 22;
  assert.equal(
    computeDropPosition({ kind: "bookmark", top, height, cursorY: top + 11 }),
    "after",
  );
  assert.equal(
    computeDropPosition({ kind: "bookmark", top, height, cursorY: top + 10 }),
    "before",
  );
});

test("topLevelNodes skips the synthetic root", () => {
  const tree: BookmarkNode[] = [
    {
      id: "0",
      title: "",
      children: [
        { id: "1", parentId: "0", title: "Bookmarks bar", children: [] },
        { id: "2", parentId: "0", title: "Other bookmarks", children: [] },
      ],
    },
  ];
  assert.deepEqual(
    topLevelNodes(tree).map((n) => n.id),
    ["1", "2"],
  );
  assert.equal(pickRootFolderId(tree), "1");
});

test("visibleTopLevelNodes hides only Chrome's Other bookmarks folder", () => {
  const tree: BookmarkNode[] = [
    {
      id: "0",
      title: "",
      children: [
        { id: "1", parentId: "0", title: "Bookmarks bar", children: [] },
        { id: "2", parentId: "0", title: "其他书签", children: [] },
        { id: "3", parentId: "0", title: "Mobile bookmarks", children: [] },
      ],
    },
  ];

  assert.deepEqual(
    visibleTopLevelNodes(tree, true).map((n) => n.id),
    ["1", "2", "3"],
  );
  // Matched by id, not title — the stub above deliberately carries a localized
  // "Other bookmarks" title, which a title comparison would miss.
  assert.deepEqual(
    visibleTopLevelNodes(tree, false).map((n) => n.id),
    ["1", "3"],
  );
  // Hiding it must not move the empty-area "New folder" target.
  assert.equal(pickRootFolderId(tree), "1");
});

test("subtreeContains detects cycles before they happen", () => {
  const tree: BookmarkNode[] = [
    {
      id: "F",
      title: "F",
      children: [
        { id: "A", parentId: "F", title: "A" },
        {
          id: "G",
          parentId: "F",
          title: "G",
          children: [{ id: "H", parentId: "G", title: "H" }],
        },
      ],
    },
  ];
  const folder = tree[0];
  const inner = folder.children![1];
  assert.equal(subtreeContains(folder, "H"), true);
  assert.equal(subtreeContains(folder, "F"), true);
  assert.equal(subtreeContains(inner, "A"), false);
});

test("a click opens a bookmark but only folds a folder", () => {
  // The click contract: one click is the whole gesture, and it never selects,
  // so the search box in the main area stays where it is.
  assert.equal(
    resolveRowActivation({ id: "b", title: "GitHub", url: "https://github.com" }),
    "open",
  );
  assert.equal(resolveRowActivation({ id: "f", title: "Dev", children: [] }), "toggle");
  // `getTree()` gives a folder an empty/absent url; both must fold, not "open".
  assert.equal(resolveRowActivation({ id: "f2", title: "Empty url", url: "" }), "toggle");
});

// ---------------------------------------------------------------- search

/** One top-level folder, so the "ancestors are kept" cases have a parent. */
function searchable(): BookmarkNode[] {
  return [
    {
      id: "1",
      title: "Bookmarks bar",
      children: [
        { id: "b1", title: "GitHub", url: "https://github.com" },
        {
          id: "f1",
          title: "Dev",
          children: [
            { id: "b2", title: "Vue", url: "https://vuejs.org" },
            { id: "b3", title: "Notes", url: "https://example.com/vue-notes" },
          ],
        },
      ],
    },
  ];
}

test("an empty query is not a filter", () => {
  const tree = searchable();
  const result = searchBookmarks(tree, "   ");
  assert.equal(result.active, false);
  assert.deepEqual(
    result.nodes.map((n) => n.id),
    ["1"],
  );
  assert.equal(result.reveal.size, 0);
});

test("search keeps the matches and the folders above them, and drops the rest", () => {
  const result = searchBookmarks(searchable(), "vue");
  // "Dev" does not match — it survives only as the way down to two rows that
  // do, which is the whole difference from "matches plus descendants".
  assert.deepEqual(result.nodes[0].children!.map((n) => n.id), ["f1"]);
  assert.deepEqual(
    result.nodes[0].children![0].children!.map((n) => n.id),
    ["b2", "b3"],
  );
  // GitHub is nowhere on the path, so it is not there to be rendered at all.
  assert.equal(JSON.stringify(result.nodes).includes("GitHub"), false);
});

test("search reports the folders it must open, and only those", () => {
  const result = searchBookmarks(searchable(), "vue");
  // The path to a hit: the top-level folder and the one the hits live in.
  assert.deepEqual([...result.reveal].sort(), ["1", "f1"]);
});

test("a folder that matches on its own is kept without being opened", () => {
  const result = searchBookmarks(searchable(), "dev");
  assert.deepEqual(result.nodes[0].children!.map((n) => n.id), ["f1"]);
  // Nothing below it matched, so there is nothing to reveal: opening it would
  // show an empty folder, and the user's own fold is left as they left it.
  assert.equal(result.reveal.has("f1"), false);
  assert.deepEqual([...result.reveal], ["1"]);
});

test("search matches the URL as well as the title, case-insensitively", () => {
  const byUrl = searchBookmarks(searchable(), "example.com");
  assert.deepEqual(byUrl.nodes[0].children![0].children!.map((n) => n.id), ["b3"]);
  assert.equal(matchesQuery({ id: "x", title: "Docs", url: "https://x.dev/A" }, "x.dev/a"), true);
  assert.equal(matchesQuery({ id: "x", title: "Untitled", url: undefined }, "untitled"), true);
});

test("a query nothing answers prunes the tree to nothing", () => {
  const result = searchBookmarks(searchable(), "zzz");
  assert.equal(result.active, true);
  assert.deepEqual(result.nodes, []);
  assert.equal(result.reveal.size, 0);
});
