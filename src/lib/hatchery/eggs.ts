/** Egg art: one shell per element, dressed up by tier.
 *
 *  An egg shows its element through the shell's colors and a pattern that
 *  wraps its curved surface (a leafy vine, flame licks, breaking waves,
 *  speckled strata, clouds, icicles, a crescent and stars, a rune circle), and
 *  its tier through trim that escalates: common shells are plain-patterned,
 *  rare ones gain a band, epic ones a glowing gem set in it, legendary ones a
 *  gold crown, gold band and swags around a big jewel, with sparkles.
 *  Cracks overlay as incubation nears the hatch: a hairline, then branches,
 *  then a jagged gap with light spilling out.
 *
 *  The shell fits the in-app icon crop (x 6–25, y 6–29 including outline). */

import type { Decal, Paint, Palette, Part, Prim, Sprite, V } from "./pixel.ts";
import { ell, path, poly, render } from "./pixel.ts";
import type { Element, Tier } from "./kit.ts";
import { sparkle, stamp } from "./kit.ts";

interface EggLook {
  shell: string;
  /** Main pattern ink. */
  mark: string;
  /** Secondary pattern ink (inner flame, foam, cloud shade, ...). */
  mark2: string;
  /** Rare/epic band. */
  band: string;
  /** Epic gem and legendary jewel. */
  gem: string;
}

const LOOK: Record<Element, EggLook> = {
  leaf: { shell: "#d6eeae", mark: "#4fa347", mark2: "#9fd66a", band: "#f29ab4", gem: "#ff5c7c" },
  ember: { shell: "#ffe4b8", mark: "#ec5634", mark2: "#ffb838", band: "#7c4fd6", gem: "#56d8ff" },
  tide: { shell: "#d5f2f0", mark: "#2f8ccc", mark2: "#f4fbff", band: "#f0dca6", gem: "#ff7d8e" },
  stone: { shell: "#d4c8b6", mark: "#6c5d50", mark2: "#a8977f", band: "#63b39c", gem: "#3fd98a" },
  sky: { shell: "#94c8ff", mark: "#fbfdff", mark2: "#c2d3f2", band: "#6f7fe8", gem: "#ff6fa8" },
  frost: { shell: "#eaf6ff", mark: "#6fc0ea", mark2: "#bfe8fb", band: "#ae98ff", gem: "#b67cff" },
  moon: { shell: "#4a4494", mark: "#f4e4a0", mark2: "#fff6cf", band: "#b8c0ff", gem: "#8ff0ff" },
  arcane: { shell: "#e4d4ff", mark: "#8e52e4", mark2: "#4fd2c0", band: "#4fc8b8", gem: "#3fe0a8" },
};

const GOLD = "#f2c14e";

// ── the shell ──
//
// A classic egg: narrow crown, full bottom. The silhouette is specified as
// each row's half-width from the center line (x = 16), and the shell is the
// polygon through those row edges — the SDF shades it smoothly while the
// pixel edge is exactly this curve: 1-px steps with runs that lengthen
// toward the equator, no lumps.
const TOP = 7;
const HALF = [2, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6, 5, 3];
const BOTTOM = TOP + HALF.length - 1; // 28

const SHELL_PTS: V[] = [
  [16, TOP - 0.1],
  ...HALF.map((h, i): V => [16 + h, TOP + i + 0.5]),
  [16, BOTTOM + 1.1],
  ...HALF.map((h, i): V => [16 - h, TOP + i + 0.5]).reverse(),
];
const shellPrim: Prim = poly(SHELL_PTS);

/** Is pixel (x, y) on the shell, at least `inset` pixels in from its edge? */
function onShell(x: number, y: number, inset = 0): boolean {
  const i = y - TOP;
  if (i < 0 || i >= HALF.length) return false;
  const h = HALF[i] - inset;
  return x >= 16 - h && x < 16 + h;
}

