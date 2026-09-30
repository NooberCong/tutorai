/** Reader backdrops: each habitat painted wide, shown dimmed behind the
 *  reader's pages (the space to the left and right of them).
 *
 *  The pixel scenes in scenes.ts are 56×48; these fill a window, so they are
 *  painted per pixel instead, like a small offline renderer. Layers go far
 *  to near. Terrain is shaped by fractal noise and lit by bump-mapping it.
 *  Foliage, clouds and rock are built from noise-edged spheres shaded
 *  toward a light. Distance fades into the sky color, and light is added
 *  rather than painted: glows, god rays, aurora and lava. The interesting
 *  parts sit at the edges, where the pages don't cover them.
 *
 *  Scenes are written in a 1600×1000 space and rendered at any size with
 *  the same look. The reader dims them (styles.css); here they are painted
 *  at full strength.
 *
 *  Pure math, no DOM: rendered in a worker by the app
 *  (components/hatchery/backdrop.worker.ts) and by
 *  `scripts/backdrop-sheet.ts`. */

import type { Element } from "./kit.ts";

export const BACKDROP_W = 1600;
export const BACKDROP_H = 1000;
const W = BACKDROP_W;
const H = BACKDROP_H;

// ── numbers ──

type C = [number, number, number];
type Noise = (x: number, y: number) => number;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 2-D gradient noise, about -1…1. */
function perlin(seed: number): Noise {
  const r = rng(seed);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const a = perm[perm[X] + Y];
    const b = perm[perm[X + 1] + Y];
    const c = perm[perm[X] + Y + 1];
    const d = perm[perm[X + 1] + Y + 1];
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const n00 = gx[a] * xf + gy[a] * yf;
    const n10 = gx[b] * (xf - 1) + gy[b] * yf;
    const n01 = gx[c] * xf + gy[c] * (yf - 1);
    const n11 = gx[d] * (xf - 1) + gy[d] * (yf - 1);
    const x1 = n00 + u * (n10 - n00);
    const x2 = n01 + u * (n11 - n01);
    return (x1 + v * (x2 - x1)) * 1.4;
  };
}

/** Fractal noise: octaves of `n`, about -1…1 (mostly within ±0.6). */
function fbm(n: Noise, x: number, y: number, oct = 5, gain = 0.5): number {
  let s = 0;
  let a = 1;
  let t = 0;
  for (let i = 0; i < oct; i++) {
    s += n(x, y) * a;
    t += a;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 3.7;
    a *= gain;
  }
  return s / t;
}

/** Ridged fractal noise, 0…1, sharp crests: mountain ranges, cracks. */
function ridged(n: Noise, x: number, y: number, oct = 5): number {
  let s = 0;
  let a = 1;
  let t = 0;
  for (let i = 0; i < oct; i++) {
    const v = 1 - Math.abs(n(x, y));
    s += v * v * a;
    t += a;
    x = x * 2.1 + 5.3;
    y = y * 2.1 + 9.1;
    a *= 0.5;
  }
  return s / t;
}

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hex = (h: string): C => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];
function blend(a: C, b: C, t: number): C {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const times = (c: C, k: number): C => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/** Shade output: painters write the color here (and return its alpha). */
const T = new Float32Array(3);
function set(c: C) {
  T[0] = c[0];
  T[1] = c[1];
  T[2] = c[2];
}
function mix(a: C, b: C, t: number) {
  T[0] = a[0] + (b[0] - a[0]) * t;
  T[1] = a[1] + (b[1] - a[1]) * t;
  T[2] = a[2] + (b[2] - a[2]) * t;
}
/** Blend T toward `c` by t. */
function toward(c: C, t: number) {
  T[0] += (c[0] - T[0]) * t;
  T[1] += (c[1] - T[1]) * t;
  T[2] += (c[2] - T[2]) * t;
}
function scale(k: number) {
  T[0] *= k;
  T[1] *= k;
  T[2] *= k;
}
/** Dark → mid → light by t in 0…1. */
function ramp(t: number, dark: C, mid: C, light: C) {
  t = clamp(t);
  if (t < 0.5) mix(dark, mid, t * 2);
  else mix(mid, light, t * 2 - 1);
}

// ── the canvas ──

class Paint {
  readonly w: number;
  readonly h: number;
  readonly px: Float32Array;
  /** Device pixels per scene unit. */
  readonly k: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Float32Array(w * h * 3);
    this.k = w / W;
  }
  /** Visit every pixel of a scene-space box: fn(sceneX, sceneY, index). */
  each(x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, i: number) => void) {
    const k = this.k;
    const a = Math.max(0, Math.floor(x0 * k));
    const b = Math.min(this.w, Math.ceil(x1 * k));
    const c = Math.max(0, Math.floor(y0 * k));
    const d = Math.min(this.h, Math.ceil(y1 * k));
    for (let y = c; y < d; y++) {
      const Y = (y + 0.5) / k;
      for (let x = a; x < b; x++) fn((x + 0.5) / k, Y, (y * this.w + x) * 3);
    }
  }
  /** Paint T over pixel i at alpha a. */
  over(i: number, a: number) {
    const p = this.px;
    p[i] += (T[0] - p[i]) * a;
    p[i + 1] += (T[1] - p[i + 1]) * a;
    p[i + 2] += (T[2] - p[i + 2]) * a;
  }
  /** Add light. */
  add(i: number, c: ArrayLike<number>, s: number) {
    const p = this.px;
    p[i] += c[0] * s;
    p[i + 1] += c[1] * s;
    p[i + 2] += c[2] * s;
  }
  /** Read pixel i into T. */
  get(i: number) {
    T[0] = this.px[i];
    T[1] = this.px[i + 1];
    T[2] = this.px[i + 2];
  }
  /** 8-bit RGBA, dithered so smooth gradients don't band. */
  rgba(): Uint8ClampedArray<ArrayBuffer> {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    const r = rng(99);
    for (let j = 0, i = 0; j < out.length; j += 4, i += 3) {
      const d = (r() + r() - 1) * 0.75 + 0.5;
      out[j] = this.px[i] * 255 + d;
      out[j + 1] = this.px[i + 1] * 255 + d;
      out[j + 2] = this.px[i + 2] * 255 + d;
      out[j + 3] = 255;
    }
    return out;
  }
}

/** Returns alpha; writes color to T. X, Y in scene space; d = depth past the
 *  shape's edge (for land: below the top line). */
type Shade = (X: number, Y: number, d: number) => number;
type Curve = (X: number) => number;

/** A curve sampled once per scene unit and interpolated. */
function curve(fn: Curve): Curve {
  const t = new Float32Array(W + 3);
  for (let x = 0; x < t.length; x++) t[x] = fn(x - 1);
  return (X) => {
    const x = clamp(X + 1, 0, W + 1.999);
    const i = Math.floor(x);
    return t[i] + (t[i + 1] - t[i]) * (x - i);
  };
}

/** Everything below `top` (to `bottom`), antialiased along the edge. */
function land(p: Paint, top: Curve, shade: Shade, bottom = H) {
  const k = p.k;
  for (let x = 0; x < p.w; x++) {
    const X = (x + 0.5) / k;
    const t = top(X);
    const y0 = Math.max(0, Math.floor(t * k));
    const y1 = Math.min(p.h, Math.ceil(bottom * k));
    for (let y = y0; y < y1; y++) {
      const Y = (y + 0.5) / k;
      const cov = clamp((Y - t) * k + 0.5);
      if (cov <= 0) continue;
      const a = shade(X, Y, Y - t) * cov;
      if (a > 0) p.over((y * p.w + x) * 3, a);
    }
  }
}

/** Everything above `bottom`: ceilings, stalactites. */
function ceiling(p: Paint, bottom: Curve, shade: Shade) {
  const k = p.k;
  for (let x = 0; x < p.w; x++) {
    const X = (x + 0.5) / k;
    const b = bottom(X);
    const y1 = Math.min(p.h, Math.ceil(b * k));
    for (let y = 0; y < y1; y++) {
      const Y = (y + 0.5) / k;
      const cov = clamp((b - Y) * k + 0.5);
      if (cov <= 0) continue;
      const a = shade(X, Y, b - Y) * cov;
      if (a > 0) p.over((y * p.w + x) * 3, a);
    }
  }
}

function fill(p: Paint, shade: (X: number, Y: number) => void) {
  p.each(0, 0, W, H, (X, Y, i) => {
    shade(X, Y);
    p.over(i, 1);
  });
}

/** Vertical gradient through color stops (y as a fraction of the height). */
function sky(p: Paint, stops: [number, string][]) {
  const cs = stops.map(([t, c]) => [t, hex(c)] as const);
  fill(p, (_, Y) => {
    const t = Y / H;
    let j = 0;
    while (j < cs.length - 2 && t > cs[j + 1][0]) j++;
    const [t0, c0] = cs[j];
    const [t1, c1] = cs[j + 1];
    mix(c0, c1, smooth(0, 1, (t - t0) / (t1 - t0)));
  });
}

