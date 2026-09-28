/**
 * Unit tests for settings normalization.
 *
 * `normalizeSettings` is the only gate between storage and the rest of the app. The docking side is
 * the first field where a bad value would show up as a broken *layout* rather than a merely wrong
 * preference — an unrecognised position has to fall back to left, not reach the shell as a mystery
 * string no CSS class matches. The history cap goes straight to `maxResults`, so it has to arrive as
 * a whole number inside the range the options page offers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  normalizeSettings,
} from "../src/core/settings.ts";

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
  // Also pins the drop-unknown-keys behaviour: a leftover key must not survive a read, or it would
  // live on forever in storage. `historyCount` is exactly that.
  assert.deepEqual(
    normalizeSettings({
      searchEngine: "bing",
      openInNewTab: false,
      showOtherBookmarks: false,
      historyLimit: 250,
      sidebarPosition: "right",
      historyCount: 50,
    }),
    {
      searchEngine: "bing",
      openInNewTab: false,
      showOtherBookmarks: false,
      historyLimit: 250,
      sidebarPosition: "right",
    },
  );
});

test("the history panel is capped at 100 entries unless told otherwise", () => {
  assert.equal(normalizeSettings({}).historyLimit, DEFAULT_SETTINGS.historyLimit);
  assert.equal(DEFAULT_SETTINGS.historyLimit, 100);
});

test("a cap nobody could have meant falls back rather than reaching the API", () => {
  // A profile that predates the setting has no value at all, and that is the case
  // worth separating from a *bad* one: a missing key gets the default back.
  for (const missing of [undefined, {}, "abc", NaN, Infinity]) {
    assert.equal(
      normalizeSettings({ historyLimit: missing }).historyLimit,
      100,
      `"${String(missing)}" should fall back to the default`,
    );
  }
  // Anything else is coerced and clamped, exactly as the sidebar width is — so a stored `null`
  // cannot arrive as null, and 0 cannot ask the API for zero rows.
  for (const out of [null, "", [], 0, -5]) {
    assert.equal(
      normalizeSettings({ historyLimit: out }).historyLimit,
      HISTORY_LIMIT_MIN,
      `"${String(out)}" should land on the floor, not on the API`,
    );
  }
  assert.equal(
    normalizeSettings({ historyLimit: 99999 }).historyLimit,
    HISTORY_LIMIT_MAX,
  );
});

test("the cap is a whole number of entries", () => {
  // It is handed straight to `maxResults`, and the list draws one row per entry.
  assert.equal(normalizeSettings({ historyLimit: 50.6 }).historyLimit, 51);
  assert.equal(normalizeSettings({ historyLimit: "250" }).historyLimit, 250);
});
