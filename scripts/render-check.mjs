/**
 * Renders both entry points headlessly: stubs `chrome.*`, loads the real SFCs through Vite and
 * server-renders them. `onMounted` never runs (no DOM), so listeners and intervals are out of
 * scope.   node scripts/render-check.mjs
 */

import { createRequire } from "node:module";
import { readFile as readSource } from "node:fs/promises";
import { createSSRApp, ref } from "vue";
import { renderToString } from "@vue/server-renderer";
import { MARK_SIZES, markPixel, quadness } from "./app-mark.mjs";
import { markPng } from "./mark-png.mjs";
import {
  TOP_SITES,
  createSsrServer,
  installChromeStub,
  setFailWrites,
  setTopSites,
} from "./harness.mjs";
import { readPng } from "./png-probe.mjs";

/** MDI's own dataset: a glyph in the output is compared against its source, not eyeballed. */
const mdi = createRequire(import.meta.url)("@iconify-json/mdi/icons.json");

/** Every `d` MDI defines — a set lookup per glyph. */
const MDI_PATHS = new Set();
for (const glyph of Object.values(mdi.icons)) {
  for (const match of glyph.body.matchAll(/d="([^"]*)"/g)) MDI_PATHS.add(match[1]);
}

// Shared with `mobile-preview.mjs`: two copies of a fixture set are two sets that disagree.
installChromeStub();

const failures = [];