/** Soft additive light. */
function glow(p: Paint, cx: number, cy: number, r: number, c: C, s: number, reach = 4) {
  const R = r * reach;
  const r2 = reach * reach;
  p.each(cx - R, cy - R, cx + R, cy + R, (X, Y, i) => {
    const d2 = ((X - cx) ** 2 + (Y - cy) ** 2) / (r * r);
    if (d2 > r2) return;
    const v = Math.exp(-d2) * 0.75 + 0.25 / (1 + d2 * 3);
    p.add(i, c, s * v * (1 - smooth(r2 * 0.4, r2, d2)));
  });
}

/** Specks of light: pollen, embers, stars, dust. */
function motes(
  p: Paint,
  seed: number,
  n: number,
  area: [number, number, number, number],
  size: [number, number],
  colors: C[],
  s: number,
  where: (X: number, Y: number) => boolean = () => true,
) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[2] - area[0]);
    const y = area[1] + r() * (area[3] - area[1]);
    const rad = size[0] + r() * r() * (size[1] - size[0]);
    const c = colors[Math.floor(r() * colors.length)];
    const b = s * (0.35 + r() * 0.65);
    if (where(x, y)) glow(p, x, y, rad, c, b, 3);
  }
}

/** Light shafts fanning from (ox, oy) around angle `dir`. */
function rays(p: Paint, n: Noise, ox: number, oy: number, dir: number, spread: number, len: number, c: C, s: number, freq = 9) {
  p.each(0, 0, W, H, (X, Y, i) => {
    const dx = X - ox;
    const dy = Y - oy;
    let a = Math.atan2(dy, dx) - dir;
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    const e = 1 - (a / spread) ** 2;
    if (e <= 0) return;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stripe = smooth(0.15, 0.75, n(a * freq, 0.5) * 0.5 + 0.5 + n(a * freq * 3.1, 7.5) * 0.25);
    const fall = Math.exp(-dist / len);
    p.add(i, c, s * stripe * fall * e);
  });
}

/** A horizontal band of mist, patchy. */
function mist(p: Paint, n: Noise, y0: number, y1: number, c: C, a: number) {
  const mid = (y0 + y1) / 2;
  const half = (y1 - y0) / 2;
  set(c);
  p.each(0, y0, W, y1, (X, Y, i) => {
    const band = 1 - ((Y - mid) / half) ** 2;
    if (band <= 0) return;
    const patch = smooth(-0.35, 0.45, fbm(n, X * 0.003, Y * 0.012, 4));
    set(c);
    p.over(i, a * band * band * patch);
  });
}

/** Light direction (toward the light), normalized. */
function light(x: number, y: number, z: number): C {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
const LIGHT = light(-0.45, -0.8, 0.55);

interface Ball {
  dark: C;
  mid: C;
  light: C;
  /** Edge wobble (fraction of the radius) and its noise frequency. */
  rough: number;
  freq: number;
  /** Fine surface texture strength (leaves, rock grain) and frequency. */
  tex?: number;
  texFreq?: number;
  L?: C;
  alpha?: number;
  /** Edge softness in scene units (clouds soft, leaves crisp). */
  feather?: number;
  /** Color the silhouette edge picks up (backlight). */
  rim?: C;
  rimAmt?: number;
  /** 0 = fully round shading, 1 = flat (soft things like clouds). */
  flat?: number;
}

/** A noise-edged sphere, lit: one leaf clump, cloud puff or boulder. */
function ball(p: Paint, n: Noise, cx: number, cy: number, r: number, st: Ball, squash = 1) {
  const L = st.L ?? LIGHT;
  const pad = r * (1 + st.rough) + 2;
  const feather = (st.feather ?? 1) / r;
  const tex = st.tex ?? 0.2;
  const tf = st.texFreq ?? 0.09;
  const alpha = st.alpha ?? 1;
  p.each(cx - pad, cy - pad * squash, cx + pad, cy + pad * squash, (X, Y, i) => {
    const dx = (X - cx) / r;
    const dy = (Y - cy) / (r * squash);
    const d = Math.sqrt(dx * dx + dy * dy);
    const edge = 1 + st.rough * fbm(n, X * st.freq, Y * st.freq, 3) * 1.6;
    const cov = clamp((edge - d) / feather);
    if (cov <= 0) return;
    const q = Math.min(d / edge, 0.999);
    const nx = dx / edge;
    const ny = dy / edge;
    const nz = Math.sqrt(1 - q * q);
    let l = (nx * L[0] + ny * L[1] + nz * L[2]) * 0.5 + 0.5;
    if (st.flat) l += (0.62 - l) * st.flat;
    if (tex) l += tex * (smooth(-0.25, 0.45, fbm(n, X * tf + 50, Y * tf + 50, 3)) - 0.5);
    ramp(l, st.dark, st.mid, st.light);
    if (st.rim) toward(st.rim, (st.rimAmt ?? 0.5) * smooth(0.75, 1, q));
    p.over(i, cov * alpha);
  });
}

/** A cluster of balls in an ellipse, drawn back to front, deeper ones
 *  darker: tree crowns, bushes, cloud towers. */
function cluster(p: Paint, n: Noise, seed: number, cx: number, cy: number, rx: number, ry: number, count: number, size: [number, number], st: Ball, dim = 0.35) {
  const r = rng(seed);
  const balls: { x: number; y: number; r: number; depth: number }[] = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r());
    balls.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k, r: size[0] + r() * (size[1] - size[0]), depth: r() });
  }
  balls.sort((a, b) => a.depth - b.depth);
  for (const b of balls) {
    const k = 1 - dim * (1 - b.depth);
    ball(p, n, b.x, b.y, b.r, { ...st, dark: times(st.dark, k), mid: times(st.mid, k), light: times(st.light, k) });
  }
}

/** A vertical strand — trunk, spire, kelp, candle: rows from yTop to yBot,
 *  centered on center(v) with half-width halfW(v), v = 0 top … 1 bottom.
 *  shade gets u = -1 … 1 across. */
function strand(
  p: Paint,
  yTop: number,
  yBot: number,
  center: (v: number) => number,
  halfW: (v: number, Y: number) => number,
  shade: (X: number, Y: number, u: number, v: number) => number,
) {
  const k = p.k;
  const y0 = Math.max(0, Math.floor(yTop * k));
  const y1 = Math.min(p.h, Math.ceil(yBot * k));
  for (let y = y0; y < y1; y++) {
    const Y = (y + 0.5) / k;
    const v = (Y - yTop) / (yBot - yTop);
    const c = center(v);
    const hw = halfW(v, Y);
    if (hw <= 0) continue;
    const x0 = Math.max(0, Math.floor((c - hw - 1) * k));
    const x1 = Math.min(p.w, Math.ceil((c + hw + 1) * k));
    for (let x = x0; x < x1; x++) {
      const X = (x + 0.5) / k;
      const u = (X - c) / hw;
      const cov = clamp((1 - Math.abs(u)) * hw * k + 0.5);
      if (cov <= 0) continue;
      const a = shade(X, Y, u, v) * cov;
      if (a > 0) p.over((y * p.w + x) * 3, a);
    }
  }
}

/** A round limb from (x1,y1) to (x2,y2), radius r1 → r2; shade gets the
 *  side across it, -1 … 1, and t along it. */
function limb(p: Paint, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, shade: (u: number, t: number) => void) {
  const pad = Math.max(r1, r2) + 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  p.each(Math.min(x1, x2) - pad, Math.min(y1, y2) - pad, Math.max(x1, x2) + pad, Math.max(y1, y2) + pad, (X, Y, i) => {
    const t = clamp(((X - x1) * dx + (Y - y1) * dy) / len2);
    const px = x1 + dx * t - X;
    const py = y1 + dy * t - Y;
    const d = Math.sqrt(px * px + py * py);
    const r = r1 + (r2 - r1) * t;
    const cov = clamp((r - d) * p.k + 0.5);
    if (cov <= 0) return;
    const side = ((X - x1) * dy - (Y - y1) * dx) / len / r;
    shade(clamp(side, -1, 1), t);
    p.over(i, cov);
  });
}

/** A pointed leaf blade from (x, y) along (dx, dy), drooping at the tip,
 *  lit across its midrib. */
