/** Habitats: a pixel-art scene per element for pets (and eggs) to stand in.
 *
 *  Scenes are painted in code on a SCENE_W × SCENE_H canvas at the same
 *  pixel size as the creature in front of it, layer by layer, far to near:
 *  sky, far silhouettes, side props, the floor. Gradients are banded with
 *  ordered dithering rather than blended, so they stay pixel art. A pool of
 *  light under the creature and a darkened rim keep the eye on the pet, and
 *  keep every scene quiet enough for the pet's own colors to lead.
 *
 *  The creature's 32×32 box sits at STAGE (feet on the floor, hats inside the
 *  frame). Motes — embers, snow, bubbles — are drawn by the UI on top, from
 *  MOTES, so the canvas itself is still.
 *
 *  Pure math, no DOM: shared by the app and `scripts/scene-sheet.ts`. */

import type { Element } from "./kit.ts";
import type { Sprite } from "./pixel.ts";
import type { Rgb } from "./color.ts";
import { hexToRgb } from "./color.ts";

export const SCENE_W = 56;
export const SCENE_H = 48;
/** Top-left of the creature's 32×32 box: its ground row (y 30) lands on the
 *  floor's middle, and a hat (10 px over the box) still fits the frame. */
export const STAGE = { x: 12, y: 12 };
/** First floor row. */
const FLOOR = 40;

// ── canvas ──

type Paint = Rgb | string;
const rgb = (c: Paint): Rgb => (typeof c === "string" ? hexToRgb(c) : c);

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));
/** Ordered-dither threshold for a pixel, 0–1. */
const bayer = (x: number, y: number) => BAYER[y & 3][x & 3];
const TINT = 0.07;

class Canvas {
  data = new Uint8ClampedArray(SCENE_W * SCENE_H * 4);

  set(x: number, y: number, c: Paint) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= SCENE_W || y >= SCENE_H) return;
    const [r, g, b] = rgb(c);
    const i = (y * SCENE_W + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  get(x: number, y: number): Rgb {
    const i = (y * SCENE_W + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  /** Paint every pixel where `inside` holds. */
  fill(inside: (x: number, y: number) => boolean, c: Paint | ((x: number, y: number) => Paint | null)) {
    for (let y = 0; y < SCENE_H; y++) {
      for (let x = 0; x < SCENE_W; x++) {
        if (!inside(x, y)) continue;
        const p = typeof c === "function" ? c(x, y) : c;
        if (p) this.set(x, y, p);
      }
    }
  }

  /** A shape with a lit top edge (and optionally a lit left edge). */
  shape(inside: (x: number, y: number) => boolean, body: Paint, rim?: Paint, side?: Paint) {
    this.fill(inside, (x, y) => {
      if (rim && !inside(x, y - 1)) return rim;
      if (side && !inside(x - 1, y)) return side;
      return body;
    });
  }

  /** Vertical gradient through `stops`, banded, dithered only where bands
   *  meet (`soft` widens the dithered seam). */
  gradient(y0: number, y1: number, stops: Paint[], soft = 0.35, x0 = 0, x1 = SCENE_W) {
    const n = stops.length - 1;
    for (let y = y0; y < y1; y++) {
      const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n;
      const i = Math.min(n - 1, Math.floor(t));
      const f = t - i;
      for (let x = x0; x < x1; x++) {
        const edge = Math.min(1, Math.max(0, (f - 0.5) / soft + 0.5));
        this.set(x, y, stops[edge > bayer(x, y) ? i + 1 : i]);
      }
    }
  }

  /** Mix toward `c` by `amt(x, y)` (0–1), quantized to steps of TINT and
   *  dithered between them, so the palette stays small. */
  tint(c: Paint, amt: (x: number, y: number) => number) {
    const to = rgb(c);
    for (let y = 0; y < SCENE_H; y++) {
      for (let x = 0; x < SCENE_W; x++) {
        const a = Math.min(1, amt(x, y));
        if (a <= 0) continue;
        // Dither only near a step's edge; inside a step it's flat.
        const lv = a / TINT;
        const f = Math.min(1, Math.max(0, (lv % 1 - 0.5) / 0.3 + 0.5));
        const k = (Math.floor(lv) + (f > bayer(x, y) ? 1 : 0)) * TINT;
        if (!k) continue;
        const [r, g, b] = this.get(x, y);
        this.set(x, y, [r + (to[0] - r) * k, g + (to[1] - g) * k, b + (to[2] - b) * k].map(Math.round) as Rgb);
      }
    }
  }

  /** Pixel rows, `.` transparent: `ink` maps the other characters. */
  stamp(x: number, y: number, rows: string[], ink: Record<string, Paint>, flip = false) {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch !== "." && ink[ch]) this.set(flip ? x + row.length - 1 - dx : x + dx, y + dy, ink[ch]);
      });
    });
  }

  sprite(): Sprite {
    return { w: SCENE_W, h: SCENE_H, data: this.data };
  }
}

