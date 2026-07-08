/** Pure geometry for the annotation layer: client↔fraction conversion,
 *  selection→markup rects, hit-testing, and ink outlines. No React. */

import { getStroke } from "perfect-freehand";
import type { Annotation, FracRect, InkAnnot } from "./types";

export const QUOTE_CAP = 1000;

/** Client coords → page-fraction coords, clamped to [0,1]. Measures the live
 *  bounding rect, so it's correct even mid CSS-transform reflow. */
export function clientToFrac(
  pageEl: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = pageEl.getBoundingClientRect();
  return {
    x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1),
  };
}

export interface PageMarkup {
  page: number;
  rects: FracRect[];
  quote: string;
}

/** Selection → per-page line rects + quote. Rects come from the Range's
 *  client rects over the text layer; each is assigned to the page containing
 *  its center (a selection can span pages), converted to fractions, and
 *  merged per visual line so a highlight is one clean bar per line. */
export function selectionToMarkups(
  selection: Selection,
  host: HTMLElement,
): PageMarkup[] {
  if (selection.isCollapsed || selection.rangeCount === 0) return [];
  const quote = selection.toString().replace(/\s+/g, " ").trim().slice(0, QUOTE_CAP);
  if (!quote) return [];

  const pages = Array.from(host.querySelectorAll<HTMLElement>("[data-page]")).map(
    (el) => ({ num: Number(el.dataset.page), rect: el.getBoundingClientRect() }),
  );
  if (!pages.length) return [];

  const byPage = new Map<number, FracRect[]>();
  for (let r = 0; r < selection.rangeCount; r++) {
    for (const c of selection.getRangeAt(r).getClientRects()) {
      if (c.width < 1 || c.height < 1) continue;
      const cy = c.top + c.height / 2;
      const page = pages.find((p) => cy >= p.rect.top && cy <= p.rect.bottom);
      if (!page || !page.rect.width || !page.rect.height) continue;
      // Junk rects (container/sentinel spans) are taller than any text line.
      if (c.height / page.rect.height > 0.15) continue;
      const frac: FracRect = {
        x: (c.left - page.rect.left) / page.rect.width,
        y: (c.top - page.rect.top) / page.rect.height,
        w: c.width / page.rect.width,
        h: c.height / page.rect.height,
      };
      const list = byPage.get(page.num);
      if (list) list.push(frac);
      else byPage.set(page.num, [frac]);
    }
  }

  const result: PageMarkup[] = [];
  for (const [page, rects] of byPage) {
    const merged = mergeLineRects(rects);
    if (merged.length) result.push({ page, rects: merged, quote });
  }
  return result.sort((a, b) => a.page - b.page);
}

/** Group rects into visual lines (≥50% vertical overlap), then merge
 *  horizontally-adjacent fragments within a line. Fragments separated by a
 *  real gap (e.g. a column gutter) stay separate rects. */
function mergeLineRects(rects: FracRect[]): FracRect[] {
  const GAP = 0.012; // max horizontal gap (page widths) still "the same run"
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: FracRect[][] = [];
  for (const r of sorted) {
    const line = lines.find((l) => {
      const other = l[0];
      const overlap =
        Math.min(r.y + r.h, other.y + other.h) - Math.max(r.y, other.y);
      return overlap >= 0.5 * Math.min(r.h, other.h);
    });
    if (line) line.push(r);
    else lines.push([r]);
  }
  const out: FracRect[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let cur = { ...line[0] };
    for (let i = 1; i < line.length; i++) {
      const r = line[i];
      if (r.x <= cur.x + cur.w + GAP) {
        const right = Math.max(cur.x + cur.w, r.x + r.w);
        const top = Math.min(cur.y, r.y);
        cur.h = Math.max(cur.y + cur.h, r.y + r.h) - top;
        cur.y = top;
        cur.w = right - cur.x;
      } else {
        out.push(cur);
        cur = { ...r };
      }
    }
    out.push(cur);
  }
  return out;
}

/** Bounding box of an annotation in fraction coords. */
export function annotBounds(a: Annotation): FracRect {
  switch (a.type) {
    case "highlight":
    case "underline":
    case "strikethrough": {
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const r of a.rects) {
        x0 = Math.min(x0, r.x);
        y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w);
        y1 = Math.max(y1, r.y + r.h);
      }
      return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    }
    case "note":
      return { x: a.at.x, y: a.at.y, w: 0, h: 0 };
    case "freetext":
      return a.rect;
    case "ink": {
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const [x, y] of a.points) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    }
  }
}

