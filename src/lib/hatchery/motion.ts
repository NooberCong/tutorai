/** Creature animation. A species marks the parts of its drawing that move —
 *  a wing swinging at the shoulder, a tail whipping from its root, a head
 *  bobbing on the body — and each frame resolves those moves into plain
 *  shapes before rasterizing. So every frame is drawn fresh as pixel art:
 *  a tilted wing is re-shaded and re-outlined at its new angle, never a
 *  sprite pushed or rotated as a bitmap.
 *
 *  Time `t` runs 0 → 1 over a clip. Waves with a whole number of cycles per
 *  clip loop seamlessly. Shifts land on whole pixels and turns step a pixel
 *  at a time at a part's far end, as a pixel artist would move a part;
 *  only growth reshapes a part continuously. */

import type { Decal, Drawing, Part, Prim, V } from "./pixel.ts";
import { SIZE } from "./pixel.ts";

/** A value over the clip's time t (0–1), mostly within -1…1. */
export type Wave = (t: number) => number;

export interface Move {
  /** The joint: turns and growth are about it. */
  at: V;
  wave: Wave;
  /** Swing in degrees at wave 1 (+ is clockwise). */
  turn?: number;
  /** Displacement at wave 1; rounded to whole pixels. */
  shift?: V;
  /** Growth about the joint at wave 1, per axis (0.1 = 10% larger). */
  grow?: V;
  /** A whip instead of a stiff swing: the turn ramps up with distance from
   *  the joint over `bend` px, and lags behind it by `lag` of a cycle at
   *  that distance, so the wave runs out along a tail, fin or flame. */
  bend?: number;
  lag?: number;
  /** Shapes right of the center line move as the mirror image (a pair of
   *  wings or ears drawn as one part). */
  pair?: boolean;
  /** Only the shapes on one side of the center line move (one ear of a
   *  mirrored pair). */
  side?: "left" | "right";
}

// ── waves ──

const TAU = Math.PI * 2;
const frac = (x: number) => x - Math.floor(x);

export const sine = (rate = 1, phase = 0): Wave => (t) => Math.sin(TAU * (rate * t + phase));

/** 0 → 1 → 0: a breath. */
export const rise = (rate = 1, phase = 0): Wave => (t) => 0.5 - 0.5 * Math.cos(TAU * (rate * t + phase));

/** A wing beat: from up (+1) to down (-1) in `down` of each beat — the
 *  power stroke — and a slower recovery back up. */
export const beat = (rate = 1, phase = 0, down = 0.4): Wave => (t) => {
  const u = frac(rate * t + phase);
  return u < down ? Math.cos((Math.PI * u) / down) : -Math.cos((Math.PI * (u - down)) / (1 - down));
};

/** A flame's lick: three unrelated harmonics, so it never visibly repeats
 *  within the loop. */
export const flicker = (rate = 2, seed = 0): Wave => (t) =>
  (Math.sin(TAU * (rate * t + seed * 0.37)) +
    0.6 * Math.sin(TAU * ((2 * rate + 1) * t + seed * 0.71)) +
    0.35 * Math.sin(TAU * ((3 * rate + 2) * t + seed * 0.13))) /
  1.95;

/** Once per clip, starting at `at`, over `len` of it: a quick rise to 1
 *  and a damped settle (an ear flick, a tail flick). Rest otherwise. */
export const twitch = (at: number, len = 0.15, ring = 1.5): Wave => (t) => {
  const u = frac(t - at);
  if (u >= len) return 0;
  const x = u / len;
  return 1.4 * Math.sin(TAU * ring * x) * (1 - x) ** 2;
};

/** Once per clip, starting at `at`, over `len` of it: an eased rise to 1
 *  and back (a hop, a puff, a glance). Rest otherwise. */
export const pulse = (at: number, len = 0.3): Wave => (t) => {
  const u = frac(t - at);
  return u < len ? Math.sin((Math.PI * u) / len) ** 2 : 0;
};

/** An eased 0 → 1 between `a` and `b`, held at 1 after — for acts that
 *  build over the clip. */
export const ease = (a: number, b: number): Wave => (t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** A wave held to `n` levels each side of rest: a big part (a body, a head)
 *  steps between a few poses instead of re-rasterizing every frame, which
 *  would make its shading shimmer. */
export const stepped = (w: Wave, n = 1): Wave => (t) => Math.round(w(t) * n) / n;

/** The same wave, `lag` of a cycle behind: follow-through. */
export const lagged = (w: Wave, lag: number): Wave => (t) => w(t - lag);

// ── resolving ──

/** Where a move puts a point, and the turn it gets there (degrees). */
type Mapper = (v: V) => { v: V; deg: number };

/** `reach` is how far the move's shapes extend from its joint: turns step
 *  by the angle that carries the farthest point one pixel, so a slow swing
 *  moves the way a pixel artist would move it, a pixel at a time, instead
 *  of shimmering — and a rigid part stays rigid while it steps. */
function mapper(m: Move, t: number, right: boolean, reach: number): Mapper {
  const ax = right && m.pair ? SIZE - m.at[0] : m.at[0];
  const ay = m.at[1];
  const flip = right && m.pair ? -1 : 1;
  const w = m.wave(t);
  const turn = (m.turn ?? 0) * flip;
  const gx = 1 + (m.grow?.[0] ?? 0) * w;
  const gy = 1 + (m.grow?.[1] ?? 0) * w;
  const sx = Math.round((m.shift?.[0] ?? 0) * w) * flip;
  const sy = Math.round((m.shift?.[1] ?? 0) * w);
  return ([x, y]) => {
    let dx = (x - ax) * gx;
    let dy = (y - ay) * gy;
    let deg = turn * w;
    if (m.bend && turn) {
      const f = Math.min(1, Math.hypot(x - ax, y - ay) / m.bend);
      deg = turn * f * (m.lag ? m.wave(t - m.lag * f) : w);
    }
    let a = (deg * Math.PI) / 180;
    if (reach > 0) a = Math.round(a * reach) / reach;
    if (a) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
    }
    return { v: [ax + dx + sx, ay + dy + sy], deg: (a * 180) / Math.PI };
  };
}

