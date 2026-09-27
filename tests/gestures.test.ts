/**
 * The two decisions behind a touch long press.
 *
 * Neither has another witness. A press that arms on the wrong pointer type takes
 * the gesture away from the drag adapter; a slop that is too tight turns a
 * scroll into a menu, and one that is too loose swallows the menu's own
 * dismiss-by-moving. Both failures look like "the menu is flaky" in a browser,
 * which is the report that never gets filed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isLongPressPointer,
  LONG_PRESS_MS,
  movedBeyondSlop,
  PRESS_SLOP,
} from "../src/core/gestures.ts";

test("only a finger arms a long press", () => {
  // A mouse and a pen both have a right button, and the drag adapter is a
  // mouse gesture — arming on either would put two gestures on one press.
  assert.equal(isLongPressPointer("touch"), true);
  assert.equal(isLongPressPointer("mouse"), false);
  assert.equal(isLongPressPointer("pen"), false);
  // An empty string is what a browser reports when it cannot tell.
  assert.equal(isLongPressPointer(""), false);
});

test("the press has to outlast a tap", () => {
  // Chrome's own long press is 500ms; below the platform's value our menu opens
  // first and the platform's own arrives into it.
  assert.equal(LONG_PRESS_MS, 500);
});

test("a finger resting still is still a press", () => {
  const from = { x: 200, y: 300 };
  assert.equal(movedBeyondSlop(from, from), false);
  // Inside the slop in either direction — a finger never holds perfectly still.
  assert.equal(movedBeyondSlop(from, { x: 200 + PRESS_SLOP, y: 300 }), false);
  assert.equal(movedBeyondSlop(from, { x: 200, y: 300 - PRESS_SLOP }), false);
  assert.equal(movedBeyondSlop(from, { x: 202, y: 297 }), false);
});

test("past the slop the press is a scroll", () => {
  const from = { x: 200, y: 300 };
  // One pixel past the boundary, on either axis, either way.
  assert.equal(movedBeyondSlop(from, { x: 200 + PRESS_SLOP + 1, y: 300 }), true);
  assert.equal(movedBeyondSlop(from, { x: 200 - PRESS_SLOP - 1, y: 300 }), true);
  assert.equal(movedBeyondSlop(from, { x: 200, y: 300 + PRESS_SLOP + 1 }), true);
  assert.equal(movedBeyondSlop(from, { x: 200, y: 300 - PRESS_SLOP - 1 }), true);
});

test("the slop is measured per axis, not as a distance", () => {
  // A diagonal drag of `slop` on each axis is `slop * sqrt(2)` away and still a
  // press. Measuring the hypotenuse would cancel this gesture, which is the
  // one a thumb makes when it settles onto a row.
  const from = { x: 200, y: 300 };
  assert.equal(
    movedBeyondSlop(from, { x: 200 + PRESS_SLOP, y: 300 + PRESS_SLOP }),
    false,
  );
});
