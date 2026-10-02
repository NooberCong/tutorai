/** The sunlit glade's wildlife, over its reader backdrop (ambience.ts):
 *  butterflies wandering the undergrowth and settling on its wildflowers,
 *  and now and then a songbird — a robin, a blue tit or a goldfinch —
 *  dropping in to sit on a bush or hop about the grass, then flying off.
 *
 *  They keep to the strips beside the pages, where the glade is seen; birds
 *  come in and leave past the outer edges or from behind the pages. What
 *  rests on a plant rides its sway (gladeSway), so it stays put on what it
 *  sits on. Everything is drawn in the painting's 1600×1000 scene space and
 *  lit like it, the sun high in the middle. It stays cheap: a handful of
 *  creatures, their wings and bodies painted once per species and stamped. */

import type { Layer } from "./ambience.ts";
import { GLADE_FLOWERS, GROUND_SWAY, UNDERGROWTH_SWAY, gladeGround, rng } from "./backdrops.ts";
import { gladeSway } from "./living.ts";

type Ctx = OffscreenCanvasRenderingContext2D;
type Rng = () => number;
type Point = [x: number, y: number];

const TAU = Math.PI * 2;
/** The glade's two seen strips, beside the pages. */
const SIDES: readonly Point[] = [[15, 405], [1195, 1585]];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (k: number) => k * k * (3 - 2 * k);
const between = (r: Rng, lo: number, hi: number) => lo + r() * (hi - lo);
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

// ── butterflies ──

interface ButterflyKind {
  /** Half the wingspan, in scene px. */
  half: number;
  /** Wingbeats a second; cruising speed; chance a second of gliding on
   *  open wings. */
  beat: number;
  speed: number;
  glide: number;
  body: string;
  /** Paints the right pair of wings, upper side, in wing units: the body
   *  runs down x = 0 and the forewing's tip is near (1, -0.8). */
  paint(c: Ctx): void;
}

/** The forewing's outline: from the shoulder up the leading edge to the
 *  tip, down the outer edge to the trailing corner, and back. */
function forewing(c: Ctx, tip: Point, corner: Point, hook = 0) {
  c.beginPath();
  c.moveTo(0.05, -0.1);
  c.bezierCurveTo(0.22, -0.52, 0.55 - hook, -0.86, tip[0], tip[1]);
  c.bezierCurveTo(tip[0] + 0.06 - hook * 1.5, tip[1] + 0.32, corner[0] + 0.08, corner[1] - 0.16, corner[0], corner[1]);
  c.quadraticCurveTo(corner[0] * 0.5, 0.05, 0.05, 0.04);
  c.closePath();
}

/** The hindwing's outline: out along its front edge, round its outer edge
 *  to `reach`, and back to the body. `point` sharpens its outer corner. */
function hindwing(c: Ctx, reach: Point, point = 0) {
  const [rx, ry] = reach;
  c.beginPath();
  c.moveTo(0.05, -0.04);
  c.bezierCurveTo(0.34, -0.14, rx + 0.08, -0.08, rx + point * 0.12, ry * 0.42);
  c.bezierCurveTo(rx - point * 0.1, ry * 0.86, rx * 0.72, ry * 1.04, rx * 0.42, ry);
  c.quadraticCurveTo(0.14, ry * 0.86, 0.05, 0.18);
  c.closePath();
}

/** Fill the current wing outline, then paint `inside` clipped to it, and
 *  draw its veins and edge. */
function wing(c: Ctx, fill: string | CanvasGradient, inside: () => void, veins: Point[], edge = "rgba(40,32,24,0.45)") {
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.clip();
  inside();
  c.strokeStyle = "rgba(30,24,16,0.16)";
  c.lineWidth = 0.018;
  for (const [x, y] of veins) {
    c.beginPath();
    c.moveTo(0.06, 0);
    c.quadraticCurveTo(x * 0.5, y * 0.35, x, y);
    c.stroke();
  }
  c.restore();
  c.strokeStyle = edge;
  c.lineWidth = 0.03;
  c.stroke();
}

const FORE_VEINS: Point[] = [[0.98, -0.78], [1.02, -0.56], [0.98, -0.36], [0.88, -0.16]];
const HIND_VEINS: Point[] = [[0.8, 0.18], [0.74, 0.42], [0.56, 0.62]];

function radial(c: Ctx, r: number, stops: [number, string][]) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
}

function spot(c: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}

