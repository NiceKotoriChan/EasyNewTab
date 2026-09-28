// Shared chrome stub + fixtures + Vite server for render-check and mobile-preview, so the two can't drift; the stub answers, it doesn't model.

import { createServer } from "vite";

const noop = () => {};

// Keeps its listeners so a caller can *fire* a change — a preference flip must reach the tree without another `getTree()` round-trip.
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

// Covers the row shapes that change rendering (folder w/ child, leaf, nested leaf, empty folder); "Other bookmarks" is toggled separately.
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

// Ten rows: what a real profile tends to answer with, and more than the cap, so "the cap cut
// something" stays visible. Row 2 is a second page of row 1's host, which is a real profile's shape,
// and row 3 has a blank title, which is what Chrome actually sends.
export const TOP_SITES = [
  { url: "https://github.com/", title: "GitHub" },
  { url: "https://github.com/explore", title: "Explore GitHub" },
  { url: "https://mail.google.com/mail/u/0/", title: "   " },
  { url: "https://news.ycombinator.com/", title: "Hacker News" },
  { url: "https://vuejs.org/", title: "Vue" },
  { url: "https://developer.mozilla.org/en-US/", title: "MDN Web Docs" },
  { url: "https://stackoverflow.com/", title: "Stack Overflow" },
  { url: "https://www.zhihu.com/", title: "知乎" },
  { url: "https://bilibili.com/", title: "bilibili" },
  { url: "https://rust-lang.org/", title: "Rust" },
];

// Generated (250 rows) so the cap can be asserted as "drew what the setting asked for" against a setting, not a constant.
export const HISTORY_ITEMS = Array.from({ length: 250 }, (_, i) => ({
  id: `h${i + 1}`,
  url: `https://example.com/${i + 1}`,
  title: `Example ${i + 1}`,
  lastVisitTime: Date.now() - i * 60_000,
  visitCount: 1,
  typedCount: 0,
}));

// Mutable mid-run answers live behind setters because ES module exports are read-only to importers.
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

// One object (not per-call) so a caller can swap a single method mid-run and restore it — the settings check does.
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
    // Answers the query it is handed; a fixed row would let "cap applied" pass while no `maxResults` was sent. Default 100.
    search: async (query = {}) => {
      const from = query.startTime ?? 0;
      const limit = query.maxResults ?? 100;
      return HISTORY_ITEMS.filter((item) => item.lastVisitTime >= from).slice(
        0,
        limit,
      );
    },
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

// Vite dev server in `middlewareMode` (no port) compiling the real SFCs, so its scope hashes match a real build's.
export async function createSsrServer(overrides = {}) {
  return createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
    ...overrides,
  });
}
