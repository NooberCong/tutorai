/** A tiny pixel-art rasterizer for the hatchery's creatures and eggs.
 *
 *  Sprites are authored as layered *parts* built from shape primitives
 *  (ellipses, tapered capsules, polylines, polygons), never as hand-typed
 *  pixel grids — shape composition is reliable to author and to tweak, while
 *  per-pixel placement is not. The rasterizer then applies the rules a pixel
 *  artist would by hand, identically for every sprite, which is what keeps a
 *  hundred-plus creatures reading as one art style:
 *
 *   - each part's primitives are smooth-unioned into one signed distance
 *     field, sampled at pixel centers → clean, pixel-perfect silhouettes;
 *   - the SDF is inflated into a dome height field and lit from the top-left
 *     → rounded "puffy" shading quantized onto the material's hue-shifted
 *     ramp (color.ts), no dithering;
 *   - a part drawn over another casts a one-pixel dark separation line onto
 *     it, so overlapping forms (ear over head, paw over belly) stay legible;
 *   - lone pixels whose shade none of their neighbours share are merged
 *     into their surroundings — quantization noise, never intent;
 *   - a one-pixel outline in each material's own darkest hue wraps the
 *     silhouette (never flat black), a step softer on the lit side;
 *   - small hand-authored decals (eyes, blush, mouths, sparkles) go on last.
 *
 *  Pure TS with no DOM so the same code renders in the app (to canvas) and
 *  in `scripts/sprite-sheet.ts` (to PNG contact sheets for review). */

import { BASE, DARK, LIGHT, OUTLINE, SHADOW, SHINE, hexToRgb, makeRamp } from "./color.ts";

export type V = [number, number];

export type Prim =
  /** Ellipse centered at c with radii r, rotated by rot degrees. */
  | { k: "ell"; c: V; r: V; rot?: number }
  /** Capsule from a (radius ra) to b (radius rb) — limbs, horns, tails. */
  | { k: "cap"; a: V; b: V; ra: number; rb: number }
  /** Tapered stroke through points, radius interpolated r0 → r1. */
  | { k: "path"; pts: V[]; r0: number; r1: number }
  /** Polygon (any winding), optionally inflated by `round`. */
  | { k: "poly"; pts: V[]; round: number }
  /** Egg: ellipse whose top narrows by `taper` (0–0.4). */
  | { k: "egg"; c: V; r: V; taper: number };

export interface Paint {
  mat: string;
  prims: Prim[];
  cut?: Prim[];
  /** Force a ramp level instead of inheriting the part's shading. */
  level?: number;
}

export interface Part {
  mat: string;
  prims: Prim[];
  /** Subtracted from the union. */
  cut?: Prim[];
  /** Smooth-union blend radius in pixels (0 = hard union). Default 1. */
  blend?: number;
  /** Dome radius for shading; larger = rounder, softer falloff. Defaults to
   *  the part's own thickness, i.e. it shades as a full ellipsoid. */
  round?: number;
  /** Far-side limb or wing: shaded one ramp step darker, reads as depth. */
  back?: boolean;
  /** Cast a separation line on parts beneath. Default true. */
  line?: boolean;
  /** Emissive (flame, crystal, glow): lit from the core outward, no shadow. */
  glow?: boolean;
  /** Recolor regions of this part, keeping its shading (bellies, spots). */
  paint?: Paint[];
  /** Worn on top (accessories): the creature's own decals — eyes, blush,
   *  mouths — don't paint over it; only decals marked `cover` do. */
  cover?: boolean;
}

/** An ink is "mat:level" (a ramp step of a palette material) or "#rrggbb". */
export type Ink = string;

export interface Decal {
  /** Top-left pixel. */
  x: number;
  y: number;
  /** Rows of characters; '.' and ' ' are transparent. */
  rows: string[];
  inks: Record<string, Ink>;
  /** Draw after the outline pass (things that float outside the body). */
  over?: boolean;
  /** Belongs with `cover` parts, so it may paint over them. */
  cover?: boolean;
}

export interface Drawing {
  parts: Part[];
  decals?: Decal[];
}

export type Palette = Record<string, string>;

