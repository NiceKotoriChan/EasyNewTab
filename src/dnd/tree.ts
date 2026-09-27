/**
 * Drag & drop for the bookmark tree — the only module that speaks
 * `@atlaskit/pragmatic-drag-and-drop`. Everything around it keeps calling
 * `computeDropPosition` / `computeMoveTarget` from `core/`, so the zone model
 * stays a tested pure function and the library stays replaceable.
 *
 * The library earns its place on three things HTML5 drag & drop cannot do: a
 * drag image you can offset (`setCustomNativeDragPreview`), autoscrolling an
 * inner `overflow: auto` list, and knowing which row the pointer is actually on
 * when rows are nested (`dropTargetForElements` maintains that stack; the
 * hand-rolled version re-derived it from `event.target.closest(".row")`).
 * `canDrop()` also gives a row a supported way to refuse a drop, and
 * `dropEffect: none` keeps the cursor agreeing with the highlight.
 *
 * Left to the browser on purpose: how far the pointer must move before a drag
 * starts. Imposing our own threshold on top of the browser's does not fix a
 * twitchy click — it turns it into "the drag was cancelled and the click did not
 * fire either", which is strictly worse.
 */
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

/** Rest this long on a collapsed folder row and it opens, so a drop into a
 *  nested folder is one gesture instead of three. */
const DWELL_MS = 600;

/**
 * What every row carries, both as a drag source and as a drop target.
 *
 * The index signature is not decoration: the library types its payloads as an
 * open bag of `unknown`, and a closed interface is not assignable to that. It
 * costs nothing — `id` and `kind` keep their own types — and it keeps the two
 * keys this app relies on named in one place.
 */
interface RowDragData {
  id: string;
  kind: NodeKind;
  [key: string]: unknown;
  [key: symbol]: unknown;
}

/** Where the pointer is, once it has been resolved to a single row. */
export interface RowHover {
  position: DropPosition;
  /** The row's box, so the caller can draw the indicator without re-querying. */
  rect: DOMRect;
}

/**
 * Everything a row has to tell the tree. Read lazily through functions rather
 * than captured by value: the node object behind a row is replaced on every
 * reload, and the registration outlives it.
 */
export interface RowRegistration {
  data: () => RowDragData;
  /** False while this row is the dragged node itself or lives in its subtree. */
  canDrop: () => boolean;
  /** A collapsed folder with children — the only row worth spring-loading open. */
  canExpand: () => boolean;
  onHover: (hover: RowHover) => void;
  /** The pointer is no longer on this row. */
  onLeave: () => void;
  /** Dwelt on a collapsed folder long enough to open it. */
  onDwell: () => void;
  /**
   * Whether the drag that brought the pointer here is still running. Checked
   * just before spring-loading, and it has to be: hover a collapsed folder at
   * 500ms and release the mouse — the timer set on entry is still pending, and
   * without this it would fire 100ms after the drop and open a folder nobody is
   * dragging into any more. The tree answers it; rows never need to.
   */
  isDragging?: () => boolean;
  onDragStart: () => void;
  /** The drag finished, however it finished. */
  onDragEnd: () => void;
}

function readKind(data: Record<string | symbol, unknown>): NodeKind {
  return data.kind === "folder" ? "folder" : "bookmark";
}