/** Deterministic noise so a scene is the same every time it's drawn. */
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

/** A smooth 1-D noise curve (sum of seeded sines), roughly -1…1. */
function ridge(seed: number, scale = 1) {
  const r = rng(seed);
  const waves = [0.9, 1.9, 3.7].map((f) => ({ f: (f * scale) / 10, p: r() * 6.28, a: 1 / f }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (x: number) => waves.reduce((s, w) => s + Math.sin(x * w.f + w.p) * w.a, 0) / norm;
}

const inEll = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** The finishing passes every scene shares: light pooled where the
 *  creature stands, a glow behind it, and a darker rim. */
function finish(c: Canvas, light: Paint, shade: Paint, pool = 0.4, glow = 0.14) {
  const cx = STAGE.x + 16;
  c.tint(light, (x, y) => {
    const floor = y >= FLOOR ? pool * (1 - Math.hypot((x + 0.5 - cx) / 17, (y + 0.5 - 43.5) / 4.2)) : 0;
    const halo = glow * (1 - Math.hypot((x + 0.5 - cx) / 22, (y + 0.5 - 26) / 20));
    return Math.max(floor, halo);
  });
  c.tint(shade, (x, y) => {
    const dx = Math.abs(x + 0.5 - SCENE_W / 2) / (SCENE_W / 2);
    const dy = Math.abs(y + 0.5 - SCENE_H * 0.55) / (SCENE_H * 0.55);
    return Math.max(0, Math.hypot(dx * 1.05, dy * 0.8) - 0.78) * 1.2;
  });
}

// ── habitats ──

function leaf(c: Canvas) {
  // Afternoon light through a canopy: a hazy gold-green clearing.
  c.gradient(0, FLOOR, ["#5f8a5a", "#86a868", "#b4c47c", "#cfd08a"], 0.45);
  // Far trunks and the tree line, soft in the haze.
  const far = ridge(3, 1.4);
  c.fill((x, y) => y > 25 + far(x) * 3 && y < FLOOR, "#7b9a62");
  for (const [x, w] of [[4, 2], [15, 1], [38, 1], [50, 2]]) c.fill((px, y) => px >= x && px < x + w && y > 8 && y < 32, "#6f8f5c");
  const near = ridge(11, 2.2);
  c.fill((x, y) => y > 31 + near(x) * 2.5 && y < FLOOR, "#5e8150");
  // Shafts of light slanting down from the gaps.
  c.tint("#f4f0b8", (x, y) => (y < FLOOR && ((x - y * 0.45 + 60) % 19) < 3.2 && ((x - y * 0.45 + 60) % 19) > 0 ? 0.28 : 0));
  // Canopy framing the top, with sunlit leaf edges.
  const lip = ridge(7, 2.6);
  const canopy = (x: number, y: number) =>
    y < 5 + lip(x) * 3 + (Math.abs(x - 28) < 14 ? -2 : 3) || inEll(2, 6, 8, 9)(x, y) || inEll(55, 5, 9, 10)(x, y);
  c.shape(canopy, "#2e4d33", undefined);
  c.fill((x, y) => canopy(x, y) && !canopy(x, y + 1), "#4a7a45");
  c.fill((x, y) => canopy(x, y) && !canopy(x, y + 1) && bayer(x, y * 3) > 0.6, "#6d9b52");
  // Near trunks at the edges.
  c.shape((x, y) => x <= 3 && y >= 4 && y < FLOOR + 1, "#3f3226", undefined, "#5a4632");
  c.shape((x, y) => x >= 51 && x <= 53 && y >= 6 && y < FLOOR + 1, "#3f3226", undefined, "#5a4632");
  // Bushes either side.
  const bush = (x: number, y: number) =>
    inEll(7, 40, 8, 6)(x, y) || inEll(13, 41, 5, 4)(x, y) || inEll(50, 40, 8, 6.5)(x, y) || inEll(43, 41.5, 4.5, 3.5)(x, y);
  c.shape((x, y) => bush(x, y) && y < FLOOR + 2, "#3f6b3b", "#6a9a4c");
  // Mossy floor.
  c.gradient(FLOOR, SCENE_H, ["#5f9447", "#4b7a3c", "#3b6333"], 0.4);
  c.fill((_, y) => y === FLOOR, "#86b85a");
  const r = rng(5);
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * SCENE_W);
    const y = FLOOR + 1 + Math.floor(r() * 7);
    c.set(x, y, r() < 0.5 ? "#79aa52" : "#355a2e");
  }
  // Grass tufts and flowers.
  for (const x of [5, 19, 36, 47]) c.stamp(x, FLOOR - 2, [".g.", "g.g"], { g: "#86b85a" });
  for (const [x, y, k] of [[9, 44, "#f0b6c8"], [16, 46, "#fff2c8"], [41, 45, "#f0b6c8"], [48, 43, "#fff2c8"], [30, 47, "#fff2c8"]] as const) {
    c.set(x, y, k);
    c.set(x, y + 1, "#3b6333");
  }
  // A toadstool on the left, a fern on the right.
  c.stamp(2, 38, [".rrr.", "rwrrw", "rrrrr", "..s..", "..s.."], { r: "#c9503f", w: "#f6ead2", s: "#eadfc4" });
  c.stamp(47, 36, ["....f.", "..f.f.", ".f.ff.", "f.ff..", ".ff...", "..f..."], { f: "#79aa52" }, true);
  finish(c, "#fff2b0", "#10180f", 0.32, 0.12);
}

