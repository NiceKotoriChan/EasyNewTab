// Renders the pages in their phone shape as 390×844 iframes so a real layout engine evaluates the width media queries headless checks can't.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import {
  createSsrServer,
  installChromeStub,
  setTopSites,
} from "./harness.mjs";

const DIST = "dist";

// iPhone 14/15 logical pixels — the width the narrow end of the adaptation is designed against.
const PHONE = { width: 390, height: 844 };

installChromeStub();
// The phone drops the top-sites row entirely, so the fixture is trimmed rather than arguing over its presence.
setTopSites([]);

const failures = [];
const ok = (label) => console.log(`  ok   ${label}`);
const fail = (label) => {
  failures.push(label);
  console.log(`  FAIL ${label}`);
};

/** Every `data-v-…` the SSR output puts on an element. */
function scopedIdsInMarkup(html) {
  return new Set(
    [...html.matchAll(/\sdata-v-([0-9a-f]{6,8})(?=[\s=>])/g)].map((m) => m[1]),
  );
}

/** Every `data-v-…` the stylesheet is scoped to. */
function scopedIdsInCss(css) {
  return new Set(
    [...css.matchAll(/\[data-v-([0-9a-f]{6,8})\]/g)].map((m) => m[1]),
  );
}

// Drops the `@media (pointer: coarse)` guard so the touch rules (the only part a desktop iframe can't reproduce) stay active; faithful because they only change measurements.
function unwrapCoarsePointer(css) {
  const QUERY = /@media\s*\(\s*pointer\s*:\s*coarse\s*\)\s*\{/;
  let out = css;
  for (;;) {
    const match = QUERY.exec(out);
    if (!match) return out;

    // Brace-match to the block's real end; counting is the only way to be sure, even though nested at-rules don't occur here.
    let depth = 0;
    let end = -1;
    for (let i = match.index + match[0].length - 1; i < out.length; i += 1) {
      const ch = out[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) return out;

    const body = out.slice(match.index + match[0].length, end);
    out = out.slice(0, match.index) + body + out.slice(end + 1);
  }
}

/** HTML-escape a string for use as an attribute value or text node. */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A self-contained document: the shipped CSS, then the server-rendered app. */
function frameDocument({ title, css, markup }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
${unwrapCoarsePointer(css)}
</style>
</head>
<body>
<div id="app">${markup}</div>
</body>
</html>`;
}

/** Read `dist/assets`, split the stylesheets by the entry that owns them. */
async function readBuiltCss() {
  const assets = join(DIST, "assets");
  const files = await readdir(assets);
  const sheets = { base: [], newtab: [], options: [] };
  for (const name of files.filter((f) => f.endsWith(".css")).sort()) {
    const owner = name.startsWith("base-")
      ? "base"
      : name.startsWith("newtab-")
        ? "newtab"
        : name.startsWith("options-")
          ? "options"
          : null;
    if (!owner) {
      fail(`unrecognised stylesheet in ${assets}: ${name}`);
      continue;
    }
    sheets[owner].push(await readFile(join(assets, name), "utf8"));
  }
  for (const [owner, parts] of Object.entries(sheets)) {
    if (parts.length === 0) fail(`no ${owner} stylesheet found in ${assets}`);
  }
  // `base` carries the tokens/resets and must come first so entry sheets can read its custom properties.
  return {
    newtab: [...sheets.base, ...sheets.newtab].join("\n"),
    options: [...sheets.base, ...sheets.options].join("\n"),
  };
}

const server = await createSsrServer();

let pages;
try {
  console.log("render");
  const { usePlatform } = await server.ssrLoadModule(
    "/src/composables/usePlatform.ts",
  );
  const { isCompact, isTouch } = usePlatform();
  // No viewport here: both axes are set directly (what the guardrail does) — the only way to render the phone shape from Node.
  isCompact.value = true;
  isTouch.value = true;

  const { default: NewTabApp } = await server.ssrLoadModule("/src/newtab/App.vue");
  const { default: OptionsApp } = await server.ssrLoadModule(
    "/src/options/OptionsApp.vue",
  );
  const { default: SidePanel } = await server.ssrLoadModule(
    "/src/components/layout/SidePanel.vue",
  );
  const { default: HistoryList } = await server.ssrLoadModule(
    "/src/components/history/HistoryList.vue",
  );

  // App.vue only reads `activeView` in onMounted (which doesn't run here), so driving the history + list components directly is what makes the rows appear.
  const HistoryPanel = {
    render: () =>
      h(SidePanel, { active: "history" }, { default: () => h(HistoryList) }),
  };

  // Stores hydrate async on first render; render once to kick the reads off, let them settle, then render the shape worth capturing (not the Loading… frame).
  await renderToString(createSSRApp(NewTabApp));
  await renderToString(createSSRApp(OptionsApp));
  await renderToString(createSSRApp(HistoryPanel));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const newTabMarkup = await renderToString(createSSRApp(NewTabApp));
  ok("the new tab page renders");
  if (!newTabMarkup.includes("Loading…")) ok("the bookmark tree has finished loading");
  else fail("the sidebar is still showing its loading state — the preview would be a picture of the app booting");

  const optionsMarkup = await renderToString(createSSRApp(OptionsApp));
  ok("the settings page renders");
  if (!optionsMarkup.includes("Loading…")) ok("the settings store has finished loading");
  else fail("the settings page is still showing its loading state");

  const historyMarkup = await renderToString(createSSRApp(HistoryPanel));
  ok("the history panel renders");
  // This snapshot keeps "read-only on every device" visible: a hover-only affordance looks right on desktop and wrong on a phone with no cursor.
  if (!historyMarkup.includes('aria-label="Remove from history"')) ok("with no delete button on any row — the panel is read-only");
  else fail("a history row still carries a delete button");
  if (!historyMarkup.includes('role="menu"')) ok("with no menu rendered alongside them");
  else fail("a context menu is in the history markup");

  // The preview is only worth a look if it really is the phone shape — a silent regression to the desktop shell would be a convincing picture of the wrong thing.
  if (newTabMarkup.includes("is-stacked")) ok("new tab is in the stacked layout");
  else fail("new tab is NOT stacked — the preview would show the desktop shell");
  if (!newTabMarkup.includes('class="sash"')) ok("the divider is gone");
  else fail("the divider is still in the mobile markup");
  if (!optionsMarkup.includes("Shortcuts")) ok("settings drops the shortcut section");
  else fail("settings still renders the shortcut section on touch");
  if (!optionsMarkup.includes(">Layout<")) ok("and the docking section with it — stacked, there is no column to dock into");
  else fail("settings still renders the docking section on a narrow window");

  pages = { newTabMarkup, optionsMarkup, historyMarkup };
} finally {
  await server.close();
}

console.log("stylesheet");
const css = await readBuiltCss();

// The check that justifies this script: SSR and the production build must agree on every scope hash or the page renders unstyled.
for (const [label, markup, sheet] of [
  ["new tab", pages.newTabMarkup, css.newtab],
  ["settings", pages.optionsMarkup, css.options],
  ["history", pages.historyMarkup, css.newtab],
]) {
  const inMarkup = scopedIdsInMarkup(markup);
  const inCss = scopedIdsInCss(sheet);
  const missing = [...inMarkup].filter((id) => !inCss.has(id));
  if (missing.length === 0) {
    ok(`${label}: all ${inMarkup.size} scope hashes resolve against the shipped CSS`);
  } else {
    fail(`${label}: ${missing.length} scope hash(es) in the markup are absent from the CSS: ${missing.join(", ")}`);
  }
}

const frames = [
  {
    id: "newtab",
    label: "新标签页",
    note: "搜索卡片在上、书签/历史在下方；目录行没有删除按钮，书签行才有",
    doc: frameDocument({
      title: "New Tab",
      css: css.newtab,
      markup: pages.newTabMarkup,
    }),
  },
  {
    id: "history",
    label: "历史面板",
    note: "每行一个删除按钮；没有右键菜单，也没有「清空全部历史」",
    doc: frameDocument({
      title: "History",
      css: css.newtab,
      markup: pages.historyMarkup,
    }),
  },
  {
    id: "options",
    label: "设置页",
    note: "只剩「通用」：「布局」跟着窄屏走（堆叠时没有列可停靠），「快捷键」跟着触屏走（没有键盘可按）",
    doc: frameDocument({
      title: "Easy New Tab — Settings",
      css: css.options,
      markup: pages.optionsMarkup,
    }),
  },
];

const gallery = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Easy New Tab — 移动端快照</title>
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body {
    margin: 0;
    padding: 32px 24px 48px;
    background: #eceef2;
    color: #1b1f27;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Roboto, Arial, sans-serif;
  }
  header { max-width: 880px; margin: 0 auto 26px }
  h1 { margin: 0 0 6px; font-size: 19px; font-weight: 600; letter-spacing: -0.2px }
  p.lede { margin: 0; color: #5b6270; max-width: 62ch }
  .stage { display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; align-items: flex-start }
  figure { margin: 0 }
  figcaption { margin: 0 0 9px; display: flex; flex-direction: column; gap: 2px }
  .name { font-weight: 600 }
  .size { color: #8b93a1; font-size: 11.5px }
  .note { color: #5b6270; font-size: 11.5px; max-width: ${PHONE.width}px }
  iframe {
    width: ${PHONE.width}px;
    height: ${PHONE.height}px;
    border: 1px solid #d9dde5;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 10px 30px #10182821, 0 2px 6px #1018280f;
    display: block;
  }
</style>
</head>
<body>
<header>
  <h1>Easy New Tab — 移动端快照</h1>
  <p class="lede">
    下面三帧都是 ${PHONE.width}×${PHONE.height} 的真实视口，内容是把应用组件在服务端渲染成「窄屏 + 触屏」状态后，配真正打包出来的样式表得到的。
    宽度相关的媒体查询由浏览器按 ${PHONE.width}px 正常求值；触屏相关的那几条规则在本页里被强制打开（桌面浏览器无法报告 coarse 指针），
    所以每行的删除按钮在这里是常显的 —— 那正是触屏上的样子。
  </p>
</header>
<div class="stage">
${frames
  .map(
    (frame) => `  <figure>
    <figcaption>
      <span class="name">${frame.label}</span>
      <span class="size">${PHONE.width} × ${PHONE.height} · 触摸</span>
      <span class="note">${frame.note}</span>
    </figcaption>
    <iframe id="frame-${frame.id}" title="${frame.label}" loading="lazy"></iframe>
  </figure>`,
  )
  .join("\n")}
</div>
<script>
  const docs = ${JSON.stringify(
    Object.fromEntries(frames.map((f) => [f.id, f.doc])),
  ).replace(/<\/script/gi, "<\\/script")};
  for (const id of Object.keys(docs)) {
    document.getElementById("frame-" + id).srcdoc = docs[id];
  }
</script>
</body>
</html>
`;

const out = join(DIST, "mobile-preview.html");
await writeFile(out, gallery, "utf8");
console.log(`\n${out}  ${gallery.length} bytes`);

if (failures.length > 0) {
  console.error(`\n${failures.length} preview check(s) failed`);
  process.exit(1);
}
console.log("mobile preview written");
