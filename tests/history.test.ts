/**
 * Unit tests for the history timestamps.
 *
 * The two formatters disagree about the year on purpose, so both directions are
 * pinned: the row stamp drops it, the detail stamp keeps it. The last test is
 * the one that guards the shared decision — that neither follows the browser's
 * locale — and it needs a second process to do it, because Node fixes its
 * default locale at startup and ignores later writes to `process.env`.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { formatFullTimestamp, formatVisitStamp } from "../src/core/history.ts";

/** A fixed "now", so the today/older split does not drift with the calendar. */
const NOW = new Date(2026, 8, 25, 14, 5).getTime();
const TODAY = new Date(2026, 8, 25, 9, 7).getTime();
const OLDER = new Date(2026, 7, 29, 14, 5).getTime();

test("a visit from today shows a zero-padded 24-hour time", () => {
  assert.equal(formatVisitStamp(TODAY, NOW), "09:07");
  assert.equal(formatVisitStamp(new Date(2026, 8, 25, 0, 0).getTime(), NOW), "00:00");
});

test("anything older shows an English month and day, with no year", () => {
  assert.equal(formatVisitStamp(OLDER, NOW), "Aug 29");
});

test("a missing visit time is blank, not \"Invalid Date\"", () => {
  assert.equal(formatVisitStamp(undefined, NOW), "");
});

test("the detail timestamp keeps the year the row stamp drops", () => {
  assert.equal(formatFullTimestamp(OLDER), "Aug 29, 2026, 02:05 PM");
  assert.equal(formatFullTimestamp(undefined), "—");
});

test("both timestamps stay English under a non-English host locale", () => {
  // The locale is printed next to the output so this cannot pass vacuously —
  // if `LC_ALL` ever stopped taking effect, the prefix changes and says so.
  const script = [
    'import { formatVisitStamp, formatFullTimestamp } from "./src/core/history.ts";',
    "const locale = Intl.DateTimeFormat().resolvedOptions().locale;",
    "const older = new Date(2026, 7, 29, 14, 5).getTime();",
    "const at = new Date(2026, 8, 25, 14, 5).getTime();",
    "process.stdout.write(`${locale}|${formatVisitStamp(older, at)}|${formatFullTimestamp(older)}`);",
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

  assert.equal(stdout, "zh-CN|Aug 29|Aug 29, 2026, 02:05 PM");
});
