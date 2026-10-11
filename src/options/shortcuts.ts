interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: "/", label: "Focus the search bar" },
  { keys: "s", label: "Show or hide the side panels" },
  { keys: "b", label: "Open the bookmarks panel" },
  { keys: "h", label: "Open the history panel" },
];