// Half-planes and holes for clipping paints (paints only subtract).
const above = (y: number): Prim => poly([[-4, -4], [36, -4], [36, y], [-4, y]]);
const below = (y: number): Prim => poly([[-4, y], [36, y], [36, 36], [-4, 36]]);
/** Everything *outside* an ellipse: the canvas with an elliptical hole. */
function outside(cx: number, cy: number, rx: number, ry: number): Prim {
  const ring: V[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI + (i / 32) * Math.PI * 2;
    ring.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return poly([[-4, cy], [-4, -4], [36, -4], [36, 36], [-4, 36], [-4, cy], ...ring]);
}

/** Reflected light: a 1-px rim along the lower-right edge, a step lighter
 *  than the core shadow beside it, so the shell turns rather than ends. */
const RIM: Paint = {
  mat: "shell",
  prims: [shellPrim],
  cut: [poly(SHELL_PTS.map(([x, y]): V => [x - 1, y - 1.2])), above(17)],
  level: 2,
};

// Form-following tones for markings. Rather than the rasterizer's 5-step
// dome shading (which bleaches a pattern into the shine on a pale shell), a
// marking gets three deliberate tones laid out like the shell's own light:
// lit on the upper-left, base across the front, shadow round the lower-right
// rim — so it reads as painted *on* a curved surface at every size.
const LIT = outside(12.6, 12.8, 5.4, 6.6);
const FRONT = ell(14.6, 16.6, 7.3, 9.9);

function toned(mat: string, prims: Prim[], cut: Prim[] = [], lit = 4, base = 3, shade = 2): Paint[] {
  return [
    { mat, prims, cut, level: base },
    { mat, prims, cut: [...cut, LIT], level: lit },
    { mat, prims, cut: [...cut, FRONT], level: shade },
  ];
}

// ── the band (rare and up) ──

/** The band's center line bows down toward the viewer, wrapping the shell at
 *  its widest part. */
const BAND_LINE: V[] = [[5, 18.2], [8, 19.2], [12, 19.9], [16, 20.1], [20, 19.9], [24, 19.2], [27, 18.2]];

function bandY(x: number): number {
  for (let i = 1; i < BAND_LINE.length; i++) {
    const [x0, y0] = BAND_LINE[i - 1];
    const [x1, y1] = BAND_LINE[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return BAND_LINE[BAND_LINE.length - 1][1];
}
const inBand = (x: number, y: number) => Math.abs(y + 0.5 - bandY(x + 0.5)) < 1.7;

// ── pixel helpers ──

type Px = V[];

/** Pixels of a polyline (integer vertices), 8-connected. */
function trace(pts: V[]): Px {
  const out: Px = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = i === 1 ? 0 : 1; s <= n; s++) {
      out.push([Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n)]);
    }
  }
  return out;
}

/** One ink on a set of pixels, clipped to the shell. */
function dots(px: Px, ink: string, inset = 0): Decal[] {
  return px.filter(([x, y]) => onShell(x, y, inset)).map(([x, y]) => stamp(x, y, ["d"], { d: ink }));
}

/** A little stamp, as pixel lists per ink, so it can be clipped. */
function glyph(x0: number, y0: number, rows: string[], inks: Record<string, string>): Decal[] {
  const out: Decal[] = [];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ink = inks[row[dx]];
      if (ink) out.push(stamp(x0 + dx, y0 + dy, ["d"], { d: ink }));
    }
  });
  return out;
}

/** Samples of y = y0 + amp·sin(...) across the egg, for wave edges. */
function sine(y0: number, amp: number, period: number, phase: number, x0 = 5, x1 = 27): V[] {
  const out: V[] = [];
  for (let x = x0; x <= x1 + 0.01; x += 0.5) out.push([x, y0 + amp * Math.sin(((x - phase) / period) * Math.PI * 2)]);
  return out;
}

// ── element patterns ──

interface Pattern {
  paints: Paint[];
  /** Small pixel details; clipped away where a band covers them. */
  decals: Decal[];
}

/** A pointed leaf from base to tip, `w` wide at its fullest. */
function leaf(bx: number, by: number, tx: number, ty: number, w: number): Prim {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const at = (t: number, s: number): V => [bx + dx * t + nx * s, by + dy * t + ny * s];
  return poly([at(0, 0), at(0.3, w * 0.5), at(0.65, w * 0.42), at(1, 0), at(0.65, -w * 0.42), at(0.3, -w * 0.5)], 0.25);
}

