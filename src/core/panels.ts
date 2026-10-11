export type SidePaneId = "bookmarks" | "history";

export type PanelId = SidePaneId | "search";

export type SideOrder = "bookmarks-left" | "history-left";

export type ShellShape = "dock" | "page";

export const CENTRE_SLOT = 1;

function panelSlots(order: SideOrder): [SidePaneId, PanelId, SidePaneId] {
  return order === "history-left"
    ? ["history", "search", "bookmarks"]
    : ["bookmarks", "search", "history"];
}

export function panelSides(order: SideOrder): {
  left: SidePaneId;
  right: SidePaneId;
} {
  const [left, , right] = panelSlots(order);
  return { left, right };
}

export function shellShape(isCompact: boolean): ShellShape {
  return isCompact ? "page" : "dock";
}

export type ShellHandle = {
  focusPanel(panel: SidePaneId): void;
  toggle(): void;
  focusSearch(): void;
};
