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

export function rng(seed: number) {
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

/** A mask channel's meaning. "hide" starts at 1 and is covered by whatever
 *  is painted after it: where a moving effect behind the scenery shows
 *  (aurora behind the mountains). "tag" follows the brush: how much a
 *  pixel belongs to something that moves (a crown that sways). */
type MaskMode = "hide" | "tag";

class Paint {
  readonly w: number;
  readonly h: number;
  readonly px: Float32Array;
  /** Device pixels per scene unit. */
  readonly k: number;
  /** Painting for the living backdrop (living.ts): the moving parts are
   *  left out for its shader to draw, and it gets the masks and layer
   *  it needs. */
  readonly live: boolean;
  /** 4 channels per pixel, meaning set per scene (see MaskMode). */
  readonly mask: Float32Array | null;
  readonly modes: (MaskMode | null)[] = [null, null, null, null];
  /** What "tag" channels are painted with. */
  readonly brush = new Float32Array(4);
  /** Blur radius per channel, in scene units: a sway field has to reach a
   *  little past the thing that sways, or its edge can't move. */
  readonly blur = [0, 0, 0, 0];
  /** A separate layer the shader moves (kelp) or animates (lava light):
   *  premultiplied RGBA, painted into while `toLayer` is set. */
  layer: Float32Array | null = null;
  layerMode: "over" | "add" | null = null;
  toLayer = false;
  constructor(w: number, h: number, live = false) {
    this.w = w;
    this.h = h;
    this.px = new Float32Array(w * h * 3);
    this.k = w / W;
    this.live = live;
    this.mask = live ? new Float32Array(w * h * 4) : null;
  }
  /** Start a "hide" channel: everything painted from now on covers it. */
  hide(ch: number) {
    if (!this.mask) return;
    this.modes[ch] = "hide";
    for (let j = ch; j < this.mask.length; j += 4) this.mask[j] = 1;
  }
  /** Start a "tag" channel, blurred by `blur` scene units at the end. */
  tag(ch: number, blur = 0) {
    this.modes[ch] = "tag";
    this.blur[ch] = blur;
  }
  /** Send what follows to the separate layer (live only). */
  beginLayer(mode: "over" | "add") {
    if (!this.live) return;
    this.layer ??= new Float32Array(this.w * this.h * 4);
    this.layerMode = mode;
    this.toLayer = true;
  }
  endLayer() {
    this.toLayer = false;
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
    if (this.toLayer) {
      const L = this.layer!;
      const j = (i / 3) * 4;
      L[j] += (T[0] - L[j]) * a;
      L[j + 1] += (T[1] - L[j + 1]) * a;
      L[j + 2] += (T[2] - L[j + 2]) * a;
      L[j + 3] += (1 - L[j + 3]) * a;
      return;
    }
    const p = this.px;
    p[i] += (T[0] - p[i]) * a;
    p[i + 1] += (T[1] - p[i + 1]) * a;
    p[i + 2] += (T[2] - p[i + 2]) * a;
    const m = this.mask;
    if (m) {
      const j = (i / 3) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const mode = this.modes[ch];
        if (mode === "hide") m[j + ch] *= 1 - a;
        else if (mode === "tag") m[j + ch] += (this.brush[ch] - m[j + ch]) * a;
      }
    }
  }
  /** Add light. */
  add(i: number, c: ArrayLike<number>, s: number) {
    if (this.toLayer) {
      const L = this.layer!;
      const j = (i / 3) * 4;
      L[j] += c[0] * s;
      L[j + 1] += c[1] * s;
      L[j + 2] += c[2] * s;
      return;
    }
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
      // over-bright light (lava, glows) keeps its hue: scale the pixel down
      // as a whole instead of clipping channels, which turns orange yellow
      const m = Math.max(this.px[i], this.px[i + 1], this.px[i + 2]);
      const k = m > 1 ? 255 / m : 255;
      out[j] = this.px[i] * k + d;
      out[j + 1] = this.px[i + 1] * k + d;
      out[j + 2] = this.px[i + 2] * k + d;
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

/** How much each scene darkens its corners. */
export const VIGNETTE: Record<Element, number> = { leaf: 0.3, ember: 0.3, tide: 0.4, stone: 0.35, sky: 0.25, frost: 0.35, moon: 0.35, arcane: 0.35 };

/** Darken the corners a touch (the layer too; masks are left alone). The
 *  living shader applies the same falloff to what it draws. */
function vignette(p: Paint, s: number) {
  const L = p.layer;
  p.each(0, 0, W, H, (X, Y, i) => {
    const dx = (X - W / 2) / (W / 2);
    const dy = (Y - H * 0.45) / (H * 0.6);
    const k = 1 - s * smooth(0.5, 1.6, dx * dx + dy * dy);
    p.px[i] *= k;
    p.px[i + 1] *= k;
    p.px[i + 2] *= k;
    if (L) {
      const j = (i / 3) * 4;
      L[j] *= k;
      L[j + 1] *= k;
      L[j + 2] *= k;
    }
  });
}

// ── shared scenery ──

/** A pine at (x, base), `h` tall: tiered, jagged, lit from the left; snow
 *  on the tier tops when `snow` is given. */
function pine(p: Paint, n: Noise, x: number, base: number, h: number, dark: C, lit: C, snow?: C, haze?: { c: C; a: number }, sway = 0) {
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
      if (hw <= 0) return;
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
    p.brush[0] = sway * v * v;
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

/** How strongly the glade's undergrowth — bushes and wildflowers — and
 *  its grassy foreground sway in living.ts (their weight in mask channel 0). */
export const UNDERGROWTH_SWAY = 0.5;
export const GROUND_SWAY = 0.25;

let groundNoise: Noise | null = null;
/** The glade's ground along its grassy foreground, at x: where the grass
 *  grows from, under its tips — and where its songbirds hop (wildlife.ts). */
export function gladeGround(x: number): number {
  groundNoise ??= perlin(2);
  return 915 + 18 * fbm(groundNoise, x * 0.004, 9.5, 3);
}

/** The glade's wildflowers, in the undergrowth either side: where the
 *  painter puts them, and where its butterflies settle (wildlife.ts).
 *  `petal` indexes the painter's petal colours. */
export const GLADE_FLOWERS: readonly { x: number; y: number; r: number; petal: number }[] = (() => {
  const r = rng(31);
  return Array.from({ length: 70 }, (_, i) => {
    const x = i % 2 ? 1600 - r() * 520 : r() * 520;
    const y = 830 + r() * 150;
    const petal = Math.floor(r() * 4);
    return { x, y, petal, r: 3 + r() * 3.5 };
  });
})();

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

  // the meadow, a sunlit clearing in the middle (live: sun-dapples drift
  // over it, channel 3; crowns, bushes and flowers sway, channel 0)
  p.tag(0, 10);
  p.tag(3);
  p.brush[3] = 1;
  land(p, curve((X) => 690 + 22 * fbm(n, X * 0.003, 4.2, 3)), (X, Y, d) => {
    const streak = fbm(n2, X * 0.2, Y * 0.03, 2) * 0.25 + fbm(n, X * 0.006, Y * 0.02, 3) * 0.6;
    const sun = Math.exp(-(((X - 800) / 520) ** 2) - ((Y - 740) / 160) ** 2);
    mix(hex("#4f8a3e"), hex("#8cbd5c"), clamp(0.35 + streak + sun * 0.45 - smooth(0, 260, d) * 0.3));
    toward(hex("#d8e79a"), sun * 0.35 * (1 - smooth(0, 60, d)));
    return 1;
  });
  p.brush[3] = 0;
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
  p.brush[0] = 1;
  cluster(p, n, 21, 150, 80, 330, 170, 34, [60, 120], foliage);
  cluster(p, n, 22, 1460, 70, 330, 160, 34, [60, 120], foliage);
  p.brush[0] = 0.7;
  cluster(p, n, 23, 350, 340, 110, 70, 12, [36, 66], foliage);

  // undergrowth, then the dark foreground lip with grass tips
  const bush = { ...foliage, light: hex("#86b85a") };
  p.brush[0] = UNDERGROWTH_SWAY;
  cluster(p, n, 24, 170, 870, 280, 60, 26, [40, 80], bush, 0.5);
  cluster(p, n, 25, 1440, 860, 280, 60, 26, [40, 80], bush, 0.5);
  p.brush[0] = GROUND_SWAY;
  land(p, curve((X) => gladeGround(X) - 12 * Math.abs(n(X * 0.3, 2.2))), (X, Y, d) => {
    mix(hex("#1f3a1c"), hex("#3f6e30"), clamp(0.5 + fbm(n, X * 0.2, Y * 0.03, 3) * 0.8 - smooth(0, 40, d) * 0.4));
    return 1;
  });

  // wildflowers in the undergrowth, pollen drifting in the light
  const petals = ["#fff6e0", "#ffd86b", "#f3a6c8", "#c9b6ff"].map(hex);
  p.brush[0] = UNDERGROWTH_SWAY;
  for (const f of GLADE_FLOWERS) {
    const c = petals[f.petal];
    ball(p, n, f.x, f.y, f.r, { dark: times(c, 0.6), mid: c, light: hex("#ffffff"), rough: 0.3, freq: 0.5, tex: 0 });
  }
  vignette(p, VIGNETTE.leaf);
}

/** The ember crags' volcano: the middle of its crater's mouth. Its plume
 *  rises from here (living.ts), and now and then it throws up sparks
 *  (ember.ts). */
export const CRATER: readonly [number, number] = [1350, 350];
/** The lava lake's far shore, and the horizon its surface runs toward in
 *  perspective. Shared by the painter, living.ts (its crust drifting) and
 *  ember.ts (bubbles breaking on it). */
export const LAVA_SHORE = 806;
export const LAVA_HORIZON = 650;
/** Where bubbles rise and break on the lake, in the open lava beside the
 *  pages: [x, y, size]. */
export const LAVA_BUBBLES: readonly [number, number, number][] = [
  [262, 868, 0.8],
  [118, 916, 1],
  [352, 944, 1.15],
  [1228, 858, 0.75],
  [1330, 902, 1],
  [1262, 962, 1.2],
];

/** The volcano's flanks at x, where the cinders it throws land
 *  (ember.ts). The painter roughens them a little. */
export function volcanoAt(x: number): number {
  const dx = Math.abs(x - CRATER[0]);
  return CRATER[1] + (dx < 46 ? 3 : 480 * (1 - 1 / (1 + ((dx - 46) / 300) ** 1.6)));
}

/** The plume's middle and half-width at height h over the crater: it
 *  leans away on the wind and spreads as it climbs. Keep in step with
 *  plume() in living.ts. */
export function plumeAt(h: number): [number, number] {
  return [CRATER[0] - 0.0016 * h * h - 0.08 * h, 22 + h * 0.5];
}

const fract = (v: number) => v - Math.floor(v);

/** Cells of 2-D space around (x, y), points jittered by a hash: the
 *  distances to the nearest point and the next, and the nearest one's
 *  hash. */
function cells(x: number, y: number): [number, number, number] {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i;
      const cy = iy + j;
      const hx = fract(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453);
      const hy = fract(Math.sin(cx * 269.5 + cy * 183.3) * 43758.5453);
      const dx = cx + 0.5 + 0.4 * Math.sin(Math.PI * 2 * hx) - x;
      const dy = cy + 0.5 + 0.4 * Math.sin(Math.PI * 2 * hy) - y;
      const e = dx * dx + dy * dy;
      if (e < f1) {
        f2 = f1;
        f1 = e;
        id = hx;
      } else if (e < f2) f2 = e;
    }
  }
  return [Math.sqrt(f1), Math.sqrt(f2), id];
}

/** The lake's crust at a point of the painting, seen in perspective:
 *  plates of cooled skin, glowing red at their thin edges, parted by
 *  seams of open lava, some seams healing over, a plate here and there
 *  thin enough to glow through. 0 = cold crust … 1 = open lava. Only
 *  trig and hashes, so living.ts's crust() — keep the two in step —
 *  draws the same lake to the pixel, then sets it drifting. */
function crust(X: number, Y: number): number {
  const d = Y - LAVA_HORIZON;
  let sx = ((X - 800) * 3.4) / d;
  let sy = 2600 / d;
  const wx = 0.3 * Math.sin(sy * 1.3 + 1.7 * Math.sin(sx * 0.5)) + 0.2 * Math.sin(sx * 0.9 - sy * 0.7);
  const wy = 0.3 * Math.sin(sx * 1.1 + 1.3 * Math.sin(sy * 0.6)) + 0.2 * Math.sin(sy * 0.8 + sx * 0.5);
  sx += wx;
  sy += wy;
  const [f1, f2, id] = cells(sx, sy);
  const edge = f2 - f1;
  // how hot this part of the lake runs: seams bright here, faint there
  const heat = smooth(-0.6, 0.9, Math.sin(sx * 0.35 + 1.5 * Math.sin(sy * 0.3)) + 0.6 * Math.sin(sy * 0.55 - sx * 0.2));
  const seam = Math.exp(-((edge / (0.035 + 0.05 * heat)) ** 2));
  const rim = Math.exp(-edge / 0.16);
  // finer cracks across the plates
  const [g1, g2] = cells(sx * 2.6 + 7, sy * 2.6);
  const crack = Math.exp(-(((g2 - g1) / 0.05) ** 2)) * 0.35;
  // a plate here and there thinner, glowing through
  const thin = smooth(0.85, 1, id) * heat * 0.3;
  return clamp(seam * (0.45 + 0.55 * heat) + rim * 0.22 * heat + crack * heat + thin);
}

