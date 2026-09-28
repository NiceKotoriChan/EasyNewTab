// Tests `selectTopSites`: what it keeps, the one row it skips, and the cap. Pinned against literals
// here, since the render check only ever sees the fixture's shape.

import assert from "node:assert/strict";
import test from "node:test";

import { selectTopSites, TOP_SITE_LIMIT } from "../src/core/topSites.ts";

test("the row is what it was handed, in the order it arrived", () => {
  // Chrome ranks pages, and that ranking is the whole reason to use this API, so an entry reaches
  // the row as itself: a second page of a host already on the row, a `www.` twin and a deep link all
  // keep their own slot, and nothing is moved. The cost is real and accepted — a profile whose top
  // pages share a host spends several tiles on it.
  const pages = [
    { url: "https://github.com/", title: "GitHub" },
    { url: "https://github.com/explore", title: "Explore GitHub" },
    { url: "https://www.zhihu.com/", title: "知乎" },
    { url: "https://zhihu.com/hot", title: "热榜" },
    { url: "http://192.168.1.1/", title: "OpenWrt" },
  ];
  assert.deepEqual(selectTopSites(pages), pages);
});

test("a blank title falls back to the host, with `www.` stripped", () => {
  const picked = selectTopSites([
    { url: "https://mail.google.com/mail/u/0/", title: "" },
    { url: "https://www.zhihu.com/hot", title: "   " },
    { url: "https://nothing.example/x", title: undefined },
  ]);
  assert.deepEqual(picked, [
    { url: "https://mail.google.com/mail/u/0/", title: "mail.google.com" },
    { url: "https://www.zhihu.com/hot", title: "zhihu.com" },
    { url: "https://nothing.example/x", title: "nothing.example" },
  ]);
});

test("a row with no URL is the one thing skipped", () => {
  const picked = selectTopSites([
    { url: "", title: "Empty" },
    { url: "https://ok.example/", title: "Fine" },
  ]);
  assert.deepEqual(picked, [{ url: "https://ok.example/", title: "Fine" }]);
});

test("the row is capped, and the cap keeps the top of the order", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    url: `https://site${i}.example/`,
    title: `Site ${i}`,
  }));
  const picked = selectTopSites(many);
  assert.equal(picked.length, TOP_SITE_LIMIT);
  // Not just "eight of them" — Chrome's ranking is why this API exists, so the kept eight must be the first eight.
  assert.deepEqual(
    picked.map((site) => site.title),
    ["Site 0", "Site 1", "Site 2", "Site 3", "Site 4", "Site 5", "Site 6", "Site 7"],
  );
});

test("a shorter list is passed on as-is", () => {
  // The cap is an upper bound, not a quota: nothing here pads the row out to eight.
  const picked = selectTopSites([
    { url: "https://a.example/", title: "A" },
    { url: "https://b.example/", title: "B" },
    { url: "https://c.example/", title: "C" },
  ]);
  assert.equal(picked.length, 3);
});

test("an empty list stays empty", () => {
  // A fresh profile, incognito, or no `topSites` permission — the row's `v-if` keys off length, so `[]` (not a non-empty length) is the answer.
  assert.deepEqual(selectTopSites([]), []);
});