export interface Sprite {
  w: number;
  h: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray;
}

export const SIZE = 32;

// ── primitive constructors (terse on purpose: recipes use hundreds) ──

export const ell = (cx: number, cy: number, rx: number, ry = rx, rot = 0): Prim => ({
  k: "ell", c: [cx, cy], r: [rx, ry], rot,
});
export const cap = (ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Prim => ({
  k: "cap", a: [ax, ay], b: [bx, by], ra, rb,
});
export const path = (pts: V[], r0: number, r1 = r0): Prim => ({ k: "path", pts, r0, r1 });
export const poly = (pts: V[], round = 0): Prim => ({ k: "poly", pts, round });
export const egg = (cx: number, cy: number, rx: number, ry: number, taper = 0.18): Prim => ({
  k: "egg", c: [cx, cy], r: [rx, ry], taper,
});

/** Mirror a primitive across the sprite's vertical center line. */
export function mirror(p: Prim, w = SIZE): Prim {
  const f = ([x, y]: V): V => [w - x, y];
  switch (p.k) {
    case "ell":
      return { ...p, c: f(p.c), rot: -(p.rot ?? 0) };
    case "cap":
      return { ...p, a: f(p.a), b: f(p.b) };
    case "path":
      return { ...p, pts: p.pts.map(f) };
    case "poly":
      return { ...p, pts: p.pts.map(f) };
    case "egg":
      return { ...p, c: f(p.c) };
  }
}

/** A primitive and its mirror image. */
export const both = (p: Prim, w = SIZE): Prim[] => [p, mirror(p, w)];

/** Move a primitive: points through `f`, radii scaled by `s`, ellipses
 *  turned by `rot` degrees (match `f`'s rotation). */
export function transform(p: Prim, f: (v: V) => V, s = 1, rot = 0): Prim {
  switch (p.k) {
    case "ell":
      return { ...p, c: f(p.c), r: [p.r[0] * s, p.r[1] * s], rot: (p.rot ?? 0) + rot };
    case "cap":
      return { ...p, a: f(p.a), b: f(p.b), ra: p.ra * s, rb: p.rb * s };
    case "path":
      return { ...p, pts: p.pts.map(f), r0: p.r0 * s, r1: p.r1 * s };
    case "poly":
      return { ...p, pts: p.pts.map(f), round: p.round * s };
    case "egg":
      return { ...p, c: f(p.c), r: [p.r[0] * s, p.r[1] * s] };
  }
}

/** Shift a whole drawing by whole pixels (decals stay on the grid). */
export function shiftDrawing(d: Drawing, dx: number, dy: number): Drawing {
  const f = ([x, y]: V): V => [x + dx, y + dy];
  const part = (p: Part): Part => ({
    ...p,
    prims: p.prims.map((q) => transform(q, f)),
    cut: p.cut?.map((q) => transform(q, f)),
    paint: p.paint?.map((pt) => ({
      ...pt,
      prims: pt.prims.map((q) => transform(q, f)),
      cut: pt.cut?.map((q) => transform(q, f)),
    })),
  });
  return {
    parts: d.parts.map(part),
    decals: d.decals?.map((dc) => ({ ...dc, x: dc.x + dx, y: dc.y + dy })),
  };
}

/** Whether pixel (x, y) — its center — lies inside a part's own shape,
 *  whatever is drawn over it. For measuring sprites (fit.ts). */
export function partCovers(part: Part, x: number, y: number): boolean {
  return sdPart(part, x + 0.5, y + 0.5) < 0;
}

// ── signed distance functions (negative inside) ──

function sdEllipse(px: number, py: number, rx: number, ry: number): number {
  // Quilez's cheap ellipse bound — exact enough at sprite scale.
  const k0 = Math.hypot(px / rx, py / ry);
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry));
  if (k1 === 0) return -Math.min(rx, ry);
  return (k0 * (k0 - 1)) / k1;
}