function ember(p: Paint) {
  const n = perlin(3);
  const n2 = perlin(4);
  const [cx, cy] = CRATER;
  const lava = hex("#ff6a1c");
  const hot = hex("#ffd27a");
  const fire = hex("#ff8a3a");
  sky(p, [[0, "#0a0610"], [0.22, "#190a14"], [0.42, "#341219"], [0.56, "#5e1e1c"], [0.64, "#923820"], [0.7, "#c05a28"], [1, "#2a0d10"]]);

  // a ruddy moon, dim through the ash
  const [mx, my, mr] = [250, 196, 40];
  glow(p, mx, my, mr * 2.4, hex("#c0603e"), 0.22);
  const [moonDark, moonLit] = [hex("#c8704c"), hex("#ffcfa8")];
  p.each(mx - mr - 2, my - mr - 2, mx + mr + 2, my + mr + 2, (X, Y, i) => {
    const d = Math.hypot(X - mx, Y - my) / mr;
    const cov = clamp((1 - d) * mr * p.k + 0.5);
    if (cov <= 0) return;
    mix(moonDark, moonLit, clamp(0.8 - d * d * 0.4 + fbm(n2, X * 0.045, Y * 0.045, 3) * 0.45));
    p.over(i, cov * 0.62);
  });

  // ash clouds, their undersides lit by the fire below (live: they
  // billow, channel 1)
  p.tag(1, 20);
  p.brush[1] = 1;
  const soot = hex("#140a10");
  const ruddy = hex("#7a2a1e");
  const moonlit = hex("#b47a6c");
  p.each(0, 0, W, 640, (X, Y, i) => {
    const wx = fbm(n2, X * 0.0015, Y * 0.003, 3) * 160;
    // (and a thin bank drawn across the moon)
    const veil = Math.exp(-(((X - mx) / 190) ** 2) - ((Y - my - 8) / 30) ** 2) * 0.32;
    const dens = (y: number, oct: number) =>
      fbm(n, (X + wx) * 0.0017, y * 0.0055, oct) + (veil > 0.003 ? veil * Math.exp(-(((y - my - 8) / 16) ** 2)) * (0.6 + fbm(n2, X * 0.01, y * 0.05, 3)) : 0);
    const d = dens(Y, 5);
    const a = smooth(-0.1, 0.32, d) * smooth(0, 50, Y) * (1 - smooth(430, 620, Y));
    if (a <= 0.004) return;
    // thinner just below: an underside, catching the light
    const under = clamp((d - dens(Y + 16, 3)) * 7 + 0.35);
    const heat = Math.exp(-(((X - cx) / 560) ** 2) - ((Y - 340) / 300) ** 2) + smooth(200, 620, Y) * 0.5;
    const moon = Math.exp(-(((X - mx) / 200) ** 2) - ((Y - my) / 130) ** 2);
    mix(soot, ruddy, clamp(heat * (0.25 + under * 0.9)));
    toward(fire, clamp(heat - 0.35) * under * 0.55);
    toward(moonlit, moon * (1 - under) * 0.45);
    p.over(i, a * 0.94);
  });
  p.brush[1] = 0;

  // the plume (live: living.ts draws it rising)
  if (!p.live) {
    const [smokeDark, smokeLit] = [hex("#2a1416"), hex("#5a2c26")];
    p.each(cx - 760, 0, cx + 240, cy + 4, (X, Y, i) => {
      const h = cy - Y;
      const [pc, hw] = plumeAt(h);
      const q = Math.abs(X - pc) / hw;
      if (q > 1.6) return;
      const b = fbm(n, (X - pc) * 0.012, Y * 0.01, 4);
      const a = smooth(1.15, 0.45, q - b * 0.6) * smooth(-6, 20, h) * (1 - smooth(200, 360, h) * 0.6);
      if (a <= 0) return;
      const low = Math.exp(-h / 150);
      mix(smokeDark, smokeLit, clamp(0.4 + b));
      toward(fire, low * 0.7 * clamp(0.6 - b));
      p.over(i, a * 0.9);
    });
  }

  // the far range, and a smaller volcano smoking on it
  const far = curve((X) => Math.min(668 - 110 * ridged(n, X * 0.0026, 0.3, 5), 566 + Math.abs(X - 350) * 0.62 + 6 * n(X * 0.06, 2)));
  const [farDark, farLit, farRim] = [hex("#3a141e"), hex("#5a2026"), hex("#a84426")];
  land(p, far, (X, Y, d) => {
    mix(farDark, farLit, clamp(0.35 + bump(n2, X, Y, 0.01, 0.004) * 0.4));
    toward(farRim, 0.3 * (1 - smooth(0, 140, d)));
    toward(hot, (1 - smooth(0, 2.5, d)) * 0.35);
    // its thread of lava
    const lx = 350 + 14 * fbm(n2, Y * 0.02, 4, 2) * smooth(566, 640, Y);
    toward(lava, Math.exp(-(((X - lx) / 3) ** 2)) * smooth(562, 572, Y) * (1 - smooth(610, 670, Y)) * 0.8);
    return 1;
  });
  glow(p, 350, 570, 26, lava, 0.4);
  mist(p, n2, 600, 720, hex("#8a3424"), 0.35);

  // the volcano: gullies running down from the rim, lava pouring down
  // them
  const cone = curve((X) => volcanoAt(X) + 5 * n(X * 0.06, 1) + 10 * fbm(n2, X * 0.012, 3, 3) * smooth(46, 120, Math.abs(X - cx)));
  /** A river from the rim at x0, swinging `drift` aside by the foot: its
   *  middle by height, sampled once. */
  const river = (x0: number, drift: number, w: number, seed: number) => ({
    w,
    seed,
    mid: curve((Y) => {
      const t = clamp((Y - cy) / (LAVA_SHORE - cy));
      return x0 + drift * t * t + 26 * fbm(n2, Y * 0.01, seed, 3) * t;
    }),
  });
  const rivers = [river(cx - 16, -190, 1, 5), river(cx + 18, 110, 0.8, 6), river(cx + 2, -36, 0.55, 7)];
  /** A river at height Y: its two braids' middles, and their half-width. */
  const riverAt = (f: (typeof rivers)[number], Y: number) => {
    const t = clamp((Y - cy) / (LAVA_SHORE - cy));
    const c = f.mid(Y);
    const split = 7 * f.w * Math.max(0, Math.sin(t * 9 + f.seed)) * t;
    return { a: c - split, b: c + split, hw: (2.5 + 8 * t) * f.w, t };
  };
  const heatOf = (X: number, Y: number) => {
    let h = 0;
    for (const f of rivers) {
      const { a, b, hw } = riverAt(f, Y);
      h += Math.exp(-(((X - a) / (hw * 6 + 18)) ** 2)) + Math.exp(-(((X - b) / (hw * 6 + 18)) ** 2));
    }
    return clamp(h * 0.6);
  };
  const gully = (X: number, Y: number) => ridged(n, Math.atan2(X - cx, Y - cy + 60) * 7, Math.sqrt(Math.max(0, Y - cy)) * 0.22, 4);
  const [slopeDark, slopeLit, slopeHot, foot] = [hex("#1a080c"), hex("#4a1a1a"), hex("#c0481e"), hex("#7a2a18")];
  land(p, cone, (X, Y, d) => {
    // the ridges between gullies lit on the side toward the crater's glow
    const g = gully(X, Y);
    const slope = (gully(X + 2, Y) - g) * 2 * (X < cx ? 1 : -1);
    mix(slopeDark, slopeLit, clamp(0.3 + g * 0.35 + slope * 3 + bump(n2, X, Y, 0.02, 0.01) * 0.15 - smooth(0, 320, d) * 0.15));
    toward(slopeHot, heatOf(X, Y) * 0.6);
    // the rim, lit from the crater
    toward(fire, Math.exp(-d / 26) * smooth(140, 20, Math.abs(X - cx)) * 0.5);
    // and the foot, by the lake
    toward(foot, smooth(700, 806, Y) * 0.5);
    return 1;
  });
  // the lava's own light, and the crater's (live: a layer, its crust
  // creeping downhill)
  p.beginLayer("add");
  p.each(cx - 420, cy - 20, cx + 300, LAVA_SHORE + 4, (X, Y, i) => {
    if (Y < cone(X) - 1) return;
    for (const f of rivers) {
      const { a, b, hw, t } = riverAt(f, Y);
      const d = Math.min(Math.abs(X - a), Math.abs(X - b)) / hw;
      if (d > 6) continue;
      const skin = smooth(0.15, 0.7, n(X * 0.15, Y * 0.06) * 0.5 + 0.5) * t * 0.6;
      p.add(i, lava, Math.exp(-d * d * 0.6) * 1.1 * (1 - skin * 0.6) + Math.exp(-d * 0.8) * 0.22);
      p.add(i, hot, Math.exp(-d * d * 2) * 0.9 * (1 - skin));
    }
  });
  // the mouth, molten
  p.each(cx - 60, cy - 14, cx + 60, cy + 14, (X, Y, i) => {
    const e = Math.hypot((X - cx) / 46, (Y - cy - 2) / 8);
    if (e > 1.6 || Y > cone(X) + 2) return;
    p.add(i, hot, Math.exp(-e * e * 2) * 1.4);
    p.add(i, lava, Math.exp(-e * e) * 0.8);
  });
  p.endLayer();
  glow(p, cx, cy - 4, 44, hot, 0.6);
  glow(p, cx, cy - 20, 200, lava, 0.24);

  // basalt columns: the cliff on the left, a few on the right; their
  // faces toward the lava lit by it
  /** A column `w` across from `top` down to `base`, broken off at a slant;
   *  `side` is the face toward the light (1 right, -1 left). */
  const column = (x: number, top: number, base: number, w: number, side: number, near: number, seed: number) => {
    const r = rng(seed);
    const tilt = (r() - 0.5) * 0.9;
    // turned a little each: where its faces meet, and how much light it gets
    const e1 = -0.5 + (r() - 0.5) * 0.4;
    const e2 = 0.3 + (r() - 0.5) * 0.4;
    const k = 0.75 + r() * 0.35;
    const joints: number[] = [];
    for (let y = top + 50 + r() * 120; y < base - 30; y += 90 + r() * 160) joints.push(y);
    const dark = times(hex("#140709"), 1 - near * 0.3);
    const mid = times(hex("#3a1716"), 1 - near * 0.2);
    const lit = hex("#d0602c");
    const rim = hex("#ffa060");
    const broken = hex("#6a3028");
    const hw = w / 2;
    p.each(x - hw - 1, top - hw, x + hw + 1, base, (X, Y, i) => {
      const u = (X - x) / hw;
      if (Math.abs(u) > 1 + 1 / (hw * p.k)) return;
      const lid = top + tilt * u * hw + 2 * n(X * 0.08, seed);
      const cov = clamp((1 - Math.abs(u)) * hw * p.k + 0.5) * clamp((Y - lid) * p.k + 0.5);
      if (cov <= 0) return;
      // three faces of the prism: away from the light, front, toward it
      const s = u * side;
      const face = (s < e1 ? 0.05 : s < e2 ? 0.38 : 1) * k;
      const grain = fbm(n2, X * 0.1, Y * 0.01, 3) * 0.2;
      // the lava below lights them more the lower down
      const warm = 0.25 + 0.75 * smooth(top - 60, base + 40, Y) ** 1.6;
      ramp(face * warm * 0.95 + grain, dark, mid, lit);
      // the edge where the lit face turns, catching it
      toward(rim, Math.exp(-((((s - e2) * hw) / 1.4) ** 2)) * warm * 0.4);
      // and a dark seam between one column and the next
      scale(1 - smooth(0.8, 1, Math.abs(u)) * 0.5);
      // joints: a dark crack, its lower lip lit
      for (const jy of joints) {
        const dy = Y - jy - tilt * u * hw * 0.6;
        if (dy > -1.6 && dy < 0.6) scale(0.4);
        else if (dy >= 0.6 && dy < 2.6) toward(rim, face * warm * 0.3);
      }
      // the broken top, lit by the sky's glow
      toward(broken, smooth(5, 0, Y - lid) * 0.6);
      toward(lava, near * face * smooth(base - 80, base, Y) * 0.25);
      p.over(i, cov);
    });
  };
  // the cliff stepping down toward the lake, and its fallen pieces
  const r = rng(13);
  for (let x = -14; x < 260; x += 30 + r() * 12) {
    const top = 150 + 470 * smooth(20, 280, x) ** 1.3 + (r() - 0.5) * 80;
    column(x, top, 830, 30 + r() * 12, 1, 0, 100 + x);
  }
  for (let x = 1616; x > 1500; x -= 32 + r() * 10) column(x, 500 + (1616 - x) * 1.1 + (r() - 0.5) * 60, 830, 32 + r() * 10, -1, 0, 200 + x);
  // the lava lake (live: channel 0, its crust drifting)
  const shore = curve((X) => LAVA_SHORE + 5 * fbm(n2, X * 0.01, 6.5, 3));
  p.tag(0);
  p.brush[0] = 1;
  const crustC = hex("#170605");
  const crustL = hex("#3a1209");
  const red = hex("#b8300e");
  land(p, shore, (X, Y, d) => {
    const c = crust(X, Y);
    // far off, the plates too small to tell apart: a glow
    const far = smooth(36, 0, d);
    mix(crustC, crustL, clamp(0.4 + fbm(n, X * 0.05, Y * 0.14, 3) * 0.8));
    toward(red, smooth(0, 0.35, c) * 0.8 + far * 0.4);
    toward(lava, smooth(0.25, 0.75, c) + far * 0.3);
    toward(hot, smooth(0.65, 1, c) * 0.8);
    // brightest along the far shore, where the rivers run in
    toward(hot, Math.exp(-d / 4) * 0.5);
    return 1;
  });
  p.brush[0] = 0;
  glow(p, 1200, LAVA_SHORE, 46, hot, 0.5);
  glow(p, 800, LAVA_SHORE + 20, 600, fire, 0.1);

  // broken columns standing in the lava, low enough to see their tops:
  // hexagons, lit by the sky's glow, their sides by the lava
  const top6 = hex("#26100f");
  const side6 = hex("#1a0809");
  const top6Lit = hex("#6a3228");
  const side6Lit = hex("#8a3418");
  const edge6 = hex("#ffb070");
  const stump = (x: number, y: number, R: number, h: number, seed: number) => {
    const q = 0.36;
    const ry = R * q * Math.sin(Math.PI / 3);
    // the hexagon's outline below and above its middle, at x
    const rimAt = (dx: number) => ry * clamp((R - Math.abs(dx)) / (R / 2));
    p.each(x - R - 1, y - ry - 1, x + R + 1, y + ry + h + 1, (X, Y, i) => {
      const dx = X - x;
      const e = rimAt(dx);
      const cx_ = clamp((R - Math.abs(dx)) * p.k + 0.5);
      if (cx_ <= 0) return;
      const dy = Y - y;
      if (dy < -e - 1) return;
      if (dy <= e) {
        // the top: cracked basalt, its edge catching the light
        const cov = cx_ * clamp((dy + e) * p.k + 0.5);
        const edge = Math.min(R - Math.abs(dx), e - Math.abs(dy) * 0.9);
        const cracks = smooth(0.82, 0.95, ridged(n2, X * 0.06 + seed, Y * 0.16, 3));
        mix(top6, top6Lit, clamp(0.3 + fbm(n, X * 0.08 + seed, Y * 0.2, 3) * 0.7 - dy / ry * 0.15 - cracks * 0.4));
        toward(edge6, Math.exp(-edge / 1.1) * 0.28);
        p.over(i, cov);
        return;
      }
      if (dy > e + h) return;
      // the sides: three faces, the one toward the middle of the lake lit
      const f = dx < -R / 2 ? 0 : dx < R / 2 ? 1 : 2;
      const toLake = x < W / 2 ? 2 : 0;
      const v = (dy - e) / h;
      mix(side6, side6Lit, clamp((f === toLake ? 0.5 : f === 1 ? 0.26 : 0.06) + v * 0.45 + fbm(n2, X * 0.14, Y * 0.015, 3) * 0.3));
      toward(edge6, Math.exp(-(dy - e) / 1.2) * 0.3);
      // where it meets the lava: molten
      toward(lava, smooth(0.6, 1, v) * 0.7);
      p.over(i, cx_ * clamp((e + h - dy) * p.k + 0.5));
    });
    glow(p, x, y + ry + h, R * 0.8, lava, 0.18);
  };
  for (const [x, y, R, h] of [[300, 874, 16, 8], [1196, 866, 13, 6], [1420, 904, 18, 10], [176, 948, 34, 30], [70, 910, 46, 90], [-6, 950, 56, 70], [118, 990, 44, 40], [1470, 960, 34, 24], [1556, 920, 50, 90], [1640, 960, 60, 60], [1500, 1000, 44, 40]] as const) stump(x, y, R, h, x);

  // sparks in the air (live: ember.ts)
  if (!p.live) motes(p, 33, 70, [0, 300, W, 900], [1, 2.6], [hot, lava, fire], 0.7);
  vignette(p, VIGNETTE.ember);
}

