/**
 * What the two context menus offer, as data.
 *
 * Here rather than inline in the panels for the same reason `SHORTCUTS` lives
 * in its own module: the list is a statement about what the app can do, and the
 * one input that changes it — whether a touchscreen is looking at it — is worth
 * being able to pin without a browser, an event or a right-click.
 *
 * The rule that varies is the detail view. It replaces the search box in the
 * main area, and that is a real place only while the two sheets sit side by
 * side. On a touchscreen the shell stacks them, the search box *is* the card,
 * and a detail view would have nowhere to go — so the entry is left out rather
 * than offered and then not delivered.
 */

export interface MenuItem {
  label: string;
  /** Passed back to the `onPick` callback of the opening call. */
  action: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separatorBefore?: boolean;
}

export interface MenuOptions {
  /**
   * Whether the reader has a place for the detail editor. False on a
   * touchscreen; true everywhere else, including a narrow desktop window, where
   * the stacked shell still has a main area to swap.
   */
  showDetails: boolean;
}

/**
 * A bookmark or folder row.
 *
 * Folders get "New folder" where bookmarks get "Open": a folder row's click
 * already folds it, so the one thing a folder cannot do from a click is hold a
 * new child.
 */
export function bookmarkMenu(
  node: { folder: boolean },
  { showDetails }: MenuOptions,
): MenuItem[] {
  return [
    node.folder
      ? { label: "New folder", action: "new-folder" }
      : { label: "Open", action: "open" },
    // The only action here that a click cannot reach.
    ...(showDetails
      ? [{ label: "Edit details", action: "details" as const }]
      : []),
    { label: "Rename", action: "rename" },
    // Offered for folders as well as bookmarks: `removeTree` is the folder
    // case, and it goes through the confirmation dialog like everything else.
    // The row's own hover button is the one that stops at bookmarks.
    { label: "Delete", action: "delete", danger: true, separatorBefore: true },
  ];
}

/** One history entry. Read-only apart from open and remove. */
export function historyMenu({ showDetails }: MenuOptions): MenuItem[] {
  return [
    { label: "Open", action: "open" },
    ...(showDetails ? [{ label: "Details", action: "details" as const }] : []),
    {
      label: "Remove from history",
      action: "remove",
      danger: true,
      separatorBefore: true,
    },
  ];
}

/** The blank space under the bookmark tree, which is where a top-level folder is made. */
export function emptyTreeMenu(): MenuItem[] {
  return [{ label: "New folder", action: "new-folder" }];
}

/** The blank space under the history list. */
export function emptyHistoryMenu(): MenuItem[] {
  return [
    { label: "Clear all history…", action: "clear", danger: true },
  ];
}
