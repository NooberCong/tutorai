/** Where a page's pictures are, so the reader can open them to zoom into.
 *
 *  Replays the transforms of the operator list the canvas render already holds
 *  and takes each painted image's box: an image is drawn as the unit square
 *  under the current matrix. Images that touch or overlap are joined (a figure
 *  is often stored as tiles or strips), then two kinds are left out — a scan or
 *  background covering most of the page, where a click is for the text on it,
 *  and anything as small as a bullet or a logo. */

import { OPS, type PDFPageProxy } from "pdfjs-dist";
import { IDENTITY, asMatrix, cachedOperatorList, mul, type Matrix } from "./pdfOps";

/** A rect in fractions of the page, as links and snips are. */
export interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The shortest side, in PDF points, that still makes a picture (half an inch). */
const MIN_SIDE_PT = 36;
/** The share of the page above which an image is the page itself. */
const MAX_PAGE_SHARE = 0.8;
/** How close, in points, two images may sit and still be one figure. */
const JOIN_PT = 1;

/** The page's pictures, or null when pdf.js no longer holds its operator list
 *  (call right after the page renders). */
export function pageImages(page: PDFPageProxy): PageRect[] | null {
  const ops = cachedOperatorList(page);
  if (!ops) return null;
  const viewport = page.getViewport({ scale: 1 });
  const boxes: Box[] = [];
  const stack: Matrix[] = [];
  let ctm = IDENTITY;
  let inAnnotation = 0;

  const { fnArray, argsArray } = ops;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    switch (fn) {
      case OPS.beginAnnotation:
        inAnnotation++;
        break;
      case OPS.endAnnotation:
        inAnnotation = Math.max(0, inAnnotation - 1);
        break;
      case OPS.save:
      case OPS.beginGroup: // a group's matrix arrives with its form's paintFormXObjectBegin
        stack.push(ctm);
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push(ctm);
        const m = asMatrix(args?.[0]);
        if (m) ctm = mul(ctm, m);
        break;
      }
      case OPS.restore:
      case OPS.endGroup:
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.transform:
        ctm = mul(ctm, asMatrix(args) ?? IDENTITY);
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
        // Annotation appearances (stamps, signatures) aren't the page's own.
        if (!inAnnotation) boxes.push(unitSquareBox(ctm, viewport));
        break;
    }
  }

  const pageArea = viewport.width * viewport.height;
  return join(boxes)
    .filter(
      (b) =>
        b.x1 - b.x0 >= MIN_SIDE_PT &&
        b.y1 - b.y0 >= MIN_SIDE_PT &&
        (b.x1 - b.x0) * (b.y1 - b.y0) <= MAX_PAGE_SHARE * pageArea,
    )
    .map((b) => ({
      x: b.x0 / viewport.width,
      y: b.y0 / viewport.height,
      w: (b.x1 - b.x0) / viewport.width,
      h: (b.y1 - b.y0) / viewport.height,
    }));
}

/** A rect in viewport points (scale 1, y down). */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The viewport-space bounds of the unit square under `m` — where pdf.js paints
 *  an image. Through the viewport, so a rotated page lands right. */
function unitSquareBox(m: Matrix, viewport: { convertToViewportPoint(x: number, y: number): number[] }): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const [x, y] = viewport.convertToViewportPoint(m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]);
    xs.push(x);
    ys.push(y);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Merge boxes that touch or overlap until none do. */
function join(boxes: Box[]): Box[] {
  const out: Box[] = [];
  for (let box of boxes) {
    // Absorb every kept box this one meets; the grown box may now meet others
    // already passed, so rescan until it settles.
    for (let i = 0; i < out.length; ) {
      const o = out[i];
      if (o.x0 <= box.x1 + JOIN_PT && box.x0 <= o.x1 + JOIN_PT && o.y0 <= box.y1 + JOIN_PT && box.y0 <= o.y1 + JOIN_PT) {
        box = { x0: Math.min(o.x0, box.x0), y0: Math.min(o.y0, box.y0), x1: Math.max(o.x1, box.x1), y1: Math.max(o.y1, box.y1) };
        out.splice(i, 1);
        i = 0;
      } else {
        i++;
      }
    }
    out.push(box);
  }
  return out;
}