function ember(c: Canvas) {
  // Smoke-dark sky over a glowing horizon.
  c.gradient(0, 32, ["#1e1016", "#2a1218", "#3e181a", "#62241e", "#9a3c22"], 0.35);
  // Far range, and the volcano with its lit crater.
  const far = ridge(21, 2.8);
  c.shape((x, y) => y >= 25 + Math.abs(far(x)) * 5 && y < FLOOR, "#3b1a1c", "#52221e");
  const slope = ridge(5, 4);
  const cone = (x: number, y: number) => y >= 13 && y >= 11 + Math.abs(x + 0.5 - 38) * (0.85 + slope(y) * 0.12) && y < FLOOR;
  c.shape(cone, "#2c1418", "#7a3424");
  c.fill((x, y) => cone(x, y) && x + 0.5 < 38 && !cone(x - 1, y), "#5a2620");
  c.tint("#ff8a3a", (x, y) => 0.42 * (1 - Math.hypot((x + 0.5 - 38) / 11, (y - 12) / 7)));
  c.fill((x, y) => y === 13 && Math.abs(x + 0.5 - 38) < 2.5, "#ffb04a");
  c.fill((x, y) => y === 13 && Math.abs(x + 0.5 - 38) < 1, "#ffe08a");
  // Lava running down the flank: a hot core line with a cooler edge.
  const run = (y: number) => 38 - (y - 13) * 0.42 - Math.sin((y - 13) * 0.22) * 1.5;
  const flow = (y: number) => 0.7 + (y - 13) * 0.06;
  c.fill((x, y) => cone(x, y) && y > 13 && y < FLOOR && Math.abs(x + 0.5 - run(y)) < flow(y) + 0.6, (x, y) => {
    const d = Math.abs(x + 0.5 - run(y));
    return d < flow(y) * 0.5 ? "#ffc060" : d < flow(y) ? "#e8601e" : "#8a2a1a";
  });
  // A plume of ash above the crater.
  c.fill((x, y) => inEll(36, 8, 5, 2.6)(x, y) || inEll(32, 4, 4.5, 2.2)(x, y) || inEll(27, 1, 4, 2)(x, y), "#361a1e");
  c.fill((x, y) => (inEll(36, 8, 5, 2.6)(x, y) && !inEll(36, 8, 5, 2.6)(x, y + 1)) || (inEll(32, 4, 4.5, 2.2)(x, y) && !inEll(32, 4, 4.5, 2.2)(x, y + 1)), "#5a2a24");
  // Jagged spires framing the sides, rimmed on the side facing the glow.
  const SPIRES: [number, number, number][] = [[1, 12, 3.2], [5, 21, 2.6], [9, 29, 2], [55, 10, 3.4], [51, 19, 2.8], [47, 28, 2]];
  const spire = (x: number, y: number) =>
    y < FLOOR + 1 && SPIRES.some(([sx, top, w]) => y >= top && Math.abs(x + 0.5 - sx) < ((y - top) / (FLOOR - top)) * w + 0.5);
  c.fill(spire, (x, y) => {
    const inward = x < 28 ? 1 : -1;
    return !spire(x + inward, y) || !spire(x, y - 1) ? "#8a3e26" : !spire(x + 2 * inward, y) ? "#4a2220" : "#1c0e14";
  });
  // Cracked basalt floor with lava seams.
  c.gradient(FLOOR, SCENE_H, ["#3a2224", "#2c1a1e", "#221418"], 0.4);
  c.fill((_, y) => y === FLOOR, "#5a3028");
  const seam = [[4, 43], [5, 43], [6, 42], [7, 42], [8, 43], [9, 43], [10, 44], [11, 44], [12, 45], [13, 45], [43, 41], [44, 41], [45, 42], [46, 42], [47, 43], [48, 43], [49, 44], [50, 44], [21, 46], [22, 46], [23, 47], [33, 47], [34, 46], [35, 46], [36, 46]];
  c.tint("#ff6a2a", (x, y) => (y >= FLOOR ? 0.4 * (1 - Math.min(...seam.map(([sx, sy]) => Math.hypot(sx - x, (sy - y) * 1.5))) / 3) : 0));
  for (const [x, y] of seam) c.set(x, y, "#e8581e");
  for (const [x, y] of [[7, 42], [8, 43], [46, 42], [47, 43], [22, 46], [34, 46]]) c.set(x, y, "#ffc060");
  finish(c, "#ffb070", "#0e0708", 0.3, 0.1);
}

