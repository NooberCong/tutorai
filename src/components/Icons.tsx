/** Inline icon set — 16×16 grid, 1.5px strokes, drawn for this app so every
 *  glyph shares one visual voice. All inherit currentColor. */

import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const ChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
);

export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
);

export const ChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m3.5 6 4.5 4.5L12.5 6" /></svg>
);

export const PanelLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="10" rx="2" />
    <path d="M6.5 3v10" />
  </svg>
);

export const Minus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 8h9" /></svg>
);

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 3.5v9M3.5 8h9" /></svg>
);

/** Viewfinder — snip a region of the page to ask the tutor about. */
export const Snip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 5V4A1.5 1.5 0 0 1 4 2.5h1M11 2.5h1A1.5 1.5 0 0 1 13.5 4v1M13.5 11v1a1.5 1.5 0 0 1-1.5 1.5h-1M5 13.5H4A1.5 1.5 0 0 1 2.5 12v-1" />
    <path d="M6.25 8h3.5M8 6.25v3.5" />
  </svg>
);

/** A page of text with the companion's mark in its margin — the insights toggle. */
export const MarginNote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.5 4h7M6.5 8h7M6.5 12h4.5" />
    <circle cx="3" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const FitWidth = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 3.5v9M14 3.5v9" />
    <path d="M4.5 8h7M6.5 5.75 4.25 8l2.25 2.25M9.5 5.75 11.75 8 9.5 10.25" />
  </svg>
);

/** The Bookmark-T — the mark of AI presence, echoing the app icon. The stroke
 *  matches the fill purely to round the corners. */
export const Spark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, fill: "currentColor", strokeWidth: 0.9 })}>
    <path d="M3.6 3.1H12.4V5H9.7V12.7L8 10.8L6.3 12.7V5H3.6Z" />
  </svg>
);

export const Send = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 12.5v-9M4.25 7.25 8 3.5l3.75 3.75" /></svg>
);

export const Stop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
  </svg>
);

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m4 4 8 8M12 4l-8 8" /></svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m3 8.5 3.2 3L13 4.5" /></svg>
);

export const SummaryGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 4h10M3 8h10M3 12h6" /></svg>
);

export const QuizGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m3 4.2 1.2 1.2 2-2.2M3 10.2l1.2 1.2 2-2.2" />
    <path d="M8.5 5h4.5M8.5 11h4.5" />
  </svg>
);

export const ChatGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13.5 7.7c0 2.7-2.5 4.8-5.5 4.8-.7 0-1.4-.1-2-.3L2.5 13l.8-2.5c-.5-.8-.8-1.7-.8-2.8C2.5 5 5 2.9 8 2.9s5.5 2.1 5.5 4.8Z" />
  </svg>
);

export const ProjectGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5.5 5-3 3 3 3M10.5 5l3 3-3 3" /></svg>
);

export const FolderOpen = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h4A1.5 1.5 0 0 1 13 6v1" />
    <path d="M3.6 7h9.9a1 1 0 0 1 .96 1.27l-1 3.5a1 1 0 0 1-.96.73H3.5a1.5 1.5 0 0 1-1.5-1.5V8.3A1.3 1.3 0 0 1 3.6 7Z" />
  </svg>
);

export const PageMark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="2" width="9" height="12" rx="1.5" />
    <path d="M6 5.5h4M6 8h4M6 10.5h2.2" />
  </svg>
);

export const Trash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1" />
    <path d="M4.5 4.5 5 12.4a1.2 1.2 0 0 0 1.2 1.1h3.6A1.2 1.2 0 0 0 11 12.4l.5-7.9" />
  </svg>
);

export const ArrowUpRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" /></svg>
);

// ── Annotation suite ──────────────────────────────────────────────────

/** A pen drawing a line — the markup-mode toggle and the pen tool. */
export const PenLine = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9.7 3.3 3 3L6.4 12.6l-3.6.9.9-3.6 6-6.6Z" />
    <path d="M3 14.5h10" />
  </svg>
);

/** Chisel-nib highlighter. */
export const HighlighterGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m8.2 3.6 4.2 4.2-4.7 4.7H4v-3.7l4.2-5.2Z" />
    <path d="m10.3 1.9 3.8 3.8" />
  </svg>
);

export const UnderlineGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5" />
    <path d="M3.5 13.5h9" />
  </svg>
);

export const StrikeGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M11.3 4.6C10.7 3.3 9.4 2.7 8 2.7c-1.9 0-3.3 1-3.3 2.5 0 .9.5 1.6 1.5 2" />
    <path d="M5 11.4c.5 1.3 1.7 1.9 3 1.9 1.9 0 3.4-1 3.4-2.6 0-.6-.2-1.1-.6-1.5" />
    <path d="M2.5 8h11" />
  </svg>
);

/** Text tool — a T with an insertion caret. */
export const TextTool = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 4.5V3h8v1.5M7 3v9M5.5 12h3" />
    <path d="M13 6.5v6" />
  </svg>
);

export const CursorArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 2.8 12.6 9l-3.7.7 2 3.4-1.9 1.1-2-3.4-2.5 2.7V2.8Z" />
  </svg>
);

export const EraserGlyph = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9.2 3 3.8 3.8-6 6H4.2L2.4 11a1.5 1.5 0 0 1 0-2.1L9.2 3Z" />
    <path d="M13.5 12.8H8" />
  </svg>
);

export const Undo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.7 3.5 3 6.2l2.7 2.7" />
    <path d="M3 6.2h6.3a3.7 3.7 0 0 1 0 7.4H6" />
  </svg>
);

export const Redo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10.3 3.5 13 6.2l-2.7 2.7" />
    <path d="M13 6.2H6.7a3.7 3.7 0 0 0 0 7.4H10" />
  </svg>
);

/** Folded-corner sticky note, filled with the note's own color — the user's
 *  mark on the page (the companion's Bookmark-T stays in the margin). */
export function StickyNoteGlyph(props: { fill: string; size?: number }) {
  const s = props.size ?? 18;
  return (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 4A1.5 1.5 0 0 1 4 2.5h10A1.5 1.5 0 0 1 15.5 4v6.8l-4.7 4.7H4A1.5 1.5 0 0 1 2.5 14V4Z"
        fill={props.fill}
        stroke="rgba(0,0,0,0.25)"
      />
      <path d="M15.5 10.8l-4.7 4.7v-3.2a1.5 1.5 0 0 1 1.5-1.5h3.2Z" fill="rgba(0,0,0,0.26)" />
    </svg>
  );
}

/** The bare Bookmark-T at margin-mark size — AI presence on the page itself.
 *  Colored by the parent (currentColor). */
export const BookmarkMark = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5.4 4.7H18.6V7.5H14.5V19.1L12 16.2L9.5 19.1V7.5H5.4Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);

/** The app mark: the Bookmark-T on an ink tile — the same glyph as the
 *  app icon. Used in the window chrome, home nav, and empty states. */
export function LogoMark(props: { size?: number }) {
  const s = props.size ?? 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="var(--logo-tile, #0D1410)" stroke="var(--line-strong)" />
      <path
        d="M5.4 4.7H18.6V7.5H14.5V19.1L12 16.2L9.5 19.1V7.5H5.4Z"
        fill="var(--accent)"
        stroke="var(--accent)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
