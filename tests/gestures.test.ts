/**
 * The decisions the app makes about gestures — not the recognition of them, which belongs to the
 * library (`usePointerSwipe`) and to the platform's own long press.
 *
 * What is here has no other witness. A press that arms on the wrong pointer type takes the gesture
 * away from the drag adapter; a slop too tight turns a scroll into a menu, and one too loose
 * swallows the menu's own dismiss-by-moving. A swipe landing on the wrong panel, or on a gesture the
 * browser already owns, looks like "the panel is flaky" in a browser — the report that never gets
 * filed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isFingerPointer,
  LONG_PRESS_MS,
  movedBeyondSlop,
  PRESS_SLOP,
  SWIPE_EDGE,
  startedInBrowserEdge,
  swipedIndex,
} from "../src/core/gestures.ts";

test("only a finger arms a gesture", () => {
  // Both a mouse and a pen have a right button, and a mouse drag is how the tree's adapter moves a
  // row — arming either would put two gestures on one press.
  assert.equal(isFingerPointer("touch"), true);
  assert.equal(isFingerPointer("mouse"), false);
  assert.equal(isFingerPointer("pen"), false);
  // An empty string is what a browser reports when it cannot tell.
  assert.equal(isFingerPointer(""), false);
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
  // A diagonal drag of `slop` on each axis is `slop * sqrt(2)` away and still a press. Measuring the
  // hypotenuse would cancel this gesture, which is the one a thumb makes when it settles onto a row.
  const from = { x: 200, y: 300 };
  assert.equal(
    movedBeyondSlop(from, { x: 200 + PRESS_SLOP, y: 300 + PRESS_SLOP }),
    false,
  );
});

const WIDTH = 400;

test("the screen edges belong to the browser", () => {
  // Android's system back gesture and Chromium's own edge swipe both live in the marginal strip, and
  // a panel switch that fights either one loses: the page would move *and* navigate.
  assert.equal(startedInBrowserEdge(0, WIDTH), true);
  assert.equal(startedInBrowserEdge(SWIPE_EDGE - 1, WIDTH), true);
  assert.equal(startedInBrowserEdge(WIDTH, WIDTH), true);
  assert.equal(startedInBrowserEdge(WIDTH - SWIPE_EDGE + 1, WIDTH), true);
  // One pixel inside is fair game on either edge — a phone is narrow, so the usable strip is small
  // enough already without widening the guard.
  assert.equal(startedInBrowserEdge(SWIPE_EDGE, WIDTH), false);
  assert.equal(startedInBrowserEdge(WIDTH / 2, WIDTH), false);
  assert.equal(startedInBrowserEdge(WIDTH - SWIPE_EDGE, WIDTH), false);
});

test("the ends of the strip hold rather than wrap", () => {
  // Two views: from the first, only advancing goes anywhere.
  assert.equal(swipedIndex(0, "left", 2), 1);
  assert.equal(swipedIndex(1, "right", 2), 0);
  assert.equal(swipedIndex(0, "right", 2), null);
  assert.equal(swipedIndex(1, "left", 2), null);
});

test("the same step walks a longer strip", () => {
  // Not a decision anyone has made yet, but the arithmetic is what a third panel would rest on: the
  // step is "one along", not "the panel on the other side".
  assert.equal(swipedIndex(1, "left", 3), 2);
  assert.equal(swipedIndex(1, "right", 3), 0);
  assert.equal(swipedIndex(2, "left", 3), null);
  assert.equal(swipedIndex(0, "right", 3), null);
});