/** A soft patch: a radial fade from `color` at its centre. */
function haze(c: Ctx, x: number, y: number, r: number, color: string, to: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, to);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export const BUTTERFLIES: Record<string, ButterflyKind> = {
  // small white: creamy, grey-black tips, a black spot or two
  white: {
    half: 11,
    beat: 4.2,
    speed: 44,
    glide: 0.05,
    body: "#3a3a36",
    paint(c) {
      hindwing(c, [0.78, 0.64]);
      wing(c, radial(c, 0.8, [[0, "#e9e6cf"], [0.5, "#f6f3e4"], [1, "#f3efdc"]]), () => {
        haze(c, 0, 0.05, 0.32, "rgba(80,82,78,0.5)", "rgba(80,82,78,0)");
      }, HIND_VEINS);
      forewing(c, [0.98, -0.8], [0.8, -0.08]);
      wing(c, radial(c, 0.9, [[0, "#ecebe0"], [0.4, "#f8f6ec"], [1, "#f4f1e3"]]), () => {
        haze(c, 1, -0.84, 0.36, "rgba(48,48,46,0.95)", "rgba(48,48,46,0)");
        haze(c, 0, -0.04, 0.3, "rgba(80,82,78,0.5)", "rgba(80,82,78,0)");
        spot(c, 0.6, -0.4, 0.075, 0.075, "#3c3c38");
      }, FORE_VEINS);
    },
  },
  // brimstone: sulphur yellow, leaf-shaped hooked wings, an orange dot each
  brimstone: {
    half: 13,
    beat: 3.6,
    speed: 50,
    glide: 0.18,
    body: "#4a4a2a",
    paint(c) {
      hindwing(c, [0.8, 0.66], 1);
      wing(c, radial(c, 0.85, [[0, "#d6d64a"], [0.45, "#f2e258"], [1, "#efdc4c"]]), () => {
        spot(c, 0.46, 0.3, 0.05, 0.05, "#e2862c");
      }, HIND_VEINS, "rgba(150,120,30,0.5)");
      forewing(c, [1.02, -0.8], [0.8, -0.08], 0.12);
      wing(c, radial(c, 0.95, [[0, "#d9da4e"], [0.4, "#f4e45c"], [1, "#f1de50"]]), () => {
        spot(c, 0.52, -0.36, 0.05, 0.05, "#e2862c");
      }, FORE_VEINS, "rgba(150,120,30,0.5)");
    },
  },
  // common blue: violet-blue, a dark rim and a white fringe
  blue: {
    half: 8.5,
    beat: 4.8,
    speed: 40,
    glide: 0.04,
    body: "#2e3048",
    paint(c) {
      const rim = () => {
        c.strokeStyle = "#2a2e58";
        c.lineWidth = 0.09;
        c.stroke();
      };
      hindwing(c, [0.76, 0.62]);
      wing(c, radial(c, 0.8, [[0, "#5866c8"], [0.55, "#7c8cee"], [1, "#8d9cf2"]]), rim, HIND_VEINS, "#f4f4fb");
      forewing(c, [0.96, -0.8], [0.8, -0.1]);
      wing(c, radial(c, 0.95, [[0, "#5a68cc"], [0.5, "#8090f0"], [1, "#94a2f4"]]), rim, FORE_VEINS, "#f4f4fb");
    },
  },
  // peacock: rich red, an eyespot on every wing
  peacock: {
    half: 14,
    beat: 3.2,
    speed: 52,
    glide: 0.28,
    body: "#2a1a16",
    paint(c) {
      const border = () => {
        c.strokeStyle = "rgba(46,30,26,0.85)";
        c.lineWidth = 0.12;
        c.stroke();
      };
      hindwing(c, [0.8, 0.68]);
      wing(c, radial(c, 0.85, [[0, "#3a1c16"], [0.3, "#7a2a1e"], [0.6, "#b23a26"], [1, "#a63422"]]), () => {
        border();
        spot(c, 0.5, 0.4, 0.2, 0.18, "#1c1418");
        spot(c, 0.5, 0.4, 0.13, 0.12, "#3e5cae");
        spot(c, 0.5, 0.4, 0.07, 0.065, "#141018");
        spot(c, 0.47, 0.36, 0.025, 0.025, "#dfe6ff");
      }, HIND_VEINS);
      forewing(c, [0.98, -0.8], [0.8, -0.1]);
      wing(c, radial(c, 0.95, [[0, "#3a1c16"], [0.28, "#8a2e20"], [0.55, "#c2442a"], [1, "#b83e28"]]), () => {
        border();
        spot(c, 0.72, -0.6, 0.21, 0.17, "#f0d488");
        spot(c, 0.72, -0.6, 0.15, 0.12, "#4a6ec4");
        spot(c, 0.72, -0.6, 0.08, 0.065, "#1c1620");
        spot(c, 0.42, -0.5, 0.06, 0.1, "#20181a");
        spot(c, 0.68, -0.64, 0.03, 0.025, "#f4f0ff");
      }, FORE_VEINS);
    },
  },
};

/** Sprite px per scene px for what's painted once and stamped: the
 *  ambience canvas is in CSS px, where a scene px is about one. */
