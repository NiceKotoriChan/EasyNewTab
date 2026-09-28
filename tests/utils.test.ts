// Tests core/utils helpers: `formatDate` must ignore the host locale (proved in a second process), and `openUrl` is checked by recording which `chrome.tabs` call it makes. (Not type-checked — only run.)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { formatDate, formatTime, openUrl } from "../src/core/utils.ts";

/** A fixed instant, so the assertions do not drift with the calendar. */
const SEPTEMBER_25_2026 = new Date(2026, 8, 25, 14, 5);

test("the date line is the English long form", () => {
  assert.equal(formatDate(SEPTEMBER_25_2026), "Friday, September 25");
});

test("the date line carries no year", () => {
  assert.doesNotMatch(formatDate(SEPTEMBER_25_2026), /\d{4}/);
});

test("the date line stays English under a non-English host locale", () => {
  // Locale is printed next to the output so the assertion can't pass vacuously — if `LC_ALL` stops working, the prefix changes and names which half broke.
  const script = [
    'import { formatDate } from "./src/core/utils.ts";',
    'const locale = Intl.DateTimeFormat().resolvedOptions().locale;',
    "process.stdout.write(`${locale}|${formatDate(new Date(2026, 8, 25, 14, 5))}`);",
  ].join("\n");

  const stdout = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, LC_ALL: "zh_CN.UTF-8", LANG: "zh_CN.UTF-8" },
      encoding: "utf8",
    },
  );

  assert.equal(stdout, "zh-CN|Friday, September 25");
});

test("the clock is 24-hour and zero-padded", () => {
  assert.equal(formatTime(SEPTEMBER_25_2026), "14:05");
  assert.equal(formatTime(new Date(2026, 8, 25, 9, 7)), "09:07");
  assert.equal(formatTime(new Date(2026, 8, 25, 0, 0)), "00:00");
});

// `openUrl`'s stub records both calls, so a test expecting a new tab can't pass on a same-page navigation that merely didn't throw.
const tabCalls: Array<[string, string]> = [];
(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    create: ({ url }: { url: string }) => tabCalls.push(["create", url]),
    update: ({ url }: { url: string }) => tabCalls.push(["update", url]),
  },
};

const SOME_URL = "https://example.com/";

test("a click that beats the preference to the page opens a new tab", () => {
  // The preference is `undefined` on the first clicks after a new tab opens; reading it as "off" would navigate the new tab away from itself — the one outcome it can't have.
  tabCalls.length = 0;
  openUrl(SOME_URL, undefined);
  assert.deepEqual(tabCalls, [["create", SOME_URL]]);
});

test("the preference on opens a new tab", () => {
  tabCalls.length = 0;
  openUrl(SOME_URL, true);
  assert.deepEqual(tabCalls, [["create", SOME_URL]]);
});

test("the preference off sends this tab instead", () => {
  tabCalls.length = 0;
  openUrl(SOME_URL, false);
  assert.deepEqual(tabCalls, [["update", SOME_URL]]);
});
