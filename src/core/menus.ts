/**
 * What a context menu offers, as data.
 *
 * Here rather than inline in the panels for the same reason `SHORTCUTS` lives
 * in its own module: the list is a statement about what the app can do, and it
 * is worth being able to pin without a browser, an event or a right-click.
 *
 * Only two things in the app have a menu at all, and both are about keeping the
 * tree's *structure*: a folder row, and the blank space under the tree. Nothing
 * else gets one —
 *
 * - A bookmark row: a click already opens it and the row's own button already
 *   deletes it. A menu would only be a second way to do those two things, and
 *   the second way is the one that has to be discovered.
 * - A history row: a click opens it, a button removes it. Same argument, and
 *   it is also why there is no "clear all" — the panel is a list to read and
 *   prune, not a place to run maintenance from.
 */

export interface MenuItem {
  label: string;
  /** Passed back to the `onPick` callback of the opening call. */
  action: string;
  danger?: boolean;
}

/**
 * A folder row.
 *
 * Ordered the way the work happens — make a child, fix its name, remove it.
 * Deliberately without dividers: three related actions on one folder are one
 * group, and a rule drawn between them would be decoration rather than a
 * boundary.
 */
export function folderMenu(): MenuItem[] {
  return [
    { label: "New folder", action: "new-folder" },
    { label: "Rename", action: "rename" },
    { label: "Delete", action: "delete", danger: true },
  ];
}

/** The blank space under the tree, which is where a top-level folder is made. */
export function emptyTreeMenu(): MenuItem[] {
  return [{ label: "New folder", action: "new-folder" }];
}
