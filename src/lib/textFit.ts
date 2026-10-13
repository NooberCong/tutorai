/** Pixel-exact selection boxes for the pdf.js text layer.
 *
 *  pdf.js lays each text item (often a whole justified line) out as ONE span
 *  in a fallback font, stretched uniformly to the item's width. The ends line
 *  up, but every glyph inside drifts — the fallback's proportions and the
 *  line's justification spacing differ from the PDF's — so a selection
 *  highlight can sit half a word off the glyphs on the canvas.
 *
 *  This replays the page's text-showing operators to get every glyph's real
 *  position, then re-lays each span so every character boundary lands within
 *  a fraction of a pixel of it: in the PDF's own font where its character map
 *  is usable, with the line's justification as word/letter spacing, splitting
 *  into more spans (only ever between words) where one layout can't follow.
 *
 *  Cost: none until the pointer first reaches a page's text — pages nobody
 *  selects on never pay. Then the operator list is normally the one the
 *  canvas render already holds on the main thread; only if pdf.js has since
 *  freed it (page.cleanup() after a text extraction) is it fetched again,
 *  and that copy is dropped as soon as the glyphs are read. */

import { OPS, type PDFPageProxy, type PageViewport } from "pdfjs-dist";
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";

type Matrix = number[];

/** One drawn glyph, in PDF user space: baseline y and its horizontal extent
 *  (advance, including char/word spacing — the selectable slot). */
export interface Glyph {
  x0: number;
  x1: number;
  y: number;
  u: string;
}

interface PdfGlyph {
  unicode: string;
  width: number;
  isSpace: boolean;
}

interface FontObj {
  fontMatrix?: Matrix;
  isType3Font?: boolean;
  vertical?: boolean;
}

interface TextState {
  ctm: Matrix;
  tm: Matrix;
  x: number;
  y: number;
  lineX: number;
  lineY: number;
  leading: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  rise: number;
  font: FontObj | null;
  fontSize: number;
  fontDir: number;
}

