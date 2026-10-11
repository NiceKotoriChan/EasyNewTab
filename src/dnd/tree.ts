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

const DWELL_MS = 600;

interface RowDragData {
  id: string;
  kind: NodeKind;
  [key: string]: unknown;
  [key: symbol]: unknown;
}

export interface RowHover {
  position: DropPosition;
  rect: DOMRect;
}

export interface RowRegistration {
  data: () => RowDragData;
  canDrop: () => boolean;
  canExpand: () => boolean;
  onHover: (hover: RowHover) => void;
  onLeave: () => void;
  onDwell: () => void;
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

function isInnermost(
  element: Element,
  dropTargets: readonly { element: Element }[],
): boolean {
  return dropTargets[0]?.element === element;
}

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
        if (!nativeSetDragImage) return;

        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: ({ container }) => ({
            x: 16,
            y: container.getBoundingClientRect().height / 2,
          }),
          render: ({ container }) => {
            const ghost = el.cloneNode(true) as HTMLElement;
            ghost.classList.remove("dragging");
            ghost.classList.add("drag-ghost");
            ghost.removeAttribute("data-node-id");
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
  container: () => HTMLElement | null;
  onMove: (dragId: string, targetId: string, position: DropPosition) => void;
  onAppend: (dragId: string) => void;
  onFinish: () => void;
}

function isBelowLastRow(container: HTMLElement | null, clientY: number): boolean {
  if (!container) return false;
  const box = container.getBoundingClientRect();
  if (clientY < box.top || clientY > box.bottom) return false;
  const rows = container.querySelectorAll("[data-node-id]");
  const last = rows[rows.length - 1];
  return last ? clientY > last.getBoundingClientRect().bottom : false;
}

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

function makeTreeAutoScroll(el: HTMLElement): Cleanup {
  return autoScrollForElements({
    element: el,
    getAllowedAxis: () => "vertical",
  });
}

export function watchTree(el: HTMLElement, opts: DragWatchOptions): Cleanup {
  return combine(makeTreeAutoScroll(el), watchDrag(opts));
}
