/** Accessories: things a pet can wear, each earned by a reading habit.
 *
 *  They're drawn with the creatures' own rasterizer, in the same pass, so a
 *  hat gets the same puffy shading, hue-shifted outline and separation line
 *  as an ear would — it reads as part of the sprite, not a sticker. Each
 *  design is authored once around an anchor (the top of the skull, the eyes,
 *  the neck — see fit.ts) and sized from the creature's own measurements:
 *  a brim spans the skull it sits on, a scarf the neck it wraps.
 *
 *  Local coordinates: u to the right, v down, origin at the anchor. */

import type { Fit, Nudge } from "./fit.ts";
import type { Decal, Part, Prim, V } from "./pixel.ts";
import { cap, ell, mirror, path, poly, transform } from "./pixel.ts";
import { hexToRgb } from "./color.ts";

export type Slot = "head" | "face" | "neck";
export type AccessoryId =
  | "glasses"
  | "scarf"
  | "nightcap"
  | "sunhat"
  | "flowercrown"
  | "wizardhat"
  | "bowtie"
  | "mortarboard";

export interface Accessory {
  id: AccessoryId;
  name: string;
  slot: Slot;
  /** What earns it, as shown before it's earned. */
  how: string;
  /** One line once it's earned. */
  blurb: string;
  goal: number;
  /** How progress toward `goal` is counted and shown. */
  unit: "min" | "days" | "uses" | "chapters" | "books";
}

export const ACCESSORIES: Accessory[] = [
  {
    id: "glasses", name: "Reading glasses", slot: "face", goal: 45, unit: "min",
    how: "Read at a slow, careful pace",
    blurb: "For the small print. Earned by reading slowly and carefully.",
  },
  {
    id: "scarf", name: "Knit scarf", slot: "neck", goal: 60, unit: "min",
    how: "Read deep into long sittings (past the first 40 minutes)",
    blurb: "Knitted one stitch per page over some very long sittings.",
  },
  {
    id: "nightcap", name: "Nightcap", slot: "head", goal: 60, unit: "min",
    how: "Read late at night, after 9 pm",
    blurb: "For one more chapter before bed. And then one more.",
  },
  {
    id: "sunhat", name: "Sun hat", slot: "head", goal: 90, unit: "min",
    how: "Read in the daytime, 5 am to 5 pm",
    blurb: "Woven for reading in the sun.",
  },
  {
    id: "flowercrown", name: "Flower crown", slot: "head", goal: 7, unit: "days",
    how: "Read at least 10 minutes on different days",
    blurb: "One flower for every day you came back to read.",
  },
  {
    id: "wizardhat", name: "Wizard hat", slot: "head", goal: 40, unit: "uses",
    how: "Use the study tools: highlight, look up, quiz, ask",
    blurb: "Study is its own kind of magic.",
  },
  {
    id: "bowtie", name: "Bow tie", slot: "neck", goal: 5, unit: "chapters",
    how: "Finish chapters",
    blurb: "Dressed for the end of a chapter.",
  },
  {
    id: "mortarboard", name: "Mortarboard", slot: "head", goal: 1, unit: "books",
    how: "Finish a whole book",
    blurb: "Read a whole book, cover to cover.",
  },
];

export const ACCESSORY: Record<AccessoryId, Accessory> = Object.fromEntries(
  ACCESSORIES.map((a) => [a.id, a]),
) as Record<AccessoryId, Accessory>;

export type Wear = Partial<Record<Slot, AccessoryId>>;

/** Accessory materials, merged into the creature's palette at render time.
 *  Prefixed so they never collide with (or get recolored by) a species'
 *  own or shiny palette. */
export const ACC_PALETTE: Record<string, string> = {
  "x-night": "#5b6fd6",
  "x-cuff": "#eef0fb",
  "x-wiz": "#8a62dc",
  "x-gold": "#f2c14e",
  "x-board": "#56608a",
  "x-straw": "#e8c87e",
  "x-ribbon": "#e8607a",
  "x-vine": "#6db85a",
  "x-fl1": "#ff9ec4",
  "x-fl2": "#fff1b0",
  "x-fl3": "#b9a4ff",
  "x-scarf": "#e2583e",
  "x-knit": "#f7e8c6",
  "x-bow": "#4f86e8",
  // Second colorways (Nudge.alt).
  "x-night-alt": "#d65a6e",
  "x-wiz-alt": "#3f9a78",
  "x-scarf-alt": "#3aa6ad",
  "x-bow-alt": "#e04a62",
  "x-ribbon-alt": "#5a8ee8",
  "x-board-alt": "#8a5a3c",
  "x-straw-alt": "#b9875a",
  "x-mustard": "#e9b53d",
};

