/** Tab strip: one tab per open document, shown whenever any document is open
 *  (including on the library screen, so open documents stay reachable).
 *
 *  Reordering is pointer-based rather than HTML5 drag-and-drop: Tauri's
 *  native drag-drop handler — needed for dropping PDF files onto the window —
 *  consumes WebView2's drag events, so `draggable` would never fire here.
 *  Tabs swap slots live during the drag; every tab shares one width, so the
 *  slot size measured off the grabbed tab holds for the whole strip.
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Close, Plus } from "./Icons";

export interface TabInfo {
  docId: string;
  title: string;
}

/** Horizontal gap between tabs — must match the CSS `gap` on .tab-strip. */
const TAB_GAP = 4;
/** Pointer travel (px) before a press turns into a drag instead of a click. */
const DRAG_THRESHOLD = 5;

export function TabStrip(props: {
  tabs: TabInfo[];
  activeId: string | null;
  onSelect: (docId: string) => void;
  onClose: (docId: string) => void;
  onMove: (from: number, to: number) => void;
  /** The "+" button: show the library to pick the next document. */
  onNewTab: () => void;
}) {
  // The lifted tab and its visual offset from its current slot. Because the
  // strip reorders live, the offset is rebased whenever the tab changes slots
  // so the lifted tab never jumps under the pointer.
  const [drag, setDrag] = useState<{ docId: string; dx: number } | null>(null);
  const gesture = useRef<{
    docId: string;
    index: number;
    originX: number; // pointer x where dx = 0 for the tab's current slot
    slot: number; // width of one tab slot (tab width + gap)
    moved: boolean;
  } | null>(null);

  const down =
    (docId: string, index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      props.onSelect(docId); // select on press, like browser tabs
      gesture.current = {
        docId,
        index,
        originX: e.clientX,
        slot: e.currentTarget.offsetWidth + TAB_GAP,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.originX;
    if (!g.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    g.moved = true;
    // Swap slots once the tab is dragged more than half a slot over.
    const target = Math.min(
      Math.max(g.index + Math.round(dx / g.slot), 0),
      props.tabs.length - 1,
    );
    if (target !== g.index) {
      props.onMove(g.index, target);
      g.originX += (target - g.index) * g.slot;
      g.index = target;
    }
    // The strip's ends are hard stops, as in a browser.
    const clamped = Math.min(
      Math.max(e.clientX - g.originX, -g.index * g.slot),
      (props.tabs.length - 1 - g.index) * g.slot,
    );
    setDrag({ docId: g.docId, dx: clamped });
  };

  const up = () => {
    gesture.current = null;
    setDrag(null);
  };

  return (
    <div className="tab-strip" role="tablist">
      {props.tabs.map((tab, i) => {
        const dragging = drag?.docId === tab.docId;
        return (
          <div
            key={tab.docId}
            role="tab"
            aria-selected={tab.docId === props.activeId}
            tabIndex={0}
            className={`tab ${tab.docId === props.activeId ? "active" : ""} ${dragging ? "dragging" : ""}`}
            style={dragging ? { transform: `translateX(${drag.dx}px)` } : undefined}
            title={tab.title}
            onPointerDown={down(tab.docId, i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") props.onSelect(tab.docId);
            }}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              title="Close tab"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => props.onClose(tab.docId)}
            >
              <Close width={11} height={11} />
            </button>
          </div>
        );
      })}
      <button
        className="tab-new"
        title="New tab — open another document"
        onClick={props.onNewTab}
      >
        <Plus width={13} height={13} />
      </button>
    </div>
  );
}
