/**
 * Shared harness for the scripts that stand in for a browser.
 *
 * Two scripts render the extension outside Chrome: `render-check.mjs`, which asserts on
 * what comes out, and `mobile-preview.mjs`, which saves it as a page you can look at.
 * Both need the same three things — a `chrome.*` surface that answers like the real one,
 * fixtures that trip the interesting edges, and a Vite server that compiles the actual
 * SFCs — and keeping them here means the two cannot drift.
 *
 * The stub is deliberately shallow. It answers; it does not model. What a browser does
 * with a bookmark tree, a storage quota or a `pointer: coarse` media query is not
 * reproducible in a Node process, so nothing here pretends to try.
 */

import { createServer } from "vite";

const noop = () => {};

/**
 * Event stubs that keep their listeners, so a caller can *fire* a change
 * instead of only proving a listener could be attached. `chrome.storage`'s
 * change event is the one subscription whose reaction is worth exercising
 * end-to-end: a preference flipped in the options page has to reach the
 * bookmark tree without another `getTree()` round-trip.
 */
function makeEvent() {
  const listeners = [];
  return {
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    fire: (...args) => listeners.forEach((fn) => fn(...args)),
  };
}

/**
 * A tree with the shapes that change how a row renders: a folder with a child,
 * a leaf, and an empty folder. The two top-level entries matter separately —
 * "Other bookmarks" is the one the settings toggle can hide.
 */
export const BOOKMARK_TREE = [
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
 * Deliberately more than the row can show: twelve entries carrying a repeat
 * host, a `chrome://` page, a malformed URL, an entry with no title, and one
 * site too many for the cap. Every rule `selectTopSites` applies has an entry
 * here that trips it, so the row a script sees is the row a real profile would
 * produce.
 */
export const TOP_SITES = [
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

// The two answers that are mutable mid-run. They are `let` behind setters
// rather than exported bindings because an ES module export is read-only to its
// importers, and both scripts flip them: one to see what the row does with
// nothing to show, the other to drive the storage-quota failure path.
let topSitesFixture = TOP_SITES;
let failWrites = false;

/** Answer the next `topSites.get` with `sites`. Pass `TOP_SITES` to restore. */
export function setTopSites(sites) {
  topSitesFixture = sites;
}

/** Make every subsequent `storage.sync.set` reject, as a quota overrun would. */
export function setFailWrites(value) {
  failWrites = value;
}

/**
 * The `chrome.*` surface both scripts render against.
 *
 * One object rather than a fresh one per call so a caller can swap a single
 * method out mid-run and put it back — the settings check does exactly that, to
 * prove a read that resolves late cannot roll back a change that beat it.
 */
const chromeApi = {
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

/** Put `chromeApi` on the global, and hand it back so a caller can fire events. */
export function installChromeStub() {
  globalThis.chrome = chromeApi;
  return chromeApi;
}

/**
 * A Vite dev server that compiles the real SFCs and resolves the real aliases.
 *
 * `middlewareMode` keeps it off the network — nothing is served and no port is
 * bound, the module graph is just used through `ssrLoadModule`. The plugin set
 * (and, importantly, `features.componentIdGenerator`) comes from
 * `vite.config.ts`, which is what keeps the scope hashes in this pipeline equal
 * to the ones in a production build.
 */
export async function createSsrServer(overrides = {}) {
  return createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
    ...overrides,
  });
}
