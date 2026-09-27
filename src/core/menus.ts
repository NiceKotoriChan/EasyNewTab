/** What a context menu offers, as data — here rather than inline so it can be
 *  pinned without a browser. Only structure gets a menu: a folder row, and the
 *  blank space under the tree (the only way to make a top-level folder). A
 *  bookmark or history row has none — a click opens it and a row button removes
 *  it, so a menu would only be a second way to do both. */

export interface MenuItem {
  label: string;
  /** Passed back to the `onPick` callback of the opening call. */
  action: string;
  danger?: boolean;
}

/** A folder row: make a child, fix its name, remove it. No dividers — three
 *  actions on one folder are one group, not two. */
export function folderMenu(): MenuItem[] {
  return [
    { label: "New", action: "new" },
    { label: "Rename", action: "rename" },
    { label: "Delete", action: "delete", danger: true },
  ];
}

/** The blank space under the tree. */
export function emptyTreeMenu(): MenuItem[] {
  return [{ label: "New", action: "new" }];
}