const RES = 2;
/** The wing sprite's box, in wing units. */
const BOX = { x0: -0.05, x1: 1.15, y0: -1.0, y1: 0.86 };
const wingSprites = new Map<ButterflyKind, OffscreenCanvas>();
function wingSprite(k: ButterflyKind): OffscreenCanvas {
  let s = wingSprites.get(k);
  if (!s) {
    const px = k.half * RES;
    s = new OffscreenCanvas(Math.ceil((BOX.x1 - BOX.x0) * px), Math.ceil((BOX.y1 - BOX.y0) * px));
    const c = s.getContext("2d")!;
    c.setTransform(px, 0, 0, px, -BOX.x0 * px, -BOX.y0 * px);
    k.paint(c);
    wingSprites.set(k, s);
  }
  return s;
}

interface Flower {
  x: number;
  y: number;
  taken: boolean;
}

interface Butterfly {
  kind: ButterflyKind;
  side: Point;
  flowers: Flower[];
  x: number;
  y: number;
  /** Direction of flight, radians; across-the-scene speed, for the lean. */
  heading: number;
  vx: number;
  mode: "fly" | "settle" | "rest";
  /** When the current flight or rest ends. */
  until: number;
  aim: Point;
  flower: Flower | null;
  /** Wingbeat phase; seconds left gliding; how open the wings are, 0…1. */
  beat: number;
  gliding: number;
  open: number;
  /** Lean of the body, radians (0 = head up). */
  lean: number;
  ph: number;
}

/** Fliers keep to the undergrowth and the air just over it. */
const AIR_TOP = 620;
const AIR_BOTTOM = 965;

function newAim(b: Butterfly, r: Rng): Point {
  return [between(r, b.side[0], b.side[1]), between(r, AIR_TOP, AIR_BOTTOM)];
}

/** Butterflies, two to a side: they wander the undergrowth in loose,
 *  bobbing flight, now and then settle on a wildflower and bask, wings
 *  slowly opening and closing, then lift off again. */
export function butterflies(seed: number): Layer {
  const r = rng(seed);
  const kinds = [BUTTERFLIES.white, BUTTERFLIES.peacock, BUTTERFLIES.brimstone, BUTTERFLIES.blue];
  const flock: Butterfly[] = kinds.map((kind, i) => {
    const side = SIDES[i % 2];
    // it settles on top of a bloom
    const flowers = GLADE_FLOWERS.filter((f) => f.x > side[0] && f.x < side[1] && f.y < 975).map((f) => ({ x: f.x, y: f.y - f.r * 0.3, taken: false }));
    const b: Butterfly = {
      kind, side, flowers, x: 0, y: 0, heading: r() * TAU, vx: 0, mode: "fly", until: between(r, 3, 12), aim: [0, 0], flower: null,
      beat: r() * TAU, gliding: 0, open: 1, lean: 0, ph: r() * TAU,
    };
    [b.x, b.y] = newAim(b, r);
    b.aim = newAim(b, r);
    return b;
  });

  /** Steer by turning: drawn toward the aim, but wandering on its own
   *  meanwhile, so the flight curves and loops rather than running straight.
   *  Settling, it homes in. Returns the distance left to the aim. */
  const fly = (b: Butterfly, dt: number, t: number, aim: Point, speed: number) => {
    const dx = aim[0] - b.x;
    const dy = aim[1] - b.y;
    const off = Math.atan2(dy, dx) - b.heading;
    const turn = Math.atan2(Math.sin(off), Math.cos(off));
    const homing = b.mode === "settle";
    const wander = homing ? 0 : 1.5 * Math.sin(t * 0.7 + b.ph) + Math.sin(t * 1.9 + b.ph * 2.3);
    b.heading += (clamp(turn, -1.2, 1.2) * (homing ? 5 : 1.1) + wander) * dt;
    b.vx = Math.cos(b.heading) * speed;
    b.x += b.vx * dt;
    b.y += Math.sin(b.heading) * speed * dt;
    return Math.hypot(dx, dy);
  };

  return {
    update(dt, t) {
      for (const b of flock) {
        const { kind } = b;
        if (b.mode === "rest") {
          const f = b.flower!;
          const [sx, sy] = gladeSway(f.x, f.y, t, UNDERGROWTH_SWAY);
          b.x = f.x + sx;
          b.y = f.y + sy;
          // basking: wings open and fold slowly, now and then a flutter
          const bask = smooth(0.5 + 0.5 * Math.sin(t * 0.55 + b.ph));
          const flutter = Math.max(0, Math.sin(t * 0.23 + b.ph * 3)) ** 40;
          b.open = 0.1 + 0.85 * bask - flutter * 0.6 * (0.5 + 0.5 * Math.sin(t * TAU * kind.beat));
          // each sits at a slant of its own
          b.lean += (Math.sin(b.ph * 5) * 0.25 - b.lean) * Math.min(1, dt * 3);
          if (t > b.until) {
            f.taken = false;
            b.flower = null;
            b.mode = "fly";
            b.until = t + between(r, 7, 16);
            b.aim = newAim(b, r);
            b.heading = -Math.PI / 2 + between(r, -0.7, 0.7);
          }
          continue;
        }

        if (b.mode === "settle") {
          const f = b.flower!;
          const [sx, sy] = gladeSway(f.x, f.y, t, UNDERGROWTH_SWAY);
          const aim: Point = [f.x + sx, f.y + sy];
          const d = Math.hypot(aim[0] - b.x, aim[1] - b.y);
          if (d > 12) fly(b, dt, t, aim, Math.min(kind.speed, 10 + d * 1.2));
          else {
            // the last few px straight in, slowing to a touch
            const k = Math.min(1, dt * 4);
            b.vx = (aim[0] - b.x) * 4;
            b.x += (aim[0] - b.x) * k;
            b.y += (aim[1] - b.y) * k;
          }
          if (d < 1.5) {
            b.mode = "rest";
            b.until = t + between(r, 5, 13);
          }
        } else {
          const d = fly(b, dt, t, b.aim, kind.speed);
          if (d < 25 || b.x < b.side[0] - 30 || b.x > b.side[1] + 30) b.aim = newAim(b, r);
          if (t > b.until) {
            const free = b.flowers.filter((f) => !f.taken);
            if (free.length) {
              b.flower = pick(r, free);
              b.flower.taken = true;
              b.mode = "settle";
            } else b.until = t + 4;
          }
        }

        // wingbeats, or a glide on open wings; settling, the beat quickens
        // and shallows
        if (b.gliding > 0) {
          b.gliding -= dt;
          b.open += (1 - b.open) * Math.min(1, dt * 10);
          b.beat = 0;
        } else {
          b.beat += TAU * kind.beat * (b.mode === "settle" ? 1.4 : 1) * dt;
          const depth = b.mode === "settle" ? 0.55 : 0.88;
          b.open = 1 - depth * (0.5 - 0.5 * Math.cos(b.beat));
          if (b.beat > TAU) {
            b.beat -= TAU;
            if (b.mode === "fly" && r() < kind.glide) b.gliding = between(r, 0.3, 0.8);
          }
        }
        b.lean += (clamp(b.vx / 70, -0.6, 0.6) - b.lean) * Math.min(1, dt * 4);
      }
    },
    draw(c, _t, x0, x1) {
      for (const b of flock) {
        const { kind } = b;
        if (b.x + kind.half < x0 || b.x - kind.half > x1) continue;
        // each downstroke lifts the body a little
        const bob = b.mode === "rest" ? 0 : -1.6 * Math.sin(b.beat);
        c.save();
        c.translate(b.x, b.y + bob);
        c.rotate(b.lean);
        drawButterfly(c, kind, b.open);
        c.restore();
      }
    },
  };
}