interface OpList {
  fnArray: number[];
  argsArray: unknown[][];
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const FONT_IDENTITY: Matrix = [0.001, 0, 0, 0.001, 0, 0];
/** Max drift of any character boundary from its glyph, in CSS px. */
const TOLERANCE_PX = 0.25;

/** Operator args carry matrices as plain arrays or Float32Arrays. */
const asMatrix = (v: unknown): Matrix | null =>
  v != null && (Array.isArray(v) || ArrayBuffer.isView(v)) && (v as ArrayLike<number>).length === 6
    ? Array.from(v as ArrayLike<number>)
    : null;

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

type IntentStates = Map<unknown, { operatorList?: OpList & { lastChunk?: boolean }; renderTasks?: Set<unknown> }>;

/** pdf.js keeps operator lists per rendering intent on the page proxy.
 *  `_intentStates` is internal, so anything unexpected yields null and the
 *  layer simply stays as pdf.js laid it out. */
function intentStates(page: PDFPageProxy): IntentStates | null {
  const states = (page as unknown as { _intentStates?: unknown })._intentStates;
  return states instanceof Map ? (states as IntentStates) : null;
}

/** The completed display operator list the canvas render already fetched. */
function cachedOperatorList(page: PDFPageProxy): OpList | null {
  for (const state of intentStates(page)?.values() ?? []) {
    const list = state.operatorList;
    if (list?.lastChunk && Array.isArray(list.fnArray) && Array.isArray(list.argsArray)) return list;
  }
  return null;
}

/** Glyph positions of a page, from the operator list its canvas render
 *  already holds; null when pdf.js has freed it (see fetchPageGlyphs). */
export function cachedPageGlyphs(page: PDFPageProxy): Glyph[] | null {
  const ops = cachedOperatorList(page);
  return ops ? collectGlyphs(page, ops) : null;
}

/** Glyph positions of a page whose render's operator list was freed: fetch
 *  it again, then drop that copy so it isn't kept alive for nothing. */
export async function fetchPageGlyphs(page: PDFPageProxy): Promise<Glyph[]> {
  const ops = (await page.getOperatorList()) as unknown as OpList;
  const glyphs = collectGlyphs(page, ops);
  const states = intentStates(page);
  for (const [key, state] of states ?? []) {
    if (state.operatorList === ops && !state.renderTasks?.size) states!.delete(key);
  }
  return glyphs;
}

/** Walk the operator list mirroring pdf.js's CanvasGraphics text state, and
 *  collect upright horizontal glyphs. Anything else (rotated, mirrored,
 *  vertical text) yields no glyphs, so its items keep pdf.js's layout. */
function collectGlyphs(page: PDFPageProxy, ops: OpList): Glyph[] {
  const glyphs: Glyph[] = [];
  const stack: TextState[] = [];
  let st: TextState = {
    ctm: IDENTITY,
    tm: IDENTITY,
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    leading: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    rise: 0,
    font: null,
    fontSize: 0,
    fontDir: 1,
  };
  const setFont = (name: unknown, size: number) => {
    const objs = page.commonObjs;
    st.font = typeof name === "string" && objs.has(name) ? (objs.get(name) as FontObj) : null;
    st.fontDir = size < 0 ? -1 : 1;
    st.fontSize = Math.abs(size);
  };
  const moveText = (x: number, y: number) => {
    st.x = st.lineX += x;
    st.y = st.lineY += y;
  };
  let inAnnotation = 0;

  const { fnArray, argsArray } = ops;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    if (fn === OPS.beginAnnotation) inAnnotation++;
    else if (fn === OPS.endAnnotation) inAnnotation = Math.max(0, inAnnotation - 1);
    if (inAnnotation) continue; // annotation appearances aren't in the text content
    switch (fn) {
      case OPS.save:
      case OPS.beginGroup:
        stack.push({ ...st });
        break;
      case OPS.restore:
      case OPS.endGroup:
        st = stack.pop() ?? st;
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push({ ...st });
        const m = asMatrix(args?.[0]);
        if (m) st.ctm = mul(st.ctm, m);
        break;
      }
      case OPS.paintFormXObjectEnd:
        st = stack.pop() ?? st;
        break;
      case OPS.transform:
        st.ctm = mul(st.ctm, asMatrix(args) ?? IDENTITY);
        break;
      case OPS.beginText:
        st.tm = IDENTITY;
        st.x = st.y = st.lineX = st.lineY = 0;
        break;
      case OPS.setTextMatrix:
        st.tm = asMatrix(args?.[0]) ?? asMatrix(args) ?? IDENTITY;
        st.x = st.y = st.lineX = st.lineY = 0;
        break;
      case OPS.moveText:
        moveText(args![0] as number, args![1] as number);
        break;
      case OPS.setLeadingMoveText:
        st.leading = args![1] as number;
        moveText(args![0] as number, args![1] as number);
        break;
      case OPS.setLeading:
        st.leading = -(args![0] as number);
        break;
      case OPS.nextLine:
        moveText(0, st.leading);
        break;
      case OPS.setCharSpacing:
        st.charSpacing = args![0] as number;
        break;
      case OPS.setWordSpacing:
        st.wordSpacing = args![0] as number;
        break;
      case OPS.setHScale:
        st.hScale = (args![0] as number) / 100;
        break;
      case OPS.setTextRise:
        st.rise = args![0] as number;
        break;
      case OPS.setFont:
        setFont(args![0], args![1] as number);
        break;
      case OPS.setGState:
        for (const [key, value] of (args?.[0] ?? []) as [string, unknown][]) {
          if (key === "Font") {
            const [name, size] = value as [unknown, number];
            setFont(name, size);
          }
        }
        break;
      case OPS.showText:
        showText(st, (args?.[0] ?? []) as (PdfGlyph | number)[], glyphs);
        break;
    }
  }
  return glyphs;
}

