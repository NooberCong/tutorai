/** The markup rail: a slim floating pill of canvas tools, summoned by the
 *  toolbar toggle (or M). Text markup mostly happens in the selection
 *  popover — the rail is for the tools that need a mode: select, drag-
 *  highlighter, pen, text, note, eraser — plus color, undo and redo. */

import { useEffect, useRef, useState } from "react";
import {
  HIGHLIGHT_COLORS,
  INK_COLORS,
  useAnnotations,
  type AnnotTool,
} from "../lib/annotations";
import {
  CursorArrow,
  EraserGlyph,
  HighlighterGlyph,
  PenLine,
  Redo,
  StickyNoteGlyph,
  TextTool,
  Undo,
} from "./Icons";

const WIDTHS = [
  { label: "fine", value: 1.5 },
  { label: "med", value: 2.5 },
  { label: "broad", value: 4 },
];

export function MarkupRail() {
  const ctx = useAnnotations();
  const [flyout, setFlyout] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // The flyout dismisses like every other popover: outside pointerdown / Esc.
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setFlyout(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyout(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  useEffect(() => {
    if (!ctx.railOpen) setFlyout(false);
  }, [ctx.railOpen]);

  if (!ctx.railOpen) return null;

  const preset = ctx.inkPresets[ctx.inkPresetIdx];
  const toolColor = (t: AnnotTool): string | null => {
    switch (t) {
      case "highlight":
        return ctx.hlColor;
      case "pen":
        return preset.color;
      case "note":
        return ctx.noteColor;
      case "freetext":
        return ctx.textColor;
      default:
        return null;
    }
  };
  const activeColor = toolColor(ctx.tool) ?? ctx.hlColor;

  const pick = (t: AnnotTool) => {
    setFlyout(false);
    if (ctx.tool === t) {
      if (t === "pen") setFlyout(true); // re-click the pen = open the tray
      else ctx.setTool(null);
      return;
    }
    ctx.setTool(t);
  };

  const tools: { tool: AnnotTool; title: string; icon: React.ReactNode }[] = [
    { tool: "select", title: "Select (V)", icon: <CursorArrow /> },
    { tool: "highlight", title: "Highlighter — drag across text (H)", icon: <HighlighterGlyph /> },
    { tool: "pen", title: "Pen (P)", icon: <PenLine /> },
    { tool: "freetext", title: "Text (T)", icon: <TextTool /> },
    { tool: "note", title: "Sticky note (N)", icon: <StickyNoteGlyph fill="currentColor" size={14} /> },
    { tool: "eraser", title: "Eraser — drag over ink (E)", icon: <EraserGlyph /> },
  ];

  return (
    <div className="annot-rail" ref={railRef} role="toolbar" aria-label="Markup tools">
      {tools.map(({ tool, title, icon }) => {
        const color = toolColor(tool);
        return (
          <button
            key={tool}
            className={`rail-btn ${ctx.tool === tool ? "active" : ""}`}
            title={title}
            aria-pressed={ctx.tool === tool}
            onClick={() => pick(tool)}
          >
            {icon}
            {color && <span className="rail-underbar" style={{ background: color }} />}
          </button>
        );
      })}
      <span className="rail-sep" />
      <button
        className={`rail-btn rail-color ${flyout ? "active" : ""}`}
        title="Colors & pens"
        aria-label="Colors and pens"
        aria-expanded={flyout}
        onClick={() => setFlyout((v) => !v)}
      >
        <span className="rail-dot" style={{ background: activeColor }} />
      </button>
      <span className="rail-sep" />
      <button
        className="rail-btn"
        title="Undo (Ctrl+Z)"
        disabled={!ctx.canUndo}
        onClick={ctx.undo}
      >
        <Undo />
      </button>
      <button
        className="rail-btn"
        title="Redo (Ctrl+Y)"
        disabled={!ctx.canRedo}
        onClick={ctx.redo}
      >
        <Redo />
      </button>

      {flyout && (
        <div className="rail-flyout">
          {ctx.tool === "pen" ? (
            <>
              <div className="flyout-label">Pens</div>
              <div className="flyout-row">
                {ctx.inkPresets.map((p, i) => (
                  <button
                    key={i}
                    className={`pen-chip ${i === ctx.inkPresetIdx ? "current" : ""}`}
                    title={`${p.mode === "highlighter" ? "Marker" : "Pen"} · ${p.width}pt`}
                    onClick={() => ctx.setInkPresetIdx(i)}
                  >
                    <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden>
                      <path
                        d="M3 10 C 10 3, 16 12, 31 4"
                        fill="none"
                        stroke={p.color}
                        strokeWidth={Math.min(p.width * 1.4, 9)}
                        strokeLinecap="round"
                        opacity={p.mode === "highlighter" ? 0.65 : 1}
                      />
                    </svg>
                  </button>
                ))}
              </div>
              {preset.mode === "pen" && (
                <div className="flyout-row">
                  {WIDTHS.map((w) => (
                    <button
                      key={w.label}
                      className={`width-chip ${preset.width === w.value ? "current" : ""}`}
                      title={w.label}
                      aria-label={`Width ${w.label}`}
                      onClick={() => ctx.updateInkPreset({ width: w.value })}
                    >
                      <span style={{ width: 4 + w.value * 2, height: 4 + w.value * 2 }} />
                    </button>
                  ))}
                </div>
              )}
              <div className="flyout-row">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    className={`annot-swatch ${preset.color === c.hex ? "current" : ""}`}
                    style={{ background: c.hex }}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => ctx.updateInkPreset({ color: c.hex })}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flyout-row">
              {(ctx.tool === "freetext" ? INK_COLORS : HIGHLIGHT_COLORS).map((c) => (
                <button
                  key={c.hex}
                  className={`annot-swatch ${activeColor === c.hex ? "current" : ""}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => {
                    if (ctx.tool === "freetext") ctx.setTextColor(c.hex);
                    else if (ctx.tool === "note") ctx.setNoteColor(c.hex);
                    else ctx.setHlColor(c.hex);
                    setFlyout(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