/** A butterfly seen from above, head up, its middle at the origin; `open`
 *  is how far its wings are spread, 1 flat … 0 shut above its back. */
export function drawButterfly(c: Ctx, k: ButterflyKind, open: number) {
  const img = wingSprite(k);
  const h = k.half;
  for (const dir of [1, -1]) {
    c.save();
    c.scale(dir * Math.max(0.06, open), 1);
    c.drawImage(img, BOX.x0 * h, BOX.y0 * h, (BOX.x1 - BOX.x0) * h, (BOX.y1 - BOX.y0) * h);
    c.restore();
  }
  // body, head and antennae
  c.fillStyle = k.body;
  c.beginPath();
  c.ellipse(0, h * 0.12, h * 0.07, h * 0.42, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(0, -h * 0.3, h * 0.085, 0, TAU);
  c.fill();
  c.strokeStyle = k.body;
  c.lineWidth = Math.max(0.5, h * 0.035);
  c.lineCap = "round";
  for (const dir of [1, -1]) {
    c.beginPath();
    c.moveTo(0, -h * 0.34);
    c.quadraticCurveTo(dir * h * 0.08, -h * 0.6, dir * h * 0.2, -h * 0.74);
    c.stroke();
    c.beginPath();
    c.arc(dir * h * 0.2, -h * 0.74, h * 0.04, 0, TAU);
    c.fill();
  }
}

// ── songbirds ──

interface BirdKind {
  /** Scale against the robin, whose drawing is in px: about 23 long. */
  size: number;
  back: string;
  wing: string;
  tail: string;
  beak: string;
  legs: string;
  /** Plumage over the back colour, clipped to the body. */
  paint(c: Ctx): void;
  /** Feather edging on the folded wing; a wing bar, if it has one. */
  edge: string;
  bar?: string;
  /** White spots at the tail's tip. */
  tailTips?: string;
  /** Bobs and flicks its tail between moves (robins do). */
  bobs: boolean;
  /** Chance it forages on the grass rather than sitting on a bush. */
  ground: number;
}

export const BIRDS: Record<string, BirdKind> = {
  // robin: olive-brown, an orange face and breast edged in grey
  robin: {
    size: 0.95,
    back: "#857052",
    wing: "#76613f",
    tail: "#6e5a3c",
    beak: "#2a2420",
    legs: "#8c6c52",
    edge: "rgba(200,180,140,0.45)",
    bobs: true,
    ground: 0.6,
    paint(c) {
      spot(c, 0.5, -5, 6.4, 2.8, "#ece2d0");
      spot(c, 5.4, -11.2, 5.4, 5.6, "#a9aaa6");
      spot(c, 5.9, -11.4, 4.6, 5, "#df6f38");
    },
  },
  // blue tit: blue cap, white face, black eye-stripe, yellow below
  bluetit: {
    size: 0.82,
    back: "#8fa250",
    wing: "#5584c4",
    tail: "#4a78bc",
    beak: "#24262c",
    legs: "#6a7486",
    edge: "rgba(210,230,255,0.4)",
    bar: "#eef4fa",
    bobs: false,
    ground: 0.35,
    paint(c) {
      spot(c, 2.4, -8, 5.6, 4.6, "#efcf42");
      spot(c, 4.6, -14.6, 3.4, 2.5, "#f4f3ee");
      spot(c, 3.6, -17.2, 3.3, 1.5, "#3d86d6");
      c.strokeStyle = "#1e2430";
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(7.8, -15.2);
      c.lineTo(1.2, -15);
      c.stroke();
      spot(c, 6.6, -12.5, 1.1, 1.3, "#1e2430");
    },
  },
  // goldfinch: red face, black-and-white head, a gold bar on black wings
  goldfinch: {
    size: 0.86,
    back: "#b08e66",
    wing: "#22201e",
    tail: "#22201e",
    beak: "#e8cbb4",
    legs: "#b89a8a",
    edge: "rgba(240,240,236,0.5)",
    bar: "#f2cb24",
    tailTips: "#f4f2ec",
    bobs: false,
    ground: 0.3,
    paint(c) {
      spot(c, 1.8, -7.4, 6, 4, "#efe5d6");
      spot(c, 2.6, -16, 3, 1.9, "#1e1c1c");
      spot(c, 4.4, -14.2, 2.6, 2, "#f3f0ea");
      spot(c, 6.9, -15, 1.8, 1.7, "#cf3328");
    },
  },
};

/** The body's outline, facing right, feet at the origin. */
function silhouette(c: Ctx) {
  c.beginPath();
  c.moveTo(7.8, -15.4);
  c.quadraticCurveTo(7.1, -17.5, 4.2, -17.8);
  c.quadraticCurveTo(1.5, -17.7, 0.8, -15.4);
  c.quadraticCurveTo(-3.2, -13.4, -6.6, -8.6);
  c.quadraticCurveTo(-6.9, -6.5, -5.1, -5.5);
  c.quadraticCurveTo(-2, -3.6, 2, -4.3);
  c.quadraticCurveTo(6.6, -6, 7.3, -10.5);
  c.quadraticCurveTo(7.9, -13, 7.8, -15.4);
  c.closePath();
}

export interface BirdPose {
  /** Lean forward (+) or back (−), radians, about the hip. */
  tilt: number;
  /** Tail angle off its rest: up is negative. */
  tail: number;
  /** Beak open, 0…1. */
  beak: number;
  /** null with wings folded; else the wing's sweep, 0 up … 1 down. */
  wing: number | null;
  legs: boolean;
}

/** A songbird in profile facing right, its feet at the origin, in robin
 *  px (scale by its kind's size). */
export function drawBird(c: Ctx, k: BirdKind, p: BirdPose) {
  // legs stay planted; the body leans about the hip
  if (p.legs) {
    c.strokeStyle = k.legs;
    c.lineWidth = 0.75;
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const x of [-0.4, 1.2]) {
      c.beginPath();
      c.moveTo(x, -4.8);
      c.lineTo(x - 0.3, 0);
      c.lineTo(x + 1.7, 0.1);
      c.stroke();
    }
  }
  c.save();
  c.translate(0.4, -4.8);
  c.rotate(p.tilt);
  c.translate(-0.4, 4.8);
  if (p.wing !== null) openWing(c, p.wing, k.wing, true);
  // tail, fanned a little at its tip
  c.save();
  c.translate(-5.6, -7.4);
  c.rotate(p.tail);
  c.fillStyle = k.tail;
  c.beginPath();
  c.moveTo(0.3, -1.3);
  c.lineTo(-5.8, 0.9);
  c.quadraticCurveTo(-6.7, 2.5, -5.6, 3.2);
  c.lineTo(0.5, 1.3);
  c.closePath();
  c.fill();
  if (k.tailTips) {
    spot(c, -5.7, 1.5, 0.75, 0.5, k.tailTips);
    spot(c, -5.5, 2.7, 0.75, 0.5, k.tailTips);
  }
  c.restore();
  // beak: the lower half drops as it sings
  c.fillStyle = k.beak;
  c.beginPath();
  c.moveTo(7.4, -15.9);
  c.lineTo(10.3, -15.1);
  c.lineTo(7.6, -14.5);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(7.6, -14.6);
  c.lineTo(9.9, -14.8 + p.beak * 1.6);
  c.lineTo(7.4, -13.9);
  c.closePath();
  c.fill();
  const { x0, y0, x1, y1 } = BODY_BOX;
  c.drawImage(bodySprite(k), x0, y0, x1 - x0, y1 - y0);
  if (p.wing === null) foldedWing(c, k);
  else openWing(c, p.wing, k.wing, false);
  c.restore();
}

