/** The annotation overlay for one page: highlights, underlines, strikes,
 *  sticky notes, free text, and ink. Rendered inside .page-inner so it rides
 *  the two-speed zoom transform and mounts/unmounts with virtualization.
 *  All geometry is page fractions → percentage positioning; the layer itself
 *  carries no z-index so highlight multiply blends against the page canvas. */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  annotBounds,
  buildStrokePath,
  clientToFrac,
  hitTest,
  penCursor,
  strokePathPageUnits,
} from "../lib/annotGeometry";
import {
  HIGHLIGHT_COLORS,
  INK_COLORS,
  lineColor,
  useAnnotations,
} from "../lib/annotations";
import type {
  Annotation,
  FreeTextAnnot,
  InkAnnot,
  NoteAnnot,
  TextMarkupAnnot,
} from "../lib/types";
import { Close, StickyNoteGlyph, Trash } from "./Icons";

interface PageDims {
  width: number;
  height: number;
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const pct = (v: number) => `${v * 100}%`;

export const PageAnnotations = memo(function PageAnnotations(props: {
  page: number;
  dims: PageDims;
  scale: number;
}) {
  const { page, dims, scale } = props;
  const ctx = useAnnotations();
  const annots = ctx.byPage.get(page);
  const layerRef = useRef<HTMLDivElement>(null);

  // ── Ink drawing (pen tool): points in a ref, rAF-driven path — React
  //    never renders per pointermove. ─────────────────────────────────────
  const preset = ctx.inkPresets[ctx.inkPresetIdx];
  const drawing = useRef<{ points: [number, number, number][]; mouse: boolean } | null>(null);
  const livePathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef(0);
  const [drawingNow, setDrawingNow] = useState(false);

  const renderLive = useCallback(() => {
    rafRef.current = 0;
    const d = drawing.current;
    const path = livePathRef.current;
    if (!d || !path) return;
    path.setAttribute(
      "d",
      buildStrokePath(
        d.points.map(([x, y, p]) => [x * dims.width, y * dims.height, p] as [number, number, number]),
        preset.width,
        preset.mode,
        d.mouse,
      ),
    );
  }, [dims, preset]);

  const scheduleLive = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(renderLive);
  }, [renderLive]);

  const strokePoint = (e: { clientX: number; clientY: number; pressure?: number }, mouse: boolean) => {
    const { x, y } = clientToFrac(layerRef.current!, e.clientX, e.clientY);
    const p = mouse ? 0.5 : e.pressure || 0.5;
    return [x, y, p] as [number, number, number];
  };

  // ── Eraser: hit strokes under the drag, hide optimistically, remove as
  //    one batch (= one undo entry) on release. ──────────────────────────
  const erasing = useRef<Set<string> | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const eraseAt = (clientX: number, clientY: number) => {
    const list = ctx.byPage.get(page);
    if (!list?.length) return;
    const pt = clientToFrac(layerRef.current!, clientX, clientY);
    const hit = hitTest(
      list,
      pt,
      dims.width,
      dims.height,
      8 / scale,
      (a) => a.type === "ink" && !erasing.current?.has(a.id),
    );
    if (hit && erasing.current) {
      erasing.current.add(hit.id);
      setHiddenIds(new Set(erasing.current));
    }
  };

