// Tests for the pure bookmark logic; the drag-and-drop index correction is the reason this file exists — a silent regression lands a bookmark one slot off.

import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDropPosition,
  computeMoveTarget,
  dragBlockedIds,
  pickRootFolderId,
  resolveRowActivation,
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

// Chromium's move rules transcribed from bookmark_model.cc: "already there" is index==old or old+1, and later moves decrement. Reproducing it is the only way the returned index means anything.
function chromiumMove<T>(list: readonly T[], from: number, index: number): T[] {
  if (index === from || index === from + 1) return [...list];
  const at = index > from ? index - 1 : index;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(at, 0, moved);
  return next;
}

// The drop target stated without an index convention: lift the row out, put it back before/after the target in the pre-lift list — the frame the indicator is drawn in.
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
  // Downward moves are the half that can go wrong: re-applying Chromium's correction cancels it, and the platform's decrement doesn't fire on upward moves — so the bug reads as "drop ignored", not off-by-one.
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
        // A missing index becomes -1, which `splice` turns into a wrong insertion — so this fails loudly instead of lining up quietly.
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
  // The correction is Chromium's, but the frame is ours: a downward drop names the slot as counted *before* the node is lifted. Both land the same way; only the index differs.
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
  // Chromium accepts `index == children().size()` (`IsValidIndex(..., true)`), so the one-past-the-end index is legal and must not be clamped.
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
  // Belt-and-braces for a reload race: the row is on screen but not in the sibling list, so there's no index to name — better to do nothing than guess a slot.
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
  // Matched by id, not title — the stub carries a localized "Other bookmarks" title a title comparison would miss.
  assert.deepEqual(
    visibleTopLevelNodes(tree, false).map((n) => n.id),
    ["1", "3"],
  );
  // Hiding it must not move the blank-space "New" target.
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
  // The click contract: one click is the whole gesture and never selects, so the main-area search box stays put.
  assert.equal(
    resolveRowActivation({ id: "b", title: "GitHub", url: "https://github.com" }),
    "open",
  );
  assert.equal(resolveRowActivation({ id: "f", title: "Dev", children: [] }), "toggle");
  // `getTree()` gives a folder an empty/absent url; both must fold, not "open".
  assert.equal(resolveRowActivation({ id: "f2", title: "Empty url", url: "" }), "toggle");
});
