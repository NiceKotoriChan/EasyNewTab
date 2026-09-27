/**
 * Headless render smoke test for both extension entry points.
 *
 * Running the built extension for real needs a Chrome profile, so this is the
 * closest we can get in CI: stub the `chrome.*` surface, load the actual SFCs
 * through Vite, and server-render them. That exercises everything a mount
 * does except effects — setup logic, computed evaluation, prop passing,
 * recursive component resolution (`BookmarkNode` inside itself), inject/provide
 * and template compilation.
 *
 * `onMounted` hooks are intentionally not executed (no DOM here), so window
 * listeners and intervals are out of scope for this check.
 *
 *   node scripts/render-check.mjs
 */

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { createSSRApp, ref } from "vue";
import { renderToString } from "@vue/server-renderer";

/**
 * MDI's own dataset, so glyphs in the output can be compared against their
 * source instead of merely inspected. See the "icon set" section for why the
 * comparison, not the eyeball, is the check.
 */
const mdi = createRequire(import.meta.url)("@iconify-json/mdi/icons.json");

/**
 * Every `d` value MDI defines. Small enough to hold in memory (the strings are
 * ~140 kB against the 2.3 MB of JSON that surrounds them) and the comparison is
 * a set lookup per glyph.
 */
const MDI_PATHS = new Set();
for (const glyph of Object.values(mdi.icons)) {
  for (const match of glyph.body.matchAll(/d="([^"]*)"/g)) MDI_PATHS.add(match[1]);
}

// ---------------------------------------------------------------- chrome stub
const noop = () => {};

/**
 * Event stubs that keep their listeners, so a test can *fire* a change instead
 * of only proving that a listener could be attached. The settings store is the
 * one subscriber whose reaction is worth exercising end-to-end: a preference
 * flipped in the options page has to reach the bookmark tree without another
 * `getTree()` round-trip.
 */
const makeEvent = () => {
  const listeners = [];
  return {
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    fire: (...args) => listeners.forEach((fn) => fn(...args)),
  };
};

const BOOKMARK_TREE = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        parentId: "0",
        title: "Bookmarks bar",
        children: [
          { id: "b1", parentId: "1", title: "GitHub", url: "https://github.com" },
          {
            id: "f1",
            parentId: "1",
            title: "Dev",
            children: [
              {
                id: "b2",
                parentId: "f1",
                title: "Vue",
                url: "https://vuejs.org",
              },
            ],
          },
        ],
      },
      { id: "2", parentId: "0", title: "Other bookmarks", children: [] },
    ],
  },
];

/**
 * What the top-sites stub answers with, and deliberately more than the row can
 * show: twelve entries carrying a repeat host, a `chrome://` page, a malformed
 * URL, an entry with no title, and one site too many for the cap. Every rule
 * `selectTopSites` applies has an entry here that trips it, so the row the
 * render check sees is the row a real profile would produce.
 */
const TOP_SITES = [
  { url: "https://github.com/", title: "GitHub" },
  { url: "https://github.com/explore", title: "Explore GitHub" },
  { url: "chrome://bookmarks", title: "Bookmark Manager" },
  { url: "https://mail.google.com/mail/u/0/", title: "   " },
  { url: "https://news.ycombinator.com/", title: "Hacker News" },
  { url: "https://vuejs.org/", title: "Vue" },
  { url: "https://developer.mozilla.org/en-US/", title: "MDN Web Docs" },
  { url: "https://stackoverflow.com/", title: "Stack Overflow" },
  { url: "https://www.zhihu.com/", title: "知乎" },
  { url: "https://bilibili.com/", title: "bilibili" },
  { url: "not-a-url", title: "Nope" },
  { url: "https://rust-lang.org/", title: "Rust" },
];

/** Mutable: the last pass answers with nothing, to see what the row does then. */
let topSitesFixture = TOP_SITES;

/**
 * Flip to make the next `storage.sync.set` fail. Storage writes really do fail
 * — `sync` has write quotas, and a write from a page whose extension has been
 * reloaded throws — so the "did not land" path is exercised rather than assumed.
 */
let failWrites = false;

globalThis.chrome = {
  storage: {
    sync: {
      get: async () => ({}),
      set: async () => {
        if (failWrites) throw new Error("QUOTA_BYTES quota exceeded");
      },
    },
    local: { get: async () => ({}), set: async () => {} },
    session: { get: async () => ({}), set: async () => {} },
    onChanged: makeEvent(),
  },
  runtime: {
    getURL: (path) => `chrome-extension://stub/${path}`,
    openOptionsPage: noop,
  },
  bookmarks: {
    getTree: async () => BOOKMARK_TREE,
    get: async () => [],
    getSubTree: async () => [],
    getChildren: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    move: async () => ({}),
    remove: async () => {},
    removeTree: async () => {},
    onCreated: makeEvent(),
    onRemoved: makeEvent(),
    onChanged: makeEvent(),
    onMoved: makeEvent(),
    onChildrenReordered: makeEvent(),
    onImportEnded: makeEvent(),
  },
  history: {
    search: async () => [
      {
        id: "h1",
        url: "https://example.com/",
        title: "Example",
        lastVisitTime: Date.now(),
        visitCount: 4,
        typedCount: 1,
      },
    ],
    deleteUrl: async () => {},
    deleteAll: async () => {},
    onVisited: makeEvent(),
    onVisitRemoved: makeEvent(),
  },
  tabs: { create: noop, update: noop },
  topSites: { get: async () => topSitesFixture },
};

