/**
 * Unit tests for the shared helpers in `core/utils.ts`.
 *
 * `formatDate` reads no ambient state, so almost every rule it follows is checkable
 * against a literal. The one that is not is the one that matters most — the locale it
 * must *ignore*. Node fixes its default locale at startup and ignores later writes to
 * `process.env`, so the only way to prove the function does not follow the host is to run
 * it in a second process with a different one.
 *
 * `openUrl` reaches for `chrome.tabs`, which Node does not have. The two calls are
 * recorded rather than made, so the assertion can name *which* one it picked instead of
 * only proving neither threw.
 *
 * Note that `tsconfig.json` does not include this directory, so these files are not
 * type-checked — only executed. A typo surfaces as a failing test, not a compiler error.
 */

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
  // The locale is printed next to the output on purpose. Asserting the two together
  // stops this from passing vacuously: if `LC_ALL` ever stopped taking effect, the prefix
  // would change and the failure would say which half broke, rather than quietly
  // comparing English against English.
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

/** `openUrl`'s stub. Both calls are recorded, so a test that expected a new tab cannot
 *  pass on a same-page navigation that happened to not throw. */
const tabCalls: Array<[string, string]> = [];
(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    create: ({ url }: { url: string }) => tabCalls.push(["create", url]),
    update: ({ url }: { url: string }) => tabCalls.push(["update", url]),
  },
};

const SOME_URL = "https://example.com/";

test("a click that beats the preference to the page opens a new tab", () => {
  // The preference is read from storage, so it is genuinely `undefined` for the first
  // click or two after a new tab opens. Reading that as "off" would send this page away
  // from itself, which is the one outcome the new tab page cannot have.
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