function pattern(el: Element): Pattern {
  switch (el) {
    case "leaf": {
      // One broad leaf laid diagonally across the shell, its tip curling
      // round the rim, with a dark midrib and paired side veins; a small
      // second leaf round the shaded side and a curl of stem at the base.
      const B: V = [10, 26.4];
      const T: V = [22.8, 9.4];
      const at = (t: number, s = 0): V => {
        const dx = T[0] - B[0];
        const dy = T[1] - B[1];
        const len = Math.hypot(dx, dy);
        return [Math.round(B[0] + dx * t - (dy / len) * s - 0.5), Math.round(B[1] + dy * t + (dx / len) * s - 0.5)];
      };
      const veins: Px = [
        ...trace([at(0.08), at(0.86)]),
        ...[0.3, 0.5, 0.7].flatMap((t) => [...trace([at(t), at(t + 0.12, 2.4)]), ...trace([at(t), at(t + 0.12, -2.4)])]),
      ];
      return {
        paints: toned("mark", [
          leaf(B[0], B[1], T[0], T[1], 7.4),
          leaf(18.6, 26.2, 23.4, 22.6, 3),
          path([[10, 26.4], [8.6, 27.4], [8.6, 28.6]], 0.7),
        ], [], 4, 3, 2),
        decals: dots(veins, "mark:1", 1),
      };
    }
    case "ember": {
      // Flames licking up from the base: three red tongues, a hot core.
      const outer = [
        below(24.5),
        poly([[12.4, 25], [13.3, 20.5], [14.6, 17], [15.4, 12.6], [16.9, 16.2], [18.6, 19.6], [19.6, 25]], 0.3),
        poly([[7.5, 25], [8.8, 21], [10.2, 16.6], [11.6, 20], [13, 25]], 0.3),
        poly([[18.6, 25], [20, 19.4], [21.4, 14.6], [22.6, 18.8], [24.5, 25]], 0.3),
      ];
      const inner = [
        below(27.2),
        poly([[13.8, 27.5], [14.8, 23], [15.9, 18.6], [17.1, 22.6], [18.2, 27.5]], 0.25),
        poly([[9.4, 27.5], [10.4, 22.4], [11.8, 27.5]], 0.25),
        poly([[19.8, 27.5], [21, 20.4], [22.4, 27.5]], 0.25),
      ];
      return {
        paints: [...toned("mark", outer, [], 3, 3, 2), ...toned("mark2", inner, [], 4, 3, 3)],
        decals: dots([[15, 10], [10, 14], [21, 12], [17, 8]], "mark2:4"),
      };
    }
    case "tide": {
      // Deep water rolling round the lower shell, crests capped with foam,
      // and a thin swell line higher up.
      const edge = sine(22.6, 1.1, 5.4, 7.2);
      const water = poly([...edge, [27, 34], [5, 34]]);
      const swell = path(sine(12.8, 0.9, 5.4, 9.8), 0.7);
      return {
        paints: [
          ...toned("mark", [water, swell], [], 4, 3, 2),
          { mat: "mark2", prims: [path(sine(21.7, 1.1, 5.4, 7.2), 0.62)], level: 4 },
        ],
        decals: [],
      };
    }
    case "stone": {
      // Speckled like a quail egg, over curved strata.
      const strata = [
        path([[6, 11.4], [11, 12.8], [16, 13.2], [21, 12.8], [26, 11.4]], 0.8),
        path([[6, 23.6], [11, 25.1], [16, 25.6], [21, 25.1], [26, 23.6]], 1.1),
      ];
      const speck: [number, number, number][] = [
        [13.5, 9.5, 0.6], [19, 10, 1], [21.5, 13.5, 0.6], [10.5, 15.5, 0.6], [15, 16, 1],
        [20, 17.5, 0.6], [11, 18, 1], [17.5, 22.5, 0.6], [13, 22, 1], [22, 22, 1],
        [9.5, 24.5, 0.6], [15.5, 27.5, 0.6], [19.5, 26.5, 0.6], [12.5, 26.5, 0.6],
      ];
      return {
        paints: [
          ...toned("mark2", strata, [], 3, 3, 2),
          ...toned("mark", speck.map(([x, y, r]) => ell(x, y, r)), [], 3, 3, 2),
        ],
        decals: [],
      };
    }
    case "sky": {
      // Fair-weather clouds drifting round a blue shell, flat shaded
      // undersides, one sailing off the rim.
      const cloud = (puffs: Prim[], base: number): Paint[] => [
        ...toned("mark", puffs, [below(base)], 4, 4, 3),
        ...toned("mark2", puffs, [above(base - 1), below(base)], 3, 3, 2),
      ];
      return {
        paints: [
          ...cloud([ell(9.6, 24.2, 2.2, 1.9), ell(13, 22.8, 2.7, 2.5), ell(16.8, 24.2, 2.1, 1.8)], 26),
          ...cloud([ell(18.8, 13, 2, 1.8), ell(21.8, 11.8, 2.4, 2.3), ell(24.6, 13, 2, 1.8)], 14.6),
          ...cloud([ell(9.8, 16.6, 1.6, 1.3), ell(12, 15.9, 1.8, 1.6)], 17.6),
        ],
        decals: [],
      };
    }
    case "frost": {
      // An ice cap hanging icicles over the crown, a snowflake below.
      const icicle = (x: number, tip: number, r = 1.25): Prim => path([[x, 9], [x, tip]], r, 0.3);
      const ice = [
        above(9.6),
        icicle(10.2, 12.2, 1.1),
        icicle(12.6, 14.6),
        icicle(15.2, 12.3),
        icicle(17.8, 15.8, 1.35),
        icicle(20.3, 13),
        icicle(22.3, 11.4, 1),
      ];
      return {
        paints: [
          ...toned("mark", ice, [], 4, 3, 2),
          { mat: "mark2", prims: [poly([[13, 7.4], [15.2, 7.4], [13, 9.8]]), poly([[18.4, 8], [20, 8], [18.4, 10.2]])], level: 4 },
        ],
        decals: [
          ...glyph(13, 22, ["...s...", ".s.s.s.", "..sss..", "sssSsss", "..sss..", ".s.s.s.", "...s..."], {
            s: "mark:2",
            S: "mark:4",
          }),
          ...glyph(9, 16, [".s.", "sSs", ".s."], { s: "mark:3", S: "mark2:4" }),
          ...dots([[21, 17], [11, 20], [22, 25], [20, 21]], "mark:3"),
        ],
      };
    }
    case "moon": {
      // A crescent moon and a scatter of twinkling stars on a night shell.
      const star = (x: number, y: number) => glyph(x, y, [".s.", "sSs", ".s."], { s: "mark:3", S: "mark2:5" });
      return {
        paints: toned("mark", [ell(18.3, 14, 3.6)], [ell(20.3, 12.8, 3)], 4, 3, 2),
        decals: [
          ...star(10, 22),
          ...star(19, 24),
          ...star(20, 8),
          ...dots([[11, 14], [22, 18], [14, 27], [9, 18], [22, 21], [12, 20], [16, 17]], "mark:4"),
        ],
      };
    }
    case "arcane": {
      // A rune circle on the crown and an orbit of runes round the base.
      const orbit = path([[6, 21.4], [10, 23.4], [13, 24.3], [16, 24.6], [19, 24.3], [22, 23.4], [26, 21.4]], 0.62);
      return {
        paints: [
          ...toned("mark", [ell(16, 13, 3.9)], [ell(16, 13, 2.85)]),
          ...toned("mark", [orbit, path([[16, 7.6], [16, 8.6]], 0.6), path([[10.6, 13], [11.4, 13]], 0.6), path([[20.6, 13], [21.4, 13]], 0.6)]),
        ],
        decals: [
          ...glyph(15, 11, [".s", "sS", "Ss", "s."], { s: "mark:3", S: "mark2:4" }),
          ...glyph(10, 25, ["s.s", ".s."], { s: "mark:3" }),
          ...glyph(15, 26, ["ss", "s."], { s: "mark:3" }),
          ...glyph(20, 25, [".s.", "s.s"], { s: "mark:3" }),
        ],
      };
    }
  }
}

