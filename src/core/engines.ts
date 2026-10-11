interface SearchEngine {
  readonly id: string;
  readonly name: string;
  readonly searchUrl: string;
}

export const ENGINES = {
  google: {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q=",
  },
  bing: {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q=",
  },
  duckduckgo: {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q=",
  },
  yandex: {
    id: "yandex",
    name: "Yandex",
    searchUrl: "https://yandex.com/search/?text=",
  },
  bilibili: {
    id: "bilibili",
    name: "Bilibili",
    searchUrl: "https://search.bilibili.com/all?keyword=",
  },
  github: {
    id: "github",
    name: "GitHub",
    searchUrl: "https://github.com/search?q=",
  },
} satisfies Record<string, SearchEngine>;

export type EngineId = keyof typeof ENGINES;

export const ENGINE_IDS = Object.keys(ENGINES) as EngineId[];

export const DEFAULT_ENGINE_ID: EngineId = "google";

export function isEngineId(value: unknown): value is EngineId {
  return typeof value === "string" && value in ENGINES;
}

export function buildSearchUrl(engineId: EngineId, query: string): string {
  const engine = ENGINES[engineId] ?? ENGINES[DEFAULT_ENGINE_ID];
  return engine.searchUrl + encodeURIComponent(query);
}

export function looksLikeUrl(str: string): boolean {
  return (
    /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=+#]*)?$/.test(str) &&
    str.includes(".") &&
    !str.includes(" ")
  );
}

export function normalizeUrl(str: string): string {
  return /^https?:\/\//i.test(str) ? str : "https://" + str;
}
