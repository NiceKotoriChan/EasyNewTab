/**
 * Unit tests for the key → action mapping.
 *
 * The cases that matter are the *negative* ones — a bare key pressed while someone is
 * typing must not fire — because those are the failures nobody reports as a bug ("it
 * opened the sidebar while I was writing"). Every key is gated behind `typing`, so one
 * loop covers the whole map.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveShortcut, type KeyEventLike } from "../src/core/keymap.ts";

function press(key: string, extra: Partial<KeyEventLike> = {}) {
  return resolveShortcut({ key, typing: false, ...extra });
}

test("a bare key the shell owns resolves to its action", () => {
  assert.equal(press("/"), "focus-search");
  assert.equal(press("p"), "search-bookmarks");
  assert.equal(press("s"), "toggle-sidebar");
  assert.equal(press("b"), "show-bookmarks");
  assert.equal(press("h"), "show-history");
});

test("no binding needs a modifier", () => {
  // Nothing is bound with a modifier, so a modified key must fall through — `Ctrl+P` is
  // the print dialog, not the bookmark search, and `Ctrl+1`/`Ctrl+2` belong to the
  // browser's tab switching.
  for (const key of ["/", "p", "s", "b", "h"]) {
    assert.equal(press(key, { ctrlKey: true }), null, `Ctrl+${key} is not a binding`);
    assert.equal(press(key, { metaKey: true }), null, `Cmd+${key} is not one either`);
  }
});

test("a bare key does nothing while the user is typing", () => {
  for (const key of ["/", "p", "s", "b", "h"]) {
    assert.equal(press(key, { typing: true }), null, `${key} must not fire mid-sentence`);
  }
});

test("Escape reaches the shell from inside an input", () => {
  // The one key that has to: it is how a text field is abandoned, and the bindings above
  // are dead until the caret is out of one.
  assert.equal(press("Escape", { typing: true }), "dismiss");
});

test("bindings are case-insensitive, as the browser reports them", () => {
  assert.equal(press("P"), "search-bookmarks");
  assert.equal(press("S"), "toggle-sidebar");
  assert.equal(press("B"), "show-bookmarks");
  assert.equal(press("H"), "show-history");
  assert.equal(press("Escape"), "dismiss");
});

test("keys the shell does not own are left alone", () => {
  // A bare letter that is not bound must fall through to the page, and a modified key
  // must not be swallowed either.
  for (const key of ["d", "a", "Enter", "ArrowDown", "Tab", "1", "2"]) {
    assert.equal(press(key), null, `${key} should not be a shortcut`);
    assert.equal(press(key, { ctrlKey: true }), null, `Ctrl+${key} is not one either`);
  }
  // `d` and the digits are the ones a careless refactor would promote to bare bindings;
  // assert them explicitly.
  assert.equal(press("d"), null);
});
