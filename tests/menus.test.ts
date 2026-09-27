/**
 * What the two context menus offer.
 *
 * The lists are the only description of what the app can do to a bookmark's *structure*,
 * and they are deliberately short: a folder row and the blank space under the tree, and
 * nothing else. A bookmark row and every history row have no menu at all — the things
 * they can do are on the row itself.
 *
 * That makes the interesting assertions the negative ones: an action silently coming back
 * is the failure mode, and it would come back as a menu entry that opens something with
 * nowhere to go.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { emptyTreeMenu, folderMenu } from "../src/core/menus.ts";

/** Every action either menu may hand out. Adding one is a deliberate act, so it has to be
 *  added here too — this allowlist is what keeps an action from being reintroduced
 *  without a decision. */
const ALLOWED_ACTIONS = ["new-folder", "rename", "delete"];

test("a folder row offers make, rename, remove — in the order the work happens", () => {
  assert.deepEqual(
    folderMenu().map((item) => item.action),
    ["new-folder", "rename", "delete"],
  );
  assert.deepEqual(
    folderMenu().map((item) => item.label),
    ["New folder", "Rename", "Delete"],
  );
});

test("delete is the dangerous one, and it is last", () => {
  const items = folderMenu();
  const remove = items[items.length - 1];
  assert.equal(remove.action, "delete");
  assert.equal(remove.danger, true);
  // Nothing else in the app is a red menu row, so a stray `danger` is a misfired red
  // rather than a second destructive action.
  assert.equal(
    items.filter((item) => item.danger).length,
    1,
  );
});

test("the blank space under the tree makes a top-level folder", () => {
  assert.deepEqual(
    emptyTreeMenu().map((item) => item.action),
    ["new-folder"],
  );
  // Creating one is not destructive, so it is not painted as though it were.
  assert.equal(emptyTreeMenu()[0].danger, undefined);
});

test("no menu offers anything a click or a row button already does", () => {
  // Absent, not disabled: a greyed-out row would say "this exists but you may not have
  // it", which is not what is true.
  for (const item of [...folderMenu(), ...emptyTreeMenu()]) {
    assert.ok(
      ALLOWED_ACTIONS.includes(item.action),
      `unexpected menu action: ${item.action}`,
    );
  }
});

test("no menu hands out an empty list", () => {
  // `useContextMenu.open` treats an empty list as "nothing to show"; a builder that can
  // return one is a menu that silently does nothing.
  for (const menu of [folderMenu(), emptyTreeMenu()]) {
    assert.ok(menu.length > 0);
  }
});

test("no menu draws a divider", () => {
  // Three related actions on one folder are one group, so there is no divider to draw —
  // and no field on `MenuItem` that could reintroduce one as an ad-hoc property.
  for (const item of [...folderMenu(), ...emptyTreeMenu()]) {
    assert.equal("separatorBefore" in item, false);
  }
});