function sdUnevenCapsule(px: number, py: number, a: V, b: V, ra: number, rb: number): number {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  px -= a[0];
  py -= a[1];
  const h = bx * bx + by * by;
  if (h < 1e-6) return Math.hypot(px, py) - Math.max(ra, rb);
  let qx = (px * by - py * bx) / h;
  const qy = (px * bx + py * by) / h;
  qx = Math.abs(qx);
  const dr = ra - rb;
  if (dr * dr >= h) {
    // One end swallows the other: fall back to the bigger circle.
    return ra > rb ? Math.hypot(px, py) - ra : Math.hypot(px - bx, py - by) - rb;
  }
  const cx = Math.sqrt(h - dr * dr);
  const cy = dr;
  const k = cx * qy - cy * qx;
  const m = cx * qx + cy * qy;
  const n = qx * qx + qy * qy;
  if (k < 0) return Math.sqrt(h * n) - ra;
  if (k > cx) return Math.sqrt(h * (n + 1 - 2 * qy)) - rb;
  return m - ra;
}

function sdPolygon(px: number, py: number, v: V[]): number {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0];
    const ey = v[j][1] - v[i][1];
    const wx = px - v[i][0];
    const wy = py - v[i][1];
    const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - ex * t;
    const by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= v[i][1];
    const c2 = py < v[j][1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

function sdPrim(p: Prim, x: number, y: number): number {
  switch (p.k) {
    case "ell": {
      let dx = x - p.c[0];
      let dy = y - p.c[1];
      if (p.rot) {
        const a = (-p.rot * Math.PI) / 180;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs];
      }
      return sdEllipse(dx, dy, p.r[0], p.r[1]);
    }
    case "cap":
      return sdUnevenCapsule(x, y, p.a, p.b, p.ra, p.rb);
    case "path": {
      // Arc-length interpolated radii across the segments.
      let total = 0;
      for (let i = 1; i < p.pts.length; i++) {
        total += Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]);
      }
      let d = Infinity;
      let run = 0;
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1];
        const b = p.pts[i];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ra = p.r0 + (p.r1 - p.r0) * (run / (total || 1));
        run += len;
        const rb = p.r0 + (p.r1 - p.r0) * (run / (total || 1));
        d = Math.min(d, sdUnevenCapsule(x, y, a, b, ra, rb));
      }
      return d;
    }
    case "poly":
      return sdPolygon(x, y, p.pts) - p.round;
    case "egg": {
      const dy = y - p.c[1];
      const narrow = 1 + p.taper * (dy / p.r[1]); // < 1 near the top
      return sdEllipse((x - p.c[0]) / Math.max(0.3, narrow), dy, p.r[0], p.r[1]);
    }
  }
}

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

function sdUnion(prims: Prim[], x: number, y: number, k: number): number {
  let d = Infinity;
  for (const p of prims) d = smin(d, sdPrim(p, x, y), k);
  return d;
}

type Box = [number, number, number, number];

/** A conservative bounding box: outside it, the primitive's SDF is > 0. */
function primBox(p: Prim): Box {
  const pts = (vs: V[], r: number): Box => [
    Math.min(...vs.map((v) => v[0])) - r,
    Math.min(...vs.map((v) => v[1])) - r,
    Math.max(...vs.map((v) => v[0])) + r,
    Math.max(...vs.map((v) => v[1])) + r,
  ];
  switch (p.k) {
    case "ell":
      return pts([p.c], Math.max(p.r[0], p.r[1]));
    case "cap":
      return pts([p.a, p.b], Math.max(p.ra, p.rb));
    case "path":
      return pts(p.pts, Math.max(p.r0, p.r1));
    case "poly":
      return pts(p.pts, p.round);
    case "egg":
      return pts([p.c], Math.max(p.r[0] / 0.3, p.r[1]));
  }
}

/** Where a part can cover pixels. Smooth union reaches up to blend/4 past its
 *  primitives; one more pixel of slack covers the approximate ellipse SDF. */
function partBox(part: Part): Box {
  const pad = (part.blend ?? 1) / 4 + 1;
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of part.prims) {
    const q = primBox(p);
    b[0] = Math.min(b[0], q[0] - pad);
    b[1] = Math.min(b[1], q[1] - pad);
    b[2] = Math.max(b[2], q[2] + pad);
    b[3] = Math.max(b[3], q[3] + pad);
  }
  return b;
}