// ---------------------------------------------------------------- checks
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

/**
 * Every glyph the app renders has to be one MDI actually publishes.
 *
 * The reason this is a *comparison against the dataset* rather than a spot
 * check is that the two mistakes look identical on screen: the hand-drawn set
 * this replaced drew the same shapes at the same sizes with the same classes,
 * so "there is an `<svg>` of about the right size" says nothing. Only the path
 * data distinguishes them, and only the dataset can say what the path data
 * ought to be.
 *
 * `EngineIcon.vue`'s brand marks are classed `engine-mark`, not `icon`, so they
 * fall outside the sweep — they are hand-drawn on purpose (colour is the
 * information) and would fail it by design.
 */
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

  // Guard the guard. A regex that silently matched nothing would satisfy the
  // assertion above while checking nothing, so require that the sweep covered
  // every `class="icon"` in the document — and that there was at least one.
  const tags = (html.match(/class="icon[^"]*"/g) ?? []).length;
  expectEqual(svgs.length, tags, `${where}: the sweep covered every glyph`);
  expectEqual(tags > 0, true, `${where}: there were glyphs to check (${tags})`);
}

/**
 * The `d` a named MDI glyph is drawn with, read from the dataset rather than
 * pasted in. A rename upstream then fails loudly here instead of quietly
 * turning the assertion below into a comparison of two stale strings.
 */
function mdiGlyph(name) {
  const glyph = mdi.icons[name];
  if (!glyph) throw new Error(`render-check: MDI has no glyph named ${name}`);
  return glyph.body.match(/d="([^"]*)"/)[1];
}

/**
 * Which glyph one specific row is wearing.
 *
 * The slice runs from the row's `data-node-id` to its label span — the band the
 * lead icon sits in, and nothing else's. That precision is the whole point: a
 * document-wide `expect(html, d)` cannot tell "the shut row is solid" from
 * "a solid glyph exists somewhere on this page", and with a two-state icon
 * those are different claims.
 */
function rowGlyph(html, id) {
  const start = html.indexOf(`data-node-id="${id}"`);
  if (start === -1) return null;
  const label = html.indexOf('class="label"', start);
  if (label === -1) return null;
  // `is-folder` rather than "the first `d` in the slice": a folder with children
  // also carries a chevron in its twisty, and the chevron comes first.
  const lead = html
    .slice(start, label)
    .match(/<svg\b[^>]*class="[^"]*is-folder[^"]*"[^>]*>[\s\S]*?<\/svg>/);
  return lead ? (lead[0].match(/d="([^"]*)"/)?.[1] ?? null) : null;
}

/**
 * The text one shortcut entry renders, read out of that entry's own markup.
 *
 * `null` when the entry is not there, so a missing row fails the assertion
 * instead of throwing somewhere less informative.
 *
 * The slice is not optional. The URL appears twice per entry — once in
 * `data-site-url`, once percent-encoded inside the favicon's query string — so
 * "does this host appear in the page" would be answered by the icon even if the
 * label were blank, which is precisely the bug the label fallback exists to
 * prevent.
 *
 * The label regex allows attributes between `class="label"` and `>`: scoped CSS
 * puts a `data-v-…` on every element, so the tag is never `class="label">`.
 */
function siteLabel(html, url) {
  const marker = `data-site-url="${url}"`;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const next = html.indexOf("data-site-url=", start + marker.length);
  const entry = html.slice(start, next === -1 ? undefined : next);
  return entry.match(/class="label"[^>]*>([^<]*)</)?.[1] ?? null;
}

/**
 * The size the engine pills draw their brand marks at.
 *
 * Read back rather than matched as a literal, for the same reason `siteLabel`
 * slices: scoped CSS puts a `data-v-…` between `class="engine-mark"` and the
 * `width` the component renders, so `class="engine-mark" width="18"` matches
 * nothing. `null` when the row is absent, so a missing row fails as "not
 * there" instead of throwing somewhere less informative.
 */
function engineMarkWidth(html) {
  const match = html.match(/<svg class="engine-mark"[^>]*width="(\d+)"/);
  return match ? Number(match[1]) : null;
}

/**
 * Which docking side the settings page renders as current. The two buttons are
 * identical apart from the label, so the label is what has to be read back.
 */
function activeDockSide(html) {
  const match = html.match(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/);
  if (!match) return null;
  return match[1].includes("Right") ? "right" : "left";
}

/**
 * The welcome pane's date line. Read back rather than matched as a literal for
 * an unusually literal reason: it is computed from the clock, so any literal
 * would be stale by tomorrow. `null` when the line is missing, so a
 * disappeared clock block fails as "not there" instead of throwing somewhere
 * less informative.
 */
function dateLine(html) {
  const match = html.match(/class="date"[^>]*>([^<]*)</);
  return match ? match[1] : null;
}

/**
 * The keys of the rendered shortcut rows, in the order they appear.
 *
 * Read back through `<kbd>` rather than matched as a literal, and the regex has
 * to tolerate attributes between the tag name and the `>`: a scoped component's
 * styles are delivered as a `data-v-…` attribute on every element it renders, so
 * the markup is `<kbd data-v-53c2041c>/</kbd>` and a literal `<kbd>/</kbd>`
 * matches nothing at all — a silent miss, which for an assertion reads as "the
 * page is wrong" rather than "the assertion is".
 */