function tide(p: Paint) {
  const n = perlin(5);
  const n2 = perlin(6);
  sky(p, [[0, "#a4ece2"], [0.15, "#5cc4cc"], [0.45, "#1f7ea8"], [0.75, "#0f4e7c"], [1, "#082e50"]]);
  const water = hex("#1a6f9c");
  const foam = hex("#e8fffa");

  // the rippling surface overhead: a caustic net (live: the shader's,
  // always re-forming)
  if (!p.live) {
    p.each(0, 0, W, 220, (X, Y, i) => {
      const wx = fbm(n2, X * 0.004, Y * 0.02, 3) * 60;
      const c = 1 - Math.abs(n((X + wx) * 0.012, Y * 0.04));
      p.add(i, foam, c ** 12 * (1 - smooth(0, 220, Y)) * 0.45);
    });
  }
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

  // sand: rippled, with caustics dancing on it (live: the shader's, where
  // channel 3 says)
  p.tag(3);
  land(p, curve((X) => 820 + 16 * fbm(n2, X * 0.003, 8.5, 3)), (X, Y, d) => {
    const ripple = Math.sin(X * 0.09 + 7 * fbm(n, X * 0.004, Y * 0.012, 3) + Y * 0.05) * 0.5 + 0.5;
    mix(hex("#8a7a58"), hex("#e0cc92"), clamp(0.45 + ripple * 0.3 - smooth(0, 180, d) * 0.45));
    const reach = 1 - smooth(0, 160, d);
    if (p.live) p.brush[3] = reach;
    else toward(hex("#fff4d0"), (1 - Math.abs(n(X * 0.02 + fbm(n2, X * 0.01, Y * 0.03, 2) * 2, Y * 0.06))) ** 8 * 0.5 * reach);
    toward(water, 0.18 + smooth(300, 800, Math.abs(X - 800)) * 0.1);
    return 1;
  });
  p.brush[3] = 0;

  // rocks both sides
  const rock: Ball = { dark: hex("#0f2a38"), mid: hex("#2b5566"), light: hex("#6a9aa4"), rough: 0.25, freq: 0.012, tex: 0.25, texFreq: 0.05, L: light(-0.2, -1, 0.5) };
  cluster(p, n, 71, 150, 870, 220, 50, 9, [60, 110], rock, 0.4);
  cluster(p, n, 72, 1460, 860, 220, 50, 9, [60, 115], rock, 0.4);

  // coral among the kelp's feet
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

  // a school of fish in the distance (live: ambience.ts's, swimming, with
  // the bubbles and specks)
  const fr = rng(91);
  for (let i = 0; i < (p.live ? 0 : 14); i++) {
    const x = 1130 + fr() * 330;
    const y = 280 + fr() * 180;
    const s = 0.7 + fr() * 0.5;
    ball(p, n, x, y, 13 * s, { dark: hex("#0c3c5a"), mid: hex("#1a5a7c"), light: hex("#5aa0bc"), rough: 0, freq: 0, tex: 0, alpha: 0.7 }, 0.38);
    limb(p, x + 12 * s, y, x + 22 * s, y, 1, 6 * s, () => set(hex("#124a6a")));
  }
  // kelp: tall ribbons reaching up toward the light, with blades, in front
  // (live: a layer the shader sways)
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
  p.beginLayer("over");
  kelps.forEach(([x, h], i) => kelp(x, h, 80 + i, i % 2));
  p.endLayer();

  vignette(p, VIGNETTE.tide);
}

/** The crystal cavern's pool: its surface line, and the drips that fall
 *  into it from stalactite tips — each from `tip` down to where it lands at
 *  (x, y), every `every` seconds, landing when (t + at) is a multiple of
 *  it. Shared by the painter (the stalactites), ambience.ts (the falling
 *  drops) and living.ts (the rings they make). */
export const CAVE_WATER = 872;
export interface Drip {
  x: number;
  tip: number;
  y: number;
  every: number;
  at: number;
}
export const DRIPS: readonly Drip[] = [
  { x: 176, tip: 318, y: 934, every: 7.3, at: 0.4 },
  { x: 338, tip: 382, y: 903, every: 9.1, at: 5.2 },
  { x: 1262, tip: 396, y: 917, every: 8.2, at: 2.9 },
  { x: 1408, tip: 330, y: 948, every: 11.7, at: 7.5 },
];
/** Glowing mushrooms on the cavern's rocks: [x, y, size]. */
export const CAVE_SHROOMS: readonly [number, number, number][] = [
  [72, 846, 1],
  [356, 866, 0.7],
  [1218, 870, 0.75],
  [1548, 838, 1],
];
/** Where light falls through a crack in the cavern's roof. */
export const CAVE_CRACK: readonly [number, number] = [1388, 0];