// ── tier trim ──

function trimPaints(tier: Tier): Paint[] {
  if (tier === "common") return [];
  if (tier !== "legendary") return toned("band", [path(BAND_LINE, 1.5)]);
  return [
    ...toned("gold", [path(BAND_LINE, 1.5)], [], 5, 4, 2),
    { mat: "gold", prims: [path(BAND_LINE, 0.5)], level: 2 },
    // Crown cap over the tip, its hem dipping into three points.
    ...toned("gold", [
      above(9.3),
      poly([[11, 9], [12.5, 11], [14, 9]]),
      poly([[14.5, 9], [16, 11.6], [17.5, 9]]),
      poly([[18, 9], [19.5, 11], [21, 9]]),
    ], [], 5, 4, 2),
  ];
}

const gemPoly = (r: number): Prim => poly([[16, 20.1 - r], [16 + r, 20.1], [16, 20.1 + r], [16 - r, 20.1]], 0.25);

function trimParts(tier: Tier): Part[] {
  if (tier === "epic") return [{ mat: "gem", prims: [gemPoly(2.1)], glow: true, round: 2 }];
  if (tier === "legendary") return [{ mat: "gem", prims: [gemPoly(2.9)], glow: true, round: 2.6 }];
  return [];
}

function trimDecals(tier: Tier): Decal[] {
  if (tier === "rare") return dots([[10, 19], [21, 19]], "band:5");
  if (tier === "epic") {
    return [...dots([[10, 19], [21, 19]], "band:5"), stamp(15, 19, ["w"], { w: "#ffffff" })];
  }
  if (tier === "legendary") {
    const swag = trace([[9, 22], [10, 23], [11, 24], [12, 24], [13, 23]]);
    const mirror = (px: Px): Px => px.map(([x, y]): V => [31 - x, y]);
    return [
      ...dots(swag, "gold:4"),
      ...dots(mirror(swag), "gold:3"),
      ...dots([[11, 25]], "gold:4"),
      ...dots([[20, 25]], "gold:3"),
      ...dots([[12, 16], [19, 16]], "gold:4"),
      stamp(15, 8, ["gg"], { g: "gem:4" }),
      stamp(14, 18, ["w", ".w"], { w: "#ffffff" }),
      sparkle(3, 7),
      sparkle(25, 3),
      stamp(26, 27, ["s"], { s: "#fff4c2" }, true),
      stamp(5, 25, ["s"], { s: "#fff4c2" }, true),
    ];
  }
  return [];
}