function tide(c: Canvas) {
  // Under the surface: bright water above, deep blue below.
  c.gradient(0, FLOOR, ["#5fb0c4", "#3f8fac", "#2a7094", "#1f587c", "#1a4a6c"], 0.4);
  // The surface, rippling.
  c.fill((x, y) => y === 0 || (y === 1 && (x % 6 === 1 || x % 6 === 2)), "#a8e0e4");
  c.fill((x, y) => y === 2 && x % 9 === 4, "#8fd0dc");
  // God rays fanning from the surface.
  c.tint("#c8f0f0", (x, y) => {
    if (y >= FLOOR) return 0;
    const u = (x - 28) / (y + 14);
    const band = Math.abs(((u * 7 + 10.5) % 2) - 1);
    return band < 0.28 ? 0.26 * (1 - y / FLOOR) : 0;
  });
  // Far reef silhouettes.
  const far = ridge(8, 2.4);
  c.fill((x, y) => y > 31 + far(x) * 3 && y < FLOOR, "#255f80");
  // Kelp swaying up both sides.
  const kelp = (base: number, top: number, phase: number) => (x: number, y: number) =>
    y >= top && y < FLOOR + 1 && Math.abs(x + 0.5 - (base + Math.sin(y * 0.45 + phase) * 1.2)) < 1;
  for (const [b, t, p, col] of [[3, 6, 0, "#2f7a5a"], [7, 14, 2, "#3a8a5e"], [49, 10, 1, "#3a8a5e"], [53, 4, 3, "#2f7a5a"]] as const) {
    c.shape(kelp(b, t, p), col, undefined, "#5aa874");
  }
  // Coral and rocks.
  c.shape((x, y) => inEll(44, 41, 5, 3.5)(x, y) || inEll(10, 41.5, 4.5, 3)(x, y), "#3a5a6a", "#5a7f8a");
  c.stamp(40, 33, ["p...p", "p.p.p", ".ppp.", "..p..", "..p.."], { p: "#e27a8e" });
  c.stamp(12, 34, ["o.o.", ".oo.", "o.o.", ".o..", ".o.."], { o: "#f0a060" });
  // Sandy floor with ripples, a shell and a starfish.
  c.gradient(FLOOR, SCENE_H, ["#d8c08a", "#c4aa74", "#a88e60"], 0.4);
  c.fill((_, y) => y === FLOOR, "#e8d4a0");
  c.fill((x, y) => y > FLOOR && y % 3 === 0 && ((x + y * 2) % 8) < 3, "#b89e68");
  c.stamp(45, 44, [".s.", "sss", ".s."], { s: "#f08a6a" });
  c.stamp(6, 45, [".w.", "www"], { w: "#f4e8d8" });
  finish(c, "#e8fff4", "#08141c", 0.3, 0.12);
}