function stone(p: Paint) {
  const n = perlin(7);
  const n2 = perlin(8);
  const cyan = hex("#6fdcff");
  const violet = hex("#b48cff");
  const worm = hex("#7ff0e6");
  const pink = hex("#ff8fd6");
  const day = hex("#dfe8ff");
  const white = hex("#ffffff");

  // the dark, lit faintly from the far chamber
  fill(p, (X, Y) => mix(hex("#3a3462"), hex("#0b0913"), smooth(0, 1, Math.hypot((X - 800) / 950, (Y - 520) / 620))));

  const haze = hex("#3a3462");
  /** Rock, dark → lit, with a fine grain and faint strata, hazed by
   *  distance. */
  const rocky = (X: number, Y: number, dark: C, lit: C, hz: number, f: number, base = 0.4) => {
    const strata = Math.sin(Y * 0.09 + fbm(n, X * f, Y * f * 2, 3) * 4);
    mix(dark, lit, clamp(base + bump(n, X, Y, f, f * 1.6, -1, -0.6, 2) * 0.2 + fbm(n2, X * 0.05, Y * 0.05, 2) * 0.12 + strata * 0.05));
    toward(haze, hz);
  };
  const floor = (top: Curve, dark: string, lit: string, hz: number, f: number) => {
    const [D, L] = [hex(dark), hex(lit)];
    land(p, top, (X, Y, d) => {
      // lit along its upper slopes
      rocky(X, Y, D, L, hz, f, 0.62 - smooth(0, 120, d) * 0.3);
      return 1;
    });
  };
  const roof = (bottom: Curve, dark: string, lit: string, hz: number, f: number) => {
    const [D, L] = [hex(dark), hex(lit)];
    ceiling(p, bottom, (X, Y, d) => {
      rocky(X, Y, D, L, hz, f, 0.25 + smooth(30, 0, d) * 0.2);
      return 1;
    });
  };
  /** A stalactite hanging from (x, y) (dir 1), or a stalagmite rising from
   *  it (-1): a rounded cone `len` long, `w` across at its root, lit from
   *  the left, ringed faintly where it grew. */
  const cone = (x: number, y: number, len: number, w: number, dir: 1 | -1, dark: string, lit: string, hz: number, lean = 0) => {
    const [y0, y1] = dir > 0 ? [y - 6, y + len] : [y - len, y + 6];
    const [D, L] = [hex(dark), hex(lit)];
    strand(
      p,
      y0,
      y1,
      (v) => x + lean * (dir > 0 ? v : 1 - v) ** 2,
      (v) => (w / 2) * Math.max(0, dir > 0 ? 1 - v : v) ** 0.8 * (1 + 0.06 * Math.sin(v * len * 0.25 + x)),
      (X, Y, u) => {
        mix(D, L, clamp((dir > 0 ? 0.5 : 0.62) - u * 0.42 + fbm(n2, X * 0.1, Y * 0.03, 2) * 0.2));
        toward(haze, hz);
        return 1;
      },
    );
  };
  /** A row of cones along y, about `gap` apart, lengths up to `len`. */
  const cones = (seed: number, y: Curve, len: number, gap: number, dir: 1 | -1, dark: string, lit: string, hz: number) => {
    const r = rng(seed);
    for (let x = -20 + r() * gap; x < W + 20; x += gap * (0.5 + r())) {
      const l = len * (0.18 + r() ** 1.8 * 0.82);
      cone(x, y(x), l, Math.min(l * 0.3, 70) + 8 + r() * 10, dir, dark, lit, hz, (r() - 0.5) * 10);
    }
  };
  const ridge = (y: number, rise: number, f: number, seed: number) => {
    const rn = perlin(seed);
    return curve((X) => y - rise * ridged(rn, X * f, 0.5, 4));
  };
  const underside = (y: number, drop: number, f: number, seed: number) => {
    const rn = perlin(seed);
    return curve((X) => y + drop * (0.5 + fbm(rn, X * f, 0.5, 3)));
  };

  // depth: the far chamber, then a middle row of rock and columns, each
  // nearer one darker, mist between them
  const farFloor = ridge(600, 120, 0.0028, 21);
  const farRoof = underside(120, 50, 0.003, 23);
  floor(farFloor, "#2a2550", "#46407a", 0.45, 0.008);
  cones(31, farFloor, 70, 60, -1, "#2a2550", "#46407a", 0.45);
  roof(farRoof, "#28234a", "#3e3866", 0.5, 0.008);
  cones(32, farRoof, 110, 40, 1, "#28234a", "#423c70", 0.5);
  mist(p, n2, 480, 660, hex("#46407a"), 0.4);
  const midFloor = ridge(790, 150, 0.0034, 22);
  const midRoof = underside(70, 60, 0.004, 24);
  floor(midFloor, "#14101e", "#3a3360", 0.14, 0.011);
  cones(33, midFloor, 200, 110, -1, "#14101e", "#3a3360", 0.14);
  roof(midRoof, "#14101e", "#342d58", 0.18, 0.011);
  cones(34, midRoof, 200, 52, 1, "#14101e", "#3a3360", 0.18);
  // columns where a stalactite met the rock below
  for (const [x, w] of [[96, 34], [1522, 40]]) {
    strand(p, 60, 780, (v) => x + 10 * Math.sin(v * 5 + x) + 8 * n(x, v * 4), (v) => w * (0.4 + 0.6 * (Math.abs(v - 0.55) * 2.1) ** 1.8) * (1 + 0.2 * fbm(n2, x, v * 8, 2)), (X, Y, u) => {
      // flowstone: streaks running down it
      mix(hex("#120e1c"), hex("#3a3360"), clamp(0.48 - u * 0.4 + fbm(n2, X * 0.07, Y * 0.005, 3) * 0.5));
      toward(haze, 0.12);
      return 1;
    });
  }
  mist(p, n, 640, 800, haze, 0.3);

  // the near roof: big stalactites, the drips' among them
  const nearRoof = underside(26, 46, 0.005, 25);
  roof(nearRoof, "#07050c", "#211b36", 0, 0.016);
  cones(35, nearRoof, 230, 70, 1, "#07050c", "#2a2344", 0);
  for (const d of DRIPS) cone(d.x, nearRoof(d.x), d.tip - nearRoof(d.x), 30 + (d.tip % 7) * 3, 1, "#07050c", "#2a2344", 0);
  // the glowworms' light on the roof (they hang from it: ambience.ts)
  for (const [x, y, r] of [[200, 60, 260], [1380, 70, 240], [620, 40, 200], [1010, 40, 200]]) glow(p, x, y, r, worm, 0.07);
  // a crack in the roof, and daylight falling through it
  const [kx, ky] = CAVE_CRACK;
  p.each(kx - 60, ky - 10, kx + 60, ky + 40, (X, Y, i) => {
    const d = Math.hypot((X - kx) / 26, (Y - ky - 4) / 12) - 0.35 * fbm(n2, X * 0.06, Y * 0.06, 3);
    const cov = clamp((1 - d) * 16 * p.k * 0.5 + 0.5);
    if (cov <= 0) return;
    mix(day, white, smooth(0.9, 0.2, d));
    p.over(i, cov);
  });
  glow(p, kx, ky + 12, 46, day, 0.5);
  rays(p, n2, kx, ky, Math.PI / 2 + 0.15, 0.09, 950, day, 0.12, 30);

  // crystals: hexagonal prisms glowing from within, light sliding across
  // their faces (live: where channel 3 says)
  p.tag(3);
  const crystal = (x: number, y: number, h: number, w: number, a: number, lit: C, dark: C, apex: number) => {
    p.brush[3] = 1;
    const sx = Math.sin(a);
    const cy = -Math.cos(a);
    // the point starts where its facets would meet over a prism this wide
    const vt = 1 - Math.min(0.32, (w * 1.5) / h);
    // just the prism's own bounds: its base corners and its tip
    const ex = Math.abs(cy) * w + 2;
    const ey = Math.abs(sx) * w + 2;
    const tx = x + sx * h;
    const ty = y + cy * h;
    p.each(Math.min(x, tx) - ex, Math.min(y, ty) - ey, Math.max(x, tx) + ex, Math.max(y, ty) + ey, (X, Y, i) => {
      const dx = X - x;
      const dy = Y - y;
      const v = (dx * sx + dy * cy) / h;
      const u = (dx * -cy + dy * sx) / w;
      if (v < -0.06 || v > 1) return;
      const k = v < vt ? 0 : (v - vt) / (1 - vt);
      const lo = -1 + (apex + 1) * k;
      const hi = 1 + (apex - 1) * k;
      const e = Math.min(u - lo, hi - u);
      const cov = clamp(e * w * p.k * 0.5 + 0.5) * clamp((v + 0.06) * h * p.k);
      if (cov <= 0) return;
      // three faces seen, lit from the left; their ridges run up into the point
      const r1 = -0.4 + (apex + 0.4) * k;
      const r2 = 0.35 + (apex - 0.35) * k;
      const face = u < r1 ? 1 : u < r2 ? 0.6 : 0.3;
      const core = Math.exp(-(((u - apex * 0.3) * 1.6) ** 2)) * (0.3 + 0.7 * v);
      const inc = fbm(n, v * h * 0.03 + x * 0.1, u * 1.6, 2);
      mix(dark, lit, clamp(face * (0.28 + v * 0.42) + (k > 0 ? 0.2 * face : 0) + core * 0.3 + inc * 0.16 - smooth(0.14, 0, v) * 0.4));
      const ridge = Math.min(Math.abs(u - r1), Math.abs(u - r2)) * w;
      toward(white, Math.exp(-((ridge / 1.1) ** 2)) * 0.5 * face + Math.exp(-((e * w) ** 2)) * 0.18);
      p.over(i, cov * 0.94);
    });
    p.brush[3] = 0;
  };
  /** A cluster growing from (x, y) along `axis` (0 = up): a fan of
   *  crystals of every size, the biggest near the middle, and a crust of
   *  small ones at their feet. */
  const druse = (x: number, y: number, s: number, axis: number, count: number, lit: string, dark: string, gl: C, seed: number) => {
    const r = rng(seed);
    const L = hex(lit);
    const D = hex(dark);
    const ax = Math.sin(axis);
    const ay = -Math.cos(axis);
    glow(p, x + ax * 70 * s, y + ay * 70 * s, 160 * s, gl, 0.5);
    const list = Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1) - 0.5 + (r() - 0.5) * 0.18;
      const big = Math.max(0.12, 1 - Math.abs(t) * 1.6) * (0.55 + r() * 0.55);
      const h = (60 + 250 * big) * s;
      return {
        x: x - ay * t * 130 * s,
        y: y + ax * t * 130 * s + Math.abs(t) * 12 * s,
        h,
        w: Math.min(Math.max(h * 0.16, 7 * s), 34 * s) * (0.8 + r() * 0.35),
        a: axis + t * 1.2 + (r() - 0.5) * 0.3,
        apex: (r() - 0.5) * 0.9,
        z: r() * 0.6 - Math.abs(t),
      };
    });
    list.sort((a, b) => a.z - b.z);
    for (const c of list) crystal(c.x, c.y, c.h, c.w, c.a, times(L, 0.75 + 0.25 * (c.z + 1)), D, c.apex);
    for (let i = 0; i < 12; i++) {
      const t = (r() - 0.5) * 1.6;
      const h = (14 + r() * 34) * s;
      crystal(x - ay * t * 120 * s, y + ax * t * 120 * s + 6 * s, h, Math.max(h * 0.24, 4), axis + t * 1.4 + (r() - 0.5) * 0.6, L, D, (r() - 0.5) * 0.8);
    }
    glow(p, x + ax * 50 * s, y + ay * 50 * s, 60 * s, gl, 0.22);
  };
  const rock: Ball = { dark: hex("#0e0b16"), mid: hex("#241e38"), light: hex("#4a4270"), rough: 0.22, freq: 0.014, tex: 0.25, texFreq: 0.05, L: light(-0.5, -0.8, 0.4) };

  // out of the walls at the edges
  druse(-10, 520, 0.55, 1.05, 7, "#a8ecff", "#16477e", cyan, 5);
  druse(1612, 470, 0.6, -1.1, 7, "#d8c4ff", "#43208c", violet, 6);
  // from the roof
  druse(150, 40, 0.42, Math.PI + 0.15, 6, "#d8c4ff", "#43208c", violet, 7);
  druse(1478, 46, 0.45, Math.PI - 0.2, 6, "#a8ecff", "#16477e", cyan, 8);

  // the shore at the edges, rocks standing in the water, the big clusters
  // on them
  floor(curve((X) => 830 + 60 * smooth(70, 150, X) * smooth(1530, 1450, X) + 14 * fbm(n2, X * 0.01, 3, 3)), "#0e0b16", "#2e2848", 0, 0.014);
  for (const [x, y, r] of [[262, 884, 64], [196, 892, 44], [338, 888, 30], [1440, 880, 70], [1296, 890, 40], [1222, 888, 30]] as const) ball(p, n, x, y, r, rock, 0.55);
  druse(258, 858, 1, 0.12, 9, "#a8ecff", "#16477e", cyan, 1);
  druse(1440, 852, 1.12, -0.1, 9, "#d8c4ff", "#43208c", violet, 2);
  druse(1298, 870, 0.42, 0.25, 6, "#d8c4ff", "#43208c", violet, 3);
  druse(560, 862, 0.45, 0.1, 6, "#a8ecff", "#16477e", cyan, 4);
  druse(1080, 862, 0.5, -0.1, 6, "#d8c4ff", "#43208c", violet, 9);

  // mushrooms glowing on the rocks
  const shroom = (x: number, y: number, h: number, r: number, lean: number) => {
    const cx = x + lean * h;
    const cy = y - h;
    limb(p, x, y, cx, cy, r * 0.2, r * 0.14, (u, t) => mix(hex("#3a2c4a"), hex("#e8d8f0"), clamp(0.55 - u * 0.35 + t * 0.2)));
    p.each(cx - r - 2, cy - r, cx + r + 2, cy + r * 0.4, (X, Y, i) => {
      const u = (X - cx) / r;
      const v = (Y - cy) / (r * 0.62);
      const dome = u * u + (v < 0 ? v * v : (v / 0.32) ** 2);
      const cov = clamp((1 - dome) * r * p.k * 0.5 + 0.5);
      if (cov <= 0) return;
      if (v < 0) mix(hex("#7a2a6a"), hex("#ffc8ec"), clamp(0.75 - v * 0.2 - u * 0.35 + 0.15 * n(X * 0.3, Y * 0.3)));
      // the gills beneath, glowing brightest
      else mix(hex("#ff9ad8"), hex("#fff0fa"), clamp(0.5 + 0.4 * Math.sin(u * 14) * (1 - Math.abs(u))));
      p.over(i, cov);
    });
    glow(p, cx, cy + r * 0.1, r * 1.6, pink, 0.35);
  };
  for (const [x, y, s] of CAVE_SHROOMS) {
    const r = rng(x);
    // each cluster on a rock of its own, in front of the crystals, its foot
    // in the water
    ball(p, n, x, y + 14 * s, 40 * s, rock, 0.5);
    glow(p, x, y - 14 * s, 60 * s, pink, 0.12);
    for (let i = 0; i < 4; i++) {
      const h = (16 + r() * 34) * s;
      shroom(x + (i - 1.5) * 20 * s + (r() - 0.5) * 8, y + r() * 5, h, (10 + r() * 10) * s * (h > 32 * s ? 1.2 : 1), (r() - 0.5) * 0.5);
    }
  }

  // the pool: everything above mirrored in it, darker the deeper you look
  // (live: tagged 1, rippled by the drips; reflected crystals stay in 3)
  const m = p.mask;
  p.tag(1);
  p.brush[1] = 1;
  const wl = CAVE_WATER * p.k;
  const src = new Float32Array(p.px);
  const dark = hex("#0a0e1c");
  p.each(0, CAVE_WATER, W, H, (X, Y, i) => {
    const y = Math.floor(i / 3 / p.w);
    const sy = Math.max(0, Math.round(2 * wl - y - 1));
    const sx = clamp(Math.round((X + 1.5 * n(X * 0.02, Y * 0.12)) * p.k - 0.5), 0, p.w - 1);
    const j = (sy * p.w + sx) * 3;
    const deep = smooth(CAVE_WATER, H, Y);
    T[0] = src[j];
    T[1] = src[j + 1];
    T[2] = src[j + 2];
    scale(0.72 - deep * 0.25);
    toward(dark, deep * 0.3);
    // a faint sheen, in long ripples
    T[0] += 0.02 * smooth(-0.2, 0.6, fbm(n2, X * 0.004, Y * 0.09, 3));
    T[1] += 0.025 * smooth(-0.2, 0.6, fbm(n2, X * 0.004, Y * 0.09, 3));
    T[2] += 0.04 * smooth(-0.2, 0.6, fbm(n2, X * 0.004, Y * 0.09, 3));
    if (m) p.brush[3] = m[(j / 3) * 4 + 3] * 0.5;
    p.over(i, 1);
  });
  p.brush[1] = 0;
  p.brush[3] = 0;
  // where the daylight meets the water
  glow(p, 1252, 902, 46, day, 0.18);
  vignette(p, VIGNETTE.stone);
}

/** The low sun, just above the cloud sea's far edge. */
export const SUN: readonly [number, number] = [1330, 584];
export const CLOUD_HORIZON = 600;

const CLOUD_SHADE = hex("#6c6aa4");
const CLOUD_MID = hex("#d8a6b6");
const CLOUD_LIT = hex("#ffdcae");
const CLOUD_GLOW = hex("#fff6e0");
const CLOUD_HAZE = hex("#f2cdb8");