function shortcutKeysInHtml(html) {
  return [...html.matchAll(/<kbd\b[^>]*>([^<]*)<\/kbd>/g)].map((m) => m[1]);
}

/**
 * Settings rows, and how many of them render a control.
 *
 * The General panel is meant to be controls only — a row that carries a name and
 * a paragraph but nothing to operate is read as a setting that has lost its
 * switch. Counting the two is how that stays true as rows are added: the `row`
 * class is exact, so `row-text` / `row-label` do not match it. `labels` is
 * counted too, so that "one name per row" fails loudly rather than being assumed
 * — a row may not have grown a second line of text on the left either.
 *
 * The absence of the hint paragraph that each row used to carry is asserted
 * separately, by class, next to these counts.
 */
function settingsRows(html) {
  const rows = (html.match(/class="row"/g) ?? []).length;
  const controls = (html.match(/class="row-control"/g) ?? []).length;
  const labels = (html.match(/class="row-label"/g) ?? []).length;
  return { rows, controls, labels };
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  // Every page load begins with a `storage.sync.get` in flight. Anything that
  // lands inside that window is newer than the value being read, so a read
  // that resolves last must not be allowed to put the old value back — that is
  // the "I changed the setting and it applied for a moment, then reverted /
  // never applied at all" bug. This has to run first: it needs the settings
  // module before anything else has bootstrapped it.
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
  expectEqual(
    store.settings.value.sidebarPosition,
    "right",
    "a change from another tab lands while that read is still open",
  );

  releaseRead({ settings: { ...DEFAULT_SETTINGS, sidebarPosition: "left" } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expectEqual(
    store.settings.value.sidebarPosition,
    "right",
    "and the late read cannot roll it back",
  );

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
  expectAbsent(firstPass, 'aria-label="Settings"', "the new tab page no longer links to settings");
  expectAbsent(firstPass, 'aria-label="Hide sidebar"', "and carries no collapse button either");
  expectAbsent(firstPass, 'class="rail"', "the collapsed-state toolbar is gone");
  expect(firstPass, "search-field", "the main area is the search box — nothing is selected by default");
  expectAbsent(firstPass, "statusbar", "status bar has been removed");
  expectAbsent(firstPass, "titlebar", "title bar has been removed");
  expectAbsent(firstPass, "activity-bar", "activity bar has been removed");
  expectAbsent(firstPass, "Filter bookmarks", "bookmark filter box has been removed");
  // The expand-all / collapse-all pair was the last thing in the tree's corner
  // bar, so removing it removed the bar. Folding is per-row now.
  expectAbsent(firstPass, 'aria-label="Expand all"', "tree has no expand-all button");
  expectAbsent(firstPass, 'aria-label="Collapse all"', "and no collapse-all button either");
  expect(firstPass, "DuckDuckGo", "hero search box lists the other engines");
  expect(firstPass, 'aria-label="Search engine"', "engine row is a labelled group");
  // The row is six outlined pills again, one per engine. Their borders, their
  // fill and the active pill's colours are CSS and live in the built stylesheet;
  // the brand mark's size is the one part of this shape that is markup, so it is
  // the one part this check can hold onto — 18px is the original build's value,
  // and the 15px the segmented track used would still look plausible.
  expectEqual(
    (firstPass.match(/class="engine-mark"/g) ?? []).length,
    6,
    "the engine row is six pills, one engine each",
  );
  expectEqual(
    engineMarkWidth(firstPass),
    18,
    "and each pill carries the original build's 18px brand mark",
  );

  console.log("icon set");
  // Icons are Iconify's Material Design Icons, resolved at build time from the
  // offline `@iconify-json/mdi` package. Asserting a glyph's *own path data* is
  // the only way to tell "MDI is in the bundle" from "some <svg> of about the
  // right size is in the bundle" — which is exactly what the hand-drawn set
  // this replaced also produced. The literal below is MDI's `magnify`, the
  // search field's prefix.
  expect(
    firstPass,
    'd="M9.5 3A6.5 6.5 0 0 1 16 9.5',
    "the search glyph is MDI's own path data, not a hand-drawn one",
  );
  // The old wrapper drew every icon as a 1.6px stroke path. Brand marks
  // (`EngineIcon.vue`) are still strokes with their own widths — they have to be,
  // they are multi-colour logos — so the check is on the exact value that only
  // the replaced set used.
  expectAbsent(
    firstPass,
    'stroke-width="1.6"',
    "and nothing is still drawn as a 1.6px stroke",
  );

  // The literal above proves the pipeline ran *once*. The invariant worth having
  // is the sweep: read MDI's own dataset and require every rendered
  // `class="icon"` svg to carry path data that appears in it. That is what
  // catches the hand-drawn set creeping back one glyph at a time — and it is
  // also the answer to "is this really Iconify?", which path data alone cannot
  // settle by looking at it.
  assertGlyphsAreMdi(firstPass, "new tab");
  // And the icon layer must hold no drawing of its own: a `d="` literal in
  // either file below means a glyph is being hand-made again.
  for (const file of ["Icon.vue", "mdi-icons.ts"]) {
    const source = await readFile(
      new URL(`../src/components/ui/${file}`, import.meta.url),
      "utf8",
    );
    expectAbsent(source, 'd="', `${file} carries no hand-drawn path data`);
  }

  // The stores hydrate asynchronously on first use; let those microtasks land
  // and render again to exercise the populated tree.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const secondPass = await renderToString(createSSRApp(App));
  // Swept again with the tree populated: this is the pass where the row glyphs
  // (folder, twisty) actually exist, and a sweep that only ever saw three icons
  // would be a thin thing to call coverage.
  assertGlyphsAreMdi(secondPass, "new tab, tree loaded");
  expect(secondPass, "Bookmarks bar", "bookmark tree renders a top-level folder");
  expect(secondPass, "GitHub", "bookmark tree renders a leaf bookmark");
  expect(secondPass, "Dev", "bookmark tree renders a nested folder");
  expect(secondPass, "Other bookmarks", "the Other bookmarks folder shows by default");
  expect(secondPass, 'data-kind="folder"', "folder rows are tagged for drop maths");
  expect(secondPass, 'data-kind="bookmark"', "bookmark rows are tagged");
  // A folder row carries its state in the glyph — solid when shut, hollow when
  // open. That pair is what the pre-rewrite build drew, and the whole reason
  // the icon layer keeps two folder entries instead of one.
  //
  // Both halves are present in this pass: `1` ("Bookmarks bar") opens on first
  // load, `f1` ("Dev") stays shut.
  // Guard the guard: if both keys ever resolved to the same drawing, every
  // assertion above would go on passing while the pair quietly became one icon.
  expectEqual(
    mdiGlyph("folder") === mdiGlyph("folder-outline"),
    false,
    "the shut and open glyphs are genuinely two different drawings",
  );
  expectEqual(
    rowGlyph(secondPass, "1"),
    mdiGlyph("folder-outline"),
    "an open folder row wears MDI's folder-outline",
  );
  expectEqual(
    rowGlyph(secondPass, "f1"),
    mdiGlyph("folder"),
    "a shut folder row wears MDI's solid folder",
  );
  // `2` ("Other bookmarks") is empty, and the first-load sweep puts it in
  // `expandedIds` anyway — it is the case that separates a glyph keyed on
  // `expanded` from one keyed on "expanded *and* has something to show".
  expectEqual(
    rowGlyph(secondPass, "2"),
    mdiGlyph("folder"),
    "an empty folder reads as shut even though the sweep opened it",
  );
  // And the tint has exactly one home. Both call sites ask for the token by
  // name; a hex literal at either one is how they drifted apart the first time
  // (two files, two copies of a colour that was not the shipped one). CSS is
  // invisible to an SSR render, so the sources are what has to be read.
  const tokensCss = await readFile(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  expectEqual(
    (tokensCss.match(/--icon-folder:/g) ?? []).length,
    1,
    "the folder tint is defined once, as a token",
  );
  expect(
    tokensCss,
    "--icon-folder: var(--accent)",
    "and it aliases the app's accent rather than inventing a second blue",
  );
  for (const file of ["BookmarkNode.vue", "BookmarkDetail.vue"]) {
    const source = await readFile(
      new URL(`../src/components/bookmarks/${file}`, import.meta.url),
      "utf8",
    );
    expect(source, "var(--icon-folder)", `${file} takes the folder tint from the token`);
    expectAbsent(source, "color: #", `${file} hard-codes no colour of its own`);
  }
  // Rows are no longer native drag sources: `draggable="true"` and its
  // dragstart/dragover/drop handlers were replaced by the adapter in
  // `src/dnd/tree.ts`, which is what gives the tree a drag image it controls,
  // edge autoscroll and `canDrop()`. Leaving the attribute behind would put the
  // browser's own drag in charge of the same element again.
  expectAbsent(
    secondPass,
    'draggable="true"',
    "rows are not native drag sources — the adapter owns the gesture",
  );
  // Not decoration either: the adapter reads `data-node-id` off the rows to
  // tell a drop in the blank space under the list from a drop between rows.
  expect(
    secondPass,
    'data-node-id="b1"',
    "rows advertise their id, which the empty-area drop rule queries on",
  );
  // Only top-level folders open on first load, so a depth-2 row must not exist
  // in the DOM yet. `b2` ("Vue") lives inside `f1` ("Dev").
  expectAbsent(
    secondPass,
    'data-node-id="b2"',
    "nested folders stay collapsed until expanded",
  );

  // The welcome pane's shortcut row. It only exists in this pass — the read is
  // in flight during the first one — and what it contains is the whole point:
  // the stub hands back twelve entries and the row has to come out the other
  // side with the right eight, each one a *site* rather than a page.
  expect(
    secondPass,
    'aria-label="Most visited sites"',
    "the welcome pane offers the most-visited row",
  );
  expectEqual(
    siteLabel(secondPass, "https://news.ycombinator.com/"),
    "Hacker News",
    "an entry is labelled with the title Chrome gave it",
  );
  // The fallback matters because Chrome hands back blank titles for pages that
  // never declared one, and an entry without a label is an icon in a void.
  expectEqual(
    siteLabel(secondPass, "https://mail.google.com/mail/u/0/"),
    "mail.google.com",
    "and a blank title falls back to the host",
  );
  expectAbsent(
    secondPass,
    "Explore GitHub",
    "a second page of an already-listed site gets no entry of its own",
  );
  expectAbsent(
    secondPass,
    "Bookmark Manager",
    "a chrome:// page is not offered — a new tab can only send you somewhere web",
  );
  expectAbsent(
    secondPass,
    "Nope",
    "and neither is anything that is not a URL at all",
  );
  expectEqual(
    (secondPass.match(/data-site-url=/g) ?? []).length,
    8,
    "the row is capped at eight entries",
  );
  expectAbsent(
    secondPass,
    "Rust",
    "and the cap drops from the bottom of Chrome's order, not at random",
  );

  // Flip `showOtherBookmarks` the way the options page would (a storage change
  // in the "sync" area) and confirm the tree reacts without a reload.
  console.log("settings propagation");
  chrome.storage.onChanged.fire(
    { settings: { newValue: { showOtherBookmarks: false } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const thirdPass = await renderToString(createSSRApp(App));
  expectAbsent(
    thirdPass,
    'data-node-id="2"',
    "turning the setting off hides the Other bookmarks row",
  );
  expectAbsent(
    thirdPass,
    "Other bookmarks",
    "and the folder title is gone with it",
  );
  expect(
    thirdPass,
    "Bookmarks bar",
    "while the rest of the tree is untouched (no reload needed)",
  );

  console.log("collapsed sidebar");
  // The divider is what collapses the sidebar, so it has to survive the state
  // change it causes — a handle that unmounted on collapse would drop the drag
  // mid-gesture and leave no way back except the keyboard.
  const { useSidebar } = await server.ssrLoadModule("/src/composables/useSidebar.ts");
  const { collapsed } = useSidebar();
  collapsed.value = true;
  const collapsedPass = await renderToString(createSSRApp(App));
  expect(
    collapsedPass,
    'aria-label="Show sidebar"',
    "collapsed: the divider is still rendered, so dragging can reopen it",
  );
  expect(
    collapsedPass,
    "display:none",
    "collapsed: the sidebar is hidden by style, not unmounted",
  );
  expect(
    collapsedPass,
    'role="tablist"',
    "collapsed: its contents stay in the DOM, so scroll state survives",
  );
  expectAbsent(
    collapsedPass,
    'class="rail"',
    "collapsed: no toolbar takes its place",
  );
  collapsed.value = false;

  console.log("sidebar docking");
  // The docking side is a setting and the whole row mirrors with it. The
  // collapsed hint is the half worth asserting: there is no button anywhere, so
  // that tooltip is the only thing telling you which way to drag.
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
  expect(
    dockedRight,
    "drag right to hide",
    "expanded: the divider's hint follows the docking side",
  );
  expect(
    dockedRight,
    "Bookmarks bar",
    "the panels themselves are untouched by the move",
  );

  collapsed.value = true;
  const dockedRightCollapsed = await renderToString(createSSRApp(App));
  expect(
    dockedRightCollapsed,
    "Drag left to show the sidebar",
    "collapsed: the only affordance points at the mirrored edge",
  );
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
  expectAbsent(
    dockedLeft,
    "is-right",
    "and setting it back un-mirrors the shell",
  );

  console.log("click contract");
  // A left click is the whole gesture and it is NOT selection — the sidebar
  // must not be able to take the search box away from the main area.
  //
  // Folding a folder is the only gesture that changes what the panel shows
  // (the expand-all button that used to do it in one go is gone), so that is
  // what this pass drives: `toggleExpanded` is exactly what a row click calls.
  const { useBookmarks } = await server.ssrLoadModule("/src/composables/useBookmarks.ts");
  useBookmarks().toggleExpanded("f1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const foldPass = await renderToString(createSSRApp(App));
  // Proof the fold landed, which is also what puts the nested row in the DOM
  // for the two assertions below to find.
  expect(foldPass, 'data-node-id="b2"', "folding a folder reveals the rows inside it");
  // Same row, opposite glyph: the swap is keyed on the row's state, not on
  // which row it is. Without this, a single hard-coded folder glyph would keep
  // the assertions above green in the pass where everything happened to match.
  expectEqual(
    rowGlyph(foldPass, "f1"),
    mdiGlyph("folder-outline"),
    "opening that same folder swaps it to the hollow glyph",
  );
  expect(
    foldPass,
    'data-action="toggle"',
    "a folder row declares that a click folds it",
  );
  expect(
    foldPass,
    'data-action="open"',
    "a bookmark row declares that a click opens it — no double click needed",
  );
  expect(
    foldPass,
    "search-field",
    "after a click the main area is still the search box (nothing was selected)",
  );

  console.log("sidebar search");
  // `p` reveals this box, Esc closes it. Neither key can be fired here — there
  // is no DOM, so the shell's window listeners never run — so what this section
  // pins is the state machine those keys drive and the markup it produces.
  // Half of that is a decision worth pinning: the box does not exist until it
  // is asked for, and the rows a query drops are gone from the DOM rather than
  // merely faded out.
  const searchStore = useBookmarks();

  expectAbsent(
    firstPass,
    'aria-label="Search bookmarks"',
    "the bookmarks panel has no permanent filter bar",
  );

  searchStore.openSearch();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const searchPass = await renderToString(createSSRApp(App));
  expect(
    searchPass,
    'aria-label="Search bookmarks"',
    "asking for it puts the box in the panel",
  );
  expect(
    searchPass,
    'data-node-id="b1"',
    "with the whole tree still there while the query is empty",
  );

  searchStore.searchQuery.value = "vue";
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hitPass = await renderToString(createSSRApp(App));
  expect(hitPass, 'data-node-id="b2"', "a hit survives the query");
  expect(hitPass, 'data-node-id="f1"', "and the folder on the way down to it is kept");

  // The decisive one. `f1` was folded open by the pass above, so its children
  // are in the DOM for every other assertion in this file — if the search only
  // hid rows, they would still be here.
  searchStore.searchQuery.value = "github";
  await new Promise((resolve) => setTimeout(resolve, 0));
  const urlPass = await renderToString(createSSRApp(App));
  expect(urlPass, 'data-node-id="b1"', "a bookmark found by its title");
  expectAbsent(
    urlPass,
    'data-node-id="f1"',
    "a folder nothing under it answers is gone, expanded or not",
  );
  expectAbsent(urlPass, 'data-node-id="b2"', "and so are the rows it was holding");

  searchStore.searchQuery.value = "zzz";
  await new Promise((resolve) => setTimeout(resolve, 0));
  const emptyPass = await renderToString(createSSRApp(App));
  expect(emptyPass, "No matches", "a query nothing answers says so");
  expectAbsent(
    emptyPass,
    "No bookmarks yet",
    "and does not blame the user for having no bookmarks",
  );

  searchStore.closeSearch();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const clearedPass = await renderToString(createSSRApp(App));
  expectAbsent(
    clearedPass,
    'aria-label="Search bookmarks"',
    "closing the search takes the box away again",
  );
  expect(
    clearedPass,
    'data-node-id="b1"',
    "and the tree comes back whole — a filter is not persisted",
  );

  console.log("row drag states");
  // A drag needs a real pointer, so the two states a row can be dragged into
  // are invisible from the shell. Rendering the row on its own against a
  // stubbed tree context is the only way they get a witness — and they need
  // one, because they are the whole answer to "which one am I about to get?":
  // the fill means the node goes *into* the folder, the line between rows means
  // it goes next to it.
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
      selectedId: ref(null),
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
  expectAbsent(
    idleRow,
    "is-blocked",
    "a row outside the dragged subtree is not marked as refusing the drop",
  );
  expectAbsent(
    idleRow,
    "is-drop-inside",
    "and nothing is highlighted while no drag is running",
  );

  const blockedRow = await renderRow({ blockedIds: ref(new Set(["b1"])) });
  expect(
    blockedRow,
    "is-blocked",
    "a row inside the dragged subtree renders as refusing the drop",
  );

  const insideRow = await renderRow({
    dropTarget: ref({ id: "b1", position: "inside", rect: {} }),
  });
  expect(
    insideRow,
    "is-drop-inside",
    "hovering the middle third of a folder fills the whole row",
  );

  const beforeRow = await renderRow({
    dropTarget: ref({ id: "b1", position: "before", rect: {} }),
  });
  expectAbsent(
    beforeRow,
    "is-drop-inside",
    "a drop between rows uses the line instead — the two outcomes stay distinct",
  );

  console.log("detail view");
  // The detail editor still exists, but only a context menu can ask for it.
  const { useSelection } = await server.ssrLoadModule("/src/composables/useSelection.ts");
  const selection = useSelection();
  selection.select({ kind: "bookmark", id: "b1" });
  const detailPass = await renderToString(createSSRApp(App));
  expect(detailPass, "Location", "the detail editor renders when it is asked for");
  expectAbsent(
    detailPass,
    "search-field",
    "and only then does it take the main area over",
  );
  selection.clear();

  console.log("history panel");
  const { default: HistoryList } = await server.ssrLoadModule(
    "/src/components/history/HistoryList.vue",
  );
  await renderToString(createSSRApp(HistoryList));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const historyHtml = await renderToString(createSSRApp(HistoryList));
  expect(historyHtml, "Today", "history list groups entries by day");
  expect(historyHtml, "Example", "history list renders an entry");

  console.log("welcome pane");
  const { default: WelcomePane } = await server.ssrLoadModule(
    "/src/components/welcome/WelcomePane.vue",
  );
  await renderToString(createSSRApp(WelcomePane));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const welcomeHtml = await renderToString(createSSRApp(WelcomePane));
  // The one assertion here that cannot be a literal, because the string it
  // describes moves with the calendar. The shape pins the English long weekday
  // form — the interface has no translations, so the browser's locale must not
  // reach this line — and the second pins the omitted year, which is the
  // lock-screen convention rather than an oversight. They are separate because
  // they fail for different reasons.
  const line = dateLine(welcomeHtml);
  expectEqual(
    /^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}$/.test(line ?? ""),
    true,
    "the date line is the English long form, whatever the browser's locale is",
  );
  expectEqual(
    /\d{4}/.test(line ?? ""),
    false,
    "and carries no year — it is read dozens of times a day",
  );
  expect(welcomeHtml, "search-field", "welcome pane hosts the hero search box");
  expect(welcomeHtml, "is-large", "hero search box uses the large variant");
  expect(welcomeHtml, "GitHub", "hero search box carries the engine row");
  // This spot used to be empty on purpose — a "frequently visited" grid of
  // tinted tiles was deleted from it in an earlier round for competing with the
  // search box. The row is back at the user's request, so the assertion is no
  // longer "nothing is here": it is that what is here stays inside the budget.
  expect(
    welcomeHtml,
    'aria-label="Most visited sites"',
    "the shortcut row hangs off the bottom of the search block",
  );
  // The shape is Chromium's, and it takes two elements to make it: the favicon
  // centred on a filled circle, at 24px. Either half alone would still look
  // plausible — a bare favicon in the tile, or a circle asking the cache for the
  // 16px icon the sidebar rows use — so both are pinned.
  expect(
    welcomeHtml,
    'class="site-icon"',
    "each shortcut draws its favicon on Chromium's filled icon circle",
  );
  expect(
    welcomeHtml,
    "size=24",
    "and asks the favicon cache for the 24px icon that circle is sized around",
  );

  console.log("most visited row, with nothing to show");
  // A profile with no history yet, an incognito window, or a build shipped
  // without the `topSites` permission all answer with an empty list. The one
  // outcome that would be wrong is a box that says so: this row is a shortcut,
  // not a feature, and there is no empty state to explain.
  const { useTopSites } = await server.ssrLoadModule(
    "/src/composables/useTopSites.ts",
  );
  topSitesFixture = [];
  await useTopSites().reload();
  const noSites = await renderToString(createSSRApp(WelcomePane));
  expectAbsent(
    noSites,
    'aria-label="Most visited sites"',
    "no list, no row",
  );
  expectAbsent(noSites, 'class="site"', "and no empty grid left in its place");
  expect(
    noSites,
    "search-field",
    "while the block around it is untouched",
  );

  topSitesFixture = TOP_SITES;
  await useTopSites().reload();
  expect(
    await renderToString(createSSRApp(WelcomePane)),
    'aria-label="Most visited sites"',
    "and the row comes back when the list does",
  );

  console.log("options entry");
  const { default: OptionsApp } = await server.ssrLoadModule(
    "/src/options/OptionsApp.vue",
  );
  const optionsHtml = await renderToString(createSSRApp(OptionsApp));
  // The settings page is where the other half of the icon set is drawn (docking
  // glyphs), so it gets swept too — one page's icons all coming from MDI would
  // not say much about the other's.
  assertGlyphsAreMdi(optionsHtml, "options");
  expect(optionsHtml, "Settings", "the settings page has a header");
  expect(optionsHtml, "Open bookmarks in a new tab", "general panel renders");
  // Both sections on one page, and the shortcut rows *rendered* rather than only
  // defined: that became assertable the moment the nav stopped paging them
  // behind a click nothing headless can make. Each row is read back through its
  // own `kbd`, which is the half that has to match the mapping.
  expect(optionsHtml, ">General<", "the General section is on the page itself");
  expect(
    optionsHtml,
    ">Shortcuts<",
    "and so is the Shortcuts section — the page no longer pages",
  );
  expectAbsent(optionsHtml, "nav-item", "the nav column is gone with the paging");
  expect(
    optionsHtml,
    "Focus the search bar",
    "a shortcut row renders its description, not just its key",
  );
  expect(
    optionsHtml,
    "Other bookmarks",
    "the Other bookmarks visibility toggle is offered",
  );
  expectAbsent(
    optionsHtml,
    "History items",
    "the history-count slider is gone (history is unbounded now)",
  );
  // The General panel is controls only. Both of these were static `row`s with no
  // control, sitting under the last checkbox: a paragraph saying history has no
  // cap (the absence of a slider already says that), and one explaining how to
  // reach this page (which the settings page cannot act on, and which the
  // browser's own extensions page already says). A row that cannot be changed is
  // a row that will be read as a setting.
  expectAbsent(
    optionsHtml,
    "Extension options",
    "the settings page no longer explains itself instead of holding settings",
  );
  expectAbsent(
    optionsHtml,
    "no item cap to configure",
    "and not by prose that restates the absence of a control either",
  );
  const rows = settingsRows(optionsHtml);
  expectEqual(
    rows.rows > 0 && rows.controls === rows.rows,
    true,
    "every General row carries a control — the panel has no prose-only rows",
  );
  expectEqual(
    rows.labels === rows.rows,
    true,
    "and each row is exactly one name — nothing has grown a second line",
  );
  // The explanatory paragraph under each row is the same species as those two
  // prose-only rows: it described the setting to someone already looking at its
  // control. Asserted as classes rather than by quoting the sentences, so that
  // reworded copy is not what trips this — adding a paragraph back is.
  expectAbsent(
    optionsHtml,
    'class="row-hint"',
    "no settings row carries an explanatory paragraph",
  );
  expectAbsent(
    optionsHtml,
    'class="panel-hint"',
    "and neither section opens with one",
  );
  expect(
    optionsHtml,
    'aria-label="Sidebar position"',
    "the docking side is a setting, not just prose",
  );
  expect(
    optionsHtml,
    'aria-pressed="true"',
    "and one of the two sides is marked as current",
  );
  expectAbsent(
    optionsHtml,
    "Default engine",
    "the engine picker is gone from settings — the engine row on the new tab page owns it",
  );
  expectAbsent(
    optionsHtml,
    "Bing",
    "and the grid of engines went with that section",
  );

  // The rows now render into the page above, but the cross-check still needs the
  // module: a table of shortcuts is prose *about* behaviour, and prose is what
  // goes stale.
  const { SHORTCUTS } = await server.ssrLoadModule("/src/options/shortcuts.ts");
  const shortcutKeys = SHORTCUTS.map((s) => s.keys);
  const shortcutCopy = SHORTCUTS.map((s) => s.label).join(" | ");
  expect(
    shortcutCopy,
    "Focus the search bar",
    "the shortcuts panel documents `/`",
  );
  expect(
    shortcutCopy,
    "Search bookmarks",
    "and `p`, the far side of the same change",
  );
  expectAbsent(
    shortcutCopy,
    "Quick open",
    "Quick open is gone from the list — the palette it described is gone",
  );
  expectAbsent(
    shortcutCopy,
    "palette",
    "and nothing in the list still explains itself in terms of one",
  );
  expectEqual(
    shortcutKeys.join(","),
    "/,p,s,b,h,Esc",
    "the list is those keys and no others",
  );
  expectAbsent(
    shortcutKeys.join(","),
    "Ctrl",
    "and no row needs a modifier — `Ctrl+1`/`Ctrl+2` are the browser's tab keys",
  );

  // The rows are on the page now, so the table is checked against what was
  // actually drawn and not only against itself. Comparing the two lists is what
  // makes a row that renders a stale key — or a seventh row someone added to the
  // template without a binding to match — a failure rather than a mismatch
  // nobody looks for.
  expectEqual(
    shortcutKeysInHtml(optionsHtml).join(","),
    shortcutKeys.join(","),
    "every declared row is rendered, in the order the list declares it",
  );

  // ...and the copy is tied to the keymap rather than to memory. A panel that
  // documents a key the shell does not answer to is the exact failure this
  // table is prone to, and the two halves live in different directories.
  const { resolveShortcut } = await server.ssrLoadModule("/src/core/keymap.ts");
  function bindingFor(keys) {
    if (keys === "Esc") return { key: "Escape", typing: false };
    if ([...keys].length === 1) return { key: keys, typing: false };
    return null;
  }
  for (const row of SHORTCUTS) {
    const input = bindingFor(row.keys);
    // Every row is a keystroke now, so none may be skipped. The old list had one
    // deliberate exception (a mouse gesture, which could not be mapped) and the
    // loop stepped over it; without the exception, a row that cannot be mapped
    // has to fail rather than pass by being ignored.
    expectEqual(
      input !== null,
      true,
      `the panel's “${row.keys}” row is written as something a person can press`,
    );
    if (!input) continue;
    expectEqual(
      resolveShortcut(input) !== null,
      true,
      `the panel's “${row.keys}” row is a key the shell answers to`,
    );
  }

  // The pair above is a source-level check, and it has to be: Escape reaches the
  // shell *through* `SearchField` (which stops propagation), so the binding is a
  // listener on a child component — invisible in SSR output, and there is no
  // browser here to press the key in. What it can still catch is the regression
  // that matters: the emitted `escape` once had no listener at all, which left
  // every bare-key shortcut unreachable on a page whose search box autofocuses.
  const { readFile: readSource } = await import("node:fs/promises");
  const paneSource = await readSource("src/components/welcome/WelcomePane.vue", "utf8");
  const fieldSource = await readSource("src/components/SearchField.vue", "utf8");
  expect(
    paneSource,
    '@escape="leaveField"',
    "the welcome pane listens for the search field's Escape",
  );
  expect(
    paneSource,
    "field.value?.blur()",
    "and what it does with it is hand the keyboard back",
  );
  expect(
    fieldSource,
    "emit(\"escape\")",
    "which the field only emits when it has nothing left to clear",
  );

  // The settings page is a reader as well as a writer: if it did not follow a
  // change made elsewhere, two open tabs would disagree about what is set.
  expectEqual(
    activeDockSide(optionsHtml),
    "left",
    "settings renders the docking side it was loaded with",
  );

  chrome.storage.onChanged.fire(
    { settings: { newValue: { ...DEFAULT_SETTINGS, sidebarPosition: "right" } } },
    "sync",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expectEqual(
    activeDockSide(await renderToString(createSSRApp(OptionsApp))),
    "right",
    "and follows that change when it is made from another tab",
  );

  console.log("a write that did not land");
  // The other half of "the setting doesn't work": the write fails, the control
  // keeps showing the new value, storage keeps the old one, and every other
  // page keeps the old one too. Rolling back is what makes it visible.
  const realConsoleError = console.error;
  console.error = () => {};
  failWrites = true;
  await store.update({ sidebarPosition: "left" });
  failWrites = false;
  console.error = realConsoleError;

  expectEqual(
    store.lastError.value === null,
    false,
    "a failed write is recorded instead of swallowed",
  );
  expectEqual(
    store.settings.value.sidebarPosition,
    "right",
    "and the optimistic value is rolled back to what storage still holds",
  );

  const failedHtml = await renderToString(createSSRApp(OptionsApp));
  expect(
    failedHtml,
    "That change was not saved",
    "the settings page says so rather than pretending",
  );
  expect(failedHtml, 'role="alert"', "as an alert, not a footnote");

  await store.update({ sidebarPosition: "right" });
  expectEqual(store.lastError.value, null, "a later write that lands clears it");
  expectAbsent(
    await renderToString(createSSRApp(OptionsApp)),
    'role="alert"',
    "and the warning is gone from the page",
  );
} finally {
  await server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} render check(s) failed`);
  process.exit(1);
}
console.log("\nall render checks passed");
