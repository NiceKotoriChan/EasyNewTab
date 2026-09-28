// The two context menus: only a folder row and the blank space under the tree get one (bookmark/history rows act on themselves). The interesting checks are the negative ones — an action silently returning is the failure mode.

import assert from "node:assert/strict";
import test from "node:test";

import { emptyTreeMenu, folderMenu } from "../src/core/menus.ts";

// Every action either menu may hand out; this allowlist is what stops an action being reintroduced without a decision.
const ALLOWED_ACTIONS = ["new", "rename", "delete"];

test("a folder row offers make, rename, remove — in the order the work happens", () => {
  assert.deepEqual(
    folderMenu().map((item) => item.action),
    ["new", "rename", "delete"],
  );
  assert.deepEqual(
    folderMenu().map((item) => item.label),
    ["New", "Rename", "Delete"],
  );
});

test("delete is the dangerous one, and it is last", () => {
  const items = folderMenu();
  const remove = items[items.length - 1];
  assert.equal(remove.action, "delete");
  assert.equal(remove.danger, true);
  // Nothing else is a red menu row, so a stray `danger` is a misfired red, not a second destructive action.
  assert.equal(
    items.filter((item) => item.danger).length,
    1,
  );
});

test("the blank space under the tree makes a top-level folder", () => {
  assert.deepEqual(
    emptyTreeMenu().map((item) => item.action),
    ["new"],
  );
  // Creating one is not destructive, so it is not painted as though it were.
  assert.equal(emptyTreeMenu()[0].danger, undefined);
});

test("no menu offers anything a click or a row button already does", () => {
  // Absent, not disabled: a greyed-out row would falsely imply "this exists but you may not have it".
  for (const item of [...folderMenu(), ...emptyTreeMenu()]) {
    assert.ok(
      ALLOWED_ACTIONS.includes(item.action),
      `unexpected menu action: ${item.action}`,
    );
  }
});

test("no menu hands out an empty list", () => {
  // `useContextMenu.open` treats an empty list as "nothing to show", so a builder returning one is a silently DO-nothing menu.
  for (const menu of [folderMenu(), emptyTreeMenu()]) {
    assert.ok(menu.length > 0);
  }
});

test("no menu draws a divider", () => {
  // Three related actions on one folder are one group, so there's no divider — and no `MenuItem` field that could reintroduce one.
  for (const item of [...folderMenu(), ...emptyTreeMenu()]) {
    assert.equal("separatorBefore" in item, false);
  }
});