function stone(c: Canvas) {
  // A crystal cavern, deep and dark, lit by the crystals themselves.
  c.gradient(0, FLOOR, ["#18161f", "#1f1c28", "#282332", "#332c3c", "#3e3444"], 0.4);
  // Far stalagmites rising from the back of the cave, two layers deep.
  for (const [seed, base, amp, body, rim] of [[51, 29, 10, "#23202c", "#4a4256"], [53, 34, 7, "#1a1822", "#3a3446"]] as const) {
    const r = rng(seed);
    const spires = Array.from({ length: 7 }, (_, i) => [i * 9 + r() * 6 - 2, base - amp * (0.4 + r() * 0.6), 1.6 + r() * 2.2]);
    const inside = (x: number, y: number) =>
      y < FLOOR + 1 && (y >= base + 2 || spires.some(([sx, top, w]) => y >= top && Math.abs(x + 0.5 - sx) < ((y - top) / (base + 2 - top)) * w * 1.6 + 0.4));
    c.fill(inside, (x, y) => (!inside(x, y - 1) || !inside(x - 1, y) ? rim : body));
  }
  // Tiny crystals glinting in the dark far away.
  for (const [x, y, k] of [[9, 26, "#9a7ad0"], [19, 29, "#c8a050"], [36, 27, "#9a7ad0"], [44, 31, "#c8a050"], [27, 24, "#7ab0c8"]] as const) {
    c.set(x, y, k);
    c.set(x, y + 1, "#2a2534");
  }
  // The ceiling: a ragged rock band with stalactites hanging from it.
  const ceil = ridge(57, 3.4);
  const roof = (x: number, y: number) => y < 3 + ceil(x) * 2;
  c.fill(roof, "#141219");
  for (const [x, len, w] of [[4, 11, 2.2], [11, 7, 1.6], [17, 4, 1.1], [23, 9, 1.8], [33, 5, 1.3], [39, 10, 2], [46, 6, 1.5], [52, 12, 2.4]]) {
    const tip = (px: number, y: number) => y < len && Math.abs(px + 0.5 - x) < w * (1 - y / len) + 0.25;
    c.fill(tip, (px, y) => (!tip(px - 1, y) ? "#3e3748" : "#1c1a24"));
  }
  // Crystal clusters, glowing on both sides.
  const crystal = (x: number, y: number, h: number, flip: boolean, lit: string, core: string, dark: string) =>
    c.stamp(x, y, CRYSTAL.slice(CRYSTAL.length - h), { a: dark, b: lit, c: core }, flip);
  c.tint("#b48ae0", (x, y) => 0.5 * (1 - Math.hypot((x - 5) / 13, (y - 37) / 12)));
  c.tint("#e0b04a", (x, y) => 0.5 * (1 - Math.hypot((x - 50) / 13, (y - 36) / 13)));
  crystal(0, 28, 13, false, "#b48ae0", "#efe0ff", "#6a4a9a");
  crystal(47, 28, 13, true, "#e0b04a", "#fff0c0", "#8a5a2a");
  crystal(8, 35, 7, true, "#e0b04a", "#fff0c0", "#8a5a2a");
  crystal(41, 34, 7, false, "#b48ae0", "#efe0ff", "#6a4a9a");
  // Rubble floor.
  c.gradient(FLOOR, SCENE_H, ["#4e4652", "#403842", "#322c36"], 0.4);
  c.fill((_, y) => y === FLOOR, "#655a68");
  const r = rng(13);
  for (let i = 0; i < 8; i++) {
    const x = 2 + Math.floor(r() * 52);
    const y = FLOOR + 2 + Math.floor(r() * 5);
    c.stamp(x, y, ["hh", "dd"], { h: "#6e6474", d: "#2a2430" });
  }
  c.tint("#b48ae0", (x, y) => (y >= FLOOR ? 0.3 * (1 - Math.hypot((x - 6) / 12, (y - 42) / 5)) : 0));
  c.tint("#e0b04a", (x, y) => (y >= FLOOR ? 0.3 * (1 - Math.hypot((x - 50) / 12, (y - 42) / 5)) : 0));
  finish(c, "#ffe8c0", "#0b0a10", 0.26, 0.1);
}

/** A crystal cluster, bottom-aligned (rows trimmed from the top for
 *  smaller ones): a = shadowed facet, b = lit facet, c = glinting core. */
const CRYSTAL = [
  "...c.....",
  "...bc....",
  "..abc....",
  "..abb....",
  "..abb..c.",
  "..abb.bc.",
  "c.abb.bb.",
  "bcabbabb.",
  "bbabbabb.",
  "abaabab..",
  "abaabab..",
  "aaaaaaa..",
  ".aaaaa...",
];