  const onLayerPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (ctx.tool === "pen") {
      e.preventDefault();
      layerRef.current?.setPointerCapture(e.pointerId);
      drawing.current = { points: [strokePoint(e, e.pointerType === "mouse")], mouse: e.pointerType === "mouse" };
      setDrawingNow(true);
      scheduleLive();
    } else if (ctx.tool === "eraser") {
      e.preventDefault();
      layerRef.current?.setPointerCapture(e.pointerId);
      erasing.current = new Set();
      eraseAt(e.clientX, e.clientY);
    }
  };

  const onLayerPointerMove = (e: ReactPointerEvent) => {
    if (drawing.current) {
      const mouse = drawing.current.mouse;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) drawing.current.points.push(strokePoint(ev, mouse));
      scheduleLive();
    } else if (erasing.current) {
      eraseAt(e.clientX, e.clientY);
    }
  };

  const onLayerPointerUp = () => {
    if (drawing.current) {
      const { points } = drawing.current;
      drawing.current = null;
      setDrawingNow(false);
      livePathRef.current?.setAttribute("d", "");
      if (points.length >= 2) {
        const now = Date.now();
        ctx.add({
          id: crypto.randomUUID(),
          type: "ink",
          page,
          color: preset.color,
          mode: preset.mode,
          width: preset.width,
          points: points.map(
            ([x, y, p]) =>
              [Number(x.toFixed(4)), Number(y.toFixed(4)), Number(p.toFixed(2))] as [number, number, number],
          ),
          createdAt: now,
          modifiedAt: now,
        });
      }
    } else if (erasing.current) {
      const ids = [...erasing.current];
      erasing.current = null;
      setHiddenIds(new Set());
      if (ids.length) ctx.remove(ids);
    }
  };

  const onLayerClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (ctx.tool === "note" || ctx.tool === "freetext") {
      const at = clientToFrac(layerRef.current!, e.clientX, e.clientY);
      if (ctx.tool === "note") ctx.addNote(page, at);
      else ctx.addFreeText(page, at);
    }
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ── Move / resize gestures for notes and free text ────────────────────
  const startObjectDrag = (
    e: ReactPointerEvent,
    a: NoteAnnot | FreeTextAnnot,
    mode: "move" | "resize",
  ) => {
    if (e.button !== 0) return;
    if (ctx.tool && ctx.tool !== "select") return;
    if (ctx.editingId === a.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = layerRef.current!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const before = a;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      moved = true;
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      if (before.type === "note") {
        ctx.updateLive(a.id, {
          at: { x: clamp01(before.at.x + dx), y: clamp01(before.at.y + dy) },
        });
      } else if (mode === "move") {
        ctx.updateLive(a.id, {
          rect: {
            ...before.rect,
            x: Math.min(Math.max(before.rect.x + dx, 0), 1 - before.rect.w),
            y: Math.min(Math.max(before.rect.y + dy, 0), 1 - before.rect.h),
          },
        });
      } else {
        ctx.updateLive(a.id, {
          rect: {
            ...before.rect,
            w: Math.min(Math.max(before.rect.w + dx, 0.05), 1 - before.rect.x),
          },
        });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      if (moved) {
        ctx.commitEdit(before);
      } else if (mode === "move") {
        ctx.select(a.id);
        if (before.type === "note") ctx.setEditing(a.id);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  // ── Render ────────────────────────────────────────────────────────────
  const needsLayer = ctx.tool === "pen" || ctx.tool === "eraser" || ctx.tool === "note" || ctx.tool === "freetext";
  if (!annots?.length && !needsLayer) return null;

  const H = dims.height * scale;
  const markups: TextMarkupAnnot[] = [];
  const pens: InkAnnot[] = [];
  const highlighterInks: InkAnnot[] = [];
  const notes: NoteAnnot[] = [];
  const freetexts: FreeTextAnnot[] = [];
  for (const a of annots ?? []) {
    if (a.type === "ink") (a.mode === "highlighter" ? highlighterInks : pens).push(a);
    else if (a.type === "note") notes.push(a);
    else if (a.type === "freetext") freetexts.push(a);
    else markups.push(a);
  }

  const selected = annots?.find((a) => a.id === ctx.selectedId) ?? null;
  const editing = annots?.find((a) => a.id === ctx.editingId) ?? null;
  const lineH = Math.max(1.5, 1.7 * scale);

  return (
    <div
      className="annot-layer"
      ref={layerRef}
      style={ctx.tool === "pen" ? { cursor: penCursor(preset.color, preset.width * scale) } : undefined}
      onPointerDown={onLayerPointerDown}
      onPointerMove={onLayerPointerMove}
      onPointerUp={onLayerPointerUp}
      onPointerCancel={onLayerPointerUp}
      onClick={onLayerClick}
    >
      {/* Text markup — highlight fills multiply against the page canvas. */}
      {markups.map((a) => {
        const fresh = ctx.freshIds.has(a.id);
        return a.rects.map((r, i) =>
          a.type === "highlight" ? (
            <div
              key={`${a.id}-${i}`}
              className={`annot-highlight ${fresh ? "fresh" : ""}`}
              style={{
                left: pct(r.x),
                top: pct(r.y),
                width: pct(r.w),
                height: pct(r.h),
                background: a.color,
                animationDelay: fresh ? `${i * 30}ms` : undefined,
              }}
            />
          ) : (
            <div
              key={`${a.id}-${i}`}
              className={`annot-line ${fresh ? "fresh" : ""}`}
              style={{
                left: pct(r.x),
                top: a.type === "underline" ? pct(r.y + r.h) : pct(r.y + r.h * 0.55),
                width: pct(r.w),
                height: lineH,
                marginTop: -lineH / 2,
                background: lineColor(a.color),
                animationDelay: fresh ? `${i * 30}ms` : undefined,
              }}
            />
          ),
        );
      })}
      {/* Note badges on markups that carry a comment. */}
      {markups
        .filter((a) => a.note)
        .map((a) => {
          const last = a.rects[a.rects.length - 1];
          return (
            <button
              key={`${a.id}-note`}
              className="annot-obj annot-markup-note"
              style={{ left: pct(last.x + last.w), top: pct(last.y + last.h / 2) }}
              title={a.note}
              aria-label="Note on this highlight"
              onClick={(e) => {
                e.stopPropagation();
                ctx.select(a.id);
                ctx.setEditing(a.id);
              }}
            >
              <StickyNoteGlyph fill={a.color} size={13} />
            </button>
          );
        })}

      {/* Ink: pen strokes plain, highlighter strokes multiplied as a group. */}
      {pens.length > 0 && (
        <svg className="annot-ink" viewBox={`0 0 ${dims.width} ${dims.height}`} preserveAspectRatio="none">
          {pens.map((a) => (
            <path
              key={a.id}
              d={strokePathPageUnits(a, dims.width, dims.height)}
              fill={a.color}
              className={`${ctx.freshIds.has(a.id) ? "fresh" : ""} ${hiddenIds.has(a.id) ? "hidden" : ""}`}
            />
          ))}
        </svg>
      )}
      {highlighterInks.length > 0 && (
        <svg
          className="annot-ink annot-ink-hl"
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          {highlighterInks.map((a) => (
            <path
              key={a.id}
              d={strokePathPageUnits(a, dims.width, dims.height)}
              fill={a.color}
              className={`${ctx.freshIds.has(a.id) ? "fresh" : ""} ${hiddenIds.has(a.id) ? "hidden" : ""}`}
            />
          ))}
        </svg>
      )}
      {drawingNow && (
        <svg
          className={`annot-ink live ${preset.mode === "highlighter" ? "annot-ink-hl" : ""}`}
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          preserveAspectRatio="none"
        >
          <path ref={livePathRef} fill={preset.color} />
        </svg>
      )}

      {/* Free text. */}
      {freetexts.map((a) =>
        ctx.editingId === a.id ? (
          <FreeTextEditor key={a.id} a={a} dims={dims} scale={scale} />
        ) : (
          <div
            key={a.id}
            className={`annot-obj annot-freetext ${ctx.selectedId === a.id ? "selected" : ""}`}
            style={{
              left: pct(a.rect.x),
              top: pct(a.rect.y),
              width: pct(a.rect.w),
              fontSize: a.fontSize * scale,
              color: a.color,
            }}
            onPointerDown={(e) => startObjectDrag(e, a, "move")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              ctx.setEditing(a.id);
            }}
          >
            {a.text}
            {ctx.selectedId === a.id && (
              <span
                className="annot-handle"
                onPointerDown={(e) => startObjectDrag(e, a, "resize")}
              />
            )}
          </div>
        ),
      )}

      {/* Sticky note markers. */}
      {notes.map((a) => (
        <button
          key={a.id}
          className={`annot-obj annot-note-marker ${ctx.selectedId === a.id ? "selected" : ""} ${ctx.freshIds.has(a.id) ? "fresh" : ""}`}
          style={{ left: pct(a.at.x), top: pct(a.at.y) }}
          title={a.note ? a.note.slice(0, 80) : "Note"}
          aria-label={a.note ? `Note: ${a.note.slice(0, 80)}` : "Note"}
          onPointerDown={(e) => startObjectDrag(e, a, "move")}
        >
          <StickyNoteGlyph fill={a.color} size={18} />
        </button>
      ))}

      {/* Selection ring + locate pulse. */}
      {selected && selected.type !== "note" && (
        <SelectionRing a={selected} flash={ctx.flashId === selected.id} />
      )}
      {selected && selected.type === "note" && ctx.flashId === selected.id && (
        <SelectionRing a={selected} flash />
      )}

      {/* Contextual mini-bar for the selected annotation. */}
      {selected && !editing && (
        <MiniBar a={selected} heightPx={H} />
      )}

      {/* Note editor card (sticky notes + markup comments). */}
      {editing && (editing.type === "note" || editing.type === "highlight" || editing.type === "underline" || editing.type === "strikethrough") && (
        <NoteEditor a={editing} heightPx={H} />
      )}
    </div>
  );
});

function SelectionRing(props: { a: Annotation; flash: boolean }) {
  const b = annotBounds(props.a);
  const pad = props.a.type === "note" ? 0.012 : 0.004;
  return (
    <div
      className={`annot-ring ${props.flash ? "flash" : ""}`}
      style={{
        left: pct(b.x - pad),
        top: pct(b.y - pad),
        width: pct(b.w + pad * 2),
        height: pct(b.h + pad * 2),
      }}
    />
  );
}

/** Compact pill above the selected annotation: recolor, type extras, delete. */
function MiniBar(props: { a: Annotation; heightPx: number }) {
  const ctx = useAnnotations();
  const { a, heightPx } = props;
  const b = annotBounds(a);
  const isMarkup = a.type === "highlight" || a.type === "underline" || a.type === "strikethrough";
  const palette = a.type === "ink" || a.type === "freetext" ? INK_COLORS : HIGHLIGHT_COLORS;

  const topPx = b.y * heightPx - 46;
  const style: React.CSSProperties = {
    left: pct(Math.min(Math.max(b.x + b.w / 2, 0.12), 0.88)),
  };
  if (topPx < 4) style.top = Math.min((b.y + b.h) * heightPx + 10, heightPx - 40);
  else style.top = topPx;

  return (
    <div
      className="annot-popup annot-minibar"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {palette.map((c) => (
        <button
          key={c.hex}
          className={`annot-swatch ${a.color === c.hex ? "current" : ""}`}
          style={{ background: c.hex }}
          title={c.name}
          aria-label={`Recolor ${c.name}`}
          onClick={() => ctx.update(a.id, { color: c.hex })}
        />
      ))}
      {a.type === "freetext" && (
        <>
          <span className="annot-minibar-sep" />
          {[
            ["S", 10],
            ["M", 13],
            ["L", 18],
          ].map(([label, size]) => (
            <button
              key={label}
              className={`annot-size ${a.fontSize === size ? "current" : ""}`}
              onClick={() => ctx.update(a.id, { fontSize: size as number })}
            >
              {label}
            </button>
          ))}
        </>
      )}
      {isMarkup && (
        <>
          <span className="annot-minibar-sep" />
          <button
            className="annot-minibar-btn"
            title={(a as TextMarkupAnnot).note ? "Edit note" : "Add note"}
            onClick={() => ctx.setEditing(a.id)}
          >
            <StickyNoteGlyph fill="currentColor" size={13} />
          </button>
        </>
      )}
      <span className="annot-minibar-sep" />
      <button
        className="annot-minibar-btn danger"
        title="Delete"
        aria-label="Delete annotation"
        onClick={() => ctx.remove([a.id])}
      >
        <Trash />
      </button>
    </div>
  );
}

/** The note card: edits a sticky note's text or a markup's attached comment.
 *  One history entry per editing session, committed on close; a brand-new
 *  note abandoned empty vanishes without touching history. */
function NoteEditor(props: { a: NoteAnnot | TextMarkupAnnot; heightPx: number }) {
  const ctx = useAnnotations();
  const { a, heightPx } = props;
  const initial = a.type === "note" ? a.note : a.note ?? "";
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const cardRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const commit = useCallback(() => {
    const text = draftRef.current.trim();
    if (a.type === "note") {
      if (!text && !initial) ctx.cancelCreate(a.id);
      else if (!text) ctx.remove([a.id]);
      else if (text !== a.note) ctx.update(a.id, { note: text });
    } else if (text !== (a.note ?? "")) {
      ctx.update(a.id, { note: text || undefined });
    }
    ctx.setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, ctx.cancelCreate, ctx.remove, ctx.update, ctx.setEditing]);

  // Outside pointerdown commits — same dismissal grammar as insight cards.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) commit();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [commit]);

  const b = annotBounds(a);
  const top = Math.max(8, Math.min(b.y * heightPx, heightPx - 230));
  const style: React.CSSProperties = { top };
  if (b.x > 0.55) {
    style.right = pct(Math.max(1 - b.x + 0.015, 0.02));
  } else {
    style.left = pct(Math.min(b.x + b.w + 0.015, 0.72));
  }

  return (
    <div
      className="annot-popup annot-note-editor"
      ref={cardRef}
      style={style}
      role="dialog"
      aria-label="Note"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="annot-editor-bar" style={{ background: a.color }} />
      <div className="annot-editor-head">
        <span className="annot-editor-kind">
          Note · p.{a.page}
        </span>
        <span className="annot-editor-swatches">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.hex}
              className={`annot-swatch small ${a.color === c.hex ? "current" : ""}`}
              style={{ background: c.hex }}
              title={c.name}
              aria-label={`Recolor ${c.name}`}
              onClick={() => ctx.update(a.id, { color: c.hex })}
            />
          ))}
        </span>
        <button className="annot-editor-close" title="Close" aria-label="Close" onClick={commit}>
          <Close />
        </button>
      </div>
      {a.quote && <p className="annot-editor-quote">“{a.quote.slice(0, 120)}”</p>}
      <textarea
        ref={taRef}
        value={draft}
        placeholder="Write a note…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="annot-editor-foot">
        <span className="annot-editor-when">
          {new Date(a.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {" · "}
          {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <button
          className="annot-editor-trash"
          title="Delete note"
          aria-label="Delete note"
          onClick={() => {
            if (a.type === "note") ctx.remove([a.id]);
            else {
              ctx.update(a.id, { note: undefined });
              ctx.setEditing(null);
            }
          }}
        >
          <Trash />
        </button>
      </div>
    </div>
  );
}

/** In-place free text editing: a contentEditable box, committed on blur. */
function FreeTextEditor(props: { a: FreeTextAnnot; dims: PageDims; scale: number }) {
  const ctx = useAnnotations();
  const { a, dims, scale } = props;
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.innerText = a.text;
    el.focus();
    // Caret at the end.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    const el = elRef.current;
    if (!el) return;
    const text = el.innerText.replace(/\n+$/, "").trim();
    if (!text && !a.text) {
      ctx.cancelCreate(a.id);
      return;
    }
    if (!text) {
      ctx.remove([a.id]);
      return;
    }
    const h = Math.min(Math.max(el.offsetHeight / (dims.height * scale), 0.01), 1 - a.rect.y);
    if (text !== a.text || Math.abs(h - a.rect.h) > 0.001) {
      ctx.update(a.id, { text, rect: { ...a.rect, h } });
    }
    ctx.setEditing(null);
  };

  return (
    <div
      className="annot-obj annot-freetext editing"
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      style={{
        left: pct(a.rect.x),
        top: pct(a.rect.y),
        width: pct(a.rect.w),
        fontSize: a.fontSize * scale,
        color: a.color,
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          elRef.current?.blur();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