/** One billow of cloud; `sq` is its height over width (the cloud sea's
 *  flatten with distance). */
interface Puff {
  x: number;
  y: number;
  r: number;
  sq?: number;
}

/** A whole cloud: its billows, painted as one mass. `form` is its overall
 *  shape as an ellipse [x, y, rx, ry], which the light models; without
 *  one (a stratum of the cloud sea) it's a layer whose tops face up, with
 *  `slab` filling in below that line down to `bottom`. `size` is a
 *  typical billow's radius. */
interface Cloud {
  puffs: Puff[];
  size: number;
  haze: number;
  form?: readonly [number, number, number, number];
  slab?: number;
  bottom?: number;
}

/** Paint a cloud the way a cumulus is painted by hand: the billows merge
 *  into one silhouette and the light models the mass as a whole (a lit
 *  side toward the sun, a shadowed side, a darker base). Only the outline
 *  keeps crisp edges, rimmed with gold where it faces the sun and glowing
 *  through near it; inside, the billows show only as faint folds of light
 *  on the lit side, so it reads as one cloud and not a stack of balls.
 *
 *  Depth below the outline comes from the silhouette blurred, not from
 *  the billows: their own edges cross inside the cloud, and taken as
 *  outline they'd light up as seams. */
function cloud(p: Paint, n: Noise, c: Cloud) {
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = c.bottom ?? 0;
  for (const b of c.puffs) {
    const sq = b.sq ?? 1;
    x0 = Math.min(x0, b.x - b.r * 1.2);
    x1 = Math.max(x1, b.x + b.r * 1.2);
    y0 = Math.min(y0, b.y - b.r * sq * 1.2);
    y1 = Math.max(y1, b.y + b.r * sq * 1.2);
  }
  const k = p.k;
  const px0 = Math.max(0, Math.floor(x0 * k));
  const px1 = Math.min(p.w, Math.ceil(x1 * k));
  const py0 = Math.max(0, Math.floor(y0 * k));
  const py1 = Math.min(p.h, Math.ceil(y1 * k));
  const w = px1 - px0;
  const h = py1 - py0;
  if (w <= 0 || h <= 0) return;
  const B = 32;
  const buckets: Puff[][] = Array.from({ length: Math.ceil((x1 - x0) / B) + 1 }, () => []);
  for (const b of c.puffs) {
    const k0 = Math.max(0, Math.floor((b.x - b.r * 1.2 - x0) / B));
    const k1 = Math.min(buckets.length - 1, Math.floor((b.x + b.r * 1.2 - x0) / B));
    for (let j = k0; j <= k1; j++) buckets[j].push(b);
  }
  const f = 2 / c.size;
  const feather = 1 + c.size * 0.06;
  // the silhouette, and the frontmost billow at each pixel (later ones
  // are in front)
  const cover = new Float32Array(w * h);
  const front: (Puff | null)[] = new Array(w * h).fill(null);
  const grain = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const Y = (py0 + y + 0.5) / k;
    for (let x = 0; x < w; x++) {
      const X = (px0 + x + 0.5) / k;
      const e = fbm(n, X * f, Y * f, 3);
      let inside = -Infinity;
      let fr: Puff | null = null;
      for (const b of buckets[clamp(Math.floor((X - x0) / B), 0, buckets.length - 1)]) {
        const s = b.r * (1 + 0.1 * e) - Math.hypot(X - b.x, (Y - b.y) / (b.sq ?? 1));
        if (s > inside) inside = s;
        if (s > 0) fr = b;
      }
      if (c.slab !== undefined) inside = Math.max(inside, Y - c.slab - e * c.size * 0.3);
      const j = y * w + x;
      cover[j] = clamp(inside / feather);
      front[j] = fr;
      grain[j] = e;
    }
  }
  const depth = cover.slice();
  blurChannel(depth, w, h, 0, Math.round(c.size * 0.35 * k), 1);
  for (let y = 0; y < h; y++) {
    const Y = (py0 + y + 0.5) / k;
    for (let x = 0; x < w; x++) {
      const j = y * w + x;
      const a = cover[j];
      if (a <= 0) continue;
      const X = (px0 + x + 0.5) / k;
      const e = grain[j];
      // 0 at the outline, 1 well inside; the outline's outward direction
      const inner = clamp((depth[j] - 0.5) * 2);
      let nx = depth[Math.max(0, j - 1)] - depth[Math.min(w * h - 1, j + 1)];
      let ny = depth[Math.max(0, j - w)] - depth[Math.min(w * h - 1, j + w)];
      const nl = Math.hypot(nx, ny);
      if (nl > 1e-6) {
        nx /= nl;
        ny /= nl;
      } else ny = -1;
      // the light: from the sun, and from the bright sky overhead
      const tx = SUN[0] - X;
      const ty = SUN[1] - Y;
      const dist = Math.hypot(tx, ty) + 1;
      let lx = (tx / dist) * 0.65;
      let ly = (ty / dist) * 0.65 - 0.75;
      const ll = Math.hypot(lx, ly);
      lx /= ll;
      ly /= ll;
      const near = Math.exp(-dist / 520);
      const reach = 0.6 + 0.4 * Math.exp(-dist / 1100);
      // the mass's own light and shade
      let tone: number;
      let base = 0;
      if (c.form) {
        const [cx, cy, rx, ry] = c.form;
        const fx = clamp((X - cx) / rx, -1, 1);
        const fy = clamp((Y - cy) / ry, -1, 1);
        const fz = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
        tone = clamp(0.5 + (fx * lx + fy * ly) * 0.65 + (fz - 0.5) * 0.25);
        base = smooth(cy, cy + ry * 1.1, Y);
      } else tone = 0.32 + 0.25 * (1 - inner);
      ramp(tone * reach * (1 - 0.4 * base) + 0.1 + 0.06 * e, CLOUD_SHADE, CLOUD_MID, CLOUD_LIT);
      // folds: the front billow's lit side, faint, only where the mass is
      // lit and away from the outline (the rim has that)
      const fr = front[j];
      if (fr) {
        const sq = fr.sq ?? 1;
        const s = fr.r * 0.3;
        const fold = smooth(fr.r * 0.8, fr.r * 1.05, Math.hypot(X - fr.x + lx * s, (Y - fr.y + ly * s * sq) / sq));
        toward(CLOUD_LIT, fold * 0.4 * tone * reach * inner);
      }
      // the outline: gold where it faces the light, glowing through near
      // the sun, softly translucent on the shaded side
      const rim = 1 - inner;
      const facing = clamp(nx * lx + ny * ly + 0.15);
      toward(CLOUD_LIT, rim * facing * reach * 0.9);
      toward(CLOUD_GLOW, rim * facing * near);
      toward(CLOUD_MID, rim * (1 - facing) * 0.2);
      // the foot sinks into the haze over the sea
      toward(CLOUD_HAZE, c.haze + (1 - c.haze) * base * 0.45);
      p.over(((py0 + y) * p.w + px0 + x) * 3, a);
    }
  }
}

/** A cumulus heaped up out of the cloud sea: a few big lobes making a
 *  dome, smaller billows along its outline and a few on its face, lower
 *  ones in front. */
function cumulus(cx: number, base: number, height: number, hw: number, haze: number, seed: number): Cloud {
  const r = rng(seed);
  const puffs: Puff[] = [];
  // the body
  for (const v of [-0.2, -0.45, -0.68]) {
    const span = Math.sqrt(1 - v * v) * 0.45 * (1 + v * 0.4);
    for (const u of [-span, 0, span]) puffs.push({ x: cx + u * hw, y: base + v * height, r: hw * (0.36 + 0.08 * r()) });
  }
  const ring = (count: number, out: [number, number], size: [number, number], kids: boolean) => {
    for (let k = 0; k < count; k++) {
      const a = Math.PI * (1 + (k + r()) / count);
      const o = out[0] + r() * (out[1] - out[0]);
      const u = Math.cos(a) * o;
      const v = Math.sin(a) * o * 0.92;
      const rad = hw * (size[0] + r() * (size[1] - size[0])) * (0.9 - 0.3 * v);
      puffs.push({ x: cx + u * hw, y: base + v * height, r: rad });
      if (kids && Math.abs(u) < 0.8) {
        const b = a + (r() - 0.5) * 1.4;
        puffs.push({ x: cx + u * hw + Math.cos(b) * rad * 0.8, y: base + v * height + Math.sin(b) * rad * 0.8, r: rad * (0.3 + 0.2 * r()) });
      }
    }
  };
  ring(5, [0.45, 0.6], [0.32, 0.42], false);
  ring(6, [0.2, 0.55], [0.18, 0.26], false);
  ring(18, [0.84, 0.92], [0.14, 0.22], true);
  puffs.sort((p, q) => p.y - q.y);
  return { puffs, size: hw * 0.2, haze, form: [cx, base - height * 0.5, hw, height * 0.55] };
}