function sky(c: Canvas) {
  // Above the clouds at sunrise.
  c.gradient(0, SCENE_H, ["#4f78b8", "#6f94cc", "#9ab4dc", "#c8c8d8", "#ecc8b0", "#ecc8b0"], 0.4);
  // The sun, low, with a dithered halo.
  c.tint("#fff4d0", (x, y) => 0.5 * (1 - Math.hypot((x - 14) / 13, (y - 14) / 11)));
  c.fill(inEll(14, 14, 3.4, 3.4), "#fff6d8");
  // Distant cloud banks and a pair of birds.
  const bank = (x: number, y: number) =>
    inEll(44, 24, 10, 4)(x, y) || inEll(52, 21, 6, 4)(x, y) || inEll(4, 26, 9, 3.5)(x, y) || inEll(30, 29, 20, 3)(x, y);
  c.shape(bank, "#d8dcea", "#f6f2f0");
  c.fill((x, y) => bank(x, y) && !bank(x, y + 1), "#b4bcd6");
  c.stamp(34, 9, ["k.k", ".k."], { k: "#3e5a8a" });
  c.stamp(40, 12, ["k.k", ".k."], { k: "#4f6a98" });
  // The cloud floor, puffy on top, shadowed beneath.
  const top = (x: number) => FLOOR - 3 + Math.round(Math.abs(Math.sin((x + 2) * 0.42)) * -2.2 + Math.abs(Math.sin(x * 0.19)) * 2);
  const puff = (x: number, y: number) => y >= top(x);
  c.shape(puff, "#e6ecf6", "#ffffff");
  const lower = (x: number) => FLOOR + 4 + Math.round(Math.abs(Math.sin(x * 0.35 + 1)) * 2);
  c.fill((x, y) => y >= lower(x), (x, y) => (y === lower(x) ? "#f4f6fc" : "#cfd8ea"));
  c.fill((x, y) => y > lower(x) + 1 && Math.abs(Math.sin(x * 0.35 + 1)) < 0.3, "#b8c4dc");
  finish(c, "#fff4dc", "#18203a", 0.2, 0.1);
}

function frost(c: Canvas) {
  // A polar evening under the aurora.
  c.gradient(0, 30, ["#142038", "#1c2e4c", "#2a4466", "#4a6a8a", "#7a9ab4"], 0.4);
  // Aurora ribbons.
  const wave = ridge(17, 1.6);
  c.tint("#6ff0c0", (x, y) => {
    const mid = 8 + wave(x) * 4;
    const d = y - mid;
    return d > -1 && d < 6 ? 0.55 * (1 - d / 6) * (0.6 + 0.4 * Math.sin(x * 0.7)) : 0;
  });
  c.tint("#b08af0", (x, y) => {
    const d = y - (4 + wave(x + 20) * 3);
    return d > -1 && d < 3 ? 0.3 * (1 - d / 3) : 0;
  });
  const stars = rng(19);
  for (let i = 0; i < 14; i++) c.set(Math.floor(stars() * SCENE_W), Math.floor(stars() * 18), "#dfe8ff");
  // Ice peaks with ragged snow caps and shadowed right faces.
  const PEAKS: [number, number, number][] = [[9, 17, 1.1], [27, 21, 0.85], [45, 15, 1.15]];
  const rough = ridge(33, 6);
  const hTop = (x: number) => Math.min(...PEAKS.map(([px, py, k]) => py + Math.abs(x + 0.5 - px) * k + rough(x) * 0.8));
  const nearest = (x: number) => PEAKS.reduce((b, p) => (Math.abs(x - p[0]) < Math.abs(x - b[0]) ? p : b));
  c.fill((x, y) => y >= hTop(x) && y < FLOOR, (x, y) => {
    const cap = y < hTop(x) + 3 + Math.abs(rough(x * 3)) * 3;
    const shade = x + 0.5 > nearest(x)[0];
    return cap ? (shade ? "#b0c4dc" : "#e8f0fa") : shade ? "#3e5a7a" : "#5a7a9a";
  });
  // Snowy pines framing the sides: stacked tiers, each capped with snow.
  const pine = (cx: number, top: number, h: number) => (x: number, y: number) => {
    const d = y - top;
    return d >= 0 && d < h && Math.abs(x + 0.5 - cx) <= (d % 5) * 0.7 + d * 0.22 + 0.5;
  };
  for (const [cx, t, h] of [[3, 10, 32], [10, 23, 19], [52, 12, 30], [45, 25, 17]]) {
    const p = pine(cx, t, h);
    c.fill(p, (x, y) => ((y - t) % 5 <= 1 && !p(x, y - 1) ? "#e8f2fc" : x + 0.5 < cx ? "#34606e" : "#244654"));
  }
  // Snowfield with blue shadows and glints.
  const drift = ridge(23, 3);
  c.fill((x, y) => y >= FLOOR - 1 + drift(x) * 1.2, (_, y) => (y >= FLOOR + 5 ? "#b8cce0" : "#dce8f4"));
  c.fill((x, y) => y >= FLOOR + 3 && y < FLOOR + 5 && bayer(x, y) > 0.5, "#b8cce0");
  const glint = rng(29);
  for (let i = 0; i < 7; i++) c.set(Math.floor(glint() * SCENE_W), FLOOR + 1 + Math.floor(glint() * 6), "#ffffff");
  finish(c, "#e8f4ff", "#070c18", 0.18, 0.12);
}