/** The body's box, in robin px, with room for its outline. */
const BODY_BOX = { x0: -8, y0: -19, x1: 9, y1: -3 };
const bodySprites = new Map<BirdKind, OffscreenCanvas>();
/** The body, its plumage, the light on it from the sun overhead, and its
 *  eye with a glint of the sky: painted once per kind. */
function bodySprite(k: BirdKind): OffscreenCanvas {
  let s = bodySprites.get(k);
  if (!s) {
    const { x0, y0, x1, y1 } = BODY_BOX;
    const px = RES;
    s = new OffscreenCanvas((x1 - x0) * px, (y1 - y0) * px);
    const c = s.getContext("2d")!;
    c.setTransform(px, 0, 0, px, -x0 * px, -y0 * px);
    silhouette(c);
    c.fillStyle = k.back;
    c.fill();
    c.save();
    c.clip();
    k.paint(c);
    const g = c.createLinearGradient(0, -18, 0, -4);
    g.addColorStop(0, "rgba(255,248,215,0.22)");
    g.addColorStop(0.45, "rgba(255,248,215,0)");
    g.addColorStop(1, "rgba(20,28,10,0.28)");
    c.fillStyle = g;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.restore();
    silhouette(c);
    c.strokeStyle = "rgba(28,30,20,0.4)";
    c.lineWidth = 0.5;
    c.stroke();
    spot(c, 5.3, -14.9, 1.05, 1.05, "#121212");
    spot(c, 5.6, -15.25, 0.35, 0.35, "#f4f2e6");
    bodySprites.set(k, s);
  }
  return s;
}