function center(p: Prim): V {
  switch (p.k) {
    case "ell":
    case "egg":
      return p.c;
    case "cap":
      return [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2];
    case "path":
    case "poly": {
      const n = p.pts.length;
      return [p.pts.reduce((s, q) => s + q[0], 0) / n, p.pts.reduce((s, q) => s + q[1], 0) / n];
    }
  }
}

/** How far a shape's edge reaches from a point. */
function extent(p: Prim, x: number, y: number): number {
  const far = (pts: V[], r: number) => Math.max(...pts.map(([px, py]) => Math.hypot(px - x, py - y))) + r;
  switch (p.k) {
    case "ell":
    case "egg":
      return far([p.c], Math.max(...p.r));
    case "cap":
      return Math.max(far([p.a], p.ra), far([p.b], p.rb));
    case "path":
      return far(p.pts, Math.max(p.r0, p.r1));
    case "poly":
      return far(p.pts, p.round);
  }
}

const skips = (m: Move, right: boolean) => (m.side === "left" && right) || (m.side === "right" && !right);
const isRight = (p: Prim) => center(p)[0] > SIZE / 2;

type Reach = Map<Move, number>;

function moved(p: Prim, m: Move, t: number, reach: Reach): Prim {
  const right = isRight(p);
  if (skips(m, right)) return p;
  const f = mapper(m, t, right, reach.get(m) ?? 0);
  const g = (v: V) => f(v).v;
  const w = m.wave(t);
  const gx = 1 + (m.grow?.[0] ?? 0) * w;
  const gy = 1 + (m.grow?.[1] ?? 0) * w;
  const gm = Math.sqrt(gx * gy);
  switch (p.k) {
    case "ell": {
      const { v, deg } = f(p.c);
      return { ...p, c: v, r: [p.r[0] * gx, p.r[1] * gy], rot: (p.rot ?? 0) + deg };
    }
    case "egg":
      return { ...p, c: g(p.c), r: [p.r[0] * gx, p.r[1] * gy] };
    case "cap":
      return { ...p, a: g(p.a), b: g(p.b), ra: p.ra * gm, rb: p.rb * gm };
    case "path":
      return { ...p, pts: p.pts.map(g), r0: p.r0 * gm, r1: p.r1 * gm };
    case "poly":
      return { ...p, pts: p.pts.map(g), round: p.round * gm };
  }
}

/** A decal rides its moves by whole pixels, following its own center. */
function movedDecal(d: Decal, t: number, reach: Reach): Decal {
  const c: V = [d.x + d.rows[0].length / 2, d.y + d.rows.length / 2];
  let v = c;
  for (const m of d.move ?? []) {
    const right = v[0] > SIZE / 2;
    if (!skips(m, right)) v = mapper(m, t, right, reach.get(m) ?? 0)(v).v;
  }
  return { ...d, x: d.x + Math.round(v[0] - c[0]), y: d.y + Math.round(v[1] - c[1]) };
}

/** The drawing at time t: every move resolved into plain shapes. */
export function animate(d: Drawing, t: number): Drawing {
  // Each part's shapes with all the moves they ride, own ones first.
  const groups = d.parts.map((p) => {
    const ms = p.move ?? [];
    const all = (ps?: Prim[]) => ps?.map((q) => ({ q, ms: [...(q.move ?? []), ...ms] }));
    return { prims: all(p.prims)!, cut: all(p.cut), paint: p.paint?.map((pt) => ({ prims: all(pt.prims)!, cut: all(pt.cut) })) };
  });
  const reach: Reach = new Map();
  const measure = (list?: { q: Prim; ms: Move[] }[]) => {
    for (const { q, ms } of list ?? []) {
      for (const m of ms) {
        const right = isRight(q);
        if (!m.turn || skips(m, right)) continue;
        const r = extent(q, right && m.pair ? SIZE - m.at[0] : m.at[0], m.at[1]);
        reach.set(m, Math.max(reach.get(m) ?? 0, r));
      }
    }
  };
  for (const g of groups) {
    measure(g.prims);
    measure(g.cut);
    for (const pt of g.paint ?? []) measure(pt.prims);
  }
  const resolve = (list?: { q: Prim; ms: Move[] }[]) => list?.map(({ q, ms }) => ms.reduce((r, m) => moved(r, m, t, reach), q));
  return {
    ...d,
    parts: d.parts.map((p, i) => {
      const g = groups[i];
      return {
        ...p,
        prims: resolve(g.prims)!,
        cut: resolve(g.cut),
        paint: p.paint?.map((pt, j) => ({ ...pt, prims: resolve(g.paint![j].prims)!, cut: resolve(g.paint![j].cut) })),
      };
    }),
    decals: d.decals?.map((dc) => (dc.move?.length ? movedDecal(dc, t, reach) : dc)),
  };
}

/** Attach moves to parts, decals or single shapes (after any they already
 *  have: a part's own swing first, then whatever carries it). */
export function rig(moves: Move[], ...items: Part[]): Part[];
export function rig(moves: Move[], ...items: Decal[]): Decal[];
export function rig(moves: Move[], ...items: Prim[]): Prim[];
export function rig(moves: Move[], ...items: { move?: Move[] }[]): { move?: Move[] }[] {
  for (const it of items) it.move = [...(it.move ?? []), ...moves];
  return items;
}
