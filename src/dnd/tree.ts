// Bookmark-tree drag & drop via @atlaskit/pragmatic-drag-and-drop: offsettable preview, inner-list autoscroll, and the nested drop-target stack HTML5 DnD can't do.
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/utils/combine";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview";
import { computeDropPosition, type DropPosition, type NodeKind } from "@/core/bookmarks";

export type Cleanup = () => void;

// Dwell on a collapsed folder to spring it open, so a drop into a nested folder is one gesture.
const DWELL_MS = 600;

// Index signature required: the library payloads are an open bag of `unknown`.
interface RowDragData {
  id: string;
  kind: NodeKind;
  [key: string]: unknown;
  [key: symbol]: unknown;
}

export interface RowHover {
  position: DropPosition;
  /** The row's box, so the caller can draw the indicator without re-querying. */
  rect: DOMRect;
}

// Read lazily: the node behind a row is replaced on reload, the registration outlives it.
export interface RowRegistration {
  data: () => RowDragData;
  // False for the dragged row and its subtree.
  canDrop: () => boolean;
  // Only a collapsed folder with children is worth spring-loading open.
  canExpand: () => boolean;
  onHover: (hover: RowHover) => void;
  onLeave: () => void;
  onDwell: () => void;
  // Checked before spring-loading: releasing the mouse first would open a folder nobody is dragging into.
  isDragging?: () => boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function readKind(data: Record<string | symbol, unknown>): NodeKind {
  return data.kind === "folder" ? "folder" : "bookmark";
}

function textId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function zoneAt(element: Element, kind: NodeKind, clientY: number): RowHover {
  const rect = element.getBoundingClientRect();
  return {
    rect,
    position: computeDropPosition({
      kind,
      top: rect.top,
      height: rect.height,
      cursorY: clientY,
    }),
  };
}

// The drop-target stack is innermost-first; without this check both a row and its parent would claim the indicator.
function isInnermost(
  element: Element,
  dropTargets: readonly { element: Element }[],
): boolean {
  return dropTargets[0]?.element === element;
}

// Each row is draggable and droppable: the tree never wants a one-way row.
export function wireRow(el: HTMLElement, reg: RowRegistration): Cleanup {
  let dwell: ReturnType<typeof setTimeout> | null = null;

  const stopDwell = (): void => {
    if (dwell !== null) {
      clearTimeout(dwell);
      dwell = null;
    }
  };

  return combine(
    draggable({
      element: el,
      getInitialData: reg.data,

      onGenerateDragPreview({ nativeSetDragImage }) {
        // Null where the browser forbids a custom preview; the default bitmap is fine.
        if (!nativeSetDragImage) return;

        setCustomNativeDragPreview({
          nativeSetDragImage,
          // Offset in from the left and vertically centred; the default anchors top-left to the pointer.
          getOffset: ({ container }) => ({
            x: 16,
            y: container.getBoundingClientRect().height / 2,
          }),
          render: ({ container }) => {
            // Clone rather than rebuild, so the preview keeps the row's depth, icon and favicon.
            const ghost = el.cloneNode(true) as HTMLElement;
            ghost.classList.remove("dragging");
            ghost.classList.add("drag-ghost");
            ghost.removeAttribute("data-node-id");
            // `.row` stretches inside the sidebar; alone it would stretch to the page width.
            ghost.style.margin = "0";
            ghost.style.width = `${el.getBoundingClientRect().width}px`;
            container.appendChild(ghost);
            return () => ghost.remove();
          },
        });
      },

      onDragStart: reg.onDragStart,
      onDrop: reg.onDragEnd,
    }),

    dropTargetForElements({
      element: el,
      getData: reg.data,
      canDrop: () => reg.canDrop(),

      onDrag({ location, self }) {
        if (!isInnermost(self.element, location.current.dropTargets)) return;
        const data = reg.data();
        reg.onHover(zoneAt(el, data.kind, location.current.input.clientY));
      },

      onDragEnter({ location, self }) {
        if (!isInnermost(self.element, location.current.dropTargets)) return;
        if (!reg.canExpand()) return;
        stopDwell();
        dwell = setTimeout(() => {
          dwell = null;
          if (reg.isDragging && !reg.isDragging()) return;
          reg.onDwell();
        }, DWELL_MS);
      },

      onDragLeave() {
        stopDwell();
        reg.onLeave();
      },
    }),
  );
}

interface DragWatchOptions {
  /** The scrollable list, for telling "the empty area" from "outside the panel". */
  container: () => HTMLElement | null;
  onMove: (dragId: string, targetId: string, position: DropPosition) => void;
  /** Dropped in the blank space below the last row. */
  onAppend: (dragId: string) => void;
  onFinish: () => void;
}

// Only the blank space *under* the tree: a gap between rows is a near-miss, not an "append".
function isBelowLastRow(container: HTMLElement | null, clientY: number): boolean {
  if (!container) return false;
  const box = container.getBoundingClientRect();
  if (clientY < box.top || clientY > box.bottom) return false;
  const rows = container.querySelectorAll("[data-node-id]");
  const last = rows[rows.length - 1];
  return last ? clientY > last.getBoundingClientRect().bottom : false;
}

// One watcher per tree, not an onDrop per row: nested rows both fire onDrop in undocumented order, and the geometry is recomputed because onDrag is throttled.
function watchDrag(opts: DragWatchOptions): Cleanup {
  return monitorForElements({
    onDrop({ source, location }) {
      const { clientY } = location.current.input;
      const dragId = textId(source.data.id);
      const deepest = location.current.dropTargets[0];

      if (dragId) {
        if (deepest) {
          const targetId = textId(deepest.data.id);
          if (targetId) {
            const data = deepest.data;
            const { position } = zoneAt(deepest.element, readKind(data), clientY);
            opts.onMove(dragId, targetId, position);
          }
        } else if (isBelowLastRow(opts.container(), clientY)) {
          opts.onAppend(dragId);
        }
      }

      opts.onFinish();
    },
  });
}

// Pin to vertical: `.scroll` is `overflow-x: hidden`, so horizontal autoscroll would be a no-op that still engages.
function makeTreeAutoScroll(el: HTMLElement): Cleanup {
  return autoScrollForElements({
    element: el,
    getAllowedAxis: () => "vertical",
  });
}

export function watchTree(el: HTMLElement, opts: DragWatchOptions): Cleanup {
  return combine(makeTreeAutoScroll(el), watchDrag(opts));
}