function skyScene(p: Paint) {
  const n = perlin(9);
  const n2 = perlin(10);
  sky(p, [[0, "#1c3a80"], [0.28, "#3f69b0"], [0.46, "#90a6d0"], [0.55, "#e2b8b0"], [0.6, "#ffcf98"], [1, "#ffe0b0"]]);
  // the sky warms toward the sun
  const warm = hex("#ff9a5a");
  p.each(0, 0, W, CLOUD_HORIZON + 40, (X, Y, i) => {
    const w = Math.exp(-(((X - SUN[0]) / 700) ** 2) - ((Y - SUN[1]) / 260) ** 2);
    p.add(i, warm, 0.35 * w);
  });

  // a field of small rippled clouds high on the left, smaller toward the
  // horizon, catching pink (live: drifting, channel 3)
  p.tag(3, 10);
  p.brush[3] = 1;
  const fleckLit = hex("#ffd6cc");
  const fleckShade = hex("#a49ac8");
  p.each(0, 60, 1000, 420, (X, Y, i) => {
    const patch = smooth(-0.05, 0.35, fbm(n2, X * 0.0025 + 3, Y * 0.007, 3)) * smooth(60, 160, Y) * (1 - smooth(300, 420, Y)) * (1 - smooth(500, 1000, X));
    if (patch <= 0) return;
    const d = 640 - Y;
    const [f1] = cells(((X - 800) * 7) / d + fbm(n, X * 0.01, Y * 0.02, 2) * 0.3, 2600 / d);
    const a = (1 - smooth(0.1, 0.4, f1)) * patch * 0.5;
    if (a <= 0.003) return;
    mix(fleckShade, fleckLit, 1 - smooth(0.05, 0.4, f1));
    p.over(i, a);
  });

  // mares' tails: wisps of ice combed out by high wind (live: combed,
  // channel 3)
  const tailLit = hex("#fff4ec");
  const tailWarm = hex("#ffd2b8");
  p.each(600, 0, W, 330, (X, Y, i) => {
    const u = X * 0.98 + Y * 0.2;
    const v = Y * 0.98 - X * 0.2 + 46 * fbm(n, u * 0.0022, 0.5, 3);
    const body = smooth(0.08, 0.42, fbm(n2, u * 0.0016 + 7, v * 0.011, 4));
    if (body <= 0) return;
    const fiber = 0.7 + 0.3 * smooth(-0.4, 0.6, n(u * 0.004, v * 0.11));
    const a = body * fiber * smooth(600, 820, X) * (1 - smooth(220, 330, Y)) * 0.55;
    mix(tailLit, tailWarm, Y / 330);
    p.over(i, a);
  });
  p.brush[3] = 0;

  // the sun, low
  glow(p, SUN[0], SUN[1], 150, hex("#ffc878"), 0.5);
  glow(p, SUN[0], SUN[1], 30, hex("#fff6dc"), 1.6, 3);
  // its shafts (live: the shader's, strongest where channel 0 shows sky)
  p.hide(0);
  if (!p.live) rays(p, n, SUN[0], SUN[1], -Math.PI / 2 - 0.55, 0.95, 620, hex("#ffdca0"), 0.1, 7);

  // the cloud sea in strata, small and hazy far off, big and near at the
  // bottom (live: rolling, channel 2), and a cumulus heaped up out of it
  // at each side (live: billowing, channel 1)
  p.tag(1, 14);
  p.tag(2, 6);
  const r = rng(5);
  const K = 9;
  const at = (k: number) => CLOUD_HORIZON + 6 + 420 * (k / (K - 1)) ** 1.8;
  const stratum = (k: number) => {
    const y = at(k);
    const size = 4 + (y - CLOUD_HORIZON) * 0.3;
    const haze = 0.8 * (1 - k / (K - 1)) ** 1.5;
    const puffs: Puff[] = [];
    // flatter the farther, and swelling into mounds here and there
    const sq = 0.35 + 0.35 * (k / (K - 1));
    for (let x = -size * 2; x < W + size * 2; x += size * (0.9 + 1.2 * r())) {
      const swell = smooth(-0.3, 0.5, fbm(n2, x * 0.003, k * 3.1, 2));
      const rad = size * (0.9 + 1.1 * r() * r()) * (0.8 + 1.1 * swell);
      puffs.push({ x, y: y + rad * sq * (0.15 - 0.5 * r() * swell), r: rad, sq });
    }
    puffs.sort((p, q) => p.y - q.y);
    cloud(p, n, { puffs, size, haze, slab: y + size * 0.2, bottom: k < K - 1 ? at(k + 1) + 2 + size : H });
  };
  p.brush[2] = 1;
  for (let k = 0; k < 3; k++) stratum(k);
  p.brush[1] = 1;
  p.brush[2] = 0;
  cloud(p, n, cumulus(1590, 690, 250, 190, 0.25, 31));
  p.brush[1] = 0;
  p.brush[2] = 1;
  for (let k = 3; k < 5; k++) stratum(k);
  p.brush[1] = 1;
  p.brush[2] = 0;
  cloud(p, n, cumulus(190, 770, 520, 250, 0.08, 47));
  p.brush[1] = 0;
  p.brush[2] = 1;
  for (let k = 5; k < K; k++) stratum(k);
  p.brush[2] = 0;

  // the glare over the clouds around the sun
  glow(p, SUN[0], SUN[1] + 20, 120, hex("#ffd8a0"), 0.35);

  // a veil of mist drifting in front (live: the shader's)
  if (!p.live) mist(p, n2, 820, 1060, hex("#f6dccc"), 0.4);

  // birds and motes in the sunbeams move: ambience.ts
  vignette(p, VIGNETTE.sky);
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
  // (live: the shader's, moving, where channel 2 shows the sky)
  if (p.live) p.hide(2);
  else {
    curtain(300, 90, 0.0018, 13, 0.5);
    curtain(230, 70, 0.0025, 14, 0.3);
  }

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
  // (live: drifting, where channel 1 shows it)
  if (p.live) p.hide(1);
  else mist(p, n2, 560, 700, hex("#5a78a4"), 0.35);
  range(curve((X) => 690 - 150 * ridged(n2, X * 0.003, 3.5, 6)), 16, 70, ["#141f38", "#2a3a5c"], 0.12);

  // the snowfield
  land(p, curve((X) => 770 + 18 * fbm(n, X * 0.003, 6.5, 3)), (X, Y, d) => {
    mix(hex("#6d84b0"), hex("#c8d8f2"), clamp(0.6 + fbm(n2, X * 0.004, Y * 0.02, 4) * 0.8 - smooth(0, 220, d) * 0.3));
    return 1;
  });

  // pines: rows of small hazy ones, tall ones framing the sides (live: the
  // tops sway, channel 0)
  p.tag(0, 8);
  const r = rng(17);
  for (let i = 0; i < 70; i++) {
    const x = i % 2 ? 1600 - r() * 560 : r() * 560;
    pine(p, n, x, 780 + r() * 16, 50 + r() * 60, hex("#1a2a48"), hex("#3a5078"), hex("#9fb4d8"), { c: hex("#3a5a86"), a: 0.35 }, 0.1);
  }
  for (const [x, h] of [[40, 620], [160, 460], [280, 560], [400, 340], [1210, 360], [1330, 520], [1450, 440], [1570, 640]]) {
    pine(p, n2, x, 915 + (x % 3) * 10, h, hex("#0a1426"), hex("#28406a"), hex("#e2ecfa"), undefined, h / 640);
  }
  land(p, curve((X) => 918 + 16 * fbm(n2, X * 0.004, 9.1, 3)), (X, Y, d) => {
    mix(hex("#8aa0c8"), hex("#d8e4f6"), clamp(0.7 + fbm(n, X * 0.004, Y * 0.03, 3) - smooth(0, 60, d) * 0.4));
    return 1;
  });
  vignette(p, VIGNETTE.frost);
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

  // the Milky Way: a dusty river of faint stars slanting down the sky,
  // split by dark lanes and washed out near the moon
  const spine = (X: number) => 80 + (W - X) * 0.3 + 40 * n2(X * 0.0018, 3.3);
  const river = (X: number, Y: number) => {
    const s = (Y - spine(X)) * 0.96;
    const wash = 1 - Math.exp(-(((X - mx) ** 2 + (Y - my) ** 2) / 240 ** 2));
    const g = Math.exp(-((s / 105) ** 2)) * wash;
    return g < 0.01 ? 0 : g * (0.55 + 0.45 * smooth(-0.3, 0.5, fbm(n, X * 0.004, Y * 0.009, 4)));
  };
  p.each(0, 0, W, 640, (X, Y, i) => {
    const d = river(X, Y);
    if (d < 0.01) return;
    const s = (Y - spine(X)) * 0.96;
    const lane = smooth(0.05, 0.4, fbm(n2, X * 0.005 + 9, Y * 0.014, 4)) * Math.exp(-((s / 45) ** 2));
    const core = Math.exp(-((s / 40) ** 2));
    p.add(i, blend(hex("#7a88d8"), hex("#e8d8f0"), core), 0.3 * d * (1 - lane * 0.85));
  });
  const sr = rng(141);
  motes(p, 142, 2600, [0, 0, W, 640], [0.35, 1], [hex("#ffffff"), hex("#dfe6ff"), hex("#fff0dc")], 0.7, (X, Y) => sr() < river(X, Y));

  // thin clouds drifting past, silvered near the moon (live: the
  // shader's, where channel 2 shows the sky)
  if (p.live) p.hide(2);
  else {
    p.each(0, 60, W, 520, (X, Y, i) => {
      const a = smooth(0.1, 0.45, fbm(n2, X * 0.0018, Y * 0.01, 5)) * 0.5;
      if (a <= 0) return;
      mix(hex("#2a3270"), hex("#c8ccf0"), Math.exp(-(((X - mx) / 360) ** 2) - ((Y - my) / 220) ** 2));
      p.over(i, a);
    });
  }

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
  // (live: mist in the hollows drifts, channels 1 and 3)
  if (p.live) p.hide(1);
  else mist(p, n, 580, 700, hex("#8a96d8"), 0.3);
  land(p, woodline(122, 690, 60, [12, 24]), (_x, _y, d) => {
    mix(hex("#161d4c"), hex("#26306a"), clamp(0.6 - smooth(0, 40, d) * 0.4));
    toward(hex("#8a96d8"), 0.15);
    return 1;
  }, 760);
  // a few pines on the hill to the left, rooted behind its brow (live:
  // they sway a little, channel 0, as does the meadow grass)
  p.tag(0, 8);
  for (const [x, h] of [[70, 96], [118, 70], [168, 118], [222, 64]]) {
    const base = 700;
    pine(p, n, x, base, h, hex("#090c2a"), hex("#2a3474"), undefined, { c: hex("#5a66b0"), a: 0.12 }, 0.6);
  }

  hill(curve((X) => 760 - 150 * Math.exp(-(((X - 1350) / 380) ** 2)) - 90 * Math.exp(-(((X - 150) / 300) ** 2)) + 20 * fbm(n2, X * 0.003, 5.5, 3)), "#141a48", "#34408a", 0.4);
  if (p.live) p.hide(3);
  else mist(p, n2, 740, 860, hex("#7a86c8"), 0.18);

  // a broad old oak on the right, its crown silvered on the moon side
  // (live: a layer the shader sways, the trunk firm and the crown giving
  // to the wind)
  p.beginLayer("over");
  const barkD = hex("#070a24");
  const barkL = hex("#2e3672");
  const tr = rng(127);
  type Seg = [number, number, number, number, number, number];
  const segs: Seg[] = [];
  const tips: [number, number, number][] = [];
  // boughs fork two or three ways, thinning, and reach up and out
  const bough = (x: number, y: number, ang: number, len: number, r: number, depth: number) => {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const kx = (x + x2) / 2 + (tr() - 0.5) * len * 0.32;
    const ky = (y + y2) / 2 + (tr() - 0.5) * len * 0.32;
    segs.push([x, y, kx, ky, r, r * 0.86], [kx, ky, x2, y2, r * 0.86, r * 0.72]);
    if (depth === 0) {
      tips.push([x2, y2, len]);
      return;
    }
    if (depth < 3) tips.push([kx, ky, len * 0.8]);
    const k = tr() < 0.35 ? 3 : 2;
    for (let j = 0; j < k; j++) {
      let a = ang + (j - (k - 1) / 2) * (0.55 + tr() * 0.3) + (tr() - 0.5) * 0.3;
      a = Math.max(-Math.PI + 0.3, Math.min(-0.3, a));
      bough(x2, y2, a, len * (0.58 + tr() * 0.28), r * 0.64, depth - 1);
    }
  };
  const tx = 1380;
  const ty = 666;
  // the lower limbs (their roots hidden by the trunk), then the three it
  // forks into at the top
  bough(1372, 552, -2.8, 128, 11, 3);
  bough(1384, 566, -0.32, 120, 10, 3);
  const lower = segs.length;
  bough(1362, 500, -2.2, 130, 17, 3);
  bough(1370, 492, -1.5, 116, 16, 3);
  bough(1380, 500, -0.8, 140, 16, 3);
  // the crown: a cloud of small leaves round each twig's end, lit from
  // the moon's side, the far ones dimmer, over a dark mass that keeps it
  // from looking threadbare
  const leafD = hex("#04061a");
  const leafM = hex("#141c50");
  const leafL = hex("#5262b0");
  type Leaf = [number, number, number, number, number];
  const back: Leaf[] = [];
  const front: Leaf[] = [];
  for (const [x, y, len] of tips) {
    const R = 20 + len * 0.17 + tr() * 10;
    const cx = x + (tr() - 0.5) * 8;
    const cy = y - R * 0.35;
    ball(p, n, cx + 4, cy + 3, R * 0.72, { dark: leafD, mid: times(leafM, 0.6), light: times(leafM, 0.8), rough: 0.35, freq: 0.06, tex: 0.2, flat: 0.6 });
    const count = Math.round(R * 3.6);
    for (let j = 0; j < count; j++) {
      // gaussian-ish spread, flattened a little
      const a = tr() * Math.PI * 2;
      const d = Math.sqrt(-2 * Math.log(1 - tr() * 0.95)) * 0.45;
      const lx = Math.cos(a) * d;
      const ly = Math.sin(a) * d * 0.8;
      const lit = clamp(0.42 - (lx * 0.8 + ly * 0.6) * 0.55 + (tr() - 0.5) * 0.3 - d * 0.1);
      const leaf: Leaf = [cx + lx * R, cy + ly * R, 1.8 + tr() * 1.8, tr() * Math.PI, lit];
      (tr() < 0.45 ? back : front).push(leaf);
    }
  }
  const drawLeaf = ([x, y, r, rot, l]: Leaf, dim: number) => {
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    ramp(l, leafD, times(leafM, dim), times(leafL, dim));
    const c = [T[0], T[1], T[2]] as C;
    p.each(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (X, Y, i) => {
      const u = ((X - x) * cs + (Y - y) * sn) / r;
      const v = ((Y - y) * cs - (X - x) * sn) / (r * 0.55);
      const d = Math.sqrt(u * u + v * v);
      const cov = clamp((1 - d) * r * 0.55 * p.k + 0.5);
      if (cov <= 0) return;
      set(c);
      scale(1 + 0.18 * u);
      p.over(i, cov);
    });
  };
  for (const leaf of back) drawLeaf(leaf, 0.65);
  // the trunk and the boughs, round and barked, lit from the moon's side
  // whichever way they run
  const bark = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    // the side u > 0 faces (y2 - y1, x1 - x2), against the light (-0.8, -0.6)
    const face = ((y2 - y1) * -0.8 + (x1 - x2) * -0.6) / len;
    return (u: number, t: number) => {
      const lit = u * face * 0.7 + Math.sqrt(1 - u * u) * 0.25;
      mix(barkD, barkL, clamp(0.3 + lit * 0.55 + n(u * 2.2 + x1, t * len * 0.12) * 0.12));
    };
  };
  segs.forEach(([x1, y1, x2, y2, r1, r2], k) => {
    if (k === lower) trunk(p, n, tx, ty, 490, 80, 38, -18, barkD, barkL);
    limb(p, x1, y1, x2, y2, r1, r2, bark(x1, y1, x2, y2));
  });
  // rooted in a low mound, grass tufted round the foot
  p.each(tx - 90, ty - 20, tx + 90, ty + 16, (X, Y, i) => {
    const e = ((X - tx) / 84) ** 2 + ((Y - ty - 4) / 14) ** 2;
    if (e >= 1) return;
    mix(hex("#161c4e"), hex("#323e88"), clamp(0.5 - (X - tx) / 200 + n(X * 0.1, Y * 0.2) * 0.15));
    p.over(i, clamp((1 - e) * 1.6));
  });
  for (let j = 0; j < 60; j++) {
    const x = tx - 80 + tr() * 160;
    const y = ty - 8 + 20 * ((x - tx) / 84) ** 2 + tr() * 6;
    const h = 5 + tr() * 12;
    limb(p, x, y, x + (tr() - 0.5) * h * 0.8, y - h, 1.3, 0.3, (u) => mix(hex("#0e1238"), hex("#3e4a96"), clamp(0.35 - u * 0.3)));
  }
  for (const leaf of front) drawLeaf(leaf, 1);
  p.endLayer();

  // the near meadow, grass blades against the mist
  const meadow = curve((X) => 870 + 20 * fbm(n, X * 0.004, 7.5, 3));
  land(p, meadow, (X, Y, d) => {
    mix(hex("#0a0d2c"), hex("#1a2150"), clamp(0.5 + fbm(n2, X * 0.02, Y * 0.02, 3) * 0.5 - smooth(0, 80, d) * 0.4));
    return 1;
  });
  const gr = rng(133);
  p.brush[0] = 0.7;
  for (let i = 0; i < 900; i++) {
    const x = gr() * W;
    if (Math.abs(x - 800) < 300 && gr() < 0.7) continue;
    const y = meadow(x) + 4 + gr() * 30;
    const h = 14 + gr() * gr() * 50;
    const lean = (gr() - 0.5) * h * 0.8;
    limb(p, x, y, x + lean, y - h, 1.8, 0.4, (u) => mix(hex("#0c1034"), hex("#3a4690"), clamp(0.3 - u * 0.3)));
  }

  // moonflowers: five pale petals round a bright eye, glowing softly (the
  // fireflies move: ambience.ts)
  const fr = rng(131);
  p.brush[0] = 0.5;
  for (let i = 0; i < 46; i++) {
    const x = i % 2 ? 1600 - fr() * 520 : fr() * 520;
    const y = 872 + fr() * 100;
    const R = 4.5 + fr() * 3.5;
    const rot = fr() * Math.PI;
    const tilt = 0.55 + fr() * 0.35;
    limb(p, x, y + R * 0.4, x + (fr() - 0.5) * 6, y + R + 16, 0.9, 0.7, () => set(hex("#1a2258")));
    glow(p, x, y, R * 1.6, hex("#9aacff"), 0.22);
    p.each(x - R - 1, y - R - 1, x + R + 1, y + R + 1, (X, Y, j) => {
      const dx = X - x;
      const dy = (Y - y) / tilt;
      const d = Math.hypot(dx, dy) / R;
      const a = Math.atan2(dy, dx);
      const petal = 0.55 + 0.45 * Math.abs(Math.cos(2.5 * (a - rot)));
      const cov = clamp((petal - d) * R * p.k + 0.5);
      if (cov <= 0) return;
      mix(hex("#8a9ce8"), hex("#f4f6ff"), clamp(1 - d * 0.8 + (dy < 0 ? 0.1 : -0.1)));
      if (d < 0.22) mix(hex("#fff4c0"), hex("#ffffff"), 1 - d / 0.22);
      p.over(j, cov);
    });
  }

  // tall grass and dandelion clocks close by in the corners, dark against
  // the meadow, their edges catching the moon (live: on the layer, swaying)
  p.brush[0] = 0;
  p.beginLayer("over");
  const gD = hex("#04061a");
  const gL = hex("#2c387c");
  const stalk = (x: number, root: number, h: number, lean: number, w: number) =>
    strand(p, root - h, root, (v) => x + lean * (1 - v) ** 2, (v) => w * (0.12 + 0.88 * v ** 0.6), (_X, _Y, u, v) => {
      mix(gD, gL, clamp(0.18 - u * 0.3 + (1 - v) * 0.22));
      if (u < -0.55) toward(hex("#8a9ae0"), 0.35 * (1 - v));
      return 1;
    });
  const fg = rng(151);
  for (const side of [0, 1]) {
    for (let i = 0; i < 150; i++) {
      const e = fg() ** 1.7;
      const x = side ? W + 20 - e * 560 : -20 + e * 560;
      const h = (40 + fg() * fg() * 150) * (1 - e * 0.6);
      const lean = (fg() - 0.5) * h * 0.5 + (side ? -1 : 1) * h * 0.12;
      stalk(x, 952 + fg() * 60, h, lean, 2.2 + fg() * 2.6);
    }
    // dandelion clocks on long stalks
    for (let i = 0; i < 4; i++) {
      const x = side ? W - 40 - fg() * 380 : 40 + fg() * 380;
      const root = 1000;
      const h = 120 + fg() * 90;
      const lean = (fg() - 0.5) * 40;
      const hx = x + lean;
      const hy = root - h;
      strand(p, hy, root, (v) => x + lean * (1 - v) ** 2, () => 1.1, (_X, _Y, u) => {
        mix(gD, gL, clamp(0.3 - u * 0.3));
        return 1;
      });
      const R = 11 + fg() * 4;
      const spin = fg() * 6;
      glow(p, hx, hy, R * 0.9, hex("#aab8ff"), 0.12);
      p.each(hx - R - 2, hy - R - 2, hx + R + 2, hy + R + 2, (X, Y, j) => {
        const dx = X - hx;
        const dy = Y - hy;
        const d = Math.hypot(dx, dy) / R;
        if (d > 1.12) return;
        const a = Math.atan2(dy, dx) * 9 + spin;
        // fine filaments radiating, each ending in a tuft
        const spoke = Math.pow(Math.abs(Math.cos(a)), 40) * smooth(0.15, 0.4, d) * (1 - smooth(0.92, 1.0, d));
        const tuft = Math.pow(Math.abs(Math.cos(a)), 6) * Math.exp(-(((d - 1) / 0.09) ** 2));
        const seed = 1 - smooth(0.1, 0.2, d);
        const v = Math.min(1, spoke * 0.55 + tuft * 0.8 + seed * 0.9 + 0.12 * (1 - smooth(0.3, 1, d)));
        if (v <= 0.01) return;
        set(seed > 0.5 ? hex("#3a4280") : hex("#dfe6ff"));
        p.over(j, v);
      });
    }
  }
  p.endLayer();
  vignette(p, VIGNETTE.moon);
}