function sdPart(part: Part, x: number, y: number): number {
  let d = sdUnion(part.prims, x, y, part.blend ?? 1);
  if (part.cut) for (const c of part.cut) d = Math.max(d, -sdPrim(c, x, y));
  return d;
}

// ── shading ──

// Light from the top-left, slightly in front.
const LX = -0.5;
const LY = -0.72;
const LZ = 0.72;
const LN = Math.hypot(LX, LY, LZ);

function height(part: Part, R: number, x: number, y: number): number {
  const t = Math.min(1, Math.max(0, -sdPart(part, x, y) / R));
  return R * Math.sqrt(1 - (1 - t) * (1 - t));
}

function litLevel(part: Part, R: number, x: number, y: number): number {
  if (part.glow) {
    const t = -sdPart(part, x, y) / R;
    return t > 0.62 ? SHINE : t > 0.28 ? LIGHT : BASE;
  }
  const e = 0.5;
  const gx = (height(part, R, x + e, y) - height(part, R, x - e, y)) / (2 * e);
  const gy = (height(part, R, x, y + e) - height(part, R, x, y - e)) / (2 * e);
  const nl = Math.hypot(gx, gy, 1);
  const v = (-gx * LX - gy * LY + LZ) / (nl * LN);
  let level = v < 0.14 ? DARK : v < 0.46 ? SHADOW : v < 0.7 ? BASE : v < 0.93 ? LIGHT : SHINE;
  if (part.back) level = Math.max(DARK, level - 1);
  return level;
}

// ── palette resolution ──

const DEFAULT_PALETTE: Palette = {
  eye: "#2b2140",
  white: "#fffaf0",
  blush: "#ff8aa6",
};

type RampCache = Map<string, string[]>;

function rampOf(palette: Palette, mat: string, cache: RampCache): string[] {
  let r = cache.get(mat);
  if (!r) {
    const base = palette[mat] ?? DEFAULT_PALETTE[mat];
    if (!base) throw new Error(`unknown material "${mat}"`);
    r = makeRamp(base);
    cache.set(mat, r);
  }
  return r;
}

function resolveInk(ink: Ink, palette: Palette, cache: RampCache): string {
  if (ink.startsWith("#")) return ink;
  const [mat, lvl] = ink.split(":");
  return rampOf(palette, mat, cache)[lvl === undefined ? BASE : Number(lvl)];
}

// ── render ──

