/**
 * What the two context menus offer.
 *
 * The lists are the only description of what the app can do to a bookmark, and
 * one entry is conditional on the reader rather than on the data: the detail
 * editor replaces the search box in the main area, which a stacked touch shell
 * does not have. Getting that backwards is invisible — the entry would still
 * render, and open something with nowhere to go.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  bookmarkMenu,
  emptyHistoryMenu,
  emptyTreeMenu,
  historyMenu,
} from "../src/core/menus.ts";

const withDetails = { showDetails: true };
const withoutDetails = { showDetails: false };

test("a bookmark row offers the four things a click cannot do", () => {
  assert.deepEqual(
    bookmarkMenu({ folder: false }, withDetails).map((item) => item.action),
    ["open", "details", "rename", "delete"],
  );
});

test("a folder row swaps open for new-folder and keeps the rest", () => {
  assert.deepEqual(
    bookmarkMenu({ folder: true }, withDetails).map((item) => item.action),
    ["new-folder", "details", "rename", "delete"],
  );
});

test("without a detail view the entry is absent, not disabled", () => {
  // Absent, because there is nothing to explain: a greyed-out row would say
  // "this exists but you may not have it", which is not what is true.
  for (const folder of [false, true]) {
    const actions = bookmarkMenu({ folder }, withoutDetails).map(
      (item) => item.action,
    );
    assert.equal(actions.includes("details"), false);
    // And nothing else moved with it.
    assert.equal(actions.includes("rename"), true);
    assert.equal(actions.includes("delete"), true);
  }
});

test("the row that opens a menu is not the row that deletes", () => {
  const items = bookmarkMenu({ folder: false }, withDetails);
  const remove = items.find((item) => item.action === "delete");
  assert.equal(remove?.danger, true);
  // A divider above it, so the destructive entry is not one slip away from
  // "Rename" — the two are adjacent and both open a prompt.
  assert.equal(remove?.separatorBefore, true);
  // The delete confirmation dialog carries the reassurance; the row does not
  // need to repeat it.
  assert.equal(remove?.label, "Delete");
});

test("a history row offers open, details and remove", () => {
  assert.deepEqual(
    historyMenu(withDetails).map((item) => item.action),
    ["open", "details", "remove"],
  );
  assert.deepEqual(
    historyMenu(withoutDetails).map((item) => item.action),
    ["open", "remove"],
  );
  // Clearing one entry is destructive, and it is the last row of three.
  const remove = historyMenu(withDetails)[2];
  assert.equal(remove.danger, true);
  assert.equal(remove.separatorBefore, true);
});

test("the blank space under each list has exactly one command", () => {
  // Empty space has no node and no URL, so there is no detail view and no open —
  // only "make one here" and "clear the lot".
  assert.deepEqual(
    emptyTreeMenu().map((item) => item.action),
    ["new-folder"],
  );
  assert.deepEqual(
    emptyHistoryMenu().map((item) => item.action),
    ["clear"],
  );
  assert.equal(emptyHistoryMenu()[0].danger, true);
});

test("no menu hands out an empty list", () => {
  // `useContextMenu.open` treats an empty list as "nothing to show"; a builder
  // that can return one is a menu that silently does nothing.
  for (const menu of [
    bookmarkMenu({ folder: false }, withoutDetails),
    bookmarkMenu({ folder: true }, withoutDetails),
    historyMenu(withoutDetails),
    emptyTreeMenu(),
    emptyHistoryMenu(),
  ]) {
    assert.ok(menu.length > 0);
  }
});