/** The wing at rest along the bird's side, its tips over the rump. */
function foldedWing(c: Ctx, k: BirdKind) {
  c.fillStyle = k.wing;
  c.beginPath();
  c.moveTo(4.2, -12.6);
  c.quadraticCurveTo(0, -14.4, -4.6, -11);
  c.quadraticCurveTo(-7.2, -9, -8.6, -6.6);
  c.quadraticCurveTo(-4.6, -6.2, -1.4, -6.9);
  c.quadraticCurveTo(3, -8, 4.2, -12.6);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(20,20,12,0.3)";
  c.lineWidth = 0.4;
  c.stroke();
  // pale feather edges, and the bar across the coverts if it has one
  c.strokeStyle = k.edge;
  c.lineWidth = 0.45;
  for (const [x, y, ex, ey] of [[1, -9.4, -6.4, -7.3], [-1.6, -10.8, -7.4, -7.8]]) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 + 0.7, ex, ey);
    c.stroke();
  }
  if (k.bar) {
    c.strokeStyle = k.bar;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(1.2, -12.8);
    c.quadraticCurveTo(-0.4, -10.4, -0.4, -7.2);
    c.stroke();
  }
}

/** A wing spread in flight, seen from the side: swept from up and back (0)
 *  to down and back (1) about the shoulder, foreshortened mid-stroke. The
 *  far wing is drawn behind the body, in shade. */
function openWing(c: Ctx, sweep: number, color: string, far: boolean) {
  c.save();
  c.translate(far ? 2 : 1, -12.2);
  c.rotate(-0.55 - sweep * 2);
  c.scale(1, (1 - 0.3 * Math.sin(Math.PI * sweep)) * (far ? 0.9 : 1));
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(2.2, 0.4);
  c.quadraticCurveTo(2.8, -6, 0.4, -12.6);
  c.quadraticCurveTo(-0.8, -14.4, -2, -13.2);
  // the primaries' fingered trailing edge
  c.lineTo(-2.6, -11.2);
  c.lineTo(-3.4, -11.6);
  c.lineTo(-3.8, -9.4);
  c.lineTo(-4.6, -9.6);
  c.lineTo(-4.6, -7.2);
  c.quadraticCurveTo(-4.8, -3, -3.2, 0.8);
  c.closePath();
  c.fill();
  if (far) {
    c.fillStyle = "rgba(10,14,8,0.35)";
    c.fill();
  } else {
    c.strokeStyle = "rgba(255,250,230,0.25)";
    c.lineWidth = 0.45;
    for (const x of [-1.2, -2.8]) {
      c.beginPath();
      c.moveTo(x + 1.4, -1.5);
      c.lineTo(x - 0.4, -10.5);
      c.stroke();
    }
  }
  c.restore();
}

/** A bush top to sit on, or a stretch of grass to hop along. */
type Perch = { sway: number; taken: boolean } & ({ on: "bush"; x: number; y: number } | { on: "grass"; lo: number; hi: number });

/** Bush tops where a bird can sit, per side: broad solid lobes picked off
 *  the painting, a few px into the leaves so its feet sink in. */