export function render(d: Drawing, palette: Palette, w = SIZE, h = SIZE): Sprite {
  const n = w * h;
  const owner = new Int16Array(n).fill(-1);
  const level = new Uint8Array(n);
  const mat: string[] = new Array(n);
  const color: (string | null)[] = new Array(n).fill(null);
  const cache: RampCache = new Map();

  // Topmost part at each pixel center, and each part's thickness (deepest
  // interior distance) — the default dome radius, so shapes shade as solids.
  // Most parts cover a small patch of the canvas; skipping pixels outside
  // their bounds makes this pass several times cheaper without changing it.
  const depth = new Float64Array(d.parts.length);
  const boxes = d.parts.map(partBox);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      for (let i = d.parts.length - 1; i >= 0; i--) {
        const [bx0, by0, bx1, by1] = boxes[i];
        const px = x + 0.5;
        const py = y + 0.5;
        if (px < bx0 || px > bx1 || py < by0 || py > by1) continue;
        const sd = sdPart(d.parts[i], px, py);
        if (sd < 0) {
          depth[i] = Math.max(depth[i], -sd);
          if (!found) owner[y * w + x] = i;
          found = true;
        }
      }
    }
  }
  const radius = d.parts.map((p, i) => p.round ?? Math.max(1.5, depth[i]));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const o = owner[idx];
      if (o < 0) continue;
      const part = d.parts[o];
      let lv = litLevel(part, radius[o], x + 0.5, y + 0.5);
      let m = part.mat;
      for (const paint of part.paint ?? []) {
        let pd = sdUnion(paint.prims, x + 0.5, y + 0.5, 0);
        for (const c of paint.cut ?? []) pd = Math.max(pd, -sdPrim(c, x + 0.5, y + 0.5));
        if (pd < 0) {
          m = paint.mat;
          if (paint.level !== undefined) lv = paint.level;
        }
      }
      // Separation line where a later part overlaps this one.
      const nb = [idx - w, idx + w, x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1];
      for (const q of nb) {
        if (q < 0 || q >= n) continue;
        const oq = owner[q];
        if (oq > o && d.parts[oq].line !== false) {
          lv = part.glow ? Math.min(lv, BASE) : DARK;
          break;
        }
      }
      level[idx] = lv;
      mat[idx] = m;
    }
  }

  // Orphan cleanup: a shade that none of its four neighbours share, inside
  // one part and material, is quantization noise no pixel artist would
  // place. It takes the neighbours' most common shade (ties: the nearer).
  const clean = level.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const o = owner[idx];
      if (o < 0) continue;
      const nb = [idx - w, idx + w, idx - 1, idx + 1];
      if (nb.some((q) => owner[q] !== o || mat[q] !== mat[idx] || level[q] === level[idx])) continue;
      const votes = new Map<number, number>();
      for (const q of nb) votes.set(level[q], (votes.get(level[q]) ?? 0) + 1);
      let best = -1;
      let bestVotes = 0;
      for (const [lv, v] of votes) {
        const nearer = Math.abs(lv - level[idx]) < Math.abs(best - level[idx]);
        if (v > bestVotes || (v === bestVotes && nearer)) {
          best = lv;
          bestVotes = v;
        }
      }
      clean[idx] = best;
    }
  }
  for (let i = 0; i < n; i++) {
    if (owner[i] < 0) continue;
    level[i] = clean[i];
    color[i] = rampOf(palette, mat[i], cache)[level[i]];
  }

  // Outline pixels around worn items, filled in by the outline pass.
  const coverEdge = new Uint8Array(n);
  const decalPass = (over: boolean) => {
    for (const dc of d.decals ?? []) {
      if (!!dc.over !== over) continue;
      // Worn items (`cover` parts) and their outlines hide the creature's
      // decals, drawn-on-top ones too (a web thread, a sleep "z").
      const guarded = !dc.cover;
      dc.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const ch = row[dx];
          if (ch === "." || ch === " ") continue;
          const x = dc.x + dx;
          const y = dc.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const ink = dc.inks[ch];
          if (!ink) throw new Error(`decal ink "${ch}" undefined`);
          const o = owner[y * w + x];
          if (guarded && ((o >= 0 && d.parts[o].cover) || coverEdge[y * w + x])) continue;
          color[y * w + x] = resolveInk(ink, palette, cache);
          if (!over && owner[y * w + x] < 0) owner[y * w + x] = -2; // decal-only pixel
        }
      });
    }
  };
  decalPass(false);

  // Outline: empty pixels 4-adjacent to the silhouette take the darkest ramp
  // step of the material they border (top neighbor wins, then sides). On the
  // lit side — pixels touching the shape only from below or the right — the
  // outline is one step softer ("selective outline"), so forms read as lit
  // rather than cut out.
  const outline: (string | null)[] = new Array(n).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (color[idx]) continue;
      const nb = [
        y > 0 ? idx - w : -1,
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
        y < h - 1 ? idx + w : -1,
      ];
      for (const q of nb) {
        if (q < 0 || !color[q]) continue;
        const m = mat[q];
        if (m) {
          const part = owner[q] >= 0 ? d.parts[owner[q]] : null;
          const lit = !(nb[0] >= 0 && color[nb[0]]) && !(nb[1] >= 0 && color[nb[1]]);
          outline[idx] = rampOf(palette, m, cache)[part?.glow || lit ? DARK : OUTLINE];
          if (part?.cover) coverEdge[idx] = 1;
        } else {
          outline[idx] = rampOf(palette, "eye", cache)[OUTLINE];
        }
        break;
      }
    }
  }
  for (let i = 0; i < n; i++) if (outline[i]) color[i] = outline[i];

  decalPass(true);

  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const c = color[i];
    if (!c) continue;
    const [r, g, b] = hexToRgb(c);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { w, h, data };
}

export { OUTLINE, DARK, SHADOW, BASE, LIGHT, SHINE };