function blade(p: Paint, x: number, y: number, dx: number, dy: number, len: number, wid: number, dark: C, lit: C) {
  const l = Math.hypot(dx, dy);
  dx /= l;
  dy /= l;
  const pad = len + wid;
  const sag = Math.sign(dx || 1) * len * 0.25;
  p.each(x - pad, y - pad, x + pad, y + pad, (X, Y, i) => {
    const px = X - x;
    const py = Y - y;
    const t = (px * dx + py * dy) / len;
    if (t <= 0 || t >= 1) return;
    const s = px * -dy + py * dx - t * t * sag;
    const half = (wid / 2) * Math.sin(Math.PI * t ** 0.8);
    const cov = clamp((half - Math.abs(s)) * p.k + 0.5);
    if (cov <= 0) return;
    const u = s / half;
    mix(dark, lit, clamp(0.65 - 0.35 * u + 0.1 * t - 0.25 * Math.exp(-((u * 6) ** 2))));
    p.over(i, cov * 0.95);
  });
}

/** Bump lighting from a noise field: brighter where it faces the light
 *  (from the left and above by default). About -1…1. */
function bump(n: Noise, X: number, Y: number, fx: number, fy: number, lx = -1, ly = -0.6, oct = 3): number {
  const e = 1;
  const gx = fbm(n, (X + e) * fx, Y * fy, oct) - fbm(n, (X - e) * fx, Y * fy, oct);
  const gy = fbm(n, X * fx, (Y + e) * fy, oct) - fbm(n, X * fx, (Y - e) * fy, oct);
  return clamp((gx * lx + gy * ly) * (-0.3 / (e * Math.hypot(fx, fy))), -1, 1);
}

/** How much the land under a skyline faces a light from the left, 0…1:
 *  slopes rising to the right are lit, falling ones in shade. The face
 *  keeps its orientation as it runs down from the ridge, drifting sideways
 *  so faces read as planes rather than stripes. */
function faceLight(top: Curve, X: number, d: number, span = 18, gain = 2): number {
  const x = X + d * 0.35;
  return clamp(0.5 - ((top(x + span) - top(x - span)) / (2 * span)) * gain);
}

/** Darken the corners a touch. */
function vignette(p: Paint, s = 0.35) {
  p.each(0, 0, W, H, (X, Y, i) => {
    const dx = (X - W / 2) / (W / 2);
    const dy = (Y - H * 0.45) / (H * 0.6);
    p.get(i);
    scale(1 - s * smooth(0.5, 1.6, dx * dx + dy * dy));
    p.over(i, 1);
  });
}

// ── shared scenery ──

/** A pine at (x, base), `h` tall: tiered, jagged, lit from the left; snow
 *  on the tier tops when `snow` is given. */
function pine(p: Paint, n: Noise, x: number, base: number, h: number, dark: C, lit: C, snow?: C, haze?: { c: C; a: number }) {
  const w = h * 0.34;
  const tiers = Math.max(3, Math.round(h / 55));
  p.each(x - w - 3, base - h - 3, x + w + 3, base + 3, (X, Y, i) => {
    const v = (base - Y) / h;
    if (v < 0 || v > 1) return;
    let a: number;
    if (v < 0.07) {
      const u = (X - x) / (h * 0.03);
      if (Math.abs(u) > 1) return;
      mix(dark, lit, 0.2 - u * 0.15);
      scale(0.6);
      a = 1;
    } else {
      const droop = (Math.abs(X - x) / w) ** 1.4 * (0.75 / tiers);
      const tv = ((v - 0.07 + droop) / 0.93) * tiers;
      const ti = Math.floor(tv);
      const f = tv - ti;
      const jitter = 1 + 0.18 * Math.sin(ti * 12.9898 + x * 0.37);
      let hw = w * jitter * (1 - (ti / tiers) * 0.85) * (1 - f * 0.62);
      hw *= 1 + 0.16 * n(X * 0.12, Y * 0.12);
      hw *= Math.min(1, (1 - v) * 10);
      const u = (X - x) / hw;
      a = clamp((1 - Math.abs(u)) * hw * p.k + 0.5);
      if (a <= 0) return;
      mix(dark, lit, clamp(0.4 - 0.4 * u + 0.25 * f + 0.2 * n(X * 0.25, Y * 0.25)));
      if (snow) {
        const lip = f + 0.3 * fbm(n, X * 0.06, Y * 0.12, 3) - 0.55 + u * 0.15;
        if (lip > 0) mix(snow, dark, clamp(0.1 + u * 0.4) * (1 - smooth(0, 0.08, lip) * 0.5));
      }
    }
    if (haze) toward(haze.c, haze.a);
    p.over(i, a);
  });
}

/** A tree trunk, lit from the left, with bark. */
function trunk(p: Paint, n: Noise, x: number, base: number, top: number, wBase: number, wTop: number, lean: number, dark: C, lit: C) {
  strand(
    p,
    top,
    base,
    (v) => x + lean * (1 - v) * (1 - v),
    (v) => (wTop + (wBase - wTop) * v ** 2.2) / 2,
    (X, Y, u) => {
      const bark = n(X * 0.12, Y * 0.012) * 0.5 + n(X * 0.3, Y * 0.04) * 0.25;
      mix(dark, lit, clamp(0.55 - 0.5 * u + bark * 0.35 - Math.max(0, u) * 0.2));
      return 1;
    },
  );
}

/** A distant wood: a line of rounded crowns along a rolling curve. */
function woodline(seed: number, base: number, amp: number, size: [number, number]): Curve {
  const r = rng(seed);
  const n = perlin(seed);
  const ground = (x: number) => base - amp * fbm(n, x * 0.002, 0.5, 3);
  const crowns: [number, number, number][] = [];
  for (let x = -60; x < W + 60; x += size[0] * (0.7 + r() * 0.6)) {
    const s = size[0] + r() * (size[1] - size[0]);
    crowns.push([x, ground(x) - s * (0.4 + r() * 0.5), s]);
  }
  return curve((X) => {
    let top = ground(X) + 20;
    for (const [cx, cy, s] of crowns) {
      const dx = X - cx;
      if (Math.abs(dx) < s) top = Math.min(top, cy - Math.sqrt(s * s - dx * dx) * 0.8);
    }
    return top;
  });
}

// ── scenes ──

function leaf(p: Paint) {
  const n = perlin(1);
  const n2 = perlin(2);
  sky(p, [[0, "#f2eab8"], [0.3, "#dde6a8"], [0.55, "#b2d18c"], [0.8, "#86b46a"], [1, "#6d9c5a"]]);
  glow(p, 700, 40, 320, hex("#fff6d4"), 0.3);

  // far woods fading into the light, mist between
  const haze = hex("#e9f0c4");
  land(p, woodline(11, 520, 50, [22, 44]), (_x, _y, d) => {
    mix(hex("#a8c98a"), haze, 0.45 - smooth(0, 120, d) * 0.1);
    toward(hex("#f4f6d6"), (1 - smooth(0, 4, d)) * 0.35);
    return 1;
  });
  mist(p, n, 480, 620, haze, 0.55);
  land(p, woodline(12, 600, 40, [30, 60]), (X, Y, d) => {
    const t = fbm(n2, X * 0.02, Y * 0.02, 3);
    mix(hex("#78a862"), hex("#a3c784"), clamp(0.4 + t * 0.8 - smooth(0, 90, d) * 0.3));
    toward(haze, 0.25);
    toward(hex("#f4f6d6"), (1 - smooth(0, 5, d)) * 0.4);
    return 1;
  });
  mist(p, n2, 580, 700, haze, 0.35);

  // the meadow, a sunlit clearing in the middle
  land(p, curve((X) => 690 + 22 * fbm(n, X * 0.003, 4.2, 3)), (X, Y, d) => {
    const streak = fbm(n2, X * 0.2, Y * 0.03, 2) * 0.25 + fbm(n, X * 0.006, Y * 0.02, 3) * 0.6;
    const sun = Math.exp(-(((X - 800) / 520) ** 2) - ((Y - 740) / 160) ** 2);
    mix(hex("#4f8a3e"), hex("#8cbd5c"), clamp(0.35 + streak + sun * 0.45 - smooth(0, 260, d) * 0.3));
    toward(hex("#d8e79a"), sun * 0.35 * (1 - smooth(0, 60, d)));
    return 1;
  });
  rays(p, n, 700, -140, Math.PI / 2 + 0.05, 0.75, 900, hex("#fff5c8"), 0.16, 11);

  // the framing trees: trunks, then crowns spilling off the top corners
  const bark: [C, C] = [hex("#2b2a1c"), hex("#6b6a44")];
  trunk(p, n, 150, 930, 120, 92, 44, 36, ...bark);
  trunk(p, n, 1470, 930, 140, 96, 46, -40, ...bark);
  trunk(p, n, 330, 900, 380, 36, 18, 14, ...bark);
  const foliage: Ball = {
    dark: hex("#1e3a1e"),
    mid: hex("#3e6e34"),
    light: hex("#9cc766"),
    rough: 0.22,
    freq: 0.05,
    tex: 0.35,
    texFreq: 0.045,
    rim: hex("#e8f2a0"),
    rimAmt: 0.35,
  };
  cluster(p, n, 21, 150, 80, 330, 170, 34, [60, 120], foliage);
  cluster(p, n, 22, 1460, 70, 330, 160, 34, [60, 120], foliage);
  cluster(p, n, 23, 350, 340, 110, 70, 12, [36, 66], foliage);

  // undergrowth, then the dark foreground lip with grass tips
  const bush = { ...foliage, light: hex("#86b85a") };
  cluster(p, n, 24, 170, 870, 280, 60, 26, [40, 80], bush, 0.5);
  cluster(p, n, 25, 1440, 860, 280, 60, 26, [40, 80], bush, 0.5);
  land(p, curve((X) => 915 + 18 * fbm(n2, X * 0.004, 9.5, 3) - 12 * Math.abs(n(X * 0.3, 2.2))), (X, Y, d) => {
    mix(hex("#1f3a1c"), hex("#3f6e30"), clamp(0.5 + fbm(n, X * 0.2, Y * 0.03, 3) * 0.8 - smooth(0, 40, d) * 0.4));
    return 1;
  });

  // wildflowers in the undergrowth, pollen drifting in the light
  const fr = rng(31);
  const petals = ["#fff6e0", "#ffd86b", "#f3a6c8", "#c9b6ff"].map(hex);
  for (let i = 0; i < 70; i++) {
    const x = i % 2 ? 1600 - fr() * 520 : fr() * 520;
    const y = 830 + fr() * 150;
    const c = petals[Math.floor(fr() * petals.length)];
    ball(p, n, x, y, 3 + fr() * 3.5, { dark: times(c, 0.6), mid: c, light: hex("#ffffff"), rough: 0.3, freq: 0.5, tex: 0 });
  }
  motes(p, 32, 90, [0, 120, W, 820], [1.2, 3.5], [hex("#fff8d0"), hex("#f0ffc0")], 0.7);
  vignette(p, 0.3);
}