/** Same advance math as CanvasGraphics.showText / showType3Text. */
function showText(st: TextState, list: (PdfGlyph | number)[], out: Glyph[]) {
  const font = st.font;
  const size = st.fontSize;
  if (!font || !size) return;
  const fm = font.fontMatrix ?? FONT_IDENTITY;
  const hs = st.hScale * st.fontDir;
  const m = mul(st.ctm, st.tm);
  const usable =
    !font.vertical &&
    hs > 0 &&
    m[0] > 0 &&
    m[3] > 0 &&
    Math.abs(m[1]) < 1e-6 * m[0] &&
    Math.abs(m[2]) < 1e-6 * m[3];
  const baseY = m[3] * (st.y + st.rise) + m[5];
  const toX = (tx: number) => m[0] * tx + m[4];
  let x = 0;
  for (const g of list) {
    if (typeof g === "number") {
      x -= (g * size) / 1000;
      continue;
    }
    const spacing = (g.isSpace ? st.wordSpacing : 0) + st.charSpacing;
    const adv = font.isType3Font
      ? (g.width * fm[0] + fm[4]) * size + spacing
      : g.width * size * fm[0] + spacing * st.fontDir;
    if (usable) {
      out.push({ x0: toX(st.x + x * hs), x1: toX(st.x + (x + adv) * hs), y: baseY, u: g.unicode ?? "" });
    }
    x += adv;
  }
  st.x += x * hs;
}

const normCache = new Map<string, string>();
const norm = (u: string) => {
  let n = normCache.get(u);
  if (n === undefined) {
    n = u.normalize("NFKC");
    normCache.set(u, n);
  }
  return n;
};

/** Each character's left edge (plus the end) in user-space x for one text
 *  item, from the glyph stream; null when the item can't be matched exactly. */
function charEdges(item: TextItem, glyphs: Glyph[], from: number): { edges: number[]; next: number } | null {
  const [a, b, c, d, ox, oy] = item.transform;
  const str = item.str;
  if (!str || a <= 0 || d <= 0 || Math.abs(b) > 1e-6 * a || Math.abs(c) > 1e-6 * d) return null;
  if (item.dir === "rtl") return null;
  const eps = Math.max(0.01, 0.05 * Math.hypot(c, d));
  const isStart = (g: Glyph) => Math.abs(g.x0 - ox) < eps && Math.abs(g.y - oy) < eps;
  let start = -1;
  for (let j = from; j < glyphs.length; j++) if (isStart(glyphs[j])) { start = j; break; }
  if (start < 0) for (let j = 0; j < from; j++) if (isStart(glyphs[j])) { start = j; break; }
  if (start < 0) return null;

  const edges = new Array<number>(str.length + 1);
  let k = 0;
  let j = start;
  let pos = glyphs[start].x0;
  while (k < str.length) {
    const g = glyphs[j];
    const u = g && Math.abs(g.y - oy) < eps ? norm(g.u) : null;
    if (u && str.startsWith(u, k)) {
      for (let t = 0; t < u.length; t++) edges[k + t] = g.x0 + ((g.x1 - g.x0) * t) / u.length;
      pos = g.x1;
      k += u.length;
      j++;
    } else if (u && u.trim() === "" && /\s/.test(str[k])) {
      edges[k++] = g.x0; // e.g. a tab glyph the text content turned into a space
      pos = g.x1;
      j++;
    } else if (u !== null && u.trim() === "") {
      j++; // a blank glyph the text content dropped
      pos = g.x1;
    } else if (/\s/.test(str[k])) {
      edges[k++] = pos; // a space pdf.js inserted for a gap; spans up to the next glyph
    } else {
      return null;
    }
  }
  edges[str.length] = pos;
  for (let t = 1; t < edges.length; t++) if (edges[t] < edges[t - 1] - eps) return null;
  return { edges, next: j };
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Advance of one character at 100px, per font family — advances scale
 *  linearly, so one table serves every size and zoom level. Fitted spans turn
 *  off kerning and ligatures, so their layout is exactly the sum of these. */
const widthCache = new Map<string, Map<string, number>>();
const MAX_CACHED_FAMILIES = 32;
const MEASURE_SIZE = 100;

function charWidth(ctx: CanvasRenderingContext2D, family: string, ch: string): number {
  let widths = widthCache.get(family);
  if (!widths) {
    if (widthCache.size >= MAX_CACHED_FAMILIES) widthCache.clear();
    widths = new Map();
    widthCache.set(family, widths);
  }
  let w = widths.get(ch);
  if (w === undefined) {
    const font = `${MEASURE_SIZE}px ${family}`;
    if (ctx.font !== font) ctx.font = font;
    w = ctx.measureText(ch).width / MEASURE_SIZE;
    widths.set(ch, w);
  }
  return w;
}

interface Run {
  s: number;
  e: number;
  /** Uniform horizontal stretch (CSS --scale-x). */
  scaleX: number;
  /** Extra advance per space before stretching, in CSS px. */
  wordSpacing: number;
  /** Extra advance per character before stretching, in CSS px. */
  letterSpacing: number;
  /** For a word no uniform layout can follow (a ligature, heavy kerning):
   *  each character's own extra advance, in CSS px, unstretched. */
  perChar?: number[];
}

const isSpaceChar = (ch: string) => ch === " " || ch === " ";
const isWs = (ch: string) => /\s/.test(ch);

/** Solve the m×m system in `M` (augmented, row-major, (m+1) columns) in
 *  place by Gauss-Jordan elimination; false when singular. */
function solveInPlace(M: Float64Array, m: number): boolean {
  const w = m + 1;
  for (let i = 0; i < m; i++) {
    let piv = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(M[r * w + i]) > Math.abs(M[piv * w + i])) piv = r;
    if (piv !== i) for (let c = 0; c < w; c++) [M[i * w + c], M[piv * w + c]] = [M[piv * w + c], M[i * w + c]];
    const d = M[i * w + i];
    if (Math.abs(d) < 1e-12) return false;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const f = M[r * w + i] / d;
      if (f) for (let c = i; c < w; c++) M[r * w + c] -= f * M[i * w + c];
    }
  }
  for (let i = 0; i < m; i++) M[i * w + m] /= M[i * w + i];
  return true;
}