const BUSH_TOPS: Point[][] = [
  [[206, 755], [108, 771], [292, 789], [380, 773]],
  [[1228, 776], [1376, 779], [1493, 765]],
];

type Act = "hop" | "peck" | "look" | "flick" | "sing" | null;

interface Bird {
  kind: BirdKind;
  side: number;
  perch: Perch;
  /** Where its feet are now, and where along the grass it stands. */
  x: number;
  y: number;
  groundX: number;
  face: number;
  mode: "in" | "perch" | "out";
  /** In flight: the path's ends and arc, how far along it is (px). */
  from: Point;
  to: Point;
  arc: number;
  flown: number;
  /** Perched: the current move, when it started and how long it takes, and
   *  where a hop goes. */
  act: Act;
  actAt: number;
  actFor: number;
  hopTo: number;
  hopFrom: number;
  next: number;
  leave: number;
  ph: number;
}

const FLIGHT_SPEED = 125;
/** Each bound of the flight: flapping up, then a dip on folded wings. */
const BOUND = 64;

/** Where a bird is along its flight: a quadratic arc from `from` to `to`,
 *  `flown` px along. */
function along(b: Bird): Point {
  const len = flightLength(b);
  const u = clamp(b.flown / len);
  const mx = (b.from[0] + b.to[0]) / 2;
  const my = Math.min(b.from[1], b.to[1]) - b.arc;
  const x = (1 - u) * (1 - u) * b.from[0] + 2 * u * (1 - u) * mx + u * u * b.to[0];
  const y = (1 - u) * (1 - u) * b.from[1] + 2 * u * (1 - u) * my + u * u * b.to[1];
  // bounding: up while flapping, down while the wings are shut; flat as
  // it lands and takes off
  const ease = Math.min(1, b.flown / 30, (len - b.flown) / 40);
  return [x, y - 3.5 * Math.sin((TAU * b.flown) / BOUND) * Math.max(0, ease)];
}

function flightLength(b: Bird): number {
  return Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]) + b.arc * 1.2;
}

/** A songbird now and then — a robin, a blue tit or a goldfinch, one at a
 *  time or two — flying in to a bush top or a patch of grass, past an
 *  outer edge or from behind the pages, in bounding flight. It stays a
 *  while: looking about, flicking its tail, singing; on the grass, hopping
 *  and pecking. Then it flies off. */
