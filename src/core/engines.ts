/**
 * Search engine table + suggestion fetching + URL detection. Engines are fixed (not user-editable):
 * GitHub has no public suggestion endpoint, so its `suggestUrl` is omitted.
 */

interface SearchEngine {
  readonly id: string;
  readonly name: string;
  readonly searchUrl: string;
  /** Absent for engines with no public suggestion endpoint. */
  readonly suggestUrl?: (query: string) => string;
  readonly parseResponse?: (data: unknown) => string[];
}

const SUGGESTION_LIMIT = 8;

export const ENGINES = {
  google: {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q=",
    suggestUrl: (q: string): string =>
      `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`,
    parseResponse: (data: unknown): string[] =>
      Array.isArray(data) && Array.isArray(data[1])
        ? (data[1] as string[])
        : [],
  },
  bing: {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q=",
    suggestUrl: (q: string): string =>
      `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    parseResponse: (data: unknown): string[] =>
      Array.isArray(data) && Array.isArray(data[1])
        ? (data[1] as string[])
        : [],
  },
  duckduckgo: {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q=",
    suggestUrl: (q: string): string =>
      `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    parseResponse: (data: unknown): string[] => {
      if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
      return (data[1] as unknown[])
        .map((item) =>
          typeof item === "string"
            ? item
            : ((item as { phrase?: string; suggestion?: string })?.phrase ??
              (item as { suggestion?: string })?.suggestion),
        )
        .filter((s): s is string => Boolean(s));
    },
  },
  yandex: {
    id: "yandex",
    name: "Yandex",
    searchUrl: "https://yandex.com/search/?text=",
    suggestUrl: (q: string): string =>
      `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(q)}`,
    parseResponse: (data: unknown): string[] => {
      if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
      return (data[1] as unknown[])
        .map((item) => (typeof item === "string" ? item : (item as string[])[0]))
        .filter((s): s is string => Boolean(s));
    },
  },
  bilibili: {
    id: "bilibili",
    name: "Bilibili",
    searchUrl: "https://search.bilibili.com/all?keyword=",
    suggestUrl: (q: string): string =>
      `https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(q)}`,
    parseResponse: (data: unknown): string[] => {
      const d = data as {
        result?: unknown[];
        data?: { suggest_keyword?: unknown[] };
      } | null;
      const list = d?.result ?? d?.data?.suggest_keyword ?? [];
      return list
        .map((item) =>
          typeof item === "string"
            ? item
            : ((item as { value?: string; tag?: string; term?: string })?.value ??
              (item as { tag?: string })?.tag ??
              (item as { term?: string })?.term),
        )
        .filter((s): s is string => Boolean(s));
    },
  },
  github: {
    id: "github",
    name: "GitHub",
    searchUrl: "https://github.com/search?q=",
    // No public suggestion API — jump-to-search only.
  },
} satisfies Record<string, SearchEngine>;

export type EngineId = keyof typeof ENGINES;

export const ENGINE_IDS = Object.keys(ENGINES) as EngineId[];

export const DEFAULT_ENGINE_ID: EngineId = "google";

export function isEngineId(value: unknown): value is EngineId {
  return typeof value === "string" && value in ENGINES;
}

function getEngine(id: EngineId): SearchEngine {
  return ENGINES[id];
}

export function buildSearchUrl(engineId: EngineId, query: string): string {
  const engine = ENGINES[engineId] ?? ENGINES[DEFAULT_ENGINE_ID];
  return engine.searchUrl + encodeURIComponent(query);
}

/** True when the engine can return suggestions at all. */
export function supportsSuggestions(engineId: EngineId): boolean {
  return typeof getEngine(engineId).suggestUrl === "function";
}

/**
 * Loose URL detector: "has a dot, no spaces, optional scheme". Deliberately
 * permissive so `example.com/x?y=1` navigates instead of searching.
 */
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

// Never caches; an aborted fetch (the next keystroke) is reported as an empty list, not an error.
export async function fetchSuggestions(
  query: string,
  engineId: EngineId,
  signal: AbortSignal,
): Promise<string[]> {
  const engine = getEngine(engineId);
  const trimmed = query.trim();
  if (!engine.suggestUrl || !trimmed) return [];

  try {
    const response = await fetch(engine.suggestUrl(trimmed), { signal });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return (engine.parseResponse?.(data) ?? []).slice(0, SUGGESTION_LIMIT);
  } catch (err) {
    if ((err as { name?: string } | null)?.name === "AbortError") return [];
    console.warn(`Suggestions fetch failed for ${engineId}:`, err);
    return [];
  }
}
