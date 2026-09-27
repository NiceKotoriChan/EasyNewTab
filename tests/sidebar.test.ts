/**
 * The sidebar's drag thresholds.
 *
 * The collapse gesture has no other witness: dragging the divider is the only
 * way to hide the sidebar, so an off-by-one shows up as "the sidebar won't
 * close" — or worse, refuses to come back.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SIDEBAR_COLLAPSE_AT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
  dragWidth,
  resolveSidebarDrag,
} from "../src/core/settings.ts";

test("the collapse threshold sits below the minimum usable width", () => {
  // If it ever drifted above SIDEBAR_MIN the two states would overlap and a
  // single pointer position could mean both "collapse" and "resize".
  assert.ok(SIDEBAR_COLLAPSE_AT < SIDEBAR_MIN);
});

test("dragging inward far enough collapses the sidebar", () => {
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_COLLAPSE_AT - 1, false), {
    kind: "collapse",
  });
  // Even dragging far past it — the width stops mattering once it is shut.
  assert.deepEqual(resolveSidebarDrag(0, false), { kind: "collapse" });
  assert.deepEqual(resolveSidebarDrag(-40, false), { kind: "collapse" });
});

test("at the threshold it still resizes, so the flip needs real intent", () => {
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_COLLAPSE_AT, false), {
    kind: "resize",
    width: SIDEBAR_MIN,
  });
});

test("resizing clamps to the sidebar's own limits", () => {
  assert.deepEqual(resolveSidebarDrag(300, false), {
    kind: "resize",
    width: 300,
  });
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_MAX + 200, false), {
    kind: "resize",
    width: SIDEBAR_MAX,
  });
});

test("a collapsed sidebar ignores drags that stay too narrow", () => {
  // The dead band between the two thresholds: wide enough not to expand, and
  // this is what stops jitter around the boundary from flickering the panel.
  assert.deepEqual(resolveSidebarDrag(0, true), { kind: "idle" });
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_COLLAPSE_AT, true), {
    kind: "idle",
  });
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_MIN - 1, true), { kind: "idle" });
});

test("dragging back out past the minimum width brings it back", () => {
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_MIN, true), {
    kind: "expand",
    width: SIDEBAR_MIN,
  });
  assert.deepEqual(resolveSidebarDrag(SIDEBAR_MAX + 50, true), {
    kind: "expand",
    width: SIDEBAR_MAX,
  });
});

test("clampSidebarWidth rounds and bounds", () => {
  assert.equal(clampSidebarWidth(299.4), 299);
  assert.equal(clampSidebarWidth(-5), SIDEBAR_MIN);
  assert.equal(clampSidebarWidth(10_000), SIDEBAR_MAX);
});

test("the drag is measured from where the pointer went down", () => {
  // No movement, no change — in either docking side.
  assert.equal(dragWidth(260, 400, 400, "left"), 260);
  assert.equal(dragWidth(260, 400, 400, "right"), 260);
});

test("docking right mirrors which way the divider has to move", () => {
  // Docked left the divider is on the sidebar's right, so dragging left is what
  // narrows it.
  assert.equal(dragWidth(260, 300, 340, "left"), 300);
  assert.equal(dragWidth(260, 300, 260, "left"), 220);
  // Docked right it is on the sidebar's left, so the same two gestures swap.
  assert.equal(dragWidth(260, 300, 260, "right"), 300);
  assert.equal(dragWidth(260, 300, 340, "right"), 220);
});

test("docked right, the collapsed handle is dragged left to bring it back", () => {
  // The composition the pointer handler actually runs: the handle rests on the
  // right window edge describing a width of zero, and dragging left grows the
  // sidebar toward the restore threshold.
  const tooShort = dragWidth(0, 1400, 1300, "right");
  assert.equal(tooShort, 100);
  assert.deepEqual(resolveSidebarDrag(tooShort, true), { kind: "idle" });

  const farEnough = dragWidth(0, 1400, 1210, "right");
  assert.equal(farEnough, 190);
  assert.deepEqual(resolveSidebarDrag(farEnough, true), {
    kind: "expand",
    width: farEnough,
  });
});