function ember(p: Paint) {
  const n = perlin(3);
  const n2 = perlin(4);
  sky(p, [[0, "#12070f"], [0.3, "#2a0c18"], [0.55, "#5a1a1e"], [0.7, "#a84020"], [0.76, "#e07a30"], [1, "#2a0d10"]]);
  const lava = hex("#ff7a28");
  const hot = hex("#ffd27a");

  // smoke rolling over the sky, lit from below by the lava
  p.each(0, 0, W, 640, (X, Y, i) => {
    const wx = fbm(n2, X * 0.0015, Y * 0.003, 3) * 140;
    const d = fbm(n, (X + wx) * 0.0022, Y * 0.0045, 6);
    const a = smooth(-0.05, 0.4, d) * (1 - smooth(420, 640, Y)) * 0.9;
    if (a <= 0) return;
    const under = clamp((fbm(n, (X + wx) * 0.0022, (Y + 14) * 0.0045, 6) - d) * -8 + 0.3);
    const near = Math.exp(-(((X - 1270) / 500) ** 2) - ((Y - 330) / 300) ** 2);
    mix(hex("#1a0a10"), hex("#8a3020"), clamp(Y / 700 + near * 0.7) * (0.4 + under * 0.8));
    p.over(i, a);
  });
  glow(p, 800, 740, 520, hex("#ff8a3a"), 0.22);

  // far range, rim-lit
  land(p, curve((X) => 700 - 200 * ridged(n, X * 0.0024, 0.3, 5)), (X, Y, d) => {
    const b = bump(n2, X, Y, 0.01, 0.004);
    mix(hex("#3a1420"), hex("#6a2424"), clamp(0.3 + b * 0.4));
    toward(hex("#9a3a24"), 0.35 * (1 - smooth(0, 180, d)));
    toward(hot, (1 - smooth(0, 3, d)) * 0.45);
    return 1;
  });

  // the volcano, lava pouring down
  const cone = curve((X) => {
    const dx = Math.abs(X - 1270);
    const rim = 350 + 8 * n(X * 0.05, 1);
    return dx < 60 ? rim + 6 : rim + 440 * (1 - 1 / (1 + ((dx - 60) / 300) ** 1.7)) + 12 * fbm(n2, X * 0.01, 3, 3);
  });
  const flows = [
    { x0: 1250, drift: -150, w: 1, seed: 5 },
    { x0: 1295, drift: 170, w: 0.8, seed: 6 },
    { x0: 1270, drift: 20, w: 0.5, seed: 7 },
  ];
  const flowAt = (f: (typeof flows)[number], Y: number) => {
    const t = clamp((Y - 350) / 440);
    return { cx: f.x0 + f.drift * t * t + 24 * fbm(n2, Y * 0.01, f.seed, 3) * t, hw: (3 + 9 * t) * f.w, t };
  };
  land(p, cone, (X, Y, d) => {
    const b = bump(n, X, Y, 0.012, 0.003, 1, -0.3);
    mix(hex("#1e0a10"), hex("#4a1a1c"), clamp(0.35 + b * 0.35 - smooth(0, 300, d) * 0.2));
    let heat = 0;
    for (const f of flows) {
      const { cx, hw } = flowAt(f, Y);
      heat += Math.exp(-(((X - cx) / (hw * 7 + 20)) ** 2));
    }
    toward(hex("#a8401e"), clamp(heat) * 0.55);
    return 1;
  });
  p.each(900, 330, 1650, 800, (X, Y, i) => {
    if (Y < cone(X) - 1) return;
    for (const f of flows) {
      const { cx, hw, t } = flowAt(f, Y);
      const d = Math.abs(X - cx) / hw;
      if (d > 6) continue;
      const crust = smooth(0.2, 0.7, n(X * 0.15, Y * 0.06) * 0.5 + 0.5) * t * 0.6;
      p.add(i, lava, Math.exp(-d * d * 0.6) * 1.1 * (1 - crust * 0.6) + Math.exp(-d * 0.8) * 0.25);
      p.add(i, hot, Math.exp(-d * d * 2) * 0.9 * (1 - crust));
    }
  });
  glow(p, 1270, 345, 110, hot, 0.9);
  glow(p, 1270, 330, 300, lava, 0.35);

  // spires on the left, rim-lit on the side facing the fire
  const spire = (cx: number, top: number, wb: number, lean: number, seed: number) => {
    const sn = perlin(seed);
    strand(
      p,
      top,
      790,
      (v) => cx + lean * (1 - v),
      (v, Y) => (wb * 0.25 + wb * 0.75 * v ** 0.7) / 2 + 6 * sn(Y * 0.03, 0.5),
      (X, Y, u, v) => {
        const b = bump(sn, X, Y, 0.02, 0.008);
        mix(hex("#150810"), hex("#3a1418"), clamp(0.3 + b * 0.35));
        toward(hex("#ff8a3a"), smooth(0.55, 1, u) * 0.55 * (0.4 + v * 0.6));
        return 1;
      },
    );
  };
  spire(90, 220, 150, 16, 41);
  spire(230, 370, 110, 10, 42);
  spire(360, 290, 150, -12, 43);
  spire(480, 520, 80, 6, 44);
  spire(1560, 420, 120, -10, 45);

  // the ground, split by glowing cracks; a darker lip in front
  const ground = curve((X) => 770 + 16 * fbm(n2, X * 0.004, 2.5, 3));
  land(p, ground, (X, Y, d) => {
    const b = bump(n, X, Y, 0.008, 0.02);
    mix(hex("#12060a"), hex("#321216"), clamp(0.3 + b * 0.3 - smooth(0, 200, d) * 0.2));
    return 1;
  });
  p.each(0, 760, W, H, (X, Y, i) => {
    if (Y < ground(X)) return;
    const c = ridged(n2, X * 0.004, Y * 0.013, 3);
    const side = smooth(250, 600, Math.abs(X - 800));
    const v = smooth(0.84, 0.97, c) * side;
    if (v > 0) {
      p.add(i, lava, v * 0.9);
      p.add(i, hot, smooth(0.94, 0.99, c) * side * 0.6);
    }
  });
  land(p, curve((X) => 905 + 20 * fbm(n, X * 0.005, 7.7, 3)), (X, Y) => {
    mix(hex("#0c0407"), hex("#26100f"), clamp(0.3 + bump(n2, X, Y, 0.01, 0.02) * 0.3));
    return 1;
  });
  glow(p, 800, 735, 700, hex("#ff6a20"), 0.08);
  motes(p, 51, 160, [0, 120, W, 900], [1.2, 4], [lava, hot, hex("#ff9a40")], 0.9);
  vignette(p, 0.3);
}