export function songbirds(seed: number): Layer {
  const r = rng(seed);
  const perches: Perch[][] = SIDES.map((side, i) => [
    ...BUSH_TOPS[i].map(([x, y]): Perch => ({ on: "bush", x, y, sway: UNDERGROWTH_SWAY, taken: false })),
    { on: "grass", lo: side[0] + 25, hi: side[1] - 25, sway: GROUND_SWAY, taken: false },
  ]);
  const birds: Bird[] = [];
  let clock = 0;
  let nextVisit = between(r, 6, 14);

  /** Out of sight: past the strip's outer edge, or behind the pages. */
  const offstage = (side: number): Point => {
    const outer = r() < 0.6;
    const x = side === 0 ? (outer ? -30 : 600) : outer ? 1630 : 1000;
    return [x, between(r, 560, 720)];
  };

  const visit = () => {
    const side = r() < 0.5 ? 0 : 1;
    // robins come most often
    const kind = pick(r, [BIRDS.robin, BIRDS.robin, BIRDS.bluetit, BIRDS.goldfinch]);
    const free = perches[side].filter((p) => !p.taken);
    const grass = free.find((p) => p.on === "grass");
    const bushes = free.filter((p) => p.on === "bush");
    const perch = grass && (r() < kind.ground || !bushes.length) ? grass : bushes.length ? pick(r, bushes) : null;
    if (!perch) return;
    perch.taken = true;
    const from = offstage(side);
    const b: Bird = {
      kind, side, perch, x: from[0], y: from[1], groundX: perch.on === "grass" ? between(r, perch.lo, perch.hi) : 0, face: 1,
      mode: "in", from, to: from, arc: between(r, 30, 70), flown: 0,
      act: null, actAt: 0, actFor: 0, hopFrom: 0, hopTo: 0, next: 0, leave: 0, ph: r() * TAU,
    };
    b.to = perchAt(b, 0);
    b.face = Math.sign(b.to[0] - from[0]) || 1;
    birds.push(b);
  };

  /** Where a bird stands on its perch at time t, the plant's sway and all. */
  const perchAt = (b: Bird, t: number): Point => {
    const p = b.perch;
    const [x, y] = p.on === "grass" ? [b.groundX, gladeGround(b.groundX)] : [p.x, p.y];
    const [sx, sy] = gladeSway(x, y, t, p.sway);
    return [x + sx, y + sy];
  };

  const startAct = (b: Bird, t: number) => {
    const p = b.perch;
    const moves: Act[] = p.on === "grass" ? ["hop", "hop", "peck", "peck", "look"] : ["look", "sing", "flick", null];
    if (b.kind.bobs) moves.push("flick");
    b.act = pick(r, moves);
    b.actAt = t;
    b.actFor = { hop: 0.3, peck: 0.55, look: 0.25, flick: 0.4, sing: 1.8 }[b.act ?? "look"];
    if (b.act === "hop" && p.on === "grass") {
      // forward, or turn about at the end of the stretch
      let dx = b.face * between(r, 7, 13);
      if (b.groundX + dx < p.lo || b.groundX + dx > p.hi) dx = -dx;
      b.face = Math.sign(dx);
      b.hopFrom = b.groundX;
      b.hopTo = b.groundX + dx;
    }
    if (b.act === "look") b.face = -b.face;
    b.next = t + b.actFor + between(r, 0.5, 2.2);
  };

  return {
    update(dt, t) {
      clock += dt;
      if (clock > nextVisit) {
        if (birds.length < 2) visit();
        // now and then a second follows close behind
        nextVisit = clock + (birds.length > 1 || r() < 0.7 ? between(r, 24, 50) : between(r, 3, 7));
      }
      for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i];
        if (b.mode === "perch") {
          if (b.act === "hop") b.groundX = b.hopFrom + (b.hopTo - b.hopFrom) * clamp((t - b.actAt) / b.actFor);
          [b.x, b.y] = perchAt(b, t);
          if (t > b.next) startAct(b, t);
          if (t > b.leave && (b.act === null || t > b.actAt + b.actFor)) {
            b.mode = "out";
            b.from = [b.x, b.y];
            b.to = offstage(b.side);
            b.arc = between(r, 20, 50);
            b.flown = 0;
            b.face = Math.sign(b.to[0] - b.x) || 1;
            b.perch.taken = false;
          }
          continue;
        }
        const len = flightLength(b);
        // landing, it slows over the last stretch
        const left = len - b.flown;
        b.flown += FLIGHT_SPEED * (b.mode === "in" ? clamp(left / 50, 0.3, 1) : clamp(b.flown / 30 + 0.4, 0.4, 1)) * dt;
        if (b.mode === "in" && b.flown >= len) {
          b.mode = "perch";
          b.leave = t + (b.perch.on === "grass" ? between(r, 8, 16) : between(r, 9, 18));
          b.next = t + between(r, 0.6, 1.4);
          b.act = null;
          [b.x, b.y] = perchAt(b, t);
          continue;
        }
        // the perch sways while it comes in
        if (b.mode === "in") b.to = perchAt(b, t);
        [b.x, b.y] = along(b);
        if (b.mode === "out" && b.flown >= len) birds.splice(i, 1);
      }
    },
    draw(c, t, x0, x1) {
      for (const b of birds) {
        if (b.x + 20 < x0 || b.x - 20 > x1) continue;
        const k = b.kind;
        let pose: BirdPose;
        let lift = 0;
        if (b.mode === "perch") {
          const u = b.act ? clamp((t - b.actAt) / b.actFor) : 1;
          const arc = Math.sin(Math.PI * u);
          pose = { tilt: 0, tail: 0, beak: 0, wing: null, legs: true };
          if (u < 1) {
            if (b.act === "hop") {
              lift = -4 * arc;
              pose.tilt = -0.12 * arc;
              pose.tail = -0.2 * arc;
            } else if (b.act === "look") lift = -1.5 * arc;
            else if (b.act === "peck") pose.tilt = 0.85 * Math.abs(Math.sin(TAU * u));
            else if (b.act === "flick") {
              pose.tail = -0.55 * arc;
              if (k.bobs) {
                lift = 0.8 * arc;
                pose.tilt = 0.12 * arc;
              }
            } else if (b.act === "sing") {
              pose.tilt = -0.2 * Math.min(1, arc * 3);
              pose.beak = Math.max(0, Math.sin(TAU * 3 * u));
            }
          }
          // the tail never quite still
          pose.tail += 0.04 * Math.sin(t * 2.3 + b.ph);
        } else {
          const len = flightLength(b);
          const bound = (b.flown % BOUND) / BOUND;
          const landing = b.mode === "in" ? clamp(1 - (len - b.flown) / 26) : 0;
          const takeoff = b.mode === "out" ? clamp(1 - b.flown / 20) : 0;
          const flapping = bound < 0.55 || landing > 0 || takeoff > 0;
          const rate = landing > 0 || takeoff > 0 ? 9 : 7;
          pose = {
            tilt: 0.38 - 0.5 * Math.max(landing, takeoff),
            tail: -0.1 * landing,
            beak: 0,
            wing: flapping ? 0.5 - 0.5 * Math.cos(TAU * rate * t + b.ph) : null,
            legs: landing > 0.4 || takeoff > 0.5,
          };
        }
        c.save();
        c.translate(b.x, b.y + lift);
        c.scale(b.face * k.size, k.size);
        drawBird(c, k, pose);
        c.restore();
      }
    },
  };
}