function expect(haystack, needle, label) {
  if (haystack.includes(needle)) {
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

function expectAbsent(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/** For assertions about state rather than markup. */
function expectEqual(actual, expected, label) {
  if (Object.is(actual, expected)) {
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(
      `  FAIL ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Every rendered glyph must be one MDI publishes — a spot check cannot tell "MDI is in the
 *  bundle" from "an `<svg>` of about the right size is". `engine-mark` brand marks are exempt. */
function assertGlyphsAreMdi(html, where) {
  const svgs = [
    ...html.matchAll(/<svg\b[^>]*class="icon[^"]*"[^>]*>[\s\S]*?<\/svg>/g),
  ].map((match) => match[0]);
  const foreign = [];
  for (const svg of svgs) {
    for (const match of svg.matchAll(/d="([^"]*)"/g)) {
      if (!MDI_PATHS.has(match[1])) foreign.push(match[1]);
    }
  }
  for (const d of foreign.slice(0, 3)) {
    console.log(`       stray: ${d.slice(0, 56)}…`);
  }
  expectEqual(foreign.length, 0, `${where}: every glyph is MDI's own path data`);

  // Guard the guard: a regex that silently matched nothing would satisfy the line above.
  const tags = (html.match(/class="icon[^"]*"/g) ?? []).length;
  expectEqual(svgs.length, tags, `${where}: the sweep covered every glyph`);
  expectEqual(tags > 0, true, `${where}: there were glyphs to check (${tags})`);
}

/** The `d` a named MDI glyph draws with — read from the dataset, so an upstream rename fails loudly. */
function mdiGlyph(name) {
  const glyph = mdi.icons[name];
  if (!glyph) throw new Error(`render-check: MDI has no glyph named ${name}`);
  return glyph.body.match(/d="([^"]*)"/)[1];
}

/** Which glyph a row wears. `is-folder`, not "the first `d`" — a folder's twisty chevron comes first. */
function rowGlyph(html, id) {
  const start = html.indexOf(`data-node-id="${id}"`);
  if (start === -1) return null;
  const label = html.indexOf('class="label"', start);
  if (label === -1) return null;
  const lead = html
    .slice(start, label)
    .match(/<svg\b[^>]*class="[^"]*is-folder[^"]*"[^>]*>[\s\S]*?<\/svg>/);
  return lead ? (lead[0].match(/d="([^"]*)"/)?.[1] ?? null) : null;
}

/** The text a shortcut entry renders. Slicing is not optional: the URL also sits percent-encoded
 *  in the favicon's query string, so the icon would answer "does this host appear" on its own. */
function siteLabel(html, url) {
  const marker = `data-site-url="${url}"`;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const next = html.indexOf("data-site-url=", start + marker.length);
  const entry = html.slice(start, next === -1 ? undefined : next);
  return entry.match(/class="label"[^>]*>([^<]*)</)?.[1] ?? null;
}

/** The size the engine pills draw brand marks at: a `data-v-…` lands between the class and the `width`. */
function engineMarkWidth(html) {
  const match = html.match(/<svg class="engine-mark"[^>]*width="(\d+)"/);
  return match ? Number(match[1]) : null;
}

/** Which docking side settings renders as current — the two buttons differ only in their label. */
function activeDockSide(html) {
  const match = html.match(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/);
  if (!match) return null;
  return match[1].includes("Right") ? "right" : "left";
}

/** The welcome pane's date line — computed from the clock, so any literal goes stale. */
function dateLine(html) {
  const match = html.match(/class="date"[^>]*>([^<]*)</);
  return match ? match[1] : null;
}

/** The keys of the rendered shortcut rows, in order. `[^>]*` after `<kbd` because scoped CSS adds
 *  a `data-v-…`, and a literal `<kbd>/</kbd>` matches nothing — a silent miss reads as a bug. */
function shortcutKeysInHtml(html) {
  return [...html.matchAll(/<kbd\b[^>]*>([^<]*)<\/kbd>/g)].map((m) => m[1]);
}

/** Settings rows and how many render a control — a name with no control reads as a lost switch. */
function settingsRows(html) {
  const rows = (html.match(/class="row"/g) ?? []).length;
  const controls = (html.match(/class="row-control"/g) ?? []).length;
  const labels = (html.match(/class="row-label"/g) ?? []).length;
  return { rows, controls, labels };
}

/** How many list entries a panel drew — the whole answer to "did the cap reach the query". Exact
 *  on purpose: a settings row's class is `row-text`, which a substring match would count in. */
function entryRows(html) {
  return (html.match(/class="row"/g) ?? []).length;
}

/** One section's rows, sliced from its title to the next header — the only way to say "this row
 *  is in General and not in Layout". `null` when missing, so it fails loudly rather than at zero. */
function sectionRows(html, title) {
  const start = html.indexOf(`>${title}<`);
  if (start === -1) return null;
  const next = html.indexOf('class="panel-head"', start);
  const body = html.slice(start, next === -1 ? undefined : next);
  return { rows: (body.match(/class="row"/g) ?? []).length };
}

const server = await createSsrServer();

try {
  // Every load starts with a `storage.sync.get` in flight; anything landing inside that window is
  // newer, so a read resolving last must not put the old value back — the "I changed the setting
  // and it reverted" bug. Must run first: it needs the module before anything bootstraps it.
  console.log("first read vs. a change that beats it");
  const { DEFAULT_SETTINGS } = await server.ssrLoadModule("/src/core/settings.ts");

  const realSyncGet = chrome.storage.sync.get;
  let releaseRead;
  chrome.storage.sync.get = () =>
    new Promise((resolve) => {
      releaseRead = resolve;
    });

  const { useSettings } = await server.ssrLoadModule(
    "/src/composables/useSettings.ts",
  );
  const store = useSettings();
  expectEqual(typeof releaseRead, "function", "the first read starts in flight");

  chrome.storage.onChanged.fire(
    { settings: { newValue: { ...DEFAULT_SETTINGS, sidebarPosition: "right" } } },
    "sync",
  );
  expectEqual(store.settings.value.sidebarPosition, "right", "a change from another tab lands while that read is still open");

  releaseRead({ settings: { ...DEFAULT_SETTINGS, sidebarPosition: "left" } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expectEqual(store.settings.value.sidebarPosition, "right", "and the late read cannot roll it back");

  chrome.storage.sync.get = realSyncGet;
  // Leave the store on the shipping defaults so every later pass sees them.
  chrome.storage.onChanged.fire(
    { settings: { newValue: { ...DEFAULT_SETTINGS } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  console.log("newtab entry");
  const { default: App } = await server.ssrLoadModule("/src/newtab/App.vue");
  const firstPass = await renderToString(createSSRApp(App));
  expect(firstPass, "Bookmarks", "sidebar shows the bookmarks panel");
  expect(firstPass, 'role="tablist"', "panel switch renders as a segmented control");
  expect(firstPass, "History", "both panels are offered by the switch");
  expect(firstPass, 'aria-label="Resize sidebar"', "the divider is the sidebar's only affordance");
  expectAbsent(firstPass, "is-right", "the sidebar docks left until the setting says otherwise");
  expect(firstPass, 'class="sidebar"', "the sidebar renders (and stays mounted, see below)");
  expectAbsent(firstPass, 'aria-label="Hide sidebar"', "and carries no collapse button either");
  expect(firstPass, "search-field", "the main area is the search box — a sidebar click cannot take it away");
  expect(firstPass, "DuckDuckGo", "hero search box lists the other engines");
  expect(firstPass, 'aria-label="Search engine"', "engine row is a labelled group");
  // The brand mark's size is the one part of the engine row that is markup rather than CSS — 18px
  // is what the original build drew; the 15px the segmented track used would still look plausible.
  expectEqual((firstPass.match(/class="engine-mark"/g) ?? []).length, 6, "the engine row is six pills, one engine each");
  expectEqual(engineMarkWidth(firstPass), 18, "and each pill carries the original build's 18px brand mark");

  console.log("icon set");
  // Icons are Iconify's MDI, resolved at build time from the offline `@iconify-json/mdi`. A
  // glyph's *own path data* is the only way to tell MDI being in the bundle from some <svg> of
  // about the right size being in it. The literal is MDI's `magnify`, the search field's prefix.
  expect(firstPass, 'd="M9.5 3A6.5 6.5 0 0 1 16 9.5', "the search glyph is MDI's own path data, not a hand-drawn one");
  // MDI glyphs are filled paths, so a 1.6px stroke is the signature of a hand-drawn one.
  expectAbsent(firstPass, 'stroke-width="1.6"', "and nothing is still drawn as a 1.6px stroke");

  // Path data alone cannot settle it glyph by glyph, so the invariant is the sweep: require
  // every rendered `class="icon"` svg to carry path data MDI publishes. That is what catches a
  // hand-drawn glyph creeping back one at a time.
  assertGlyphsAreMdi(firstPass, "new tab");
  // And the icon layer must hold no drawing of its own.
  for (const file of ["Icon.vue", "mdi-icons.ts"]) {
    const source = await readSource(
      new URL(`../src/components/ui/${file}`, import.meta.url),
      "utf8",
    );
    expectAbsent(source, 'd="', `${file} carries no hand-drawn path data`);
  }

  console.log("app icon");
  // The extension's own mark: `app-mark.mjs` describes it, `npm run icons` draws it into
  // `public/icons/`, and the manifest offers those files. Two questions, two checks.
  //
  // *Still this geometry?* Rendered again and compared byte for byte. Nothing weaker works —
  // probing a shipped PNG cannot tell the current numbers from last month's whose quads cover the
  // same pixels, which is exactly the drift a retune without a rerun produces.
  //
  // *Does it hold up as a mark?* Not redundant: a renderer that filled the box with accent would
  // match itself and fail every sample. The points come from the geometry, so they follow a retune.
  const manifest = JSON.parse(
    await readSource(new URL("../public/manifest.json", import.meta.url), "utf8"),
  );
  expectEqual(
    JSON.stringify(manifest.icons),
    JSON.stringify({ "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }),
    "the manifest offers the three sizes this file draws, and no other",
  );
  for (const { size, quads } of MARK_SIZES) {
    const shipped = await readSource(new URL(`../public/icons/icon${size}.png`, import.meta.url));
    expectEqual(shipped.equals(markPng(size, quads)), true, `icon${size} is the mark the geometry describes — rerun npm run icons if it is not`);
    const png = readPng(shipped);
    expectEqual(png.width === size && png.height === size, true, `icon${size} is ${size} square`);
    expectEqual(png.at(0, 0)[3], 0, `icon${size}: the rounded corner is transparent, not a white notch`);
    const first = quads[0];
    const centre = png.at(
      markPixel(first.x + first.size / 2, size),
      markPixel(first.y + first.size / 2, size),
    );
    expectEqual(centre[3] === 255 && quadness(centre) > 0.85, true, `icon${size}: a quad centre carries the quad colour`);
    const cross = png.at(size >> 1, size >> 1);
    expectEqual(cross[3] === 255 && quadness(cross) < 0.35, true, `icon${size}: and the cross between the quads is still the tile — four tiles, not one block`);
    const edge = png.at(size >> 1, 0);
    expectEqual(edge[3] === 255 && quadness(edge) < 0.1, true, `icon${size}: the tile reaches the top edge, and it is the tile colour there`);
  }

  // The stores hydrate asynchronously on first use; let those microtasks land and render again.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const secondPass = await renderToString(createSSRApp(App));
  // Swept again with the tree populated: this is the pass where the row glyphs exist, and a
  // sweep that only ever saw three icons would be a thin thing to call coverage.
  assertGlyphsAreMdi(secondPass, "new tab, tree loaded");
  expect(secondPass, "Bookmarks bar", "bookmark tree renders a top-level folder");
  expect(secondPass, "GitHub", "bookmark tree renders a leaf bookmark");
  expect(secondPass, "Dev", "bookmark tree renders a nested folder");
  expect(secondPass, "Other bookmarks", "the Other bookmarks folder shows by default");
  expect(secondPass, 'data-kind="folder"', "folder rows are tagged for drop maths");
  expect(secondPass, 'data-kind="bookmark"', "bookmark rows are tagged");
  // A folder carries its state in the glyph — solid when shut, hollow when open — which is why the
  // icon layer keeps two entries. Both halves are in this pass (`1` opens, `f1` stays shut). Guard
  // the guard: if both keys resolved to the same drawing, the pair below would pass while being one.
  expectEqual(mdiGlyph("folder") === mdiGlyph("folder-outline"), false, "the shut and open glyphs are genuinely two different drawings");
  expectEqual(rowGlyph(secondPass, "1"), mdiGlyph("folder-outline"), "an open folder row wears MDI's folder-outline");
  expectEqual(rowGlyph(secondPass, "f1"), mdiGlyph("folder"), "a shut folder row wears MDI's solid folder");
  // `2` ("Other bookmarks") is empty but the first-load sweep puts it in `expandedIds` anyway — the
  // case separating a glyph keyed on `expanded` from one keyed on "expanded *and* non-empty".
  expectEqual(rowGlyph(secondPass, "2"), mdiGlyph("folder"), "an empty folder reads as shut even though the sweep opened it");
  // A bookmark's delete is a button on the row, not a menu entry. Folder rows deliberately have
  // none — a branch should not be one stray click away — so the folder menu's Delete confirms.
  expect(secondPass, 'aria-label="Delete bookmark"', "a bookmark row carries its own delete button");

  // The tint has exactly one home — a hex literal at a call site is how two definitions drifted
  // apart the first time. CSS is invisible to SSR, so the source is what has to be read.
  const tokensCss = await readSource(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  expectEqual((tokensCss.match(/--icon-folder:/g) ?? []).length, 1, "the folder tint is defined once, as a token");
  expect(tokensCss, "--icon-folder: var(--accent)", "and it aliases the app's accent rather than inventing a second blue");
  const nodeSource = await readSource(
    new URL("../src/components/bookmarks/BookmarkNode.vue", import.meta.url),
    "utf8",
  );
  expect(nodeSource, "var(--icon-folder)", "BookmarkNode.vue takes the folder tint from the token");
  expectAbsent(nodeSource, "color: #", "BookmarkNode.vue hard-codes no colour of its own");
  // A leftover `draggable="true"` would put the browser's drag back in charge of a row the adapter owns.
  expectAbsent(secondPass, 'draggable="true"', "rows are not native drag sources — the adapter owns the gesture");
  // The adapter reads `data-node-id` to tell a drop in the blank space from a drop between rows.
  expect(secondPass, 'data-node-id="b1"', "rows advertise their id, which the empty-area drop rule queries on");
  // Only top-level folders open on first load, so a depth-2 row must not be in the DOM yet.
  expectAbsent(secondPass, 'data-node-id="b2"', "nested folders stay collapsed until expanded");

  // This row only exists in this pass — the read is in flight during the first. The stub hands back
  // ten entries and the row draws the first eight of them, in the order they arrived.
  expect(secondPass, 'aria-label="Most visited sites"', "the welcome pane offers the most-visited row");
  expectEqual(siteLabel(secondPass, "https://news.ycombinator.com/"), "Hacker News", "an entry is labelled with the title Chrome gave it");
  // The fallback matters: Chrome hands back blank titles for pages that never declared one, and
  // an entry without a label is an icon in a void.
  expectEqual(siteLabel(secondPass, "https://mail.google.com/mail/u/0/"), "mail.google.com", "and a blank title falls back to the host");
  // Ten in, eight out, tile for tile in the stub's order — so the fixture's second entry, a second
  // page of the first entry's host, is the row's second tile.
  expect(secondPass, "Explore GitHub", "the row follows the stub's order, entry for entry");
  expectEqual((secondPass.match(/data-site-url=/g) ?? []).length, 8, "the row is capped at eight entries");
  expectAbsent(secondPass, "Rust", "and the cap drops from the bottom of Chrome's order, not at random");
  expectAbsent(secondPass, "bilibili", "both of the ones the cap cut, so the cut is a cut and not a scramble");

  // Flip `showOtherBookmarks` the way the options page would (a change in the "sync" area).
  console.log("settings propagation");
  chrome.storage.onChanged.fire(
    { settings: { newValue: { showOtherBookmarks: false } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const thirdPass = await renderToString(createSSRApp(App));
  expectAbsent(thirdPass, 'data-node-id="2"', "turning the setting off hides the Other bookmarks row");
  expectAbsent(thirdPass, "Other bookmarks", "and the folder title is gone with it");
  expect(thirdPass, "Bookmarks bar", "while the rest of the tree is untouched (no reload needed)");

  console.log("collapsed sidebar");
  // The divider collapses the sidebar, so it must survive that change — an unmounting handle would drop the drag.
  const { useSidebar } = await server.ssrLoadModule("/src/composables/useSidebar.ts");
  const { collapsed } = useSidebar();
  collapsed.value = true;
  const collapsedPass = await renderToString(createSSRApp(App));
  expect(collapsedPass, 'aria-label="Show sidebar"', "collapsed: the divider is still rendered, so dragging can reopen it");
  expect(collapsedPass, "display:none", "collapsed: the sidebar is hidden by style, not unmounted");
  expect(collapsedPass, 'role="tablist"', "collapsed: its contents stay in the DOM, so scroll state survives");
  expectAbsent(collapsedPass, 'class="rail"', "collapsed: no toolbar takes its place");
  collapsed.value = false;

  console.log("sidebar docking");
  // With no button anywhere, the collapsed hint is the only thing telling you which way to drag.
  chrome.storage.onChanged.fire(
    {
      settings: {
        newValue: { showOtherBookmarks: false, sidebarPosition: "right" },
      },
    },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  const dockedRight = await renderToString(createSSRApp(App));
  expect(dockedRight, "is-right", "docking right mirrors the shell");
  expect(dockedRight, "drag right to hide", "expanded: the divider's hint follows the docking side");
  expect(dockedRight, "Bookmarks bar", "the panels themselves are untouched by the move");

  collapsed.value = true;
  const dockedRightCollapsed = await renderToString(createSSRApp(App));
  expect(dockedRightCollapsed, "Drag left to show the sidebar", "collapsed: the only affordance points at the mirrored edge");
  collapsed.value = false;

  // Back to the default, so every later pass tests the shipping configuration.
  chrome.storage.onChanged.fire(
    {
      settings: {
        newValue: { showOtherBookmarks: false, sidebarPosition: "left" },
      },
    },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dockedLeft = await renderToString(createSSRApp(App));
  expectAbsent(dockedLeft, "is-right", "and setting it back un-mirrors the shell");

  console.log("stacked shell");
  // No viewport here, so the two `matchMedia` answers are driven directly — what is pinned is what
  // the shell does once the answer is "narrow". (`usePlatform` reads the queries once, and both are
  // `false` under SSR, which is why every pass above is the desktop shell.)
  const { usePlatform } = await server.ssrLoadModule(
    "/src/composables/usePlatform.ts",
  );
  const { isCompact, isTouch } = usePlatform();

  isCompact.value = true;
  const stacked = await renderToString(createSSRApp(App));
  expect(stacked, "is-stacked", "narrow: the two panes become a column");
  // Not merely hidden — the shell stops rendering the divider, since there is no column to drag across.
  expectAbsent(stacked, 'class="sash"', "narrow: the divider is gone, not hidden");
  expectAbsent(stacked, 'aria-label="Resize sidebar"', "narrow: nothing offers to resize a column that is no longer there");
  expect(stacked, 'class="sidebar"', "narrow: the sidebar is still the sidebar, just the lower of the two panes");
  expectAbsent(stacked, "is-right", "narrow: docking left and right is meaningless while stacked, and says nothing");
  // Both halves go: clock and most-visited row are ambient; the pane is the search box and engines.
  expectAbsent(stacked, 'class="date"', "narrow: the search pane drops the clock");
  expectAbsent(stacked, 'aria-label="Most visited sites"', "narrow: and the most-visited row with it");
  expect(stacked, "search-field", "narrow: what is left in the pane is the search box");
  expect(stacked, "is-large", "narrow: still the hero variant");
  expect(stacked, "DuckDuckGo", "narrow: and the engine row under it");
  // Visual order is CSS and SSR cannot show it — the DOM order is unchanged and the shell reverses the column.
  const shellSource = await readSource("src/newtab/App.vue", "utf8");
  expect(shellSource, "flex-direction: column-reverse", "narrow: the column is reversed, so the search pane lands on top with the DOM order untouched");

  // Nothing in a stacked shell can set `collapsed`, so a leftover `true` must not hide the lower pane.
  collapsed.value = true;
  const stackedCollapsed = await renderToString(createSSRApp(App));
  expectAbsent(stackedCollapsed, "display:none", "narrow: a sidebar the desktop had collapsed is shown again");
  collapsed.value = false;
  isCompact.value = false;

  const wideAgain = await renderToString(createSSRApp(App));
  expectAbsent(wideAgain, "is-stacked", "and widening the window puts the row back");
  expect(wideAgain, 'aria-label="Resize sidebar"', "divider and all");

  console.log("click contract");
  // A left click opens a bookmark or folds a folder. Folding is the only one that changes what the
  // panel shows, so that is what this pass drives — `toggleExpanded` is what a row click calls.
  const { useBookmarks } = await server.ssrLoadModule("/src/composables/useBookmarks.ts");
  useBookmarks().toggleExpanded("f1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const foldPass = await renderToString(createSSRApp(App));
  expect(foldPass, 'data-node-id="b2"', "folding a folder reveals the rows inside it");
  // Same row, opposite glyph: the swap is keyed on the row's state, not on which row it is.
  expectEqual(rowGlyph(foldPass, "f1"), mdiGlyph("folder-outline"), "opening that same folder swaps it to the hollow glyph");
  expect(foldPass, 'data-action="toggle"', "a folder row declares that a click folds it");
  expect(foldPass, 'data-action="open"', "a bookmark row declares that a click opens it — no double click needed");
  expect(foldPass, "search-field", "after a click the main area is still the search box");

  console.log("no bookmark filter bar");
  // Each half of the removed filter box needs its own check: the box could come back as markup
  // nothing opens, and the binding could outlive it and focus nothing. There is no DOM here to
  // press a key in, so the keymap is asked the question the shell's own listener asks.
  expectAbsent(
    firstPass,
    'aria-label="Search bookmarks"',
    "the bookmarks panel has no filter bar, permanent or on demand",
  );
  const { resolveShortcut } = await server.ssrLoadModule("/src/core/keymap.ts");
  expectEqual(
    resolveShortcut({ key: "p", typing: false }),
    null,
    "and `p` is not a shortcut any more",
  );
  const bookmarkStore = useBookmarks();
  expectEqual(
    ["searchOpen", "searchQuery", "searchActive", "openSearch", "closeSearch"]
      .filter((name) => name in bookmarkStore)
      .join(","),
    "",
    "nor is the state behind it still in the store",
  );

  console.log("row drag states");
  // A drag needs a real pointer, so the two states a row can be dragged into are invisible from the
  // shell; rendering the row alone against a stubbed tree is their only witness. They answer
  // "which one am I about to get?": the fill means *into* the folder, the line means next to it.
  const { default: BookmarkRow } = await server.ssrLoadModule(
    "/src/components/bookmarks/BookmarkNode.vue",
  );
  const { BOOKMARK_TREE } = await server.ssrLoadModule(
    "/src/composables/bookmarkTree.ts",
  );

  async function renderRow(overrides = {}) {
    const app = createSSRApp(BookmarkRow, {
      node: {
        id: "b1",
        parentId: "1",
        title: "GitHub",
        url: "https://github.com",
      },
      depth: 0,
    });
    app.provide(BOOKMARK_TREE, {
      isExpanded: () => false,
      toggleExpanded: () => {},
      dropTarget: ref(null),
      blockedIds: ref(new Set()),
      activate: () => {},
      nodeContextMenu: () => {},
      deleteNode: () => {},
      registerRow: () => () => {},
      hoverRow: () => {},
      leaveRow: () => {},
      ...overrides,
    });
    return renderToString(app);
  }

  const idleRow = await renderRow();
  expectAbsent(idleRow, "is-blocked", "a row outside the dragged subtree is not marked as refusing the drop");
  expectAbsent(idleRow, "is-drop-inside", "and nothing is highlighted while no drag is running");

  const blockedRow = await renderRow({ blockedIds: ref(new Set(["b1"])) });
  expect(blockedRow, "is-blocked", "a row inside the dragged subtree renders as refusing the drop");

  const insideRow = await renderRow({
    dropTarget: ref({ id: "b1", position: "inside", rect: {} }),
  });
  expect(insideRow, "is-drop-inside", "hovering the middle third of a folder fills the whole row");

  const beforeRow = await renderRow({
    dropTarget: ref({ id: "b1", position: "before", rect: {} }),
  });
  expectAbsent(beforeRow, "is-drop-inside", "a drop between rows uses the line instead — the two outcomes stay distinct");

  console.log("no detail view");
  // Pinned here rather than left to the type checker, because the failure is silent: a stray
  // import would mount a pane nothing in the app can ask for, and every pass above would still
  // be green. Their only way in was a menu entry, and the two menus that carried it are gone too.
  for (const gone of [
    "src/components/bookmarks/BookmarkDetail.vue",
    "src/components/history/HistoryDetail.vue",
    "src/composables/useSelection.ts",
  ]) {
    const exists = await readSource(
      new URL(`../${gone}`, import.meta.url),
      "utf8",
    ).then(
      () => true,
      () => false,
    );
    expectEqual(exists, false, `${gone} stays deleted`);
  }
  // And the shell has nothing to swap the search pane out with — no detail branch to take.
  expectAbsent(
    await readSource("src/newtab/App.vue", "utf8"),
    "Detail.vue",
    "the shell imports no detail view",
  );

  console.log("history panel");
  const { default: HistoryList } = await server.ssrLoadModule(
    "/src/components/history/HistoryList.vue",
  );
  const { useHistory } = await server.ssrLoadModule(
    "/src/composables/useHistory.ts",
  );
  // The panel instantiates the store itself, but that first fetch is still in flight here;
  // reloading explicitly makes the markup below the answer to the query rather than to a race.
  const historyStore = useHistory();
  await historyStore.reload();
  const historyHtml = await renderToString(createSSRApp(HistoryList));
  // One flat run, newest first, in the order the API answered. Day headings would be a `<div>` of
  // text — the same shape as the rows — so their absence is pinned explicitly.
  expectAbsent(historyHtml, 'class="group"', "no day heading sits above the rows — the list is flat");
  for (const heading of ["Today", "Yesterday", "Earlier"]) {
    expectAbsent(historyHtml, heading, `and nothing says "${heading}"`);
  }
  expect(historyHtml, "Example", "history list renders an entry");
  // The row opens the entry and that is the whole of it. How much of the profile it lists is the
  // settings page's business, not a control here.
  expectAbsent(historyHtml, 'aria-label="Remove from history"', "a history row carries no delete button");
  expectAbsent(historyHtml, 'role="menu"', "and no menu is rendered with it");
  expectEqual("remove" in historyStore, false, "the store offers no way to remove an entry");
  expectEqual("groups" in historyStore, false, "and hands the rows over ungrouped — no day buckets to render");
  // The order that reaches the screen is the API's, not one recomputed here: the fixture is
  // newest-first, so its first entry has to be the first row drawn.
  expectEqual(
    historyHtml.indexOf(">Example 1<") < historyHtml.indexOf(">Example 2<"),
    true,
    "the newest entry is the first row — nothing re-sorts the list",
  );

  console.log("history cap");
  // The stub answers with more entries than any cap asks for (see `HISTORY_ITEMS`), so the row count
  // is the assertion: a list ignoring `maxResults` could not land on the setting's number.
  expectEqual(
    entryRows(historyHtml),
    DEFAULT_SETTINGS.historyLimit,
    "the list holds exactly the default cap of entries",
  );

  // Driven the way the options page does it: a write in the "sync" area. Both directions, because
  // a cap only ever checked upwards would still pass if the query were pinned at startup.
  for (const cap of [50, 200]) {
    chrome.storage.onChanged.fire(
      { settings: { newValue: { ...DEFAULT_SETTINGS, historyLimit: cap } } },
      "sync",
    );
    // The store debounces — a history write arrives in bursts — so the change lands a beat later.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const capped = await renderToString(createSSRApp(HistoryList));
    expectEqual(
      entryRows(capped),
      cap,
      `a cap of ${cap} set on the settings page reaches an already-open panel`,
    );
  }

  // Back to the shipping defaults — the settings page below renders these values.
  chrome.storage.onChanged.fire(
    { settings: { newValue: { ...DEFAULT_SETTINGS } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 400));

  console.log("welcome pane");
  const { default: WelcomePane } = await server.ssrLoadModule(
    "/src/components/welcome/WelcomePane.vue",
  );
  await renderToString(createSSRApp(WelcomePane));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const welcomeHtml = await renderToString(createSSRApp(WelcomePane));
  // The one assertion here that cannot be a literal: the string moves with the calendar. The shape
  // pins the English long weekday form — no translations, so the browser locale must not reach this
  // line — and the second pins the omitted year. They fail for different reasons, hence two.
  const line = dateLine(welcomeHtml);
  expectEqual(/^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}$/.test(line ?? ""), true, "the date line is the English long form, whatever the browser's locale is");
  expectEqual(/\d{4}/.test(line ?? ""), false, "and carries no year — it is read dozens of times a day");
  expect(welcomeHtml, "search-field", "welcome pane hosts the hero search box");
  expect(welcomeHtml, "is-large", "hero search box uses the large variant");
  expect(welcomeHtml, "GitHub", "hero search box carries the engine row");
  // The row has to stay inside its budget: it hangs off the bottom of the search block.
  expect(welcomeHtml, 'aria-label="Most visited sites"', "the shortcut row hangs off the bottom of the search block");
  // The shape is Chromium's and takes two elements: the favicon centred on a filled circle, at
  // 24px. Either half alone would look plausible, so both are pinned.
  expect(welcomeHtml, 'class="site-icon"', "each shortcut draws its favicon on Chromium's filled icon circle");
  expect(welcomeHtml, "size=24", "and asks the favicon cache for the 24px icon that circle is sized around");

  console.log("most visited row, with nothing to show");
  // No history yet, an incognito window, or a build without the `topSites` permission all answer
  // empty. The wrong outcome would be a box saying so — this row is a shortcut, not a feature.
  const { useTopSites } = await server.ssrLoadModule(
    "/src/composables/useTopSites.ts",
  );
  setTopSites([]);
  await useTopSites().reload();
  const noSites = await renderToString(createSSRApp(WelcomePane));
  expectAbsent(noSites, 'aria-label="Most visited sites"', "no list, no row");
  expectAbsent(noSites, 'class="site"', "and no empty grid left in its place");
  expect(noSites, "search-field", "while the block around it is untouched");

  setTopSites(TOP_SITES);
  await useTopSites().reload();
  expect(await renderToString(createSSRApp(WelcomePane)), 'aria-label="Most visited sites"', "and the row comes back when the list does");

  console.log("options entry");
  const { default: OptionsApp } = await server.ssrLoadModule(
    "/src/options/OptionsApp.vue",
  );
  const optionsHtml = await renderToString(createSSRApp(OptionsApp));
  // The settings page draws the other half of the icon set (docking glyphs), so it gets swept too.
  assertGlyphsAreMdi(optionsHtml, "options");
  // `class="head"` is exact, so the panel heads below are not what this matches.
  expectAbsent(optionsHtml, 'class="head"', "the settings page has no title bar — it opens on the first section");
  expectAbsent(optionsHtml, 'class="brand-mark"', "and no app mark sits above the controls");
  expect(optionsHtml, "Open bookmarks in a new tab", "general panel renders");
  expect(optionsHtml, ">General<", "the General section is on the page itself");
  expect(optionsHtml, ">Shortcuts<", "and so is the Shortcuts section — the page no longer pages");
  expect(optionsHtml, "Focus the search bar", "a shortcut row renders its description, not just its key");
  expect(optionsHtml, "Show other bookmarks", "the Other bookmarks visibility toggle is offered");
  expect(optionsHtml, "History entries", "the history cap is a setting, not prose");
  // A stepper, not a slider and not a typed field: fixed nudges plus the value read back, so there
  // is no half-typed number to reconcile with storage. Pinning the *absence* is the point here.
  expect(optionsHtml, 'class="stepper"', "the history cap is a stepper");
  expectAbsent(optionsHtml, 'type="number"', "with no text field inside it — the buttons are the whole control");
  expect(optionsHtml, `>${DEFAULT_SETTINGS.historyLimit}</output>`, "and the cap between them is the stored value");
  expectEqual(
    optionsHtml.indexOf('aria-label="More history entries"') <
      optionsHtml.indexOf('aria-label="Fewer history entries"'),
    true,
    "the increase sits on the left — this row is not the usual `[− value +]`",
  );
  expect(optionsHtml, 'aria-label="Fewer history entries"', "with a button for each direction");
  expect(optionsHtml, 'aria-label="More history entries"', "and the ends of the range");
  // Both were static `row`s with no control — prose where a setting belongs. A row that cannot be
  // changed reads as a setting.
  expectAbsent(optionsHtml, "Extension options", "the settings page no longer explains itself instead of holding settings");
  expectAbsent(optionsHtml, "no item cap to configure", "and no prose about a cap in the control's place either");
  const rows = settingsRows(optionsHtml);
  expectEqual(rows.rows > 0 && rows.controls === rows.rows, true, "every settings row carries a control — no panel has prose-only rows");
  expectEqual(rows.labels === rows.rows, true, "and each row is exactly one name — nothing has grown a second line");
  // Asserted as classes rather than by quoting the sentences, so a reworded paragraph is not what
  // trips this — adding one back is.
  expectAbsent(optionsHtml, 'class="row-hint"', "no settings row carries an explanatory paragraph");
  expectAbsent(optionsHtml, 'class="panel-hint"', "and neither section opens with one");
  expect(optionsHtml, 'aria-label="Sidebar position"', "the docking side is a setting, not just prose");
  expect(optionsHtml, 'aria-pressed="true"', "and one of the two sides is marked as current");
  expectAbsent(optionsHtml, "Default engine", "the engine picker is gone from settings — the engine row on the new tab page owns it");
  expectAbsent(optionsHtml, "Bing", "and the grid of engines went with that section");

  // Counted per section: a document-wide count would not notice a row moving between them.
  expect(optionsHtml, ">Layout<", "the docking side is a section, not a third row under General");
  expectEqual(sectionRows(optionsHtml, "General")?.rows, 3, "General is the two behaviour toggles and the history cap, and nothing else");
  expectEqual(sectionRows(optionsHtml, "Layout")?.rows, 1, "and Layout is the docking side alone");

  // The rows render into the page above, but the table is still the source: a table of shortcuts
  // is prose *about* behaviour, and prose is what goes stale.
  const { SHORTCUTS } = await server.ssrLoadModule("/src/options/shortcuts.ts");
  const shortcutKeys = SHORTCUTS.map((s) => s.keys);
  const shortcutCopy = SHORTCUTS.map((s) => s.label).join(" | ");
  expect(shortcutCopy, "Focus the search bar", "the shortcuts panel documents `/`");
  // The list is what the shell answers to, so a row for a dead key is the lie the loop below catches.
  expectAbsent(shortcutCopy, "Search bookmarks", "the filter box's `p` row is gone with the box");
  expectAbsent(shortcutCopy, "Quick open", "Quick open is gone from the list — the palette it described is gone");
  expectAbsent(shortcutCopy, "palette", "and nothing in the list still explains itself in terms of one");
  expectEqual(shortcutKeys.join(","), "/,s,b,h", "the list is those keys and no others");
  expectAbsent(shortcutKeys.join(","), "Esc", "and no row documents Escape — no binding is left for it to name");
  expectAbsent(shortcutKeys.join(","), "Ctrl", "and no row needs a modifier — `Ctrl+1`/`Ctrl+2` are the browser's tab keys");

  // The rows are on the page now, so the table is checked against what was drawn and not only
  // against itself: that is what makes a stale key, or a seventh row added without a binding,
  // a failure rather than a mismatch nobody looks for.
  expectEqual(shortcutKeysInHtml(optionsHtml).join(","), shortcutKeys.join(","), "every declared row is rendered, in the order the list declares it");

  // ...and the copy is tied to the keymap, because the two halves live in different directories.
  function bindingFor(keys) {
    // Every row is a single character, and that is also the guard: a row written as a phrase
    // would come back null and fail below rather than being quietly skipped.
    return [...keys].length === 1 ? { key: keys, typing: false } : null;
  }
  for (const row of SHORTCUTS) {
    const input = bindingFor(row.keys);
    // Every row is a keystroke now, so none may be skipped — an unmappable row must fail, not be ignored.
    expectEqual(input !== null, true, `the panel's “${row.keys}” row is written as something a person can press`);
    if (!input) continue;
    expectEqual(resolveShortcut(input) !== null, true, `the panel's “${row.keys}” row is a key the shell answers to`);
  }

  // This has to be a source-level check: the field unwinds its own Escape, so both halves live
  // inside components and are invisible in SSR output. What can still be checked is the regression
  // that mattered — the emitted `escape` once had no listener, leaving every bare-key shortcut
  // unreachable on a page whose search box autofocuses.
  const paneSource = await readSource("src/components/welcome/WelcomePane.vue", "utf8");
  const fieldSource = await readSource("src/components/SearchField.vue", "utf8");
  expect(paneSource, '@escape="leaveField"', "the welcome pane listens for the search field's Escape");
  expect(paneSource, "field.value?.blur()", "and what it does with it is hand the keyboard back");
  expect(fieldSource, "emit(\"escape\")", "which the field only emits when it has nothing left to clear");

  // The settings page is a reader as well as a writer: if it did not follow a change made
  // elsewhere, two open tabs would disagree about what is set.
  expectEqual(activeDockSide(optionsHtml), "left", "settings renders the docking side it was loaded with");

  chrome.storage.onChanged.fire(
    { settings: { newValue: { ...DEFAULT_SETTINGS, sidebarPosition: "right" } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expectEqual(activeDockSide(await renderToString(createSSRApp(OptionsApp))), "right", "and follows that change when it is made from another tab");

  console.log("touch");
  // `isCompact` and `isTouch` answer different questions — how much room there is, and what the
  // input can do — and the case where they come apart is the one worth pinning. Set one at a time
  // with the other off: a device that is both would pass either way and prove nothing.
  isTouch.value = true;
  const touchOptions = await renderToString(createSSRApp(OptionsApp));
  expectAbsent(touchOptions, ">Shortcuts<", "touch: the shortcut list is not offered — there is no keyboard to press the keys on");
  expectAbsent(touchOptions, "<kbd", "touch: and no keycap is left behind in its place");
  expect(touchOptions, 'aria-label="Sidebar position"', "touch: the docking side is still a setting — it is about the layout, not the input");
  expect(touchOptions, ">Layout<", "touch: and still a section of its own");
  expect(touchOptions, "Open bookmarks in a new tab", "touch: the behaviour toggles are untouched");
  expect(touchOptions, "Show other bookmarks", "touch: both of them");

  isCompact.value = true;
  isTouch.value = false;
  const compactOptions = await renderToString(createSSRApp(OptionsApp));
  expect(
    compactOptions,
    ">Shortcuts<",
    "narrow but not touch: the list stays — a narrow window still has a keyboard",
  );
  // The docking side goes the other way: stacked, the shell has no column to dock into, so this
  // section would be a control that changes nothing on this window. It is the axis that decides
  // it, not the input — a wide touchscreen still gets it, a narrow desktop window does not.
  expectAbsent(compactOptions, ">Layout<", "narrow: the docking side is not offered — stacked, there is no column to dock into");
  expectAbsent(compactOptions, 'aria-label="Sidebar position"', "narrow: and no segmented control is left behind in its place");
  isCompact.value = false;

  console.log("long press");
  // The gesture has no markup to look at and no DOM here to fire a touch at. What can be pinned
  // is the half that lives in this process — which pointers arm it — plus what the two ways in
  // have to agree on: which rows have a menu at all, and what is on it.
  const { isFingerPointer } = await server.ssrLoadModule(
    "/src/core/gestures.ts",
  );
  expectEqual(
    isFingerPointer("touch"),
    true,
    "a long press is armed for a finger",
  );
  expectEqual(
    isFingerPointer("mouse"),
    false,
    "and for nothing else — the tree's drag is a mouse gesture and would lose that press",
  );

  const menus = await server.ssrLoadModule("/src/core/menus.ts");
  const actions = (items) => items.map((item) => item.action).join(",");
  expectEqual(
    actions(menus.folderMenu()),
    "new,rename,delete",
    "a folder row's menu is make/rename/remove — no detail entry, and no divider between them",
  );
  expectEqual(
    actions(menus.emptyTreeMenu()),
    "new",
    "and the blank space under the tree makes a top-level folder",
  );
  // The rows that must NOT have a menu. A `Details` entry would come back through one of these
  // builders, so the builders are where its absence is pinned. `typeof` rather than a deep equal:
  // the module namespace answers `undefined` for a name that was never exported.
  for (const gone of ["bookmarkMenu", "historyMenu", "emptyHistoryMenu"]) {
    expectEqual(
      typeof menus[gone],
      "undefined",
      `${gone} is gone — those rows have no menu`,
    );
  }

  const treeSource = await readSource(
    "src/components/bookmarks/BookmarkTree.vue",
    "utf8",
  );
  expect(treeSource, "useLongPress(", "the tree reaches its menus by long press as well as by right-click");
  expect(treeSource, "@contextmenu", "and keeps the right-click the long press stands in for");
  expect(treeSource, "folderMenu()", "but only a folder row is offered one");
  // The menu is data and the switch consuming it matches by string, so an action handed out with no
  // `case` is a row that opens and does nothing.
  for (const { action } of menus.folderMenu()) {
    expect(treeSource, `case "${action}"`, `the tree branches on the "${action}" its menu offers`);
  }
  // The blank-space menu is the exception and goes through `isFolderNode` first — the guard is
  // what makes a right-click on a *bookmark* open nothing instead of falling through to "New".
  expect(treeSource, "if (!isFolderNode(node)) return;", "a bookmark row's right-click opens nothing rather than the blank-space menu");

  const historySource = await readSource(
    "src/components/history/HistoryList.vue",
    "utf8",
  );
  expectAbsent(historySource, "useLongPress", "the history panel has no long press — it has no menu to reach");
  expectAbsent(historySource, "@contextmenu", "and no right-click either");
  expectAbsent(historySource, "ContextMenu", "and reaches no menu component at all");
  expectAbsent(historySource, "clearAll", "and no clear-all: the panel it would have lived in has no menu");
  // And no delete of any kind — pruning the profile is Chrome's own history page's job.
  expectAbsent(historySource, 'class="remove"', "and no per-row delete — opening an entry is the row's only action");

  // The delete button a cursor reveals is the *only* delete a bookmark row has, and a finger has
  // no hover — so a media query has to keep it visible under a coarse pointer or the row becomes
  // undeletable on a touchscreen. Read from the source: a media query is invisible to SSR.
  const rowSource = await readSource(
    "src/components/bookmarks/BookmarkNode.vue",
    "utf8",
  );
  const coarse = rowSource.slice(rowSource.indexOf("@media (pointer: coarse)"));
  expect(coarse, ".remove", "BookmarkNode keeps its delete button reachable without hover");
  expect(coarse, "display: grid", "and shows it outright under a coarse pointer");

  console.log("swipe");
  // Same shape of proof as the long press, and for the same reason: the decision is a pure function
  // with no markup, so the arithmetic is what can be pinned here — plus the wiring, which otherwise
  // only a browser would witness.
  const { swipeDirection, swipedIndex } = await server.ssrLoadModule(
    "/src/core/gestures.ts",
  );
  const swipe = (dx, dy) =>
    swipeDirection({ x: 200, y: 300 }, { x: 200 + dx, y: 300 + dy }, 400);
  expectEqual(swipe(-60, 0), "left", "a finger moving left is a swipe left — the panel that arrives is the one that was off the right edge");
  expectEqual(swipe(60, 0), "right", "and a finger moving right brings the one off the left edge back");
  expectEqual(swipe(-40, 0), null, "a nudge is not a swipe — the tab strip stays the way in for a short movement");
  expectEqual(swipe(-60, 90), null, "but a gesture that travelled further down than sideways was a scroll, and the panel must not also have moved");
  expectEqual(swipeDirection({ x: 10, y: 300 }, { x: 0, y: 300 }, 400), null, "and one starting in the browser's edge strip is never ours — that strip is Chromium's back/forward");
  expectEqual(swipedIndex(0, "left", 2), 1, "advancing from the first view lands on the second");
  expectEqual(swipedIndex(1, "left", 2), null, "and from the last there is nowhere to advance to — the ends hold");

  const panelSource = await readSource(
    "src/components/layout/SidePanel.vue",
    "utf8",
  );
  expect(panelSource, "useSwipeView(", "the panel listens for the swipe itself");
  expect(panelSource, "@pointerdown", "on pointerdown, so nothing has to be clicked first");
  expect(panelSource, "swipedIndex(", "and decides where it lands through the pure step rather than an if");
  // The strip's order is the order the swipe walks, so inserting a tab moves the swipe with it.
  expect(panelSource, "TABS.findIndex(", "reading the current position off the same tab list the header draws");
  expect(panelSource, 'role="tab"', "and the segmented switch stays the first way in — the swipe is a second one, not a replacement");

  // Two decisions the plumbing makes, both invisible until a phone is in a hand: the swipe reads
  // the same events the page scrolls with, so it must swallow nothing; and a gesture the browser
  // takes over for scrolling arrives as `pointercancel`, which has to let go of the pointer or a
  // scroll would later complete as a swipe.
  const swipeSource = await readSource("src/composables/useSwipeView.ts", "utf8");
  expectAbsent(swipeSource, "preventDefault", "the swipe swallows nothing — a gesture that turns out to be a scroll stays a scroll");
  expect(swipeSource, '"pointercancel"', "and a cancelled gesture is released, so a scroll can never finish as a swipe");

  console.log("a write that did not land");
  // The other half of "the setting doesn't work": the write fails, the control shows the new value,
  // storage keeps the old one. Rolling back is what makes it visible.
  const realConsoleError = console.error;
  console.error = () => {};
  setFailWrites(true);
  await store.update({ sidebarPosition: "left" });
  setFailWrites(false);
  console.error = realConsoleError;

  expectEqual(store.lastError.value === null, false, "a failed write is recorded instead of swallowed");
  expectEqual(store.settings.value.sidebarPosition, "right", "and the optimistic value is rolled back to what storage still holds");

  const failedHtml = await renderToString(createSSRApp(OptionsApp));
  expect(failedHtml, "That change was not saved", "the settings page says so rather than pretending");
  expect(failedHtml, 'role="alert"', "as an alert, not a footnote");

  await store.update({ sidebarPosition: "right" });
  expectEqual(store.lastError.value, null, "a later write that lands clears it");
  expectAbsent(await renderToString(createSSRApp(OptionsApp)), 'role="alert"', "and the warning is gone from the page");
} finally {
  await server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} render check(s) failed`);
  process.exit(1);
}
console.log("\nall render checks passed");