const normal = new Float64Array(12);

/** Split `str` into the fewest runs that, laid out in `family` at `size` px
 *  with one uniform stretch plus uniform word and letter spacing (justified
 *  lines widen their spaces; some typesetters track words instead), put
 *  every character boundary within `tol` CSS px of the real one. Runs only
 *  ever break between words. `edges` are the true boundaries in CSS px. */
function planRuns(
  ctx: CanvasRenderingContext2D,
  family: string,
  size: number,
  str: string,
  edges: number[],
  tol: number,
): Run[] {
  const n = str.length;
  const pre = new Array<number>(n + 1);
  const spaces = new Array<number>(n + 1);
  pre[0] = spaces[0] = 0;
  for (let k = 1; k <= n; k++) {
    pre[k] = pre[k - 1] + size * charWidth(ctx, family, str[k - 1]);
    spaces[k] = spaces[k - 1] + (isSpaceChar(str[k - 1]) ? 1 : 0);
  }
  // Model, relative to the run start: edge(k) = A·P(k) + Bw·S(k) + Bl·C(k),
  // with P the laid-out advance, S the spaces and C the characters passed;
  // A is the stretch, Bw/A and Bl/A the word and letter spacing. The run's
  // end is weighted to land (near) exact. Returns the worst boundary error.
  const fitWith = (s: number, e: number, m: number): { run: Run; err: number } | null => {
    // Weighted least squares via the normal equations; columns P, S, C.
    const w = m + 1;
    const M = normal;
    M.fill(0, 0, m * w);
    const col = [0, 0, 0];
    for (let k = s + 1; k <= e; k++) {
      col[0] = pre[k] - pre[s];
      col[1] = spaces[k] - spaces[s];
      col[2] = k - s;
      const y = edges[k] - edges[s];
      const wt = k === e ? 1e4 : 1;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) M[i * w + j] += wt * col[i] * col[j];
        M[i * w + m] += wt * col[i] * y;
      }
    }
    for (let i = 0; i < m; i++) M[i * w + i] += 1e-9; // ridge: an all-zero column stays solvable
    if (!solveInPlace(M, m)) return null;
    const A = M[m];
    const Bw = m > 1 ? M[w + m] : 0;
    const Bl = m > 2 ? M[2 * w + m] : 0;
    if (!(A > 0)) return null;
    let err = 0;
    for (let k = s + 1; k <= e; k++) {
      const predicted = A * (pre[k] - pre[s]) + Bw * (spaces[k] - spaces[s]) + Bl * (k - s);
      err = Math.max(err, Math.abs(predicted - (edges[k] - edges[s])));
    }
    return { run: { s, e, scaleX: A, wordSpacing: Bw / A, letterSpacing: Bl / A }, err };
  };
  const models = (s: number, e: number) => (spaces[e] > spaces[s] ? [1, 2, 3] : [1, 3]);
  const measurable = (s: number, e: number) => pre[e] - pre[s] > 0 && edges[e] - edges[s] > 0;
  /** Simplest model within tolerance, or null. */
  const fit = (s: number, e: number): Run | null => {
    if (!measurable(s, e)) return null;
    for (const m of models(s, e)) {
      const r = fitWith(s, e, m);
      if (r && r.err <= tol) return r.run;
    }
    return null;
  };
  /** A word that must stay whole but no uniform layout fits: give every
   *  character its exact advance instead. */
  const perChar = (s: number, e: number): Run => {
    const extra: number[] = [];
    for (let k = s; k < e; k++) extra.push(edges[k + 1] - edges[k] - (pre[k + 1] - pre[k]));
    return { s, e, scaleX: 1, wordSpacing: 0, letterSpacing: 0, perChar: extra };
  };

  // Runs may only end between words: the browser's double-click word
  // selection stops at element edges, so a split inside a word would select
  // only part of it.
  const bounds: number[] = [];
  for (let k = 1; k <= n; k++) if (k === n || isWs(str[k]) !== isWs(str[k - 1])) bounds.push(k);

  const runs: Run[] = [];
  let bi = 0; // index into bounds of the first boundary past s
  for (let s = 0; s < n; ) {
    while (bounds[bi] <= s) bi++;
    // Usually the whole rest fits at once — skip the incremental search.
    const rest = fit(s, n);
    if (rest) {
      runs.push(rest);
      break;
    }
    // Longest fitting run from s ending on a boundary: gallop to bracket the
    // first failure, then binary-search inside the bracket.
    let good = -1;
    let bad = bounds.length;
    let best: Run | null = null;
    for (let step = 0; bi + step < bounds.length; step = step ? step * 2 : 1) {
      const next = fit(s, bounds[bi + step]);
      if (!next) {
        bad = bi + step;
        break;
      }
      good = bi + step;
      best = next;
    }
    while (good >= 0 && bad - good > 1) {
      const mid = (good + bad) >> 1;
      const next = fit(s, bounds[mid]);
      if (next) {
        good = mid;
        best = next;
      } else bad = mid;
    }
    best ??= perChar(s, bounds[bi]);
    runs.push(best);
    s = best.e;
  }
  return runs;
}

