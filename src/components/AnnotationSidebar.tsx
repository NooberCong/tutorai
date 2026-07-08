/** "Marks" — the annotations list. The reader's own map of the document:
 *  every mark as a card, filterable by color and kind, click to jump. */

import { useMemo, useState } from "react";
import { annotBounds } from "../lib/annotGeometry";
import { annotLabel, useAnnotations } from "../lib/annotations";
import type { Annotation } from "../lib/types";
import { HighlighterGlyph, PenLine, StickyNoteGlyph, TextTool, Trash } from "./Icons";

type Kind = "markup" | "ink" | "note" | "freetext";

function kindOf(a: Annotation): Kind {
  switch (a.type) {
    case "note":
      return "note";
    case "freetext":
      return "freetext";
    case "ink":
      return "ink";
    default:
      return "markup";
  }
}

const KIND_CHIPS: { kind: Kind; label: string }[] = [
  { kind: "markup", label: "Marks" },
  { kind: "ink", label: "Ink" },
  { kind: "note", label: "Notes" },
  { kind: "freetext", label: "Text" },
];

export function AnnotationSidebar() {
  const ctx = useAnnotations();
  const [colors, setColors] = useState<Set<string>>(() => new Set());
  const [kinds, setKinds] = useState<Set<Kind>>(() => new Set());

  const usedColors = useMemo(() => {
    const seen: string[] = [];
    for (const a of ctx.annotations) if (!seen.includes(a.color)) seen.push(a.color);
    return seen;
  }, [ctx.annotations]);

  const sorted = useMemo(
    () =>
      [...ctx.annotations].sort(
        (a, b) => a.page - b.page || annotBounds(a).y - annotBounds(b).y,
      ),
    [ctx.annotations],
  );

  const shown = sorted.filter(
    (a) =>
      (!colors.size || colors.has(a.color)) && (!kinds.size || kinds.has(kindOf(a))),
  );

  if (!ctx.annotations.length) {
    return (
      <div className="ai-empty marks-empty">
        <HighlighterGlyph />
        <div className="lede">Nothing marked yet.</div>
        <p>
          Select any passage to highlight it, or press <span className="mono">M</span> for
          the markup tools.
        </p>
      </div>
    );
  }

  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  let lastPage = 0;

  return (
    <div className="marks-pane">
      <div className="marks-filters">
        {usedColors.map((hex) => (
          <button
            key={hex}
            className={`marks-color-dot ${colors.has(hex) ? "active" : ""}`}
            style={{ background: hex }}
            title="Filter by color"
            aria-pressed={colors.has(hex)}
            onClick={() => toggle(colors, hex, setColors)}
          />
        ))}
        <span className="marks-filter-gap" />
        {KIND_CHIPS.map(({ kind, label }) => (
          <button
            key={kind}
            className={`chip ${kinds.has(kind) ? "active" : ""}`}
            aria-pressed={kinds.has(kind)}
            onClick={() => toggle(kinds, kind, setKinds)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="marks-list">
        {shown.map((a) => {
          const header =
            a.page !== lastPage ? <div className="list-label">Page {a.page}</div> : null;
          lastPage = a.page;
          return (
            <div key={a.id}>
              {header}
              <MarkCard a={a} />
            </div>
          );
        })}
        {!shown.length && (
          <p className="dim small marks-none">No marks match the filters.</p>
        )}
      </div>
    </div>
  );
}

function MarkCard(props: { a: Annotation }) {
  const ctx = useAnnotations();
  const { a } = props;

  let excerpt: React.ReactNode;
  let icon: React.ReactNode = null;
  switch (a.type) {
    case "highlight":
    case "underline":
    case "strikethrough":
      excerpt = <span className="mark-quote">“{a.quote}”</span>;
      break;
    case "note":
      excerpt = a.quote ? (
        <span className="mark-quote">“{a.quote}”</span>
      ) : (
        <span className="mark-plain">{a.note || "Empty note"}</span>
      );
      icon = <StickyNoteGlyph fill={a.color} size={12} />;
      break;
    case "freetext":
      excerpt = <span className="mark-plain">{a.text}</span>;
      icon = <TextTool />;
      break;
    case "ink":
      excerpt = <span className="mark-plain dim">Ink stroke</span>;
      icon = <PenLine />;
      break;
  }

  const notePreview =
    (a.type === "note" && a.quote && a.note) ||
    ((a.type === "highlight" || a.type === "underline" || a.type === "strikethrough") && a.note) ||
    null;

  return (
    <button
      className="item-card mark-card"
      style={{ borderLeftColor: a.color }}
      title={`Jump to ${annotLabel(a)} on page ${a.page}`}
      onClick={() => ctx.focusAnnotation(a)}
    >
      <span className="mark-page mono">{a.page}</span>
      <span className="mark-excerpt">
        {icon && <span className="mark-icon">{icon}</span>}
        {excerpt}
      </span>
      {notePreview && (
        <span className="mark-note-preview">
          <StickyNoteGlyph fill={a.color} size={11} /> {notePreview}
        </span>
      )}
      <span
        className="card-remove"
        role="button"
        aria-label="Delete annotation"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          ctx.remove([a.id]);
        }}
      >
        <Trash />
      </span>
    </button>
  );
}
