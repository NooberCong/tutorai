/** Floating pill that appears over a text selection in the PDF, wiring the
 *  selection into the chat tab ("Explain" auto-sends, "Ask" prefills). */

import { useCallback, useEffect, useRef, useState } from "react";
import { explainNoteSelectionMessage, explainSelectionMessage } from "../lib/ai";
import { useSession } from "../lib/session";
import { ChatGlyph, Spark } from "./Icons";

interface SelectionState {
  text: string;
  page: number;
  x: number;
  y: number;
  /** Selection made inside a companion margin note, not the page text. */
  note: boolean;
}

export function SelectionPopover(props: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  const { openPanel } = useSession();
  const [sel, setSel] = useState<SelectionState | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const capture = useCallback(() => {
    const host = props.hostRef.current;
    const selection = window.getSelection();
    if (!host || !selection || selection.isCollapsed) {
      setSel(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 3 || text.length > 4000) {
      setSel(null);
      return;
    }
    const node =
      selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
    const pageEl = node?.closest?.("[data-page]");
    if (!pageEl || !host.contains(pageEl)) {
      setSel(null);
      return;
    }
    const rects = selection.getRangeAt(0).getClientRects();
    const last = rects[rects.length - 1];
    if (!last) return;
    const hostRect = host.getBoundingClientRect();
    setSel({
      text,
      page: Number((pageEl as HTMLElement).dataset.page),
      x: Math.min(Math.max(last.left - hostRect.left + last.width / 2, 90), hostRect.width - 90),
      y: last.bottom - hostRect.top + 10,
      note: !!node?.closest?.(".insight-card"),
    });
  }, [props.hostRef]);

  useEffect(() => {
    const host = props.hostRef.current;
    if (!host) return;
    const onMouseUp = () => setTimeout(capture, 0);
    const onDown = (e: Event) => {
      if (!popoverRef.current?.contains(e.target as Node)) setSel(null);
    };
    host.addEventListener("mouseup", onMouseUp);
    host.addEventListener("mousedown", onDown);
    host.addEventListener("scroll", () => setSel(null), true);
    return () => {
      host.removeEventListener("mouseup", onMouseUp);
      host.removeEventListener("mousedown", onDown);
    };
  }, [capture, props.hostRef]);

  if (!sel) return null;

  return (
    <div
      ref={popoverRef}
      className="selection-popover"
      style={{ left: sel.x, top: sel.y }}
    >
      <button
        onClick={() => {
          openPanel(
            "chat",
            (sel.note ? explainNoteSelectionMessage : explainSelectionMessage)(sel.text, sel.page),
            true,
          );
          setSel(null);
        }}
      >
        <Spark />
        Explain
      </button>
      <span className="sep" />
      <button
        onClick={() => {
          openPanel(
            "chat",
            sel.note
              ? `About your margin note on page ${sel.page}:\n"${sel.text}"\n\n`
              : `About this passage on page ${sel.page}:\n"${sel.text}"\n\n`,
            false,
          );
          setSel(null);
        }}
      >
        <ChatGlyph />
        Ask about this
      </button>
    </div>
  );
}
