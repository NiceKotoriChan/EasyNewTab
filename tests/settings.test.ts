/**
 * Unit tests for settings normalization.
 *
 * `normalizeSettings` is the only gate between storage and the rest of the app.
 * The docking side is the first field where a bad value would show up as a
 * broken *layout* rather than a merely wrong preference — an unrecognised
 * position has to fall back to left, not reach the shell as a mystery string
 * that no CSS class matches.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/core/settings.ts";

test("the sidebar docks left unless told otherwise", () => {
  assert.equal(normalizeSettings({}).sidebarPosition, "left");
  assert.equal(DEFAULT_SETTINGS.sidebarPosition, "left");
});

test("a hand-edited docking side falls back instead of leaking through", () => {
  for (const bad of ["middle", "LEFT", "", 2, null, undefined, {}]) {
    assert.equal(
      normalizeSettings({ sidebarPosition: bad }).sidebarPosition,
      "left",
      `"${String(bad)}" should not be accepted as a docking side`,
    );
  }
  assert.equal(
    normalizeSettings({ sidebarPosition: "right" }).sidebarPosition,
    "right",
  );
});

test("normalizing produces exactly the known fields", () => {
  // Also pins the drop-unknown-keys behaviour: a leftover key from an older
  // build must not survive a read, or it would live on forever in storage.
  assert.deepEqual(
    normalizeSettings({
      searchEngine: "bing",
      openInNewTab: false,
      showOtherBookmarks: false,
      sidebarPosition: "right",
      historyCount: 50,
    }),
    {
      searchEngine: "bing",
      openInNewTab: false,
      showOtherBookmarks: false,
      sidebarPosition: "right",
    },
  );
});
