/** Ctrl+F engine: text folding for case/accent/whitespace-insensitive
 *  matching, whole-document search over the cached page texts, and match
 *  highlight geometry computed from pdf.js text items — no DOM involved, so
 *  rects (and thus precise jump targets) exist before a page ever mounts. */

import { Util } from "pdfjs-dist";
import { mergeLineRects } from "./annotGeometry";
import type { PdfDoc } from "./pdf";
import type { FracRect } from "./types";

// ── Folding ────────────────────────────────────────────────────────────

/** A folded string plus, per folded char, the index of the source char it
 *  came from. Folding lowercases, strips diacritics and soft hyphens,
 *  expands compatibility forms (ﬁ → fi), and collapses whitespace runs to
 *  single spaces (leading/trailing runs drop entirely). Matching folded
 *  query against folded text is what lets a hit cross line breaks,
 *  ligatures, and accents while offsets still map back to the source. */
export interface Folded {
  text: string;
  /** map[i] = source-string index folded char i came from. */
  map: Uint32Array;
}

const STRIP = /[\u0300-\u036f\u00ad]/g; // combining marks + soft hyphen

export function fold(source: string): Folded {
  let text = "";
  const map: number[] = [];
  let spaceAt = -1; // source index of a pending (collapsed) whitespace run
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code < 128) {
      if (code === 32 || (code >= 9 && code <= 13)) {
        if (spaceAt < 0) spaceAt = i;
        continue;
      }
      if (spaceAt >= 0 && text) {
        text += " ";
        map.push(spaceAt);
      }
      spaceAt = -1;
      text += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : source[i];
      map.push(i);
      continue;
    }
    // Non-ASCII: take the whole code point, then normalize it.
    const start = i;
    let cluster = source[i];
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < source.length) cluster += source[++i];
    const norm = cluster.normalize("NFKD").replace(STRIP, "").toLowerCase();
    if (!norm) continue; // folded away entirely (e.g. a lone soft hyphen)
    if (!norm.trim()) {
      // Exotic whitespace (nbsp & friends) — NFKD turns it into plain spaces.
      if (spaceAt < 0) spaceAt = start;
      continue;
    }
    if (spaceAt >= 0 && text) {
      text += " ";
      map.push(spaceAt);
    }
    spaceAt = -1;
    for (let k = 0; k < norm.length; k++) {
      text += norm[k];
      map.push(start);
    }
  }
  return { text, map: Uint32Array.from(map) };
}

/** Start offsets of every non-overlapping occurrence of `needle` in `hay`
 *  (both already folded). */
export function occurrences(hay: string, needle: string): number[] {
  const starts: number[] = [];
  if (!needle) return starts;
  let at = hay.indexOf(needle);
  while (at >= 0) {
    starts.push(at);
    at = hay.indexOf(needle, at + needle.length);
  }
  return starts;
}

// ── Document search ────────────────────────────────────────────────────

/** One match: page, ordinal among that page's matches, and offsets into the
 *  page's folded text. Snippets and rects are derived on demand. */
export interface SearchMatch {
  page: number;
  ord: number;
  start: number;
  end: number;
}

export interface SearchResult {
  /** Folded query — the single form both search and geometry match against. */
  query: string;
  /** At most MATCH_CAP matches, in document order. */
  matches: SearchMatch[];
  /** Exact count across the whole document, cap or no cap. */
  total: number;
  capped: boolean;
}

export interface Snippet {
  before: string;
  hit: string;
  after: string;
}

/** Kept matches are capped so a one-letter query on a 1000-page book can't
 *  balloon memory; `total` stays exact regardless. */
export const MATCH_CAP = 5000;

export class DocSearcher {
  /** Folded page texts (index i = page i+1); maps are dropped after folding
   *  and rebuilt per page on demand for snippets — they cost 4× the text. */
  private folded: string[];
  private snipCache = new Map<number, Folded>();
  readonly hasText: boolean;

  constructor(private pages: string[]) {
    this.folded = pages.map((p) => fold(p).text);
    this.hasText = this.folded.some((t) => t.length > 0);
  }

  /** Returns null for an effectively-empty query. */
  search(rawQuery: string): SearchResult | null {
    const query = fold(rawQuery).text;
    if (!query) return null;
    const matches: SearchMatch[] = [];
    let total = 0;
    for (let p = 0; p < this.folded.length; p++) {
      const starts = occurrences(this.folded[p], query);
      total += starts.length;
      for (let i = 0; i < starts.length && matches.length < MATCH_CAP; i++) {
        matches.push({ page: p + 1, ord: i, start: starts[i], end: starts[i] + query.length });
      }
    }
    return { query, matches, total, capped: total > matches.length };
  }

  /** Original-casing context around a match, for the results panel. */
  snippet(m: SearchMatch, context = 42): Snippet {
    const { map } = this.foldedWithMap(m.page);
    const src = this.pages[m.page - 1];
    const s0 = m.start < map.length ? map[m.start] : src.length;
    const s1 = Math.max(m.end <= map.length && m.end > 0 ? map[m.end - 1] + 1 : src.length, s0 + 1);
    const clean = (t: string) => t.replace(/\s+/g, " ");
    return {
      before: clean(src.slice(Math.max(0, s0 - context), s0)).trimStart(),
      hit: clean(src.slice(s0, s1)),
      after: clean(src.slice(s1, s1 + context)).trimEnd(),
    };
  }

  private foldedWithMap(page: number): Folded {
    const hit = this.snipCache.get(page);
    if (hit) return hit;
    const f = fold(this.pages[page - 1]);
    this.snipCache.set(page, f);
    if (this.snipCache.size > 48) {
      this.snipCache.delete(this.snipCache.keys().next().value!);
    }
    return f;
  }
}

