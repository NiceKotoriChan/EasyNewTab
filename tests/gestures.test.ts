/**
 * The decisions behind the two touch gestures: which presses are ours, and what the finger did.
 *
 * Neither has another witness. A press that arms on the wrong pointer type takes the gesture away
 * from the drag adapter; a slop too tight turns a scroll into a menu, and one too loose swallows the
 * menu's own dismiss-by-moving. A swipe threshold in the wrong place is worse still — it either
 * never fires or fires on the scroll, and both look like "the panel is flaky" in a browser. That is
 * the report that never gets filed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isFingerPointer,
  LONG_PRESS_MS,
  movedBeyondSlop,
  PRESS_SLOP,
  SWIPE_EDGE,
  SWIPE_MAX_Y,
  SWIPE_MIN_X,
  swipedIndex,
  swipeDirection,
} from "../src/core/gestures.ts";

test("only a finger arms a gesture", () => {
  // Both a mouse and a pen have a right button, and a mouse drag is how the tree's adapter moves a
  // row and how text gets selected — arming either would put two gestures on one press.
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

test("a nudge is not a swipe", () => {
  const from = { x: 200, y: 300 };
  // One pixel short of the threshold, either way — the boundary itself is a swipe.
  assert.equal(
    swipeDirection(from, { x: 200 - SWIPE_MIN_X + 1, y: 300 }, WIDTH),
    null,
  );
  assert.equal(
    swipeDirection(from, { x: 200 + SWIPE_MIN_X - 1, y: 300 }, WIDTH),
    null,
  );
  assert.equal(swipeDirection(from, { x: 200 - SWIPE_MIN_X, y: 300 }, WIDTH), "left");
  assert.equal(swipeDirection(from, { x: 200 + SWIPE_MIN_X, y: 300 }, WIDTH), "right");
});

test("the direction is the finger's, not the panel's", () => {
  // Naming it for the finger is what keeps the caller's arithmetic a single `+1`: a left swipe
  // advances, so the panel that arrives is the one that was off the right-hand edge.
  const from = { x: 200, y: 300 };
  assert.equal(swipeDirection(from, { x: 100, y: 300 }, WIDTH), "left");
  assert.equal(swipeDirection(from, { x: 320, y: 300 }, WIDTH), "right");
});

test("a scroll is never a swipe", () => {
  const from = { x: 200, y: 300 };
  // Travelled far enough sideways, but drifted too far down: the list scrolled, and the panel must
  // not also have moved.
  assert.equal(
    swipeDirection(
      from,
      { x: 200 - SWIPE_MIN_X - 20, y: 300 + SWIPE_MAX_Y + 1 },
      WIDTH,
    ),
    null,
  );
  // A perfect diagonal is a scroll: sideways travel is not enough on its own, it has to dominate.
  assert.equal(swipeDirection(from, { x: 120, y: 380 }, WIDTH), null);
  // Just inside both bounds, so the gesture in between still counts.
  assert.equal(
    swipeDirection(from, { x: 200 - SWIPE_MIN_X, y: 300 + SWIPE_MAX_Y }, WIDTH),
    "left",
  );
});

test("the screen edges belong to the browser", () => {
  // Chromium's own edge swipe is back/forward. A gesture that starts in that strip is the browser's
  // to win, so it is never read as ours — otherwise the panel would move and the page would also
  // navigate. The guard reads only where the finger *started*, so the rejection holds whatever it
  // then does.
  assert.equal(
    swipeDirection({ x: SWIPE_EDGE - 1, y: 300 }, { x: SWIPE_EDGE + 59, y: 300 }, WIDTH),
    null,
  );
  assert.equal(
    swipeDirection(
      { x: WIDTH - SWIPE_EDGE + 1, y: 300 },
      { x: WIDTH - SWIPE_EDGE - 59, y: 300 },
      WIDTH,
    ),
    null,
  );
  // One pixel inside is fair game on either edge — a phone is narrow, so the usable strip is small
  // enough already without widening the guard. Both travel inward, because that is the only
  // direction there is room for: at the left edge you cannot move further left than `x = 0`.
  assert.equal(
    swipeDirection({ x: SWIPE_EDGE, y: 300 }, { x: SWIPE_EDGE + SWIPE_MIN_X, y: 300 }, WIDTH),
    "right",
  );
  assert.equal(
    swipeDirection(
      { x: WIDTH - SWIPE_EDGE, y: 300 },
      { x: WIDTH - SWIPE_EDGE - SWIPE_MIN_X, y: 300 },
      WIDTH,
    ),
    "left",
  );
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