/** The night library's fireplaces: the fire's centre x (living.ts and
 *  ambience.ts draw at the same spots). */
export const FIRES = [100, 1500];
const MANTEL = 574;
export const FIRE_BASE = 800;

/** How hot the fire is at (dx, up) from its base, 0…1-ish: a tapering body
 *  frayed into tongues. Still paintings only; living.ts draws the moving one. */
function flameHeat(n: Noise, dx: number, up: number): number {
  const qx = dx / 62;
  const qy = up / 130;
  if (qy < -0.1 || qy > 1.5 || Math.abs(qx) > 1.4) return 0;
  const sway = qx + 0.25 * n(qy * 1.5, 3.3) * qy;
  const tongues = fbm(n, qx * 3, qy * 2.2 + 4.1, 3);
  return clamp((1 - qy * 0.8 - Math.abs(sway) ** 1.5 * 1.3 + tongues * 0.65 * (0.35 + qy)) * 1.5 - 0.2) * smooth(-0.1, 0.05, qy);
}

/** Red → orange → yellow → white by heat. */
function flameColor(h: number): C {
  return [
    smooth(0, 0.35, h) * 1.0,
    smooth(0, 0.35, h) * 0.42 + smooth(0.35, 0.7, h) * 0.38,
    smooth(0, 0.35, h) * 0.1 + smooth(0.35, 0.7, h) * 0.12 + smooth(0.7, 1, h) * 0.4,
  ];
}

/** A stone fireplace filling a shelf's width below the mantel, its opening
 *  arched, logs on the grate; `inner` is the side facing the room. */
function fireplace(p: Paint, n: Noise, x0: number, x1: number, cx: number, innerLeft: boolean) {
  const warm = hex("#ff9a48");
  const r = 62;
  const archY = 702;
  const bot = 815;
  const opening = (X: number, Y: number, grow: number) =>
    Y < bot + grow && Math.abs(X - cx) < r + grow && (Y > archY || Math.hypot(X - cx, Y - archY) < r + grow);
  // the surround: smaller, warmer stones than the wall
  p.each(x0, MANTEL, x1, bot + 1, (X, Y, i) => {
    const row = Math.floor((Y - MANTEL) / 28);
    const off = row % 2 ? 23 : 0;
    const bx = (X - x0 + off) % 46;
    const by = (Y - MANTEL) % 28;
    const mortar = Math.min(bx, 46 - bx, by, 28 - by);
    const h = Math.sin(row * 12.9898 + Math.floor((X - x0 + off) / 46) * 78.233) * 43758.5453;
    mix(hex("#221820"), hex("#4a3a44"), clamp(0.4 + (h - Math.floor(h)) * 0.3 + fbm(n, X * 0.05, Y * 0.05, 3) * 0.35));
    scale(0.6 + 0.4 * smooth(0, 2.5, mortar));
    p.over(i, 1);
  });
  // the arch's voussoirs, then the firebox: soot, faint back bricks
  p.each(cx - r - 16, archY - r - 16, cx + r + 16, bot, (X, Y, i) => {
    if (opening(X, Y, 0)) {
      const back = Math.abs(X - cx) < r - 14 && Y > archY - r + 20;
      mix(hex("#0c0608"), hex("#2a1612"), clamp((Y - (archY - r)) / (bot - archY + r)) * (back ? 1 : 0.6));
      if (back && ((Y - 640) % 18 < 1.5 || (X - cx + Math.floor((Y - 640) / 18) * 13) % 26 < 1.5)) scale(0.6);
      p.brush[0] = 1;
      p.over(i, 1);
      p.brush[0] = 0;
    } else if (opening(X, Y, 14)) {
      const a = Math.atan2(Y - archY, X - cx);
      const joint = Y < archY && Math.abs(((a / Math.PI) * 9) % 1) < 0.06;
      mix(hex("#2e2230"), hex("#584652"), clamp(0.55 + fbm(n, X * 0.06, Y * 0.06, 3) * 0.3));
      if (joint) scale(0.6);
      p.over(i, 1);
    }
  });
  // the fire, for the still painting
  if (!p.live) {
    p.each(cx - r, archY - r, cx + r, bot, (X, Y, i) => {
      const h = flameHeat(n, X - cx, FIRE_BASE - Y);
      if (h > 0) p.add(i, flameColor(h), 1.3);
    });
  }
  // coals, and two logs on the grate, cracks glowing
  p.each(cx - r + 6, 805, cx + r - 6, bot, (X, Y, i) => {
    const c = clamp(0.5 + fbm(n, X * 0.12, Y * 0.3, 3) * 1.2);
    mix(hex("#1a0a06"), hex("#3a1408"), c);
    p.brush[1] = c * c;
    if (!p.live) p.add(i, hex("#ff5a18"), c * c * 0.9);
    p.over(i, smooth(bot, 809, Y) * 0.6 + 0.4);
    p.brush[1] = 0;
  });
  const log = (xa: number, ya: number, xb: number, yb: number, rad: number) =>
    limb(p, xa, ya, xb, yb, rad, rad * 0.9, (u, t) => {
      const crack = smooth(0.86, 0.97, 1 - Math.abs(n(t * 7 + xa, u * 1.6)));
      const under = smooth(-0.2, 0.9, u);
      mix(hex("#140a06"), hex("#4a2c1a"), clamp(0.45 - u * 0.35 + n(t * 20, u * 3) * 0.15));
      if (!p.live) toward(hex("#ff7a28"), crack * under * 0.8);
      p.brush[1] = crack * under;
    });
  log(cx - 50, 800, cx + 44, 790, 10);
  log(cx - 34, 784, cx + 52, 802, 9);
  p.brush[1] = 0;
  // the mantel, overhanging toward the room
  const m0 = innerLeft ? x0 - 14 : x0;
  const m1 = innerLeft ? x1 : x1 + 14;
  p.each(m0, MANTEL - 6, m1, MANTEL + 22, (X, Y, i) => {
    mix(hex("#2a1820"), hex("#7a4e3a"), clamp(0.5 + n(X * 0.01, Y * 0.3) * 0.25 - (Y - MANTEL) / 40 + (Y < MANTEL - 2 ? 0.25 : 0)));
    p.over(i, 1);
  });
  // the hearth slab in front
  p.each(innerLeft ? x0 - 16 : x0, bot, innerLeft ? x1 : x1 + 16, bot + 28, (X, Y, i) => {
    mix(hex("#2a2028"), hex("#5a4a52"), clamp(0.55 - (Y - bot) / 50 + fbm(n, X * 0.04, Y * 0.1, 2) * 0.3));
    p.over(i, 1);
  });
  // its warmth on everything near, and spreading over the floor (the
  // moving part is living.ts's)
  glow(p, cx, 760, 120, warm, p.live ? 0.24 : 0.3);
  p.each(cx - 330, bot, cx + 330, H, (X, Y, i) => {
    const d = ((X - cx) / 240) ** 2 + ((Y - bot - 30) / 110) ** 2;
    if (d < 9) p.add(i, warm, 0.2 * Math.exp(-d));
    // the fire mirrored in the polished boards (live: living.ts's, moving)
    if (!p.live && Y > bot + 28) p.add(i, hex("#ff8a38"), floorShine(X - cx, Y) * 0.4);
  });
}

/** The fire's reflection in the floor in front of the hearth, 0…1. */
function floorShine(dx: number, Y: number) {
  return Math.exp(-((dx / 55) ** 2)) * Math.exp(-(Y - 843) / 55);
}

interface Book {
  c: C;
  style: "leather" | "cloth" | "paper" | "pages";
  seed: number;
}
const BOOK_NOISE = perlin(17);

/** A book, bw thick and bh tall, standing on its bottom-left corner (bx,
 *  by) and turned by `th` (positive leans right; -π/2 lays it on its side,
 *  spine out). Spines are rounded and textured; leather ones have raised
 *  bands and a title label, cloth ones gilt rules and a gilt title, paper
 *  ones a printed label. "pages" shows a lying book's page edges instead. */