function textId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The drop zone the pointer is in, resolved against one row's box. */
function zoneAt(
  element: Element,
  kind: NodeKind,
  clientY: number,
): RowHover {
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

/**
 * True when `element` is the innermost active drop target.
 *
 * Rows are nested — a bookmark inside "Dev" is a drop target whose parent
 * folder row is also one — and every active target receives every callback. The
 * stack is bubble-ordered, innermost first, so the top of it is the row the
 * pointer is actually on. Without this check the parent and the child would
 * both claim the indicator on the same event and it would flicker between them.
 */
function isInnermost(
  element: Element,
  dropTargets: readonly { element: Element }[],
): boolean {
  return dropTargets[0]?.element === element;
}

/**
 * Make one row draggable and droppable. Returns a combined cleanup.
 *
 * Despite the name this is one call on purpose: a row that can be picked up but
 * not dropped on, or the reverse, is never what the tree wants, and splitting
 * the registration would only let the two drift apart.
 */
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
        // Null in browsers that will not let us supply one; the default bitmap
        // is an acceptable fallback rather than a reason to skip the drag.
        if (!nativeSetDragImage) return;

        setCustomNativeDragPreview({
          nativeSetDragImage,
          // Grab point: a little in from the row's left edge, vertically
          // centred. The default anchors the preview's top-left corner to the
          // pointer, which reads as if the row were hanging off the cursor.
          getOffset: ({ container }) => ({
            x: 16,
            y: container.getBoundingClientRect().height / 2,
          }),
          render: ({ container }) => {
            // Clone the row rather than rebuilding it: the preview then matches
            // the row in both themes, at its own depth, with its own icon and
            // favicon, and stays correct if the row's markup changes.
            // `onDragStart` has not run yet, so the clone is not dimmed.
            const ghost = el.cloneNode(true) as HTMLElement;
            ghost.classList.remove("dragging");
            ghost.classList.add("drag-ghost");
            ghost.removeAttribute("data-node-id");
            // `.row` is stretched by the sidebar it lives in. On its own it
            // would stretch to the width of the page instead.
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
  /** The scrollable list, used to tell "the empty area" from "outside the panel". */
  container: () => HTMLElement | null;
  /** Commit a drop that landed on a row. */
  onMove: (dragId: string, targetId: string, position: DropPosition) => void;
  /** Dropped in the blank space below the last row: send it to the end of the list. */
  onAppend: (dragId: string) => void;
  /** The drag is over, however it ended. Drop every transient bit of state. */
  onFinish: () => void;
}

/**
 * The blank space under the tree — and *only* under it. A drop in the gap
 * between two rows lands on no target either, but treating that near-miss as
 * "append to the end" would move something the user never aimed at.
 */
function isBelowLastRow(container: HTMLElement | null, clientY: number): boolean {
  if (!container) return false;
  const box = container.getBoundingClientRect();
  if (clientY < box.top || clientY > box.bottom) return false;
  const rows = container.querySelectorAll("[data-node-id]");
  const last = rows[rows.length - 1];
  return last ? clientY > last.getBoundingClientRect().bottom : false;
}

/**
 * One watcher per tree, owning the entire commit path.
 *
 * Deliberately *not* implemented as `onDrop` on each row. When rows are nested
 * the child and its parent folder both receive `onDrop`, the order between them
 * and this monitor is not a documented guarantee, and rows would each have to
 * defend against acting twice on the same drop. Here there is exactly one
 * decision, made from the final pointer position, and the geometry is
 * recomputed rather than reused: `onDrag` is throttled, so the last hover
 * update can be a frame or two stale — enough to pick the wrong third of a row.
 */
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

/**
 * Scroll the list when the pointer is dragged near the top or bottom.
 *
 * The trigger zone is the library's tuned default — `min(25% of the height,
 * 180px)` at each end, with a 400ms dampening window and a speed ramp that
 * starts at zero, so passing quickly near an edge does not yank the list. Only
 * the axis is pinned: `.scroll` is `overflow-x: hidden`, so a horizontal
 * autoscroll would have nothing to do but could still be engaged.
 */
function makeTreeAutoScroll(el: HTMLElement): Cleanup {
  return autoScrollForElements({
    element: el,
    getAllowedAxis: () => "vertical",
  });
}

/** Everything a mounted tree needs: autoscroll on the list, one commit path. */
export function watchTree(el: HTMLElement, opts: DragWatchOptions): Cleanup {
  return combine(makeTreeAutoScroll(el), watchDrag(opts));
}