/** Specular cluster on the upper-left: a short streak along the rim and a
 *  glint above it. */
function highlight(el: Element): Decal[] {
  const ink = el === "moon" ? "shell:5" : "#ffffff";
  return [stamp(11, 10, [".h", "h.", "h."], { h: ink }), stamp(13, 8, ["h"], { h: ink })];
}

// ── cracks ──

/** A hairline: a dark line with the lit broken edge just below-right. */
function hairline(pts: V[]): Decal[] {
  const px = trace(pts).filter(([x, y]) => onShell(x, y, 1));
  const key = new Set(px.map(([x, y]) => `${x},${y}`));
  const lip = px.map(([x, y]): V => [x + 1, y]).filter(([x, y]) => !key.has(`${x},${y}`));
  return [...dots(lip, "shell:2", 1), ...dots(px, "shell:0")];
}

const CRACK_MAIN: V[] = [[15, 7], [15, 8], [14, 9], [14, 10], [15, 11], [15, 12], [14, 13], [14, 14], [15, 15]];
const CRACK_BRANCHES: V[][] = [
  [[15, 12], [16, 12], [17, 13], [18, 13], [19, 14]],
  [[14, 9], [13, 10], [12, 10]],
  [[14, 14], [13, 15], [13, 16]],
];

/** Stage 3: the shell splits along a zigzag round the crown and light spills
 *  out of the gap; the upper half's broken edge is dark, the lower half's
 *  lip catches the light. Column by column, so the gap never breaks up. */
function openCrack(): Decal[] {
  //            x: 8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23
  const c = [14, 13, 12, 11, 12, 13, 14, 13, 12, 11, 12, 13, 14, 13, 12, 13];
  const out: Decal[] = [];
  c.forEach((y, i) => {
    const x = 8 + i;
    const top = Math.min(y, c[i - 1] ?? y, c[i + 1] ?? y);
    // Dark broken edge above, light pouring through, a shadowed lip below.
    out.push(...dots([[x, top - 1]], "shell:0"));
    for (let yy = top; yy <= y + 1; yy++) out.push(...dots([[x, yy]], yy === y + 1 ? "#ffc64f" : "#fff5cc"));
    out.push(...dots([[x, y + 2]], "shell:0"));
  });
  // A few white-hot glints deep in the gap.
  out.push(...dots([[11, 11], [17, 11], [21, 13]], "#ffffff"));
  return out;
}

function cracks(stage: number): Decal[] {
  if (stage <= 0) return [];
  if (stage === 1) return hairline(CRACK_MAIN.slice(0, 7));
  if (stage === 2) return [...hairline(CRACK_MAIN), ...CRACK_BRANCHES.flatMap(hairline)];
  return [
    ...openCrack(),
    ...hairline([[12, 16], [12, 17], [11, 18]]),
    ...hairline([[19, 16], [20, 17], [20, 18]]),
  ];
}

// ── public API ──

export function eggPalette(el: Element, tier: Tier): Palette {
  const p = LOOK[el];
  return {
    shell: p.shell,
    mark: p.mark,
    mark2: p.mark2,
    band: p.band,
    gem: tier === "common" || tier === "rare" ? p.band : p.gem,
    gold: GOLD,
  };
}

/** `crack` 0–3: how close to hatching. */
export function drawEgg(el: Element, tier: Tier, crack: number): Sprite {
  const pat = pattern(el);
  const banded = tier !== "common";
  const patDecals = pat.decals.filter((d) => !(banded && inBand(d.x, d.y)));
  const decals: Decal[] = [...patDecals, ...highlight(el), ...trimDecals(tier), ...cracks(Math.min(3, crack))];
  return render(
    {
      parts: [{ mat: "shell", prims: [shellPrim], round: 7, paint: [RIM, ...pat.paints, ...trimPaints(tier)] }, ...trimParts(tier)],
      decals,
    },
    eggPalette(el, tier),
  );
}