const ALT: Record<string, string> = {
  "x-night": "x-night-alt",
  "x-wiz": "x-wiz-alt",
  "x-scarf": "x-scarf-alt",
  "x-bow": "x-bow-alt",
  "x-ribbon": "x-ribbon-alt",
  "x-board": "x-board-alt",
  "x-straw": "x-straw-alt",
  "x-fl1": "x-fl3",
  "x-fl3": "x-fl1",
};

const GOLD: Record<string, string> = { "x-scarf": "x-mustard", "x-bow": "x-mustard" };

/** Swap an item to its second (or gold) colorway. */
function alt(m: Made, map: Record<string, string>): Made {
  const mat = (x: string) => map[x] ?? x;
  const ink = (i: string) => {
    const [name, lv] = i.split(":");
    return lv !== undefined && map[name] ? `${map[name]}:${lv}` : i;
  };
  return {
    parts: m.parts.map((p) => ({ ...p, mat: mat(p.mat), paint: p.paint?.map((q) => ({ ...q, mat: mat(q.mat) })) })),
    decals: m.decals.map((d) => ({
      ...d,
      inks: Object.fromEntries(Object.entries(d.inks).map(([k, v]) => [k, ink(v)])),
    })),
  };
}

// Pixel inks used as decals (stars, frames, tassels).
const INK = {
  star: "#ffe38a",
  gold: "x-gold:4",
  goldDark: "x-gold:2",
  eyeFrameDark: "#4a3027",
  eyeFrameLight: "#f2c14e",
  eyeFrameSilver: "#d9e1ec",
  glint: "#e6f7ff",
  flowerHeart: "#ffc94a",
  fringe: "x-knit:3",
};

interface Frame {
  f: (v: V) => V;
  s: number;
  tilt: number;
  flip: boolean;
}