function tide(p: Paint) {
  const n = perlin(5);
  const n2 = perlin(6);
  sky(p, [[0, "#a4ece2"], [0.15, "#5cc4cc"], [0.45, "#1f7ea8"], [0.75, "#0f4e7c"], [1, "#082e50"]]);
  const water = hex("#1a6f9c");
  const foam = hex("#e8fffa");

  // the rippling surface overhead: a caustic net
  p.each(0, 0, W, 220, (X, Y, i) => {
    const wx = fbm(n2, X * 0.004, Y * 0.02, 3) * 60;
    const c = 1 - Math.abs(n((X + wx) * 0.012, Y * 0.04));
    p.add(i, foam, c ** 12 * (1 - smooth(0, 220, Y)) * 0.45);
  });
  rays(p, n2, 800, -420, Math.PI / 2, 0.55, 1000, hex("#d8fff8"), 0.34, 14);

  // distant reef, lost in the blue
  land(p, curve((X) => 610 - 110 * fbm(n, X * 0.0025, 1.5, 5)), (_x, _y, d) => {
    mix(hex("#2a86a4"), hex("#1f7498"), smooth(0, 200, d));
    toward(water, 0.35);
    return 1;
  });
  land(p, curve((X) => 740 - 70 * fbm(n2, X * 0.003, 4.5, 5)), (X, Y, d) => {
    const b = bump(n, X, Y, 0.012, 0.012);
    mix(hex("#1a5e80"), hex("#2e84a0"), clamp(0.4 + b * 0.3 - smooth(0, 120, d) * 0.3));
    toward(water, 0.2);
    return 1;
  });
  motes(p, 61, 140, [0, 100, W, 900], [0.8, 2.2], [hex("#d8f4ff")], 0.35);

  // sand: rippled, with caustics dancing on it
  land(p, curve((X) => 820 + 16 * fbm(n2, X * 0.003, 8.5, 3)), (X, Y, d) => {
    const ripple = Math.sin(X * 0.09 + 7 * fbm(n, X * 0.004, Y * 0.012, 3) + Y * 0.05) * 0.5 + 0.5;
    mix(hex("#8a7a58"), hex("#e0cc92"), clamp(0.45 + ripple * 0.3 - smooth(0, 180, d) * 0.45));
    const c = 1 - Math.abs(n(X * 0.02 + fbm(n2, X * 0.01, Y * 0.03, 2) * 2, Y * 0.06));
    toward(hex("#fff4d0"), c ** 8 * 0.5 * (1 - smooth(0, 160, d)));
    toward(water, 0.18 + smooth(300, 800, Math.abs(X - 800)) * 0.1);
    return 1;
  });

  // rocks both sides
  const rock: Ball = { dark: hex("#0f2a38"), mid: hex("#2b5566"), light: hex("#6a9aa4"), rough: 0.25, freq: 0.012, tex: 0.25, texFreq: 0.05, L: light(-0.2, -1, 0.5) };
  cluster(p, n, 71, 150, 870, 220, 50, 9, [60, 110], rock, 0.4);
  cluster(p, n, 72, 1460, 860, 220, 50, 9, [60, 115], rock, 0.4);

  // kelp: tall ribbons swaying up toward the light, with blades
  const kelp = (x: number, h: number, seed: number, hue: number) => {
    const kn = perlin(seed);
    const dark = hex(hue ? "#1c4a2c" : "#2a4a1c");
    const lit = hex(hue ? "#7ec46a" : "#a8c85a");
    const base = 900;
    const top = base - h;
    const cx = (v: number) => x + 50 * fbm(kn, v * 1.6, 0.5, 3) * (1 - v) + (1 - v) * 20;
    strand(p, top, base, cx, (v) => 4 + 7 * v, (_x, _y, u, v) => {
      mix(dark, lit, clamp(0.55 - 0.45 * u + 0.25 * (1 - v)));
      return 1;
    });
    const r = rng(seed);
    for (let y = base - 40; y > top + 30; y -= 26 + r() * 18) {
      const sx = cx((y - top) / h);
      const dir = r() < 0.5 ? -1 : 1;
      const len = 40 + r() * 40;
      const ang = -0.9 + (r() - 0.5) * 0.5;
      blade(p, sx, y, dir * Math.cos(ang), Math.sin(ang), len, 9 + r() * 5, dark, lit);
    }
  };
  const kelps = [
    [40, 740], [120, 560], [230, 820], [330, 480], [420, 360],
    [1200, 380], [1290, 540], [1390, 780], [1480, 600], [1560, 840],
  ];
  kelps.forEach(([x, h], i) => kelp(x, h, 80 + i, i % 2));

  // coral at the kelp's feet
  const coral = (x: number, y: number, c: string, seed: number) => {
    const r = rng(seed);
    const col = hex(c);
    const dark = times(col, 0.45);
    const branch = (bx: number, by: number, a: number, len: number, rad: number, depth: number) => {
      const ex = bx + Math.cos(a) * len;
      const ey = by + Math.sin(a) * len;
      limb(p, bx, by, ex, ey, rad, rad * 0.8, (u) => mix(dark, col, clamp(0.7 - u * 0.5)));
      if (depth > 0) for (const da of [-0.55, 0.5]) branch(ex, ey, a + da + (r() - 0.5) * 0.35, len * 0.74, rad * 0.78, depth - 1);
    };
    branch(x, y, -Math.PI / 2 + (r() - 0.5) * 0.3, 55, 8, 4);
  };
  coral(440, 880, "#f07a8e", 1);
  coral(1170, 870, "#ffa070", 2);
  coral(80, 940, "#d070b8", 3);
  coral(1540, 930, "#f07a8e", 4);

  // a school of fish in the distance, and bubbles rising
  const fr = rng(91);
  for (let i = 0; i < 14; i++) {
    const x = 1130 + fr() * 330;
    const y = 280 + fr() * 180;
    const s = 0.7 + fr() * 0.5;
    ball(p, n, x, y, 13 * s, { dark: hex("#0c3c5a"), mid: hex("#1a5a7c"), light: hex("#5aa0bc"), rough: 0, freq: 0, tex: 0, alpha: 0.7 }, 0.38);
    limb(p, x + 12 * s, y, x + 22 * s, y, 1, 6 * s, () => set(hex("#124a6a")));
  }
  const br = rng(92);
  for (let i = 0; i < 60; i++) {
    const x = i % 2 ? 1600 - br() * 480 : br() * 480;
    const y = 120 + br() * 780;
    const r = 2 + br() * br() * 9;
    p.each(x - r - 2, y - r - 2, x + r + 2, y + r + 2, (X, Y, j) => {
      const d = Math.hypot(X - x, Y - y);
      const ring = Math.exp(-(((d - r) / 0.9) ** 2));
      const spec = Math.exp(-((Math.hypot(X - x + r * 0.4, Y - y + r * 0.4) / (r * 0.25)) ** 2));
      p.add(j, foam, ring * 0.5 + spec * 0.7);
    });
  }
  vignette(p, 0.4);
}