function moon(c: Canvas) {
  // Deep night with a full moon.
  c.gradient(0, 34, ["#0e1030", "#161a40", "#1e2450", "#2a2f62", "#3a3a70"], 0.4);
  const stars = rng(37);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(stars() * SCENE_W);
    const y = Math.floor(stars() * 28);
    c.set(x, y, stars() < 0.3 ? "#fff4c8" : "#9ea8e0");
  }
  c.tint("#c8d0ff", (x, y) => 0.4 * (1 - Math.hypot((x - 43) / 14, (y - 11) / 12)));
  c.shape(inEll(43, 11, 5.6, 5.6), "#f2ecc8", undefined);
  c.fill((x, y) => inEll(43, 11, 5.6, 5.6)(x, y) && !inEll(43, 11, 5.6, 5.6)(x + 1, y + 1), "#cfc6a0");
  c.stamp(40, 8, ["cc...", "c..c.", ".....", "..cc."], { c: "#ddd4ac" });
  // Rolling hills and a lone crooked tree.
  const far = ridge(41, 1.8);
  c.shape((x, y) => y > 27 + far(x) * 3 && y < FLOOR, "#1f2448", "#3a4278");
  const near = ridge(43, 2.8);
  c.shape((x, y) => y > 33 + near(x) * 2 && y < FLOOR, "#181c3a", "#343c70");
  c.stamp(2, 18, [
    "..b..b.b...",
    "b..b.bb..b.",
    ".bb.bb.bbb.",
    "...bbb.b...",
    "....bb.....",
    "....b......",
    "....b......",
    "....bb.....",
    "....b......",
    "....b......",
    "...bbb.....",
  ], { b: "#12142c" });
  c.fill((x, y) => x >= 5 && x <= 7 && y >= 29 && y < FLOOR, "#12142c");
  // Moonlit meadow with glowing moonflowers.
  c.gradient(FLOOR, SCENE_H, ["#2a3868", "#22305a", "#1a244a"], 0.4);
  c.fill((_, y) => y === FLOOR, "#4a5a98");
  for (const x of [4, 13, 38, 50]) c.stamp(x, FLOOR - 2, [".g.", "g.g"], { g: "#3a4a88" });
  for (const [x, y] of [[8, 42], [15, 45], [44, 43], [50, 46], [36, 46]]) {
    c.stamp(x - 1, y - 1, [".f.", "fcf", ".f."], { f: "#9ab0ff", c: "#f0f4ff" });
  }
  c.tint("#9ab0ff", (x, y) => (y >= FLOOR - 1 ? 0.2 * (1 - Math.min(...[[8, 42], [15, 45], [44, 43], [50, 46], [36, 46]].map(([fx, fy]) => Math.hypot(fx - x, fy - y))) / 3.5) : 0));
  finish(c, "#c8d4ff", "#05061a", 0.26, 0.12);
}

function arcane(c: Canvas) {
  // A study at night: shelves of books around a tall arched window.
  c.gradient(0, FLOOR, ["#1e1630", "#261c3c", "#2e2246"], 0.4);
  // Bookshelves: dark wood frames, rows of spines.
  const r = rng(47);
  const SPINES = ["#7a3a4a", "#3a5a7a", "#5a7a4a", "#8a6a3a", "#5a3a7a", "#3a6a6a", "#9a5a3a", "#6a4a6a"];
  for (const [x0, x1] of [[0, 17], [39, 56]]) {
    c.fill((x, y) => x >= x0 && x < x1 && y < FLOOR, "#2a1a26");
    for (let shelf = 0; shelf < 4; shelf++) {
      const base = 10 + shelf * 8;
      c.fill((x, y) => x >= x0 && x < x1 && y === base, "#5a3a34");
      c.fill((x, y) => x >= x0 && x < x1 && y === base + 1, "#1a1018");
      let x = x0 + 1;
      while (x < x1 - 1) {
        const w = r() < 0.3 ? 2 : 1;
        const h = 4 + Math.floor(r() * 3);
        if (r() < 0.12) {
          x += 1;
          continue;
        }
        const col = SPINES[Math.floor(r() * SPINES.length)];
        c.fill((px, y) => px >= x && px < x + w && y < base && y >= base - h, (px, y) => (y === base - h ? "#c8b48a" : px === x && w === 2 ? "#e8d8b0" : col));
        x += w;
      }
    }
    c.fill((x, y) => (x === x0 || x === x1 - 1) && y < FLOOR, "#3e2830");
  }
  // The arched window with a violet night sky and a crescent.
  const win = (x: number, y: number) => Math.abs(x + 0.5 - 28) < 9 && y < 34 && (y > 12 || inEll(28, 12, 9, 9)(x, y)) && y > 2;
  c.fill((x, y) => win(x, y), (_, y) => (y < 12 ? "#3a2a6a" : y < 22 ? "#4a3280" : "#5a3a8a"));
  c.fill((x, y) => win(x, y) && y > 7 && y < 30 && bayer(x, y) > 0.94, "#e8d8ff");
  c.fill((x, y) => inEll(32, 9, 2.5, 2.5)(x, y) && !inEll(33.2, 8.2, 2.3, 2.3)(x, y), "#fff0c8");
  // Mullions and frame.
  c.fill((x, y) => win(x, y) && (x === 28 || y === 20), "#2a1a26");
  c.fill((x, y) => !win(x, y) && (win(x - 1, y) || win(x + 1, y) || win(x, y - 1) || win(x, y + 1)), "#6a4a3a");
  c.tint("#b07aff", (x, y) => 0.22 * (1 - Math.hypot((x - 28) / 16, (y - 20) / 20)));
  // Candles on the shelf ends, with their glow.
  for (const cx of [15, 40]) {
    c.stamp(cx, 21, ["f", "w", "w"], { f: "#ffd27a", w: "#efe4d0" });
    c.tint("#ffc870", (x, y) => 0.4 * (1 - Math.hypot(x - cx, y - 21) / 6));
  }
  // Wooden floor and a glowing rune circle where the pet stands.
  c.gradient(FLOOR, SCENE_H, ["#4a3040", "#3c2636", "#2e1e2a"], 0.4);
  c.fill((_, y) => y === FLOOR, "#6a4650");
  c.fill((x, y) => y > FLOOR && (x + (y % 2) * 5) % 11 === 0, "#2a1a24");
  const ring = (x: number, y: number) => {
    const d = Math.hypot((x + 0.5 - 28) / 15, (y + 0.5 - 44) / 3.4);
    return d > 0.82 && d <= 1;
  };
  c.fill(ring, (x, y) => ((x * 7 + y) % 5 === 0 ? "#f0d8ff" : "#b07aff"));
  c.tint("#b07aff", (x, y) => (y >= FLOOR ? 0.3 * (1 - Math.hypot((x + 0.5 - 28) / 16, (y + 0.5 - 44) / 4.5)) : 0));
  finish(c, "#f0d8ff", "#07040e", 0.18, 0.08);
}

