import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Extension pages are served from chrome-extension://<id>/. Vite's default
  // absolute asset paths (/assets/x.js) resolve to the extension root and 404,
  // which shows up as a blank page with a single failed request.
  base: "./",

  plugins: [
    vue(),
    // Icons come from Iconify's MDI set, resolved at *build* time from the
    // offline `@iconify-json/mdi` package — `~icons/mdi/folder-outline` becomes
    // an inline SVG component, so exactly the icons that are imported ship, and
    // nothing is fetched at runtime. That matters twice over here: the new tab
    // page has no network permission to speak of, and `script-src 'self'` would
    // block any remote icon API. `autoInstall: false` keeps the build from
    // silently reaching for a set that is not in package.json.
    Icons({ compiler: "vue3", autoInstall: false }),
  ],

  resolve: {
    alias: { "@": resolve("./src") },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Minimum supported Chrome. No legacy transpilation beyond what Chrome
    // already understands.
    target: "chrome114",
    // Vite injects an INLINE modulepreload polyfill into every HTML entry.
    // MV3's `script-src 'self'` rejects inline scripts, so that snippet would
    // be blocked. Modern Chrome supports modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        newtab: resolve("./newtab.html"),
        options: resolve("./options.html"),
      },
    },
  },

  define: {
    // SFC + render functions only — the Options API is never used.
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
  },
});