function stone(p: Paint) {
  const n = perlin(7);
  const n2 = perlin(8);
  fill(p, (X, Y) => mix(hex("#3a3258"), hex("#0c0a14"), smooth(0, 1, Math.hypot((X - 800) / 900, (Y - 560) / 700))));
  const cyan = hex("#6fdcff");
  const violet = hex("#b48cff");

  // the far wall
  const wall = curve((X) => 600 - 220 * ridged(n, X * 0.002, 0.7, 5));
  land(p, wall, (X, Y, d) => {
    const b = faceLight(wall, X, d, 16, 2) - 0.5 + fbm(n2, X * 0.01, Y * 0.01, 3) * 0.4;
    mix(hex("#221d36"), hex("#3e3660"), clamp(0.35 + b * 0.5));
    toward(hex("#2c2748"), smooth(0, 200, d) * 0.5);
    return 1;
  });

  // stalactites: spikes hanging from a rough ceiling, two layers
  const spikes = (seed: number, base: number, len: number, width: [number, number], dir: 1 | -1) => {
    const r = rng(seed);
    const sn = perlin(seed);
    const list: [number, number, number][] = [];
    for (let x = -40; x < W + 40; x += width[0] * (0.5 + r() * 0.8)) list.push([x, len * (0.15 + r() ** 2 * 0.85), width[0] + r() * (width[1] - width[0])]);
    return curve((X) => {
      let y = base + 26 * fbm(sn, X * 0.004, 0.5, 3) * dir;
      for (const [cx, l, w] of list) {
        const t = 1 - Math.abs(X - cx) / w;
        if (t > 0) y = dir > 0 ? Math.max(y, base + l * t ** 2.2) : Math.min(y, base - l * t ** 1.8);
      }
      return y;
    });
  };
  const hang = (edge: Curve, dark: string, lit: string, nn: Noise) =>
    ceiling(p, edge, (X, Y, d) => {
      const f = clamp(0.5 + ((edge(X + 4) - edge(X - 4)) / 8) * 0.8);
      mix(hex(dark), hex(lit), clamp(f * 0.8 + fbm(nn, X * 0.02, Y * 0.01, 3) * 0.3 - smooth(0, 60, d) * 0.1));
      return 1;
    });
  hang(spikes(1, 90, 300, [30, 80], 1), "#1c1830", "#4a4270", n);
  hang(spikes(2, 30, 220, [24, 60], 1), "#100d1a", "#302a4c", n2);

  // stalagmites and the floor
  const mites = spikes(3, 830, 300, [30, 70], -1);
  land(p, mites, (X, Y, d) => {
    const f = 0.35 + (faceLight(mites, X, 0, 4, 0.8) - 0.35) * (1 - smooth(10, 160, d));
    mix(hex("#15111f"), hex("#3e3658"), clamp(f * 0.75 + fbm(n, X * 0.02, Y * 0.01, 3) * 0.3 - smooth(0, 160, d) * 0.25));
    return 1;
  });

  // crystal clusters: faceted, glowing, lighting the rock around them
  const crystal = (x: number, y: number, h: number, a: number, lit: C, dark: C) => {
    const w = Math.min(h * 0.19, 38);
    const sx = Math.sin(a);
    const cy = -Math.cos(a);
    p.each(x - h - w, y - h - w, x + h + w, y + h + w, (X, Y, i) => {
      // local frame: v along the crystal, 0 base … 1 tip; u across
      const dx = X - x;
      const dy = Y - y;
      const v = (dx * sx + dy * cy) / h;
      const u = (dx * -cy + dy * sx) / w;
      if (v < -0.02 || v > 1) return;
      const lim = v < 0.78 ? 1 : (1 - v) / 0.22;
      const cov = clamp((lim - Math.abs(u)) * w * p.k * 0.5 + 0.5) * clamp((v + 0.02) * h * p.k);
      if (cov <= 0) return;
      const face = u < -0.35 ? 1 : u < 0.3 ? 0.62 : 0.3;
      mix(dark, lit, clamp(face * (0.55 + v * 0.5) + 0.15 * n(X * 0.05, Y * 0.05)));
      const edge = Math.min(Math.abs(u + 0.35), Math.abs(u - 0.3));
      toward(hex("#ffffff"), Math.exp(-(((edge * w) / 1.2) ** 2)) * 0.45 * face);
      p.over(i, cov * 0.94);
    });
  };
  const crop = (x: number, y: number, s: number, lit: string, dark: string, gl: C, seed: number) => {
    const cr = rng(seed);
    glow(p, x, y - 40 * s, 170 * s, gl, 0.55);
    const k = 7;
    const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => Math.abs(b - 3) - Math.abs(a - 3));
    for (const i of order) {
      const t = i / (k - 1) - 0.5;
      crystal(x + t * 150 * s, y + Math.abs(t) * 18 * s, (270 - Math.abs(t) * 320 + cr() * 60) * s, t * 1.15 + (cr() - 0.5) * 0.12, hex(lit), hex(dark));
    }
    glow(p, x, y - 60 * s, 70 * s, gl, 0.25);
  };
  crop(210, 880, 1.05, "#c8f4ff", "#2a78b0", cyan, 1);
  crop(1400, 870, 1.2, "#eadcff", "#5a2eb0", violet, 2);
  crop(560, 860, 0.45, "#c8f4ff", "#2a78b0", cyan, 3);
  crop(1100, 865, 0.5, "#eadcff", "#5a2eb0", violet, 4);
  // a few crystals in the ceiling too
  glow(p, 1480, 40, 120, cyan, 0.4);
  crystal(1470, -10, 120, Math.PI - 0.25, hex("#c8f4ff"), hex("#2a78b0"));
  crystal(1525, -20, 90, Math.PI + 0.2, hex("#c8f4ff"), hex("#2a78b0"));
  glow(p, 130, 40, 110, violet, 0.4);
  crystal(130, -15, 110, Math.PI + 0.25, hex("#eadcff"), hex("#5a2eb0"));
  motes(p, 81, 90, [0, 80, W, 860], [0.8, 2.6], [hex("#dff6ff"), hex("#e8d8ff")], 0.7);
  vignette(p, 0.35);
}

function skyScene(p: Paint) {
  const n = perlin(9);
  const n2 = perlin(10);
  sky(p, [[0, "#2a55a6"], [0.3, "#5d86c8"], [0.5, "#a9b4d6"], [0.6, "#eec3b0"], [0.68, "#ffd8a4"], [1, "#ffe6c4"]]);
  glow(p, 1180, 610, 260, hex("#ffd8a0"), 0.55);
  glow(p, 1180, 610, 40, hex("#fff0c8"), 1.2);

  // cirrus: long combed streaks high up
  p.each(0, 0, W, 520, (X, Y, i) => {
    const d = fbm(n, X * 0.0012 + fbm(n2, X * 0.002, Y * 0.01, 2) * 0.6, Y * 0.018, 5);
    const a = smooth(0.08, 0.45, d) * (1 - smooth(300, 520, Y)) * 0.55;
    if (a <= 0) return;
    mix(hex("#ffffff"), hex("#ffd8c8"), Y / 520);
    p.over(i, a);
  });

  // the cloud sea: banks of puffs lit warm from the low sun, far ones hazed
  const sunDir = light(0.6, -0.5, 0.6);
  const puff: Ball = {
    dark: hex("#a898c8"),
    mid: hex("#f0cccc"),
    light: hex("#fff6ea"),
    rough: 0.3,
    freq: 0.02,
    tex: 0.25,
    texFreq: 0.025,
    L: sunDir,
    feather: 10,
    flat: 0.35,
  };
  const horizon = hex("#f6d6c0");
  const bank = (y: number, size: [number, number], seed: number, hz: number) => {
    const r = rng(seed);
    const st: Ball = { ...puff, dark: blend(puff.dark, horizon, hz), mid: blend(puff.mid, horizon, hz), light: blend(puff.light, horizon, hz * 0.5) };
    land(p, () => y + size[0] * 0.2, () => {
      mix(st.mid, st.dark, 0.25);
      return 1;
    });
    for (let x = -80; x < W + 80; x += size[0] * (0.45 + r() * 0.4)) {
      const s = size[0] + r() * (size[1] - size[0]);
      ball(p, n, x, y - r() * s * 0.5, s, st, 0.75);
    }
  };
  bank(640, [34, 60], 1, 0.65);
  bank(700, [46, 80], 2, 0.45);
  bank(790, [64, 110], 3, 0.22);

  // cloud towers rising at the sides
  const tower: Ball = { ...puff, dark: hex("#a494c4"), mid: hex("#f0d0d4"), light: hex("#fffaf0") };
  cluster(p, n, 11, 200, 520, 170, 260, 60, [36, 80], tower, 0.12);
  cluster(p, n, 12, 1500, 560, 140, 220, 50, [36, 76], tower, 0.12);
  bank(900, [90, 150], 4, 0);

  // a few birds far off
  for (const [x, y, k] of [[300, 240, 1], [340, 262, 0.8], [270, 276, 0.7], [1380, 330, 0.9], [1415, 312, 0.7]]) {
    const c = hex("#3e4470");
    limb(p, x - 10 * k, y - 4 * k, x, y, 1.1 * k, 1.6 * k, () => set(c));
    limb(p, x, y, x + 10 * k, y - 4 * k, 1.6 * k, 1.1 * k, () => set(c));
  }
  vignette(p, 0.25);
}

