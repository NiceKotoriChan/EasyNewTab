/** The panels, the order they sit in, and the three shapes the shell can hold them in. */

/** The two panels that can sit beside the centre. */
export type SidePaneId = "bookmarks" | "history";

/** Every panel there is. The centre is always the search pane, so it has no side to swap to. */
export type PanelId = SidePaneId | "search";

/** Which side panel sits left of the centre. */
export type SideOrder = "bookmarks-left" | "history-left";

/** The wide window's choice. A narrow one has none — see `shellShape`. */
export type PanelMode = "docked" | "hover";

/** How the shell holds its three panels. */
export type ShellShape = "dock" | "hover" | "page";

/** The centre's index in the slot list. */
export const CENTRE_SLOT = 1;

/** The three slots, left to right. The centre is the only fixed one. */
function panelSlots(order: SideOrder): [SidePaneId, PanelId, SidePaneId] {
  return order === "history-left"
    ? ["history", "search", "bookmarks"]
    : ["bookmarks", "search", "history"];
}

/** The window's two sides. The shells take these rather than the order itself, so the one setting
 *  that swaps the panels is read in a single place and no shape has to know which panel it holds. */
export function panelSides(order: SideOrder): {
  left: SidePaneId;
  right: SidePaneId;
} {
  const [left, , right] = panelSlots(order);
  return { left, right };
}

/** Only the wide window has a say: below the breakpoint there is one panel's worth of room, so it
 *  pages and the setting is ignored. */
export function shellShape(isCompact: boolean, mode: PanelMode): ShellShape {
  if (isCompact) return "page";
  return mode === "hover" ? "hover" : "dock";
}

/** What the keyboard asks of whichever shape is mounted. Each shell answers in its own terms — the
 *  docked one expands its columns, the hover one pins a layer, the paged one slides to a screen —
 *  so the shortcuts never branch on the shape. A shape that has nothing to bring back makes
 *  `toggle` one-way. */
export type ShellHandle = {
  /** Put the caret in a side panel's search box, showing the panel first if this shape is hiding it.
   *  The panel itself says where the box is (see `usePanelSearch`); the shell only has to make it
   *  visible, which is the part only the shell knows how to do. */
  focusPanel(panel: SidePaneId): void;
  /** "Put the panels away." */
  toggle(): void;
  focusSearch(): void;
};
