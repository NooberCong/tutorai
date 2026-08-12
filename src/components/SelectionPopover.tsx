/** Floating pill over a text selection: markup first (highlight swatches,
 *  underline, strike, note — one gesture from intent to mark), then the
 *  dictionary (Translate opens an anchored card), AI last ("Explain"
 *  auto-sends, "Ask" prefills). Selections inside companion margin notes
 *  keep the dictionary + AI half only — you can't highlight the AI's text. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { explainNoteSelectionMessage, explainSelectionMessage } from "../lib/ai";
import { selectionToMarkups, type PageMarkup } from "../lib/annotGeometry";
import {
  HIGHLIGHT_COLORS,
  lineColor,
  useAnnotations,
  type MarkupType,
} from "../lib/annotations";
import { useSession } from "../lib/session";
import {
  ChatGlyph,
  DictionaryGlyph,
  Spark,
  StickyNoteGlyph,
  StrikeGlyph,
  UnderlineGlyph,
} from "./Icons";
import { TranslatePopup, type DictQuery } from "./TranslatePopup";

interface SelectionState {
  text: string;
  page: number;
  x: number;
  y: number;
  /** Selection made inside a companion margin note, not the page text. */
  note: boolean;
  /** Pre-computed markup geometry — clicking a button may clear the live
   *  selection before the handler runs, so capture rects up front. */
  markups: PageMarkup[];
}

export function SelectionPopover(props: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  const { openPanel } = useSession();
  const annot = useAnnotations();
  const [sel, setSel] = useState<SelectionState | null>(null);
  /** The dictionary card outlives the pill: clicking Translate clears `sel`
   *  (and the live selection), and the card owns its own dismissal. */
  const [dictQuery, setDictQuery] = useState<DictQuery | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef(annot.tool);
  toolRef.current = annot.tool;

  const capture = useCallback(() => {
    const host = props.hostRef.current;
    const selection = window.getSelection();
    // Armed tools own the gesture (drag-highlighter consumes the selection).
    if (toolRef.current || !host || !selection || selection.isCollapsed) {
      setSel(null);
      return;
    }
    const text = selection.toString().trim();
    // Any real word qualifies — a double-clicked "go" is a dictionary query —
    // but bare punctuation from a stray drag still doesn't raise the pill.
    if (!/[\p{L}\p{N}]/u.test(text) || text.length > 4000) {
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
    const note = !!node?.closest?.(".insight-card");
    const hostRect = host.getBoundingClientRect();
    setSel({
      text,
      page: Number((pageEl as HTMLElement).dataset.page),
      x: last.left - hostRect.left + last.width / 2,
      y: last.bottom - hostRect.top + 10,
      note,
      markups: note ? [] : selectionToMarkups(selection, host),
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

  // The pill centers on the selection (translate -50%) and its width varies —
  // markup tools hide for note selections — so clamp it inside the host using
  // the measured width after render, not a guessed one at capture time.
  useLayoutEffect(() => {
    const el = popoverRef.current;
    const host = props.hostRef.current;
    if (!el || !host || !sel) return;
    const half = el.offsetWidth / 2 + 8;
    const width = host.getBoundingClientRect().width;
    el.style.left = `${Math.min(Math.max(sel.x, half), width - half)}px`;
  }, [sel, props.hostRef]);

  const dismiss = useCallback(() => {
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // NB: mutations must stay OUT of setSel updaters — StrictMode double-invokes
  // updaters, which turned one click into two annotations.
  const applyMarkup = useCallback(
    (type: MarkupType, color: string) => {
      if (sel?.markups.length) {
        annot.addMarkups(sel.markups, type, color);
        if (type === "highlight") annot.setHlColor(color);
      }
      setSel(null);
      window.getSelection()?.removeAllRanges();
    },
    [annot, sel],
  );

  const addNoteFromSel = useCallback(() => {
    const m = sel?.markups[sel.markups.length - 1];
    const r = m?.rects[m.rects.length - 1];
    if (sel && m && r) {
      annot.addNote(
        m.page,
        { x: Math.min(r.x + r.w + 0.012, 0.97), y: r.y + r.h / 2 },
        sel.text.slice(0, 300),
      );
    }
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }, [annot, sel]);

  /** Dictionary entries top out around three words ("give up", "New York");
   *  anything longer is prose for Explain, not a lookup. */
  const canTranslate =
    !!sel && sel.text.length <= 64 && sel.text.trim().split(/\s+/).length <= 3;

  const openTranslate = useCallback(() => {
    if (!sel) return;
    setDictQuery({ text: sel.text, x: sel.x, y: sel.y });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }, [sel]);

  const closeTranslate = useCallback(() => setDictQuery(null), []);

  // While the pill is open, the keyboard mirrors it: 1–5 colors, U, S, N, T.
  const canMark = !!sel && !sel.note && sel.markups.length > 0;
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "t" && canTranslate) {
        e.preventDefault();
        openTranslate();
        return;
      }
      if (!canMark) return;
      if (key >= "1" && key <= "5") {
        e.preventDefault();
        applyMarkup("highlight", HIGHLIGHT_COLORS[Number(key) - 1].hex);
      } else if (key === "u") {
        e.preventDefault();
        applyMarkup("underline", annot.hlColor);
      } else if (key === "s") {
        e.preventDefault();
        applyMarkup("strikethrough", annot.hlColor);
      } else if (key === "n") {
        e.preventDefault();
        addNoteFromSel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, canMark, canTranslate, applyMarkup, addNoteFromSel, openTranslate, dismiss, annot.hlColor]);

  if (!sel && !dictQuery) return null;

  const pill = sel && (
    <div
      ref={popoverRef}
      className="selection-popover"
      style={{ left: sel.x, top: sel.y }}
    >
      {canMark && (
        <>
          <span className="pop-swatches">
            {HIGHLIGHT_COLORS.map((c, i) => (
              <button
                key={c.hex}
                className={`annot-swatch pop ${annot.hlColor === c.hex ? "current" : ""}`}
                style={{ background: c.hex }}
                title={`Highlight ${c.name} (${i + 1})`}
                aria-label={`Highlight ${c.name}`}
                onClick={() => applyMarkup("highlight", c.hex)}
              />
            ))}
          </span>
          <span className="sep" />
          <button
            className="pop-tool"
            title="Underline (U)"
            aria-label="Underline"
            onClick={() => applyMarkup("underline", annot.hlColor)}
          >
            <UnderlineGlyph />
            <span className="pop-underbar" style={{ background: lineColor(annot.hlColor) }} />
          </button>
          <button
            className="pop-tool"
            title="Strikethrough (S)"
            aria-label="Strikethrough"
            onClick={() => applyMarkup("strikethrough", annot.hlColor)}
          >
            <StrikeGlyph />
            <span className="pop-underbar" style={{ background: lineColor(annot.hlColor) }} />
          </button>
          <button
            className="pop-tool"
            title="Add note (N)"
            aria-label="Add note"
            onClick={addNoteFromSel}
          >
            <StickyNoteGlyph fill="currentColor" size={13} />
          </button>
          <span className="sep" />
        </>
      )}
      {canTranslate && (
        <>
          <button title="Translate (T)" onClick={openTranslate}>
            <DictionaryGlyph />
            Translate
          </button>
          <span className="sep" />
        </>
      )}
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

  return (
    <>
      {dictQuery && (
        <TranslatePopup query={dictQuery} hostRef={props.hostRef} onClose={closeTranslate} />
      )}
      {pill}
    </>
  );
}