function frost(p: Paint) {
  const n = perlin(11);
  const n2 = perlin(12);
  sky(p, [[0, "#030616"], [0.35, "#0a1636"], [0.6, "#16325a"], [0.8, "#244a72"], [1, "#2a5076"]]);
  motes(p, 101, 360, [0, 0, W, 560], [0.5, 1.6], [hex("#ffffff"), hex("#dbe6ff"), hex("#fff2d8")], 0.9);

  // aurora: curtains hanging from a wavy lower edge, streaked
  const green = hex("#48ffa8");
  const violet = hex("#9a6aff");
  const curtain = (base: number, amp: number, fx: number, seed: number, s: number) => {
    const an = perlin(seed);
    const edge = curve((X) => base + amp * fbm(an, X * fx, 0.5, 4));
    const c = new Float32Array(3);
    p.each(0, 0, W, base + amp + 40, (X, Y, i) => {
      const dy = edge(X) - Y;
      if (dy < -30) return;
      const up = dy < 0 ? Math.exp(-((dy / 10) ** 2)) : Math.exp(-dy / 190);
      const streak = 0.45 + 0.55 * smooth(-0.3, 0.7, an(X * 0.045, Y * 0.0025 + 3));
      const fold = 0.6 + 0.4 * Math.sin(X * 0.012 + fbm(an, X * 0.003, 2, 2) * 6);
      mix(green, violet, smooth(40, 300, dy));
      c.set(T);
      p.add(i, c, up * streak * fold * s);
    });
  };
  curtain(300, 90, 0.0018, 13, 0.5);
  curtain(230, 70, 0.0025, 14, 0.3);

  // mountains: snow on the lit faces and up high
  const range = (top: Curve, seed: number, snowLine: number, rock: [string, string], hz: number) => {
    const mn = perlin(seed);
    land(p, top, (X, _y, d) => {
      const f = faceLight(top, X, d, 14, 2.4);
      const gully = fbm(mn, X * 0.02 + d * 0.004, d * 0.012, 3);
      const lit = clamp(f + gully * 0.25);
      const line = snowLine * (0.45 + 0.9 * f) * (0.8 + 0.5 * fbm(mn, X * 0.008, 3.3, 3)) + gully * 30;
      const snow = 1 - smooth(line - 6, line + 6, d);
      mix(hex(rock[0]), hex(rock[1]), lit);
      toward(blend(hex("#6078a8"), hex("#eef4ff"), lit), snow);
      toward(hex("#3a5a86"), hz * (1 - smooth(0, 200, d) * 0.3));
      return 1;
    });
  };
  range(curve((X) => 560 - 240 * ridged(n, X * 0.0022, 0.5, 6)), 15, 120, ["#1c2a48", "#34466e"], 0.35);
  mist(p, n2, 560, 700, hex("#5a78a4"), 0.35);
  range(curve((X) => 690 - 150 * ridged(n2, X * 0.003, 3.5, 6)), 16, 70, ["#141f38", "#2a3a5c"], 0.12);

  // the snowfield
  land(p, curve((X) => 770 + 18 * fbm(n, X * 0.003, 6.5, 3)), (X, Y, d) => {
    mix(hex("#6d84b0"), hex("#c8d8f2"), clamp(0.6 + fbm(n2, X * 0.004, Y * 0.02, 4) * 0.8 - smooth(0, 220, d) * 0.3));
    return 1;
  });

  // pines: rows of small hazy ones, tall ones framing the sides
  const r = rng(17);
  for (let i = 0; i < 70; i++) {
    const x = i % 2 ? 1600 - r() * 560 : r() * 560;
    pine(p, n, x, 780 + r() * 16, 50 + r() * 60, hex("#1a2a48"), hex("#3a5078"), hex("#9fb4d8"), { c: hex("#3a5a86"), a: 0.35 });
  }
  for (const [x, h] of [[40, 620], [160, 460], [280, 560], [400, 340], [1210, 360], [1330, 520], [1450, 440], [1570, 640]]) {
    pine(p, n2, x, 915 + (x % 3) * 10, h, hex("#0a1426"), hex("#28406a"), hex("#e2ecfa"));
  }
  land(p, curve((X) => 918 + 16 * fbm(n2, X * 0.004, 9.1, 3)), (X, Y, d) => {
    mix(hex("#8aa0c8"), hex("#d8e4f6"), clamp(0.7 + fbm(n, X * 0.004, Y * 0.03, 3) - smooth(0, 60, d) * 0.4));
    return 1;
  });
  motes(p, 103, 60, [0, 780, W, H], [0.6, 1.4], [hex("#ffffff")], 0.9);
  motes(p, 104, 120, [0, 0, W, H], [1, 3.2], [hex("#ffffff")], 0.45);
  vignette(p, 0.35);
}

function moon(p: Paint) {
  const n = perlin(13);
  const n2 = perlin(14);
  sky(p, [[0, "#060920"], [0.4, "#141c4c"], [0.7, "#2c3674"], [1, "#1a2050"]]);
  motes(p, 111, 300, [0, 0, W, 620], [0.5, 1.6], [hex("#fff8e0"), hex("#dfe6ff")], 0.9);

  // the moon, textured, haloed
  const mx = 330;
  const my = 220;
  const mr = 78;
  glow(p, mx, my, 230, hex("#b8c4ff"), 0.35);
  p.each(mx - mr - 2, my - mr - 2, mx + mr + 2, my + mr + 2, (X, Y, i) => {
    const d = Math.hypot(X - mx, Y - my) / mr;
    const cov = clamp((1 - d) * mr * p.k + 0.5);
    if (cov <= 0) return;
    mix(hex("#fbf6e2"), hex("#c8c2ac"), smooth(-0.1, 0.35, fbm(n, X * 0.02, Y * 0.02, 5)) * 0.7);
    scale(1 - 0.25 * d ** 3);
    p.over(i, cov);
  });
  glow(p, mx, my, 90, hex("#fff8e8"), 0.08);

  // thin clouds drifting past, silvered near the moon
  p.each(0, 60, W, 520, (X, Y, i) => {
    const a = smooth(0.1, 0.45, fbm(n2, X * 0.0018, Y * 0.01, 5)) * 0.5;
    if (a <= 0) return;
    mix(hex("#2a3270"), hex("#c8ccf0"), Math.exp(-(((X - mx) / 360) ** 2) - ((Y - my) / 220) ** 2));
    p.over(i, a);
  });

  // hills rolling away, mist in the hollows, rims catching moonlight
  const hill = (top: Curve, dark: string, lit: string, rim: number) => {
    land(p, top, (X, Y, d) => {
      const f = faceLight(top, X, d * 0.2, 40, 3);
      mix(hex(dark), hex(lit), clamp(0.15 + f * 0.7 + fbm(n, X * 0.01, Y * 0.02, 3) * 0.2 - smooth(0, 200, d) * 0.3));
      toward(hex("#a8b4ff"), (1 - smooth(0, 3, d)) * rim * 0.6 * (0.4 + 0.6 * Math.exp(-(((X - mx) / 700) ** 2))));
      return 1;
    });
  };
  hill(curve((X) => 590 - 90 * fbm(n2, X * 0.0018, 2.5, 4)), "#26306c", "#4250a0", 0.5);
  mist(p, n, 580, 700, hex("#8a96d8"), 0.3);
  land(p, woodline(122, 690, 60, [12, 24]), (_x, _y, d) => {
    mix(hex("#161d4c"), hex("#26306a"), clamp(0.6 - smooth(0, 40, d) * 0.4));
    toward(hex("#8a96d8"), 0.15);
    return 1;
  }, 760);
  hill(curve((X) => 760 - 150 * Math.exp(-(((X - 1350) / 380) ** 2)) - 90 * Math.exp(-(((X - 150) / 300) ** 2)) + 20 * fbm(n2, X * 0.003, 5.5, 3)), "#141a48", "#34408a", 0.4);
  mist(p, n2, 740, 860, hex("#7a86c8"), 0.18);

  // a lone tree on the right, crown silvered on the moon side
  const barkD = hex("#0a0d2a");
  const barkL = hex("#262e66");
  trunk(p, n, 1380, 660, 430, 66, 24, -30, barkD, barkL);
  limb(p, 1362, 520, 1270, 440, 12, 5, (u) => mix(barkD, barkL, 0.5 - u * 0.4));
  limb(p, 1370, 490, 1470, 420, 12, 5, (u) => mix(barkD, barkL, 0.5 - u * 0.4));
  limb(p, 1356, 470, 1340, 380, 10, 4, (u) => mix(barkD, barkL, 0.5 - u * 0.4));
  cluster(p, n, 121, 1380, 400, 190, 110, 30, [40, 80], {
    dark: hex("#080b24"),
    mid: hex("#161c4c"),
    light: hex("#4a58a8"),
    rough: 0.22,
    freq: 0.05,
    tex: 0.22,
    texFreq: 0.08,
    L: light(-0.8, -0.6, 0.4),
  });

  // the near meadow, grass blades against the mist
  const meadow = curve((X) => 870 + 20 * fbm(n, X * 0.004, 7.5, 3));
  land(p, meadow, (X, Y, d) => {
    mix(hex("#0a0d2c"), hex("#1a2150"), clamp(0.5 + fbm(n2, X * 0.02, Y * 0.02, 3) * 0.5 - smooth(0, 80, d) * 0.4));
    return 1;
  });
  const gr = rng(133);
  for (let i = 0; i < 700; i++) {
    const x = gr() * W;
    if (Math.abs(x - 800) < 300 && gr() < 0.7) continue;
    const y = meadow(x) + 4;
    const h = 14 + gr() * gr() * 50;
    const lean = (gr() - 0.5) * h * 0.8;
    limb(p, x, y, x + lean, y - h, 1.8, 0.4, (u) => mix(hex("#0c1034"), hex("#3a4690"), clamp(0.3 - u * 0.3)));
  }

  // moonflowers and fireflies
  const fr = rng(131);
  for (let i = 0; i < 60; i++) {
    const x = i % 2 ? 1600 - fr() * 520 : fr() * 520;
    const y = 860 + fr() * 120;
    glow(p, x, y, 10, hex("#b8ccff"), 0.35);
    ball(p, n, x, y, 3 + fr() * 2.5, { dark: hex("#8a9ad8"), mid: hex("#dfe6ff"), light: hex("#ffffff"), rough: 0.4, freq: 0.6, tex: 0 });
  }
  motes(p, 132, 40, [0, 480, W, 900], [2, 4], [hex("#e8ff9a")], 0.9, (x) => Math.abs(x - 800) > 280);
  vignette(p, 0.35);
}

