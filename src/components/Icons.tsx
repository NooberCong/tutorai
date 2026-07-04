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

export const FitWidth = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 3.5v9M14 3.5v9" />
    <path d="M4.5 8h7M6.5 5.75 4.25 8l2.25 2.25M9.5 5.75 11.75 8 9.5 10.25" />
  </svg>
);

/** Four-point spark — the mark of AI presence, echoing the app icon. */
export const Spark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}>
    <path d="M8 1.6c.9 3.2 2.2 4.5 5.4 5.4.4.1.4.6 0 .7-3.2.9-4.5 2.2-5.4 5.4-.1.4-.6.4-.7 0-.9-3.2-2.2-4.5-5.4-5.4-.4-.1-.4-.6 0-.7 3.2-.9 4.5-2.2 5.4-5.4.1-.4.6-.4.7 0Z" />
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

/** The app mark: the tutor's spark on an ink tile — the same glyph as the
 *  app icon. Used in the window chrome, home nav, and empty states. */
export function LogoMark(props: { size?: number }) {
  const s = props.size ?? 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="var(--logo-tile, #0D1410)" stroke="var(--line-strong)" />
      <path
        d="M12 4.3 Q12 11.9 19.7 11.9 Q12 11.9 12 19.5 Q12 11.9 4.3 11.9 Q12 11.9 12 4.3 Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
