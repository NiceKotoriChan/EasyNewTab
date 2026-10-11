type ShortcutAction =
  | "toggle-panels"
  | "focus-bookmarks"
  | "focus-history"
  | "focus-search"
  | null;

interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  typing: boolean;
}

export function resolveShortcut(event: KeyEventLike): ShortcutAction {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key.toLowerCase();

  if (mod || event.typing) return null;

  if (event.key === "/") return "focus-search";
  if (key === "s") return "toggle-panels";
  if (key === "b") return "focus-bookmarks";
  if (key === "h") return "focus-history";
  return null;
}