function arcane(p: Paint) {
  const n = perlin(15);
  const n2 = perlin(16);
  const warm = hex("#ffb65a");

  // stone wall: courses of blocks, each a slightly different stone
  fill(p, (X, Y) => {
    const row = Math.floor(Y / 54);
    const off = row % 2 ? 60 : 0;
    const col = Math.floor((X + off) / 120);
    const bx = (X + off) % 120;
    const by = Y % 54;
    const mortar = Math.min(bx, 120 - bx, by, 54 - by);
    const h = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
    const tone = h - Math.floor(h);
    mix(hex("#1c1228"), hex("#342446"), clamp(0.45 + tone * 0.3 + fbm(n, X * 0.03, Y * 0.03, 3) * 0.4));
    scale((0.55 + 0.45 * smooth(0, 3, mortar)) * (1 - 0.35 * (Y / H)));
  });
  glow(p, 800, 430, 420, hex("#6a3a9a"), 0.18);

  // arched windows onto the night, moonlight falling through
  const win = (cx: number, moon: boolean) => {
    const r = 100;
    const top = 110;
    const bot = 610;
    const inside = (X: number, Y: number, grow: number) => {
      const dx = X - cx;
      if (Math.abs(dx) > r + grow || Y > bot + grow) return false;
      return Y > top + r || Math.hypot(dx, Y - top - r) < r + grow;
    };
    p.each(cx - r - 40, top - 40, cx + r + 40, bot + 40, (X, Y, i) => {
      if (inside(X, Y, 0)) {
        mix(hex("#0a0e34"), hex("#2e3a8a"), (Y - top) / (bot - top));
        const s = n2(X * 0.6, Y * 0.6);
        if (s > 0.82) toward(hex("#ffffff"), (s - 0.82) * 5);
        if (moon) {
          const d = Math.hypot(X - cx - 40, Y - top - 90);
          if (d < 26 && Math.hypot(X - cx - 30, Y - top - 82) > 23) set(hex("#fff4d8"));
          toward(hex("#8a90d8"), Math.exp(-((d / 70) ** 2)) * 0.3);
        }
        if (Math.abs(X - cx) < 3 || Math.min(Math.abs(Y - 330), Math.abs(Y - 470)) < 3) mix(hex("#2a1c34"), hex("#4a3858"), 0.4);
        p.over(i, 1);
      } else if (inside(X, Y, 26)) {
        const out = Math.hypot(X - cx, Math.min(0, Y - top - r));
        const bevel = clamp((Math.max(out, Math.abs(X - cx)) - r) / 26);
        mix(hex("#2a1c38"), hex("#5a4470"), clamp(0.6 - bevel * 0.5 + fbm(n, X * 0.05, Y * 0.05, 3) * 0.3));
        p.over(i, 1);
      }
    });
    strand(p, bot + 4, bot + 26, () => cx, () => r + 44, (_x, _y, _u, v) => {
      mix(hex("#2a1c34"), hex("#5a4470"), 0.7 - v * 0.6);
      return 1;
    });
    // moonlight slanting down to the floor
    const ml = hex("#a8a0ff");
    p.each(cx - r - 20, bot, cx + r + 260, H, (X, Y, i) => {
      const t = (Y - bot) / (H - bot);
      const e = smooth(0, 40, X - (cx - r + t * 150)) * smooth(0, 40, cx + r + t * 230 - X);
      p.add(i, ml, e * 0.12 * (1 - t * 0.4) * (0.7 + 0.3 * n(X * 0.01, Y * 0.01)));
    });
  };
  win(390, true);
  win(1210, false);

  // bookshelves at the edges
  const wood = (X: number, Y: number, dark: string, lit: string) => {
    mix(hex(dark), hex(lit), clamp(0.45 + (n(X * 0.01, Y * 0.2) * 0.5 + n(X * 0.03, Y * 0.5) * 0.3) * 0.5));
  };
  const shelf = (x0: number, x1: number, seed: number) => {
    const r = rng(seed);
    p.each(x0, 0, x1, H, (X, Y, i) => {
      wood(Y, X, "#1a0e14", "#3a2228");
      scale(0.5);
      p.over(i, 1);
    });
    const palette = ["#7a3448", "#344a7a", "#4e6a38", "#8a6230", "#4c3a7c", "#94503a", "#2c5e5e", "#6a2a2a"].map(hex);
    for (let y = 30; y < H - 40; y += 136) {
      let x = x0 + 18;
      while (x < x1 - 30) {
        const bw = 14 + r() * 18;
        const bh = 84 + r() * 34;
        const c = palette[Math.floor(r() * palette.length)];
        const dark = times(c, 0.35);
        const lit = times(c, 1.4);
        const bx = x;
        const top = y + 122 - bh;
        const b1 = top + 12;
        const b2 = top + bh * 0.72;
        p.each(bx, top, bx + bw, y + 122, (X, Y, i) => {
          const u = ((X - bx) / bw) * 2 - 1;
          ramp(0.4 - u * 0.45 + 0.35 * (1 - u * u) - 0.1, dark, c, lit);
          if (Math.abs(Y - b1) < 2 || Math.abs(Y - b2) < 2) toward(hex("#e8c070"), 0.55);
          p.over(i, 1);
        });
        x += bw + 1 + (r() < 0.1 ? 22 : 0);
      }
      p.each(x0, y + 122, x1, y + 136, (X, Y, i) => {
        wood(X, Y, "#2a1820", "#6a4034");
        scale(1 - (Y - y - 122) / 30);
        p.over(i, 1);
      });
    }
    for (const side of [x0, x1 - 16]) {
      p.each(side, 0, side + 16, H, (X, Y, i) => {
        wood(Y * 0.3, X * 3, "#2a1820", "#5a3830");
        p.over(i, 1);
      });
    }
  };
  shelf(-20, 210, 1);
  shelf(1390, 1620, 2);

  // the floor: planks, the rune circle glowing faintly
  land(p, () => 830, (X, Y, d) => {
    const plank = Math.floor((X + Math.floor(Y / 30) * 90) / 220);
    mix(hex("#180d18"), hex("#3a2230"), clamp(0.45 + n(X * 0.01 + plank * 3, Y * 0.2) * 0.3 + (plank % 3) * 0.05 - d / 300));
    if ((Y - 830) % 30 < 1.2) scale(0.6);
    return 1;
  });
  const rune = hex("#b48cff");
  p.each(200, 820, 1400, H, (X, Y, i) => {
    const e = Math.hypot((X - 800) / 520, (Y - 910) / 70);
    p.add(i, rune, (Math.exp(-(((e - 1) * 60) ** 2)) + 0.6 * Math.exp(-(((e - 0.84) * 70) ** 2))) * 0.45 + Math.exp(-((e / 0.9) ** 2)) * 0.05);
  });

  // candles on the sills and floor
  const candle = (x: number, y: number, h: number) => {
    glow(p, x, y - h - 12, 80, warm, 0.4);
    strand(p, y - h, y, () => x, () => 7, (_x, _y, u) => {
      mix(hex("#8a6a58"), hex("#fff0d8"), clamp(0.7 - u * 0.4));
      return 1;
    });
    glow(p, x, y - h - 12, 7, hex("#ffe0a0"), 1.2, 3);
    glow(p, x, y - h - 16, 4, hex("#ffffff"), 0.9, 3);
  };
  candle(290, 612, 40);
  candle(318, 612, 26);
  candle(1290, 612, 34);
  candle(250, 830, 70);
  candle(1350, 830, 60);

  motes(p, 141, 90, [0, 100, W, 860], [1, 3], [hex("#d8b8ff"), hex("#a8e0ff"), hex("#ffe0a8")], 0.7);
  vignette(p, 0.35);
}

const PAINT: Record<Element, (p: Paint) => void> = { leaf, ember, tide, stone, sky: skyScene, frost, moon, arcane };

/** Brightness trim so every habitat sits at a similar level once the reader
 *  dims it: daylight scenes down, the cavern up. */
const EXPOSURE: Record<Element, number> = { leaf: 0.8, ember: 1.05, tide: 0.9, stone: 1.35, sky: 0.72, frost: 1, moon: 1.1, arcane: 1.1 };

/** Paint an element's backdrop at w×h (keep the 16:10 aspect; the reader
 *  crops to fill). Returns 8-bit RGBA. Takes a second or two, so render it
 *  off the main thread. */
export function renderBackdrop(el: Element, w = W, h = H): Uint8ClampedArray<ArrayBuffer> {
  const p = new Paint(w, h);
  PAINT[el](p);
  const k = EXPOSURE[el];
  for (let i = 0; i < p.px.length; i++) p.px[i] *= k;
  return p.rgba();
}