// ── Highlight geometry ─────────────────────────────────────────────────

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
  fontName: string;
}

/** Query-independent text index for one page: items joined exactly like
 *  extractPages joins them (str + "\n" on EOL else " "), then folded — so
 *  the folded text here is identical to the folded pages.json text and
 *  match counts/ordinals always agree between the two tiers. */
interface PageTextIndex {
  folded: Folded;
  items: TextItem[];
  /** Offset in the joined source string where each item's str starts. */
  itemStart: number[];
  viewW: number;
  viewH: number;
  /** Viewport transform at scale 1 (handles page rotation). */
  transform: number[];
  /** fontName → text style, for the fallback fontFamily used in measuring. */
  styles: Record<string, { fontFamily?: string }>;
}

const indexCache = new WeakMap<PdfDoc, Map<number, PageTextIndex>>();
const INDEX_CACHE_PAGES = 64;

async function pageTextIndex(pdf: PdfDoc, pageNum: number): Promise<PageTextIndex> {
  let perDoc = indexCache.get(pdf);
  if (!perDoc) indexCache.set(pdf, (perDoc = new Map()));
  const hit = perDoc.get(pageNum);
  if (hit) return hit;

  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  const itemStart: number[] = [];
  let joined = "";
  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const item = raw as TextItem;
    itemStart.push(joined.length);
    items.push(item);
    joined += item.str + (item.hasEOL ? "\n" : " ");
  }
  const index: PageTextIndex = {
    folded: fold(joined),
    items,
    itemStart,
    viewW: vp.width,
    viewH: vp.height,
    transform: vp.transform,
    styles: content.styles,
  };
  perDoc.set(pageNum, index);
  if (perDoc.size > INDEX_CACHE_PAGES) perDoc.delete(perDoc.keys().next().value!);
  return index;
}

/** Highlight rects for every occurrence of `foldedQuery` on one page —
 *  one FracRect group per match, in document order, aligned with
 *  DocSearcher ordinals. */
export async function pageMatchRects(
  pdf: PdfDoc,
  pageNum: number,
  foldedQuery: string,
): Promise<FracRect[][]> {
  const idx = await pageTextIndex(pdf, pageNum);
  const { map } = idx.folded;
  return occurrences(idx.folded.text, foldedQuery).map((s) => {
    const end = s + foldedQuery.length;
    const from = map[s];
    const to = Math.max(end <= map.length && end > 0 ? map[end - 1] + 1 : from + 1, from + 1);
    return matchRects(idx, from, to);
  });
}

/** Rects covering source chars [from, to) of the joined page string. */
function matchRects(idx: PageTextIndex, from: number, to: number): FracRect[] {
  const rects: FracRect[] = [];
  const { items, itemStart } = idx;
  let i = Math.max(0, upperBound(itemStart, from) - 1);
  for (; i < items.length && itemStart[i] < to; i++) {
    const item = items[i];
    const a = Math.max(0, from - itemStart[i]);
    const b = Math.min(item.str.length, to - itemStart[i]);
    if (b <= a) continue; // overlap is only this item's joiner char
    const r = sliceRect(idx, item, a, b);
    if (r) rects.push(r);
  }
  return mergeLineRects(rects);
}

/** First index with arr[i] > v (arr ascending). */
function upperBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Measuring context for glyph advances. The pdf.js text layer lays glyphs
 *  out in the style's fallback fontFamily scaled to the item's total width;
 *  measuring prefixes the same way puts our rects on the same glyphs, where
 *  equal-per-char slicing drifts visibly in proportional fonts. */
let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Fractions of the item's advance consumed by chars [0,a) and [0,b). */
function advanceFractions(
  idx: PageTextIndex,
  item: TextItem,
  a: number,
  b: number,
): [number, number] {
  const n = item.str.length;
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (measureCtx) {
    const family = idx.styles[item.fontName]?.fontFamily || "sans-serif";
    measureCtx.font = `64px ${family}`;
    const full = measureCtx.measureText(item.str).width;
    if (full > 0) {
      return [
        a > 0 ? measureCtx.measureText(item.str.slice(0, a)).width / full : 0,
        b < n ? measureCtx.measureText(item.str.slice(0, b)).width / full : 1,
      ];
    }
  }
  return [a / n, b / n];
}

/** Rect for chars [a,b) of one item, in page fractions. Char offsets become
 *  distances via measured glyph advances scaled to the item width.
 *  General for any page rotation: slide along the baseline vector, extend
 *  by the font's up vector, take the axis-aligned box — for unrotated text
 *  this reduces exactly to {x, baseline−fontHeight, w, fontHeight}. */
function sliceRect(idx: PageTextIndex, item: TextItem, a: number, b: number): FracRect | null {
  const tx = Util.transform(idx.transform, item.transform);
  const fontH = Math.hypot(tx[2], tx[3]);
  const dirLen = Math.hypot(tx[0], tx[1]);
  const n = item.str.length;
  if (!fontH || !dirLen || !item.width || !n) return null;
  const dx = tx[0] / dirLen;
  const dy = tx[1] / dirLen;
  const [fa, fb] = advanceFractions(idx, item, a, b);
  const off = item.width * fa;
  const len = item.width * (fb - fa);
  const x0 = tx[4] + dx * off;
  const y0 = tx[5] + dy * off;
  const xs = [x0, x0 + dx * len, x0 + tx[2], x0 + dx * len + tx[2]];
  const ys = [y0, y0 + dy * len, y0 + tx[3], y0 + dy * len + tx[3]];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left / idx.viewW,
    y: top / idx.viewH,
    w: (Math.max(...xs) - left) / idx.viewW,
    h: (Math.max(...ys) - top) / idx.viewH,
  };
}
