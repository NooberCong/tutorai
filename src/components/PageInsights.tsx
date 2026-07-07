/** Margin notes for one page: quiet marks in the page's margin that expand,
 *  on click, into a card — never anything that moves the text or grabs the
 *  eye uninvited. Rendered inside each .pdf-page wrapper. */

import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useInsights } from "../lib/insights";
import type { Insight, InsightKind } from "../lib/types";
import { Md } from "./AiPanel";
import { ArrowUpRight, BookmarkMark, ChatGlyph, Close, Trash } from "./Icons";

const KIND_LABEL: Record<InsightKind, string> = {
  example: "in the wild",
  gotcha: "watch out",
  context: "bigger picture",
  update: "since this was written",
};

/** Minimum vertical distance between marks on one page. */
const MARK_GAP = 28;
/** Rough card height used to keep it inside the page. */
const CARD_ROOM = 340;

export function PageInsights(props: { page: number; heightPx: number }) {
  const { enabled, notesByPage, dismiss, discuss } = useInsights();
  const [openId, setOpenId] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const notes = notesByPage.get(props.page);

  // Each note carries a heuristic y (char offset in the extracted text); once
  // the pdf.js text layer for this page is rendered, find the anchor quote in
  // it and snap the mark to the quote's real position. The layer comes and
  // goes with virtualization and zoom, so watch for it rather than run once.
  const [anchorFrac, setAnchorFrac] = useState(new Map<string, number>());
  useEffect(() => {
    const pageEl = layerRef.current?.closest(".pdf-page");
    if (!pageEl || !notes?.length) return;
    const locate = () => {
      const spans = Array.from(pageEl.querySelectorAll<HTMLElement>(".textLayer span"));
      if (!spans.length) return;
      const squash = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
      let text = "";
      const starts = spans.map((s) => {
        const at = text.length;
        text += squash(s.textContent ?? "") + " ";
        return at;
      });
      const pageRect = pageEl.getBoundingClientRect();
      if (!pageRect.height) return;
      setAnchorFrac((prev) => {
        let next: Map<string, number> | null = null;
        for (const n of notes) {
          const at = n.anchor ? text.indexOf(squash(n.anchor)) : -1;
          if (at < 0) continue;
          let idx = 0;
          while (idx + 1 < starts.length && starts[idx + 1] <= at) idx++;
          const rect = spans[idx].getBoundingClientRect();
          const frac = (rect.top + rect.height / 2 - pageRect.top) / pageRect.height;
          if (prev.get(n.id) !== frac) {
            next ??= new Map(prev);
            next.set(n.id, frac);
          }
        }
        return next ?? prev;
      });
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(pageEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled, notes]);

  const open = openId !== null;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!layerRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled || !notes?.length) return null;

  // Marks sit at their anchor's height, nudged apart when notes crowd.
  const ordered = [...notes].sort(
    (a, b) => (anchorFrac.get(a.id) ?? a.y) - (anchorFrac.get(b.id) ?? b.y),
  );
  let prev = -Infinity;
  const tops = ordered.map((n) => {
    const y = anchorFrac.get(n.id) ?? n.y;
    const top = Math.min(Math.max(y * props.heightPx, prev + MARK_GAP), props.heightPx - 14);
    prev = top;
    return top;
  });
  const openIdx = ordered.findIndex((n) => n.id === openId);
  const openNote = openIdx >= 0 ? ordered[openIdx] : null;

  return (
    <div className="insight-layer" ref={layerRef}>
      {ordered.map((n, i) => (
        <button
          key={n.id}
          className={`insight-mark ${n.id === openId ? "open" : ""}`}
          style={{ top: tops[i] }}
          title={n.title}
          aria-label={`Margin note: ${n.title}`}
          onClick={() => setOpenId(n.id === openId ? null : n.id)}
        >
          <BookmarkMark />
        </button>
      ))}
      {openNote && (
        <InsightCard
          note={openNote}
          top={Math.max(10, Math.min(tops[openIdx], props.heightPx - CARD_ROOM))}
          onClose={() => setOpenId(null)}
          onDismiss={() => {
            dismiss(openNote.id);
            setOpenId(null);
          }}
          onDiscuss={() => {
            discuss(openNote);
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}

function InsightCard(props: {
  note: Insight;
  top: number;
  onClose: () => void;
  onDismiss: () => void;
  onDiscuss: () => void;
}) {
  const { note } = props;
  return (
    <div className="insight-card" style={{ top: props.top }} role="dialog" aria-label={note.title}>
      <div className="insight-head">
        <span className="insight-kind">{KIND_LABEL[note.kind]}</span>
        <button className="insight-close" onClick={props.onClose} title="Close" aria-label="Close">
          <Close />
        </button>
      </div>
      <h4 className="insight-title">{note.title}</h4>
      {note.anchor && <p className="insight-anchor">“{note.anchor}”</p>}
      <div className="insight-body">
        <Md text={note.body} />
      </div>
      {note.sources.length > 0 && (
        <div className="insight-sources">
          {note.sources.map((s) => (
            <button
              key={s.url}
              className="insight-source"
              title={s.url}
              onClick={() => void openUrl(s.url)}
            >
              <ArrowUpRight />
              {s.title || hostname(s.url)}
            </button>
          ))}
        </div>
      )}
      <div className="insight-actions">
        <button className="insight-discuss" onClick={props.onDiscuss}>
          <ChatGlyph />
          Discuss
        </button>
        <button
          className="insight-remove"
          onClick={props.onDismiss}
          title="Remove this note"
          aria-label="Remove this note"
        >
          <Trash />
        </button>
      </div>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
