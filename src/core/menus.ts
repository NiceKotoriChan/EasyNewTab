export interface MenuItem {
  label: string;
  action: string;
  danger?: boolean;
}

export function folderMenu(): MenuItem[] {
  return [
    { label: "New", action: "new" },
    { label: "Rename", action: "rename" },
    { label: "Delete", action: "delete", danger: true },
  ];
}

export function emptyTreeMenu(): MenuItem[] {
  return [{ label: "New", action: "new" }];
}