function frameAt(x: number, y: number, tilt: number, n: Nudge | undefined): Frame {
  const t = tilt + (n?.tilt ?? 0);
  const s = n?.s ?? 1;
  const a = (t * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const ox = x + (n?.dx ?? 0);
  const oy = y + (n?.dy ?? 0);
  const flip = !!n?.flip;
  return {
    f: ([u, v]) => {
      const uu = u * s;
      const vv = v * s;
      return [ox + uu * cs - vv * sn, oy + uu * sn + vv * cs];
    },
    s,
    tilt: t,
    flip,
  };
}

function place(fr: Frame, prims: Prim[]): Prim[] {
  return prims.map((p) => transform(fr.flip ? mirror(p, 0) : p, fr.f, fr.s, fr.tilt));
}

function pixelAt(fr: Frame, u: number, v: number): V {
  const [x, y] = fr.f([fr.flip ? -u : u, v]);
  return [Math.floor(x), Math.floor(y)];
}

const dot = (p: V, ink: string, over = false): Decal => ({
  x: p[0], y: p[1], rows: ["o"], inks: { o: ink }, cover: true, over,
});

/** A one-pixel line of decals from a to b (grid points). */
function line(a: V, b: V, ink: string): Decal[] {
  const out: Decal[] = [];
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  const seen = new Set<string>();
  for (let i = 0; i <= n; i++) {
    const p: V = [Math.round(a[0] + ((b[0] - a[0]) * i) / n), Math.round(a[1] + ((b[1] - a[1]) * i) / n)];
    const k = p.join();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(dot(p, ink));
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Everything below local row v — a hat's crown stops at its band or brim
 *  instead of sliding down over the face. */
const below = (v: number) => poly([[-40, v], [40, v], [40, 40], [-40, 40]]);

interface Made {
  parts: Part[];
  decals: Decal[];
}

// ── head ──

function nightcap(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.head;
  const hw = w / 2;
  const k = clamp(w / 12, 0.72, 1.2);
  const fr = frameAt(x, y, tilt, n);
  const tip: V = [6.2 * k, -5.2 * k];
  const cone = path(
    [[0, -0.2], [-0.4 * k, -3.6 * k], [1.2 * k, -6.8 * k], [4 * k, -7.6 * k], tip],
    hw * 0.86,
    0.75,
  );
  return {
    parts: [
      {
        mat: "x-night", prims: place(fr, [cone]), blend: 1.5, cover: true, cut: place(fr, [below(0.6)]),
        paint: [{ mat: "x-night", prims: place(fr, [cap(-hw, -3.2 * k, hw, -3.6 * k, 0.55)]), level: 2 }],
      },
      { mat: "x-cuff", prims: place(fr, [path([[-hw - 0.4, 1.7], [0, 0.4], [hw + 0.4, 1.7]], 1.35 * k)]), cover: true, round: 1.6 },
      { mat: "x-cuff", prims: place(fr, [ell(tip[0] + 0.4 * k, tip[1] + 0.9 * k, 1.55 * k)]), cover: true },
    ],
    decals: [
      dot(pixelAt(fr, -0.6 * k, -2 * k), INK.star),
      dot(pixelAt(fr, 1.8 * k, -5.4 * k), INK.star),
    ],
  };
}

function wizardhat(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.head;
  const hw = w / 2;
  const k = clamp(w / 12, 0.72, 1.2);
  const fr = frameAt(x, y, tilt, n);
  const cone = path([[0, 0], [0.3 * k, -4.6 * k], [1.3 * k, -8.2 * k], [3.6 * k, -10 * k]], hw * 0.74, 0.55);
  const star = pixelAt(fr, 0.2 * k, -4.4 * k);
  const decals: Decal[] = [dot(star, INK.star)];
  if (k >= 0.9) {
    decals.push(dot([star[0] - 1, star[1]], INK.gold), dot([star[0] + 1, star[1]], INK.gold));
    decals.push(dot([star[0], star[1] - 1], INK.gold), dot([star[0], star[1] + 1], INK.gold));
  }
  decals.push(dot(pixelAt(fr, -hw * 0.35, -6.4 * k), INK.star));
  return {
    parts: [
      {
        mat: "x-wiz", prims: place(fr, [cone]), blend: 1.5, cover: true, cut: place(fr, [below(0.8)]),
        paint: [{ mat: "x-gold", prims: place(fr, [cap(-hw, -0.9 * k, hw, -0.9 * k, 0.8 * k)]), level: 3 }],
      },
      { mat: "x-wiz", prims: place(fr, [ell(0, 0.9, hw + 2.6 * k, 1.3 * k)]), cover: true, round: 1.4 },
    ],
    decals,
  };
}

function mortarboard(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.head;
  const hw = w / 2;
  const k = clamp(w / 12, 0.72, 1.2);
  const fr = frameAt(x, y, tilt, n);
  const reach = hw + 2.4 * k;
  const skull = poly([[-hw * 0.78, -1.4 * k], [hw * 0.78, -1.4 * k], [hw * 0.86, 1.4], [-hw * 0.86, 1.4]], 0.5);
  const board = poly([[-reach, -2.2 * k], [0, -4 * k], [reach, -2.2 * k], [0, -0.5 * k]], 0.35);
  // Tassel: from the button to the right corner, then hanging down.
  const button = pixelAt(fr, 0, -2.3 * k);
  const corner = pixelAt(fr, reach - 1.2 * k, -2 * k);
  const end = pixelAt(fr, reach - 1.1 * k, 2.4 * k);
  const decals: Decal[] = [
    ...line(button, corner, INK.gold),
    ...line([corner[0], corner[1] + 1], end, INK.gold),
    dot([end[0], end[1] + 1], INK.goldDark),
    dot([end[0] - 1, end[1] + 1], INK.gold),
    dot([end[0] - 1, end[1]], INK.gold),
    dot(button, INK.star),
  ];
  decals.forEach((d) => (d.over = true));
  return {
    parts: [
      {
        mat: "x-board", prims: place(fr, [skull]), cover: true,
        paint: [{ mat: "x-board", prims: place(fr, [skull]), level: 2 }],
      },
      // A flat board seen from just above: a lit top, a dark front edge.
      {
        mat: "x-board", prims: place(fr, [board]), cover: true, blend: 0,
        paint: [
          { mat: "x-board", prims: place(fr, [board]), level: 4 },
          {
            mat: "x-board", level: 1,
            prims: place(fr, [path([[-reach + 0.6, -1.9 * k], [0, -0.1 * k], [reach - 0.6, -1.9 * k]], 0.55)]),
          },
        ],
      },
    ],
    decals,
  };
}

function sunhat(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.head;
  const hw = w / 2;
  const k = clamp(w / 12, 0.72, 1.2);
  const fr = frameAt(x, y, tilt, n);
  const crownR = Math.max(3, hw * 0.8);
  return {
    parts: [
      {
        mat: "x-straw", prims: place(fr, [ell(0, -0.8 * k, crownR, 3 * k)]), cover: true,
        cut: place(fr, [poly([[-20, 1.2], [20, 1.2], [20, 20], [-20, 20]])]),
        paint: [{ mat: "x-ribbon", prims: place(fr, [cap(-crownR - 1, 0.1, crownR + 1, 0.1, 0.9 * k)]) }],
      },
      { mat: "x-straw", prims: place(fr, [ell(0, 1.3, hw + 3.4 * k, 1.5 * k)]), cover: true, round: 1.5 },
      { mat: "x-fl1", prims: place(fr, [ell(crownR * 0.72, -0.5 * k, 1.2 * k)]), cover: true },
    ],
    decals: [dot(pixelAt(fr, crownR * 0.72, -0.5 * k), INK.flowerHeart)],
  };
}

function flowercrown(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.head;
  const hw = w / 2;
  const k = clamp(w / 12, 0.72, 1.15);
  const fr = frameAt(x, y, tilt, n);
  // Along the curve of the skull top, a little down the sides.
  const at = (t: number): V => [t * (hw + 0.3), 0.9 + Math.pow(Math.abs(t), 2.2) * 1.8];
  const mats = ["x-fl1", "x-fl2", "x-fl3", "x-fl2", "x-fl1"];
  const wide = hw >= 6.5;
  const order = wide ? [0, 1, 2, 3, 4] : [0, 2, 4];
  const ts = wide ? [-0.95, -0.48, 0, 0.48, 0.95] : [-0.78, 0, 0.78];
  const parts: Part[] = [
    {
      mat: "x-vine", cover: true, line: false,
      prims: place(fr, [path([-1.05, -0.6, 0, 0.6, 1.05].map(at), 0.75)]),
    },
  ];
  const decals: Decal[] = [];
  ts.forEach((t, i) => {
    const c = at(t);
    const r = (i === Math.floor(ts.length / 2) ? 1.75 : 1.5) * k;
    parts.push({ mat: mats[order[i]], prims: place(fr, [ell(c[0], c[1] - 0.2, r)]), cover: true, blend: 0 });
    decals.push(dot(pixelAt(fr, c[0], c[1] - 0.2), INK.flowerHeart));
  });
  return { parts, decals };
}

// ── neck ──

function scarf(fit: Fit, n?: Nudge): Made {
  const { x, y, w, tilt } = fit.neck;
  const hn = w / 2;
  const k = clamp(w / 12, 0.75, 1.15);
  const fr = frameAt(x, y, tilt, n);
  // A plain wrap hugging the neck, and one striped tail hanging in front.
  const band = path([[-hn + 0.9, -0.4], [0, 0.5], [hn - 0.9, -0.4]], 1.4 * k);
  const tx = hn * 0.34;
  // The tail hangs to just above the ground line (y ≈ 30), never past it;
  // a chin resting on the ground leaves no room, and the wrap goes alone.
  const room = 29.2 - y - 1.4 * k;
  const len = Math.min(5.2 * k, room);
  const band0 = { mat: "x-scarf", prims: place(fr, [band]), cover: true, round: 1.3 };
  if (len < 2.4) return { parts: [band0], decals: [] };
  const tail = path([[tx, 0.6], [tx + 0.4 * k, len * 0.55], [tx + 0.8 * k, len]], 1.25 * k, 1.15 * k);
  const stripe = (v: number) => cap(tx - 3, v, tx + 4, v, 0.5);
  const end = pixelAt(fr, tx + 0.8 * k, len + 1.4 * k);
  return {
    parts: [
      band0,
      {
        mat: "x-scarf", prims: place(fr, [tail]), cover: true, round: 1.2,
        paint: [{ mat: "x-knit", prims: place(fr, [stripe(len * 0.42), stripe(len * 0.78)]), level: 4 }],
      },
    ],
    decals: [
      { ...dot([end[0] - 1, end[1]], INK.fringe, true), rows: ["o.o"] },
    ],
  };
}

/** Hand-placed pixels, not shapes: at 5–9 px wide a bow tie is all
 *  silhouette, and only an exact pinch at the knot reads as a bow. */
const BOWTIES = [
  ["BB.BB", "BBKBB", "DD.DD"],
  ["BB...BB", "BHB.BHB", "BBBKBBB", "DBB.BBD", "DD...DD"],
  ["BB.....BB", "BHBB.BBHB", "BBBBKBBBB", "DBBB.BBBD", "DD.....DD"],
];

function bowtie(fit: Fit, n?: Nudge): Made {
  const w = fit.neck.w * (n?.s ?? 1);
  const rows = BOWTIES[w < 10 ? 0 : w < 15 ? 1 : 2];
  const x = Math.round(fit.neck.x - rows[0].length / 2 + (n?.dx ?? 0));
  const y = Math.round(fit.neck.y - rows.length / 2 + (n?.dy ?? 0));
  return {
    parts: [],
    decals: [{ x, y, rows, inks: { B: "x-bow:3", H: "x-bow:4", D: "x-bow:2", K: "x-bow:1" }, cover: true }],
  };
}

// ── face ──

/** Round frames around each eye, measured from the eye decals: a pixel of
 *  lens around the eye when there's room, a bridge between, a glint. The
 *  frame is dark on light creatures and gold on dark ones. */
function glasses(fit: Fit, n: Nudge | undefined, skin: string): Made {
  const { l, r, w, h } = fit.eyes;
  const dx = n?.dx ?? 0;
  const dy = n?.dy ?? 0;
  const gap = r[0] - (l[0] + w);
  // A pixel of lens around each eye where there's room; on the nose side
  // only if the bridge still gets a pixel of its own.
  const m = gap >= 2 ? 1 : 0;
  const mi = gap >= 6 ? 1 : 0;
  const [cr, cg, cb] = hexToRgb(skin);
  const light = 0.299 * cr + 0.587 * cg + 0.114 * cb > 150;
  const frame = n?.frame ?? (light ? "dark" : "gold");
  const ink = frame === "dark" ? INK.eyeFrameDark : frame === "silver" ? INK.eyeFrameSilver : INK.eyeFrameLight;
  const decals: Decal[] = [];
  const ring = (ex: number, ey: number, left: boolean) => {
    // Eyes 2px apart: the rims would stand side by side as a thick bar, so
    // the right lens reaches over and they share one.
    const ml = left ? m : gap === 2 ? 1 : mi;
    const mr = left ? mi : m;
    const x0 = ex - 1 - ml + dx;
    const y0 = ey - 1 - m + dy;
    const W = w + 2 + ml + mr;
    const H = h + 2 + 2 * m;
    const rows: string[] = [];
    for (let j = 0; j < H; j++) {
      let row = "";
      for (let i = 0; i < W; i++) {
        const edgeX = i === 0 || i === W - 1;
        const edgeY = j === 0 || j === H - 1;
        row += edgeX && edgeY && W > 4 ? "." : edgeX || edgeY ? "f" : ".";
      }
      rows.push(row);
    }
    // A glint in the lens's upper corner, away from the eye's own highlight.
    if (m && W > 4) {
      const gx = left ? W - 2 : W - 2;
      rows[1] = rows[1].slice(0, gx) + "g" + rows[1].slice(gx + 1);
    }
    decals.push({ x: x0, y: y0, rows, inks: { f: ink, g: INK.glint }, cover: true });
    return { x0, y0, W, H };
  };
  const a = ring(l[0], l[1], true);
  const b = ring(r[0], r[1], false);
  // Bridge across the nose, then short temples toward the ears.
  const by = a.y0 + 1;
  if (b.x0 > a.x0 + a.W) decals.push(...line([a.x0 + a.W, by], [b.x0 - 1, by], ink));
  decals.push(dot([a.x0 - 1, by], ink), dot([b.x0 + b.W, by], ink));
  return { parts: [], decals };
}

/** Everything worn, in draw order (neck under face under head), in the
 *  creature's 32×32 space. `skin` is the head's base color. */
export function wearDrawing(fit: Fit & { item: Record<string, Nudge> }, wear: Wear, skin: string): Made {
  const out: Made = { parts: [], decals: [] };
  const add = (m: Made) => {
    out.parts.push(...m.parts);
    out.decals.push(...m.decals);
  };
  const MAKERS: Record<AccessoryId, (f: Fit, n?: Nudge) => Made> = {
    scarf, bowtie, nightcap, wizardhat, mortarboard, sunhat, flowercrown,
    glasses: (f, n) => glasses(f, n, skin),
  };
  for (const slot of ["neck", "face", "head"] as Slot[]) {
    const id = wear[slot];
    if (!id) continue;
    const n = fit.item[id];
    const made = MAKERS[id](fit, n);
    add(n?.alt ? alt(made, n.alt === "gold" ? GOLD : ALT) : made);
  }
  return out;
}