/** One text item matched to its glyphs. */
interface Piece {
  item: TextItem;
  div: HTMLElement;
  edges: number[];
  fontHeight: number;
}

/** Re-lay the text layer's spans so selections hug the canvas glyphs.
 *  `divs` are TextLayer.textDivs, parallel to the content's text items. */
export function fitTextLayer(
  glyphs: Glyph[],
  viewport: PageViewport,
  content: TextContent,
  divs: HTMLElement[],
): void {
  if (!glyphs.length) return;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  if (!ctx) return;

  const scale = viewport.scale;
  const { pageWidth, pageX } = viewport.rawDims as { pageWidth: number; pageX: number };
  const items = content.items.filter((it): it is TextItem => "str" in it);

  const pieces: (Piece | null)[] = [];
  let cursor = 0;
  for (let n = 0; n < items.length && n < divs.length; n++) {
    const item = items[n];
    const div = divs[n];
    pieces.push(null);
    // Split points must fall between whole characters: leave items with
    // surrogate pairs or combining marks to pdf.js.
    if (!div.isConnected || !item.str || /[\uD800-\uDFFF\p{M}]/u.test(item.str)) continue;
    const fit = charEdges(item, glyphs, cursor);
    if (!fit) continue;
    cursor = fit.next;
    const fontHeight = parseFloat(div.style.getPropertyValue("--font-height"));
    if (fontHeight > 0) pieces[n] = { item, div, edges: fit.edges, fontHeight };
  }

  const familyFor = new Map<string, string>();
  for (let n = 0; n < pieces.length; n++) {
    const first = pieces[n];
    if (!first) continue;
    // pdf.js sometimes cuts a word into two items (the PDF switches font
    // objects or sizes mid-word, e.g. small caps), and double-click word
    // selection stops at element edges. Pieces that touch on the same
    // baseline become one; a word no layout can follow is placed per char.
    const group = [first];
    for (let next = pieces[n + 1]; next; next = pieces[n + group.length]) {
      const last = group[group.length - 1];
      const touching =
        !last.item.hasEOL &&
        last.div.nextSibling === next.div &&
        Math.max(next.fontHeight, last.fontHeight) <= 2.5 * Math.min(next.fontHeight, last.fontHeight) &&
        Math.abs(next.item.transform[5] - last.item.transform[5]) < 0.01 * last.fontHeight &&
        Math.abs(next.edges[0] - last.edges[last.edges.length - 1]) < 0.15 * last.fontHeight;
      if (!touching) break;
      group.push(next);
    }
    n += group.length - 1;
    // Style (top, size, font) from the tallest piece, so a small-caps word's
    // highlight covers its capital too.
    const { item } = first;
    const { div, fontHeight } = group.reduce((a, b) => (b.fontHeight > a.fontHeight ? b : a));
    const str = group.map((p) => p.item.str).join("");
    const edges = group.flatMap((p, i) => (i < group.length - 1 ? p.edges.slice(0, -1) : p.edges));

    // The fewer runs the better. The PDF's own font — already loaded for the
    // canvas under the item's font name — has the true advances wherever its
    // character map is usable; else the fallback pdf.js picked or the other
    // generic family. Which tracks the glyphs best is a property of the font,
    // so the first longer line in each one decides for the rest of the page.
    const px = edges.map((x) => (x - edges[0]) * scale);
    const fallback = div.style.fontFamily;
    const decided = familyFor.get(item.fontName);
    const candidates = decided ? [decided] : new Set([`"${item.fontName}", ${fallback}`, fallback, "serif", "sans-serif"]);
    let best: { family: string; runs: Run[] } | null = null;
    for (const family of candidates) {
      const runs = planRuns(ctx, family, fontHeight * scale, str, px, TOLERANCE_PX);
      if (!best || runs.length < best.runs.length) best = { family, runs };
      if (runs.length === 1) break;
    }
    if (!best) continue;
    if (!decided && str.length >= 20) familyFor.set(item.fontName, best.family);
    const { family, runs } = best;
    const em = fontHeight * scale;
    const spans = runs.map(({ s, e, scaleX, wordSpacing, letterSpacing, perChar }) => {
      const span = div.cloneNode(false) as HTMLElement;
      if (perChar) {
        // Inline children keep the word one element for double-click word
        // selection; each carries its character's advance as letter-spacing.
        // Not spans, so the layer's span rules (and anchor lookups) skip them.
        for (let k = s; k < e; k++) {
          const extra = perChar[k - s];
          if (Math.abs(extra) < 1e-3) {
            span.append(str[k]);
            continue;
          }
          const c = document.createElement("fit-c");
          c.textContent = str[k];
          c.style.letterSpacing = `${extra / em}em`;
          span.append(c);
        }
      } else {
        span.textContent = str.slice(s, e);
      }
      span.style.fontFamily = family;
      span.style.fontKerning = "none";
      span.style.fontVariantLigatures = "none";
      span.style.left = `${((100 * (edges[s] - pageX)) / pageWidth).toFixed(4)}%`;
      span.style.setProperty("--scale-x", String(scaleX));
      // In em: pdf.js lays spans out at a multiple of the font size and
      // scales them back, so px would be off by that factor.
      if (Math.abs(wordSpacing) > 1e-3) span.style.wordSpacing = `${wordSpacing / em}em`;
      if (Math.abs(letterSpacing) > 1e-3) span.style.letterSpacing = `${letterSpacing / em}em`;
      return span;
    });
    for (const p of group.slice(1)) p.div.remove();
    first.div.replaceWith(...spans);
  }
}
