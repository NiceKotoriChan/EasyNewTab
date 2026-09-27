/**
 * Unit tests for the most-visited list filter.
 *
 * Everything Chrome hands back goes through `selectTopSites`, and every rule it
 * applies is visible in the rendered row — a second row for the same site, an
 * entry with no label, a shortcut to somewhere a new tab cannot go. None of
 * that is capturable by the render check without encoding the fixture's shape
 * into an assertion, so the rules are pinned here against literal inputs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { selectTopSites, TOP_SITE_LIMIT } from "../src/core/topSites.ts";

test("a page and its deep link count as one site", () => {
  const picked = selectTopSites([
    { url: "https://github.com/", title: "GitHub" },
    { url: "https://github.com/explore", title: "Explore GitHub" },
    { url: "https://github.com/notifications", title: "Notifications" },
  ]);
  assert.deepEqual(picked, [
    { url: "https://github.com/", title: "GitHub" },
  ]);
});

test("the first entry for a host wins, because it is the one Chrome ranked", () => {
  // The later title is not "more correct" — it belongs to a different page of
  // the same site, and swapping it in would relabel the site after a page
  // inside it.
  const picked = selectTopSites([
    { url: "https://news.ycombinator.com/", title: "Hacker News" },
    { url: "https://news.ycombinator.com/newest", title: "New Links" },
  ]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].title, "Hacker News");
});

test("www. does not make a second site", () => {
  const picked = selectTopSites([
    { url: "https://www.zhihu.com/", title: "知乎" },
    { url: "https://zhihu.com/hot", title: "热榜" },
  ]);
  assert.equal(picked.length, 1);
  // The kept entry is the first one whole, `www.` and all: the key is
  // normalised, the URL that gets navigated to is not rewritten.
  assert.equal(picked[0].url, "https://www.zhihu.com/");
});

test("a blank title falls back to the host", () => {
  const picked = selectTopSites([
    { url: "https://mail.google.com/mail/u/0/", title: "" },
    { url: "https://example.com/a", title: "   " },
    { url: "https://nothing.example/x", title: undefined },
  ]);
  assert.deepEqual(picked, [
    { url: "https://mail.google.com/mail/u/0/", title: "mail.google.com" },
    { url: "https://example.com/a", title: "example.com" },
    { url: "https://nothing.example/x", title: "nothing.example" },
  ]);
});

test("anything a new tab cannot navigate to is dropped", () => {
  const picked = selectTopSites([
    { url: "chrome://bookmarks", title: "Bookmark Manager" },
    { url: "file:///home/notes.md", title: "notes" },
    { url: "javascript:alert(1)", title: "nope" },
    { url: "not-a-url", title: "No scheme, no dot" },
    { url: "", title: "Empty" },
    { url: "https://ok.example/", title: "Fine" },
  ]);
  assert.deepEqual(picked, [
    { url: "https://ok.example/", title: "Fine" },
  ]);
});

test("the row is capped, and the cap keeps the top of the order", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    url: `https://site${i}.example/`,
    title: `Site ${i}`,
  }));
  const picked = selectTopSites(many);
  assert.equal(picked.length, TOP_SITE_LIMIT);
  // Not just "eight of them": Chrome's ranking is the reason for using this
  // API, so the eight have to be the first eight.
  assert.deepEqual(
    picked.map((site) => site.title),
    ["Site 0", "Site 1", "Site 2", "Site 3", "Site 4", "Site 5", "Site 6", "Site 7"],
  );

  // The cap counts *kept* entries, not scanned ones — a dupe must not eat a
  // slot, or a list with one repeat would come back seven long.
  const withDupes = [
    { url: "https://a.example/", title: "A" },
    { url: "https://a.example/deep", title: "A deep" },
    { url: "https://b.example/", title: "B" },
  ];
  assert.deepEqual(
    selectTopSites(withDupes, 2).map((site) => site.title),
    ["A", "B"],
  );
});

test("an empty list stays empty", () => {
  // A fresh profile, an incognito window, a build without the `topSites`
  // permission — the row's `v-if` is on this length, so `[]` has to be the
  // answer rather than anything with a length.
  assert.deepEqual(selectTopSites([]), []);
});
