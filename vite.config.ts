import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: "./",

  plugins: [
    vue({ features: { componentIdGenerator: "filepath-source" } }),
    Icons({ compiler: "vue3", autoInstall: false }),
  ],

  resolve: {
    alias: { "@": resolve("./src") },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome114",
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        newtab: resolve("./newtab.html"),
        options: resolve("./options.html"),
      },
    },
  },

  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
  },
});