/** Topmost annotation under a point. Math runs in page units (pw/ph = page
 *  size at scale 1) so the tolerance is isotropic. Last created wins. */
export function hitTest(
  annots: Annotation[],
  pt: { x: number; y: number },
  pw: number,
  ph: number,
  tolUnits: number,
  filter?: (a: Annotation) => boolean,
): Annotation | null {
  const px = pt.x * pw;
  const py = pt.y * ph;
  const inRect = (r: FracRect, pad: number) =>
    px >= r.x * pw - pad &&
    px <= (r.x + r.w) * pw + pad &&
    py >= r.y * ph - pad &&
    py <= (r.y + r.h) * ph + pad;

  for (let i = annots.length - 1; i >= 0; i--) {
    const a = annots[i];
    if (filter && !filter(a)) continue;
    switch (a.type) {
      case "highlight":
      case "underline":
      case "strikethrough":
        if (a.rects.some((r) => inRect(r, tolUnits / 2))) return a;
        break;
      case "note":
        if (Math.hypot(a.at.x * pw - px, a.at.y * ph - py) <= tolUnits + 8) return a;
        break;
      case "freetext":
        if (inRect(a.rect, tolUnits / 2)) return a;
        break;
      case "ink": {
        const reach = tolUnits + a.width / 2;
        const pts = a.points;
        for (let j = 0; j < pts.length - 1; j++) {
          if (
            segmentDistance(
              px, py,
              pts[j][0] * pw, pts[j][1] * ph,
              pts[j + 1][0] * pw, pts[j + 1][1] * ph,
            ) <= reach
          ) {
            return a;
          }
        }
        if (pts.length === 1 && Math.hypot(pts[0][0] * pw - px, pts[0][1] * ph - py) <= reach) {
          return a;
        }
        break;
      }
    }
  }
  return null;
}

function segmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / len2, 0), 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── Ink outlines ──────────────────────────────────────────────────────

/** Raw input points (fractions) → smoothed outline path in page units.
 *  Cached per annotation object — annotations are immutable, so identity
 *  is a valid cache key; page dims never change for a given annotation. */
const strokeCache = new WeakMap<InkAnnot, string>();

export function strokePathPageUnits(a: InkAnnot, pw: number, ph: number): string {
  const cached = strokeCache.get(a);
  if (cached) return cached;
  const d = buildStrokePath(
    a.points.map(([x, y, p]) => [x * pw, y * ph, p] as [number, number, number]),
    a.width,
    a.mode,
    a.points.every(([, , p]) => p === 0.5),
  );
  strokeCache.set(a, d);
  return d;
}

/** Uncached variant for the live, in-progress stroke. */
export function buildStrokePath(
  points: [number, number, number][],
  width: number,
  mode: "pen" | "highlighter",
  simulatePressure: boolean,
): string {
  const outline = getStroke(points, {
    size: width,
    thinning: mode === "pen" ? 0.55 : 0,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure,
    last: true,
  });
  return outlineToPath(outline);
}

/** perfect-freehand outline polygon → closed SVG path (quadratic-smoothed). */
function outlineToPath(outline: number[][]): string {
  if (!outline.length) return "";
  const avg = (a: number, b: number) => ((a + b) / 2).toFixed(2);
  let d = `M${outline[0][0].toFixed(2)} ${outline[0][1].toFixed(2)}Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${x0.toFixed(2)} ${y0.toFixed(2)} ${avg(x0, x1)} ${avg(y0, y1)} `;
  }
  return d + "Z";
}

/** Dot cursor at the pen's true on-screen size, tinted with the pen color. */
export function penCursor(color: string, diameterPx: number): string {
  const d = Math.min(Math.max(Math.round(diameterPx), 4), 32);
  const s = d + 4;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
    `<circle cx="${s / 2}" cy="${s / 2}" r="${d / 2}" fill="${color}" ` +
    `stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`;
  const mid = Math.round(s / 2);
  return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${mid} ${mid}, crosshair`;
}