function book(p: Paint, bx: number, by: number, th: number, bw: number, bh: number, b: Book) {
  const n = BOOK_NOISE;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  // corners: across is (cs, sn), up is (sn, -cs)
  const xs = [bx, bx + bw * cs, bx + bh * sn, bx + bw * cs + bh * sn];
  const ys = [by, by + bw * sn, by - bh * cs, by + bw * sn - bh * cs];
  const k = p.k;
  const dark = times(b.c, 0.3);
  const lit = blend(b.c, [1, 0.95, 0.85], 0.28);
  const gilt = hex("#d8b468");
  const sd = b.seed;
  const thick = bw > 22;
  // leather: four raised bands between head and tail
  const bands = [0.16, 0.36, 0.56, 0.76].map((f) => bh * f);
  p.each(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1, (X, Y, i) => {
    const dx = X - bx;
    const dy = Y - by;
    const u = dx * cs + dy * sn;
    const h = dx * sn - dy * cs;
    // the head's corners a little rounded
    const rc = 2.2;
    const v = bh - h; // from the head down
    const cu = Math.min(u, bw - u);
    let edge = Math.min(cu, h, v);
    if (v < rc && cu < rc) edge = Math.min(edge, rc - Math.hypot(rc - cu, rc - v));
    const cov = clamp(edge * k + 0.5);
    if (cov <= 0) return;
    const a = (u / bw) * 2 - 1;
    if (b.style === "pages") {
      // the page block between two thin boards
      if (cu < 1.8) ramp(0.5 + n(v * 0.05 + sd, u) * 0.3, dark, b.c, lit);
      else mix(hex("#a89878"), hex("#e0d4b4"), clamp(0.6 - Math.abs(a) * 0.3 + n(u * 1.6 + sd, v * 0.02) * 0.25));
      if (Math.min(v, bh - v) < 1.2) scale(0.75);
    } else {
      // a rounded spine: lit from the room, darker round the sides
      ramp(0.38 - a * 0.4 + 0.38 * (1 - a * a) - 0.12, dark, b.c, lit);
      // grain or weave, and wear at the head and tail
      const tex = b.style === "leather" ? fbm(n, u * 0.35 + sd, v * 0.35, 2) * 0.12 : n(u * 1.4 + sd, v * 1.4) * 0.05;
      scale(1 + tex - 0.18 * smooth(1.6, 0, Math.min(v, bh - v)));
      if (b.style === "leather") {
        for (const bandY of bands) {
          const d = v - bandY;
          if (Math.abs(d) < 2.4) scale(d < 0 ? 1.25 : 0.7);
        }
        // a dark label with a gilt border and the title
        if (v > bands[0] + 3 && v < bands[1] - 3 && Math.abs(a) < 0.78) {
          const inLabel = Math.abs(a) < 0.7 && v > bands[0] + 4 && v < bands[1] - 4;
          if (!inLabel) toward(gilt, 0.6);
          else {
            ramp(0.35 - a * 0.3 + 0.3 * (1 - a * a), [0.05, 0.03, 0.03], times(b.c, 0.45), times(b.c, 0.7));
            const mid = (bands[0] + bands[1]) / 2;
            if (Math.abs(v - mid) < (thick ? 1.4 : 5) && Math.abs(a) < (thick ? 0.5 : 0.18)) toward(gilt, 0.7);
          }
        }
        if (Math.abs(v - (bands[2] + bands[3]) / 2) < 1 && Math.abs(a) < 0.3) toward(gilt, 0.55);
      } else if (b.style === "cloth") {
        // gilt rules at head and tail
        for (const rv of [5, 8, bh - 8, bh - 5]) if (Math.abs(v - rv) < 0.8) toward(gilt, 0.6);
        // the title: a broken line of gilt down a thin spine, a few short
        // lines across a thick one
        const t0 = bh * 0.2;
        const t1 = bh * (0.42 + (sd % 0.2));
        if (v > t0 && v < t1) {
          if (thick) {
            const line = (v - t0) % 6;
            if (line < 1.6 && Math.abs(a) < 0.35 + 0.2 * n(Math.floor((v - t0) / 6) + sd, 1.5)) toward(gilt, 0.65);
          } else if (Math.abs(a) < 0.14 && n(v * 0.35 + sd, 0.5) > -0.25) toward(gilt, 0.6);
        }
      } else {
        // a paper label, the title in small dark print
        const l0 = bh * 0.14;
        const l1 = l0 + Math.min(26, bh * 0.25);
        if (v > l0 && v < l1 && Math.abs(a) < 0.72) {
          mix(hex("#8a7a60"), hex("#c4b494"), clamp(0.7 - a * 0.3));
          const line = (v - l0 - 5) % 5;
          if (v > l0 + 4 && v < l1 - 4 && line < 1.3 && Math.abs(a) < (thick ? 0.45 : 0.2)) scale(0.45);
        }
      }
    }
    p.over(i, cov);
  });
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

  // bookshelves at the edges, over the fireplaces
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
    const palette = ["#7a3448", "#344a7a", "#4e6a38", "#8a6230", "#4c3a7c", "#94503a", "#2c5e5e", "#6a2a2a", "#3a3040", "#6a5a3a"].map(hex);
    const pick = (): Book => {
      const base = palette[Math.floor(r() * palette.length)];
      // faded, darkened, or a little worn: no two quite alike
      const c = blend(times(base, 0.75 + r() * 0.4), [0.45, 0.4, 0.38], r() * r() * 0.5);
      const kind = r();
      return { c, style: kind < 0.42 ? "leather" : kind < 0.84 ? "cloth" : "paper", seed: r() * 1000 };
    };
    const end = x1 - 18;
    for (let y = 30; y + 136 <= MANTEL; y += 136) {
      const floor = y + 122;
      let x = x0 + 18;
      let prev = { right: x, h: 120 };
      while (x < end - 10) {
        // now and then a few books lying in a stack
        if (r() < 0.16 && end - x > 70) {
          const len = Math.min(end - x - 2, 64 + r() * 34);
          let top = floor;
          const count = 2 + Math.floor(r() * 3);
          for (let k = 0; k < count && top > y + 40; k++) {
            const th = 10 + r() * 12;
            const ln = len * (0.82 + r() * 0.18);
            const lx = x + r() * (len - ln);
            // lying flat, spine out: a quarter turn, standing on what was
            // its bottom-left corner
            const bk = pick();
            if (r() < 0.4) bk.style = "pages";
            book(p, lx + ln, top, -Math.PI / 2, th, ln, bk);
            top -= th;
          }
          prev = { right: x + len, h: floor - top };
          x += len + 2 + r() * 4;
          continue;
        }
        // a run of upright books, none quite straight
        const run = 3 + Math.floor(r() * 6);
        for (let k = 0; k < run && x < end - 9; k++) {
          const bw = Math.min(end - x, 9 + r() * r() * 26);
          const bh = 72 + r() * 44;
          const tilt = (r() - 0.5) * 0.035;
          book(p, x, floor, tilt, bw, bh, pick());
          prev = { right: x + bw, h: bh };
          x += bw + 0.6 + (r() < 0.06 ? 3 : 0);
        }
        // one leaning back against the run
        if (r() < 0.45 && end - x > 26) {
          const th = -(0.1 + r() * 0.3);
          const bw = 11 + r() * 14;
          const bh = 76 + r() * 38;
          const contact = Math.min(prev.h, bh) * 0.94;
          const bx = prev.right + contact * Math.sin(-th) + 0.5;
          if (bx + bw * Math.cos(th) < end) {
            book(p, bx, floor, th, bw, bh, pick());
            x = bx + bw * Math.cos(th) + 1.5 + r() * 5;
            prev = { right: x, h: bh * Math.cos(th) };
            continue;
          }
        }
        x += r() < 0.2 ? 2 + r() * 6 : 0;
      }
      // the compartment's shadow under the board above
      p.each(x0, y, x1, floor, (_X, Y, i) => {
        p.get(i);
        scale(0.62 + 0.38 * smooth(y, y + 46, Y));
        p.over(i, 1);
      });
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
  // rows of boards, narrower toward the back of the room, each board its
  // own shade with grain running along it
  land(p, () => 830, (X, _Y, d) => {
    const rowF = 6 * Math.log(1 + d / 60);
    const row = Math.floor(rowF);
    const len = 190 + (row % 3) * 30;
    const plank = Math.floor((X + row * 97) / len);
    const h = Math.sin(row * 12.9898 + plank * 78.233) * 43758.5453;
    const tone = h - Math.floor(h);
    const grain = n(X * 0.012 + plank * 7, rowF * 3.1) * 0.6 + n(X * 0.05 + plank * 3, rowF * 9.7) * 0.25;
    mix(hex("#1e0f0e"), hex("#5a3424"), clamp(0.42 + tone * 0.22 + grain * 0.28 - d / 520));
    // seams between rows and at board ends
    if ((rowF - row) * (60 + d) < 7.2) scale(0.55);
    if ((X + row * 97) % len < 1.3) scale(0.6);
    return 1;
  });
  // (live: the shader's, its runes turning)
  const rune = hex("#b48cff");
  if (!p.live) {
    p.each(200, 820, 1400, H, (X, Y, i) => {
      const e = Math.hypot((X - 800) / 520, (Y - 910) / 70);
      p.add(i, rune, (Math.exp(-(((e - 1) * 60) ** 2)) + 0.6 * Math.exp(-(((e - 0.84) * 70) ** 2))) * 0.45 + Math.exp(-((e / 0.9) ** 2)) * 0.05);
    });
  }

  // a fireplace in each bottom corner, under the shelves. (live: the
  // shader draws the fire and its light; the firebox is tagged in 0, the
  // glowing log cracks and coals in 1)
  p.tag(0);
  p.tag(1);
  fireplace(p, n, -20, 210, FIRES[0], false);
  fireplace(p, n, 1390, 1620, FIRES[1], true);

  // candles on the sills
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

  vignette(p, VIGNETTE.arcane);
}

const PAINT: Record<Element, (p: Paint) => void> = { leaf, ember, tide, stone, sky: skyScene, frost, moon, arcane };

/** Brightness trim so every habitat sits at a similar level once the reader
 *  dims it: daylight scenes down, the cavern up. */
const EXPOSURE: Record<Element, number> = { leaf: 0.8, ember: 1.05, tide: 0.9, stone: 1.35, sky: 0.82, frost: 1, moon: 1.1, arcane: 1.1 };

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

/** What the living backdrop (living.ts) draws from: the painting without
 *  its moving parts, the masks saying where those go, and an optional
 *  layer. All w×h RGBA8. The layer is premultiplied color over the scene
 *  ("over") or light added to it ("add", stored as sqrt(v / 4) so faint
 *  glow keeps its precision and lava can run past white). */
export interface LiveBackdrop {
  w: number;
  h: number;
  base: Uint8ClampedArray<ArrayBuffer>;
  mask: Uint8ClampedArray<ArrayBuffer>;
  layer: Uint8ClampedArray<ArrayBuffer> | null;
  layerMode: "over" | "add" | null;
}

export const backdropExposure = (el: Element) => EXPOSURE[el];

/** Paint an element's backdrop for the living shader (see LiveBackdrop). */
export function paintLive(el: Element, w = W, h = H): LiveBackdrop {
  const p = new Paint(w, h, true);
  PAINT[el](p);
  const k = EXPOSURE[el];
  for (let i = 0; i < p.px.length; i++) p.px[i] *= k;
  const m = p.mask!;
  for (let ch = 0; ch < 4; ch++) if (p.blur[ch]) blurChannel(m, w, h, ch, Math.round(p.blur[ch] * p.k));
  const r = rng(98);
  const mask = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < m.length; i++) mask[i] = m[i] * 255 + r();
  let layer: Uint8ClampedArray<ArrayBuffer> | null = null;
  if (p.layer) {
    const L = p.layer;
    layer = new Uint8ClampedArray(w * h * 4);
    const add = p.layerMode === "add";
    for (let i = 0; i < L.length; i++) {
      const d = r();
      if ((i & 3) === 3) layer[i] = L[i] * 255 + d;
      else layer[i] = (add ? Math.sqrt((L[i] * k) / 4) : L[i] * k) * 255 + d;
    }
  }
  return { w, h, base: p.rgba(), mask, layer, layerMode: p.layerMode };
}

/** Three box blurs, across then down: close to a gaussian of radius `r`.
 *  Blurs channel `ch` of `stride` interleaved channels. */
function blurChannel(m: Float32Array, w: number, h: number, ch: number, r: number, stride = 4) {
  if (r < 1) return;
  const line = new Float32Array(Math.max(w, h));
  const pass = (n: number, count: number, at: (line: number, i: number) => number) => {
    for (let l = 0; l < count; l++) {
      for (let rep = 0; rep < 3; rep++) {
        for (let i = 0; i < n; i++) line[i] = m[at(l, i)];
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += line[Math.min(n - 1, Math.max(0, i))];
        for (let i = 0; i < n; i++) {
          m[at(l, i)] = sum / (2 * r + 1);
          sum += line[Math.min(n - 1, i + r + 1)] - line[Math.max(0, i - r)];
        }
      }
    }
  };
  pass(w, h, (y, x) => (y * w + x) * stride + ch);
  pass(h, w, (x, y) => (y * w + x) * stride + ch);
}