const PAINT: Record<Element, (c: Canvas) => void> = { leaf, ember, tide, stone, sky, frost, moon, arcane };

const cache = new Map<Element, Sprite>();

export function renderScene(el: Element): Sprite {
  let s = cache.get(el);
  if (!s) {
    const c = new Canvas();
    PAINT[el](c);
    s = c.sprite();
    cache.set(el, s);
  }
  return s;
}

/** The ambient life drawn over a scene: each mote is one scene pixel. */
export interface Motes {
  /** rise and fall drift vertically across the frame, twinkle blinks in
   *  place, float wanders slowly. */
  kind: "rise" | "fall" | "twinkle" | "float";
  colors: string[];
  count: number;
  /** Where they appear, in scene pixels: [x0, y0, x1, y1]. */
  area: [number, number, number, number];
}

export const MOTES: Record<Element, Motes> = {
  leaf: { kind: "float", colors: ["#fff4a0", "#e8ffb0"], count: 6, area: [2, 12, 54, 38] },
  ember: { kind: "rise", colors: ["#ffb04a", "#ff7a2a", "#ffe08a"], count: 9, area: [2, 18, 54, 46] },
  tide: { kind: "rise", colors: ["#c8f4ff", "#8fd8ec"], count: 7, area: [4, 8, 52, 44] },
  stone: { kind: "twinkle", colors: ["#fff0c0", "#efe0ff"], count: 6, area: [0, 26, 56, 42] },
  sky: { kind: "float", colors: ["#ffffff", "#fff4dc"], count: 4, area: [0, 4, 56, 30] },
  frost: { kind: "fall", colors: ["#ffffff", "#dce8f8"], count: 12, area: [0, 0, 56, 44] },
  moon: { kind: "twinkle", colors: ["#fff4c8", "#c8d4ff"], count: 8, area: [0, 0, 56, 26] },
  arcane: { kind: "rise", colors: ["#d8b0ff", "#ffe0a0"], count: 7, area: [8, 20, 48, 46] },
};

/** Seeded mote positions and timing, so they don't jump between renders. */
export function motes(el: Element): { x: number; y: number; color: string; delay: number; dur: number }[] {
  const m = MOTES[el];
  const r = rng(el.length * 97 + el.charCodeAt(0));
  const [x0, y0, x1, y1] = m.area;
  return Array.from({ length: m.count }, (_, i) => ({
    x: Math.floor(x0 + ((i + r()) / m.count) * (x1 - x0)),
    y: Math.floor(y0 + r() * (y1 - y0)),
    color: m.colors[i % m.colors.length],
    delay: -r() * 8,
    dur: 5 + r() * 5,
  }));
}
