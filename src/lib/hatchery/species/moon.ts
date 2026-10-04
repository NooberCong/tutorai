import type { Pose, Species } from "../kit.ts";
import { awake, blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move } from "../motion.ts";
import { ease, flicker, pulse, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Paint, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, path, poly } from "../pixel.ts";

/** Five-point star polygon (points up). */
function star(cx: number, cy: number, r: number, round = 0.3, inner = 0.48): Prim {
  const pts: V[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rr = i % 2 ? r * inner : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts, round);
}

/** Tiny 4-point twinkle stamp (a star spot on fur / skin). */
const twinkleSpot = (x: number, y: number, ink: string): Decal =>
  stamp(x, y, [".s.", "sss", ".s."], { s: ink });

/** Something small and round carried at the far end of a part that turns
 *  (the moon on a tail tip): it follows that part's moves as a whole-pixel
 *  shift, so it keeps its shape instead of re-rasterizing at every
 *  sub-pixel spot. `reach` is the carrying part's extent from the joint,
 *  which sets how the turns step (as in motion.ts). With `pair`, the
 *  mirror image on the right follows the mirrored moves. */
function carried(moves: Move[], c: V, reach: number, pair = false): Move[] {
  const where = (u: number): V =>
    moves.reduce<V>(([x, y], m) => {
      const [ax, ay] = m.at;
      const f = m.bend ? Math.min(1, Math.hypot(x - ax, y - ay) / m.bend) : 1;
      const w = m.bend && m.lag ? m.wave(u - m.lag * f) : m.wave(u);
      const r = Math.round((((m.turn ?? 0) * f * w * Math.PI) / 180) * reach) / reach;
      const dx = x - ax;
      const dy = y - ay;
      return [ax + dx * Math.cos(r) - dy * Math.sin(r) + Math.round((m.shift?.[0] ?? 0) * m.wave(u)),
        ay + dx * Math.sin(r) + dy * Math.cos(r) + Math.round((m.shift?.[1] ?? 0) * m.wave(u))];
    }, c);
  return [
    { at: c, wave: (u) => Math.round(where(u)[0] - c[0]), shift: [1, 0], pair },
    { at: c, wave: (u) => Math.round(where(u)[1] - c[1]), shift: [0, 1], pair },
  ];
}

/** How far a path reaches from a point (its extent, as motion.ts measures it). */
const reachOf = (pts: V[], r: number, from: V) => Math.max(...pts.map(([x, y]) => Math.hypot(x - from[0], y - from[1]))) + r;

// ── Mooncat ──

export const mooncat: Species = {
  id: "mooncat",
  name: "Mooncat",
  element: "moon",
  tier: "common",
  stages: ["Crescent Kit", "Mooncat", "Lunar Tabby"],
  palette: { fur: "#aaaee2", cream: "#f2f0ff", moon: "#f8d266" },
  shiny: { fur: "#5b5fb4", cream: "#b4b8ee", moon: "#ffe79a" },
  lore: "Curls up on whichever page the moonlight lands on. Its crescent brightens a little each time you finish a chapter after midnight.",
  hint: "A sliver of silver on a sleepy brow.",
  // A slow breath, the head riding it a beat behind, the tail swaying with
  // the moon at its tip, one ear easing back now and then. Its act is a
  // contented slow blink: the eyes close, the crescent on its brow
  // brightens and glints, the tail curls in, then it opens its eyes again.
  motion: { idle: 3.6, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const glow = a < 0 ? 0 : ease(0.1, 0.38)(a) * (1 - ease(0.62, 0.9)(a));
    const look = awake(pose) && glow < 0.3 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The tail sways from its root, a wave running out to the moon at its
     *  tip; in the slow blink it stills and lifts the moon a little. */
    const swish = (root: V, len: number): Move[] => [
      { at: root, wave: (u) => (1 - glow) * sine(1, 0.3)(u), turn: 6 * calm, bend: len, lag: 0.3 },
      { at: root, wave: () => glow, turn: 4, bend: len, lag: 0.1 },
    ];
    /** One ear eases back about its base, now and then. */
    const flick = (bx: number, by: number): Move => ({ at: [bx + 2, by], wave: pulse(pose === "sleep" ? 0.7 : 0.45, 0.3), turn: -6 * calm, side: "left" });
    const face = (ey: number, style: "tall" | "round", my: number, ms: Move[]) => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], look, style), ...blush([10, ey + (style === "tall" ? 4 : 3)], [20, ey + (style === "tall" ? 4 : 3)])));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(...rig(ms, stamp(15, ny, ["nn"], { n: "blush:2" }), stamp(14, ny + 1, ["k..k", ".kk."], { k: "fur:1" })));
      const moon = stage < 2 ? [".mm", "m..", ".mm"] : [".mm", "m..", "m..", ".mm"];
      // The crescent brightens a step or two in the slow blink.
      const lv = glow > 0.75 ? 4 : glow > 0.3 ? 3 : 2;
      decals.push(...rig(ms, stamp(15, my, moon, { m: `moon:${lv}` })));
      if (glow > 0.6) decals.push(...rig(ms, ...twinkle(16, my - 3, a, 0.3, "moon:5", 0.3)));
    };
    const ears = (bx: number, by: number, h: number, ms: Move[]): Part => ({
      mat: "fur",
      prims: both(poly([[bx, by], [bx + 0.4, by - h], [bx + 4.8, by - h * 0.45]], 0.8)),
      paint: [{ mat: "blush", prims: both(poly([[bx + 1.3, by - 1.2], [bx + 1.4, by - h + 1.8], [bx + 3.6, by - h * 0.45 - 0.3]], 0)) }],
      move: [flick(bx, by), ...ms],
    });
    if (stage === 0) {
      // One blob: it swells as a whole, the face and ears riding along.
      const swell: Move = { at: [16, 29.3], wave: breath, grow: [0.02, 0.07] };
      parts.push(
        ...rig(swish([21, 28], 6), { mat: "fur", prims: [path([[21, 28], [24.5, 26.4], [25.2, 22.6]], 1.4, 1)], back: true }),
        ears(9.2, 20, 7, [swell]),
        ...rig([swell], { mat: "fur", round: 8, prims: [ell(16, 23, 7.5, 6.3)] }),
        { mat: "fur", prims: both(ell(13, 29.2, 1.8, 1.2)) },
      );
      face(21, "tall", 17, [swell]);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    // The chest swells on the breath; the head rides it a beat behind.
    const chest: Move = { at: [16, 29.5], wave: breath, grow: [0.02, 0.06] };
    const lift: Move = { at: [16, 16], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    if (stage === 1) {
      const tail = swish([20, 28.4], 10);
      const pts: V[] = [[20, 28.4], [25, 27.4], [27, 22.8], [26, 19]];
      parts.push(
        ...rig(tail, { mat: "fur", prims: [path(pts, 1.7, 1.1)], back: true }),
        ...rig(carried(tail, [25.8, 18.6], reachOf(pts, 1.7, [20, 28.4])), { mat: "moon", glow: true, prims: [ell(25.8, 18.6, 1.3)] }),
        ears(9, 14, 7.6, [lift]),
        { mat: "fur", prims: [...rig([lift], ell(16, 15, 7, 6)), ...rig([chest], ell(16, 24, 5.8, 5.6))], blend: 3,
          paint: [{ mat: "cream", level: 4, prims: rig([chest], ell(16, 21.4, 2.6, 2)) }] },
        { mat: "fur", round: 6, prims: both(ell(13.4, 28.8, 2, 1.4)) },
      );
      face(13, "tall", 9, [lift]);
    } else {
      const tail = swish([20.5, 28.6], 13);
      const pts: V[] = [[20.5, 28.6], [25.6, 28], [28.4, 23.4], [28, 17.6], [25.8, 14.4]];
      parts.push(
        ...rig(tail, { mat: "fur", prims: [path(pts, 2, 1.1)], back: true }),
        ...rig(carried(tail, [25.4, 13.8], reachOf(pts, 2, [20.5, 28.6])), { mat: "moon", glow: true, prims: [ell(25.4, 13.8, 1.7)] }),
        ears(9.4, 10, 8, [lift]),
        { mat: "fur", prims: [...rig([lift], ell(16, 11, 7, 5.8)), ...rig([chest], ell(16, 22.4, 6.2, 6.8)), ...both(ell(11.8, 26.2, 3, 3.4))], blend: 3,
          paint: [{ mat: "cream", level: 4, prims: rig([chest], ell(16, 18.6, 2.8, 2.4)) }] },
        { mat: "fur", round: 6, prims: both(ell(13.8, 28.9, 2.1, 1.5)) },
      );
      face(9, "tall", 5, [lift]);
      decals.push(...rig([chest], twinkleSpot(19, 21, "moon:4"), stamp(10, 24, ["s"], { s: "moon:4" }), stamp(21, 25, ["s"], { s: "moon:4" })));
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

// ── Lanternwisp ──

export const lanternwisp: Species = {
  id: "lanternwisp",
  name: "Lanternwisp",
  element: "moon",
  tier: "common",
  stages: ["Flicker", "Wickwisp", "Lanternwisp"],
  palette: { wisp: "#c2d8f8", flame: "#ffc45e", iron: "#8e84b4" },
  shiny: { wisp: "#f6c2e2", flame: "#86f0d6", iron: "#6f94b0" },
  lore: "A reading light that got lonely and went looking for readers. It hovers just over your shoulder so the page never goes dark.",
  hint: "Something small keeps the candle lit.",
  // It hovers on a slow rise and fall, the wispy tail trailing behind, the
  // wick-curl swaying with its flame licking, and the lantern swinging
  // gently a beat after the body. Its act: it lifts its lantern (the
  // hatchling, its own flame) so the page never goes dark, eyes closed
  // happily while the light brightens and glints, then lowers it again.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const up = a < 0 ? 0 : ease(0.08, 0.36)(a) * (1 - ease(0.62, 0.92)(a));
    const look = awake(pose) && up < 0.45 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The hover: up a pixel and back on a slow rise. */
    const hover: Move = { at: [16, 16], wave: stepped(rise(1)), shift: [0, -1] };
    /** The wick-curl sways from the crown, the flame riding its tip and
     *  licking on its own. */
    const wick = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.15), turn: 5 * calm, bend: len, lag: 0.3 });
    const flame = (c: V, rx: number, ry: number, ms: Move[]): Part =>
      ({ mat: "flame", glow: true, prims: [ell(c[0], c[1], rx, ry)], move: [
        { at: [c[0], c[1] + ry], wave: flicker(1, 2), turn: 6 * calm },
        { at: [c[0], c[1] + ry], wave: () => up, grow: [0.15, 0.35] },
        ...ms,
      ], paint: up > 0.4 ? [{ mat: "flame", level: 5, prims: [ell(c[0], c[1] + ry * 0.2, ry * 0.45, ry * 0.65)] }] : undefined });
    /** The wispy tail trails the hover, a wave running out to its tip. */
    const trail = (root: V, len: number): Move => ({ at: root, wave: sine(1, -0.15), turn: 7 * calm, bend: len, lag: 0.35 });
    /** A little hanging lantern: bail, cap, glowing pane, base. It swings
     *  from its bail a beat after the hover, stilled while it's held up. */
    const lantern = (x: number, y: number, s: number, ms: Move[]): Part[] => {
      const swing: Move = { at: [x, y - 1.2 * s], wave: (u) => (1 - up) * calm * sine(1, -0.2)(u), turn: 9 };
      const pane = poly([[x - 1.6 * s, y + 1.4 * s], [x + 1.6 * s, y + 1.4 * s], [x + 1.6 * s, y + 5 * s], [x - 1.6 * s, y + 5 * s]], 0.5);
      return rig([swing, ...ms],
        { mat: "iron", prims: [path([[x - 1.3 * s, y + 0.6 * s], [x, y - 1.2 * s], [x + 1.3 * s, y + 0.6 * s]], 0.8)] },
        { mat: "flame", glow: true, prims: [pane],
          paint: up > 0.3 ? [{ mat: "flame", level: 5, prims: [ell(x, y + 3.2 * s, up > 0.7 ? 1.3 * s : 0.8 * s, up > 0.7 ? 1.9 * s : 1.2 * s)] }] : undefined },
        { mat: "iron", prims: [ell(x, y + 1.2 * s, 2.3 * s, 0.9), ell(x, y + 5.4 * s, 2.3 * s, 0.9)] },
      );
    };
    /** In the act the arm lifts the lantern two pixels, a pixel at a time. */
    const lift: Move = { at: [6, 16], wave: () => Math.round(2 * up) / 2, shift: [0, -2] };
    /** Glints round the light at the act's peak. */
    const glints = (x: number, y: number) => {
      if (up > 0.6) decals.push(...rig([hover], ...twinkle(x - 4, y - 1, a, 0.3, "flame:5", 0.32), ...twinkle(x - 1, y - 5, a, 0.4, "flame:5", 0.3)));
    };
    if (stage === 0) {
      const curl: V[] = [[16, 17], [17.8, 13.6], [20.2, 12]];
      const w = wick([16, 17], 6);
      parts.push(
        { mat: "wisp", round: 9, prims: [...rig([hover], ell(16, 21.4, 6.6, 5.6)), ...rig([w, hover], path(curl, 2.8, 0.9)),
          ...rig([trail([12.4, 24.6], 4), hover], path([[12.4, 24.6], [12, 27], [14.6, 27.6]], 1.4, 0.8))], blend: 2 },
        flame([21, 11.2], 1.6, 2, [...carried([w], [21, 11.2], reachOf(curl, 2.8, [16, 17])), hover]),
      );
      decals.push(...rig([hover], ...eyes([12, 19], [18, 19], look, "tall"), ...blush([10, 23], [20, 23])));
      decals.push(...rig([hover], stamp(15, 23, ["kk"], { k: "eye:3" })));
      glints(23, 10);
    } else if (stage === 1) {
      const curl: V[] = [[17, 11], [19, 7.6], [21.6, 6.4]];
      const w = wick([17, 11], 7);
      const arm: V[] = [[11, 19.2], [8.4, 19], [6.6, 17]];
      parts.push(
        { mat: "wisp", round: 10, prims: [...rig([hover], ell(17, 16, 7.2, 6.6)), ...rig([w, hover], path(curl, 2.8, 0.9)),
          ...rig([trail([17, 20], 9), hover], path([[17, 20], [16.6, 24.4], [19.4, 27], [23, 26]], 5.4, 0.8))], blend: 3 },
        flame([22.4, 5.8], 1.5, 1.9, [...carried([w], [22.4, 5.8], reachOf(curl, 2.8, [17, 11])), hover]),
        ...rig([lift, hover], { mat: "wisp", prims: [path(arm, 1.3, 1)] }),
        ...lantern(6, 18, 1.05, [lift, hover]),
      );
      decals.push(...rig([hover], ...eyes([13, 14], [19, 14], look, "tall"), ...blush([11, 18], [21, 18])));
      decals.push(...rig([hover], stamp(16, 18, ["kk"], { k: "eye:3" })));
      glints(7, 15);
    } else {
      const curl: V[] = [[17, 9.4], [19.4, 5.4], [22.6, 3.8]];
      const w = wick([17, 9.4], 8);
      const arm: V[] = [[10.4, 18], [8, 17.6], [6.2, 14.4]];
      parts.push(
        { mat: "wisp", round: 12, prims: [...rig([hover], ell(17, 14.6, 8, 7.2)), ...rig([w, hover], path(curl, 3.6, 1)),
          ...rig([trail([18, 19], 11), hover], path([[18, 19], [17.6, 24.4], [20.8, 27.6], [25.4, 26.6], [26.8, 24]], 6.4, 0.9))], blend: 3 },
        flame([23.6, 3.4], 1.7, 2.1, [...carried([w], [23.6, 3.4], reachOf(curl, 3.6, [17, 9.4])), hover]),
        ...rig([lift, hover], { mat: "wisp", prims: [path(arm, 1.6, 1.1)] }),
        ...lantern(5.8, 15.6, 1.4, [lift, hover]),
      );
      decals.push(...rig([hover], ...eyes([13, 13], [19, 13], look, "tall"), ...blush([11, 17], [21, 17])));
      decals.push(...rig([hover], stamp(15, 17, ["k..k", ".kk."], { k: "eye:3" })));
      glints(7, 12);
    }
    if (pose === "sleep") decals.push(zzz(stage === 0 ? 25 : 26, stage === 0 ? 4 : 10));
    return { parts, decals, head: [hover], neck: [hover] };
  },
};

// ── Jackalope ──

export const jackalope: Species = {
  id: "jackalope",
  name: "Jackalope",
  element: "moon",
  tier: "rare",
  stages: ["Budlope", "Tinelope", "Jackalope"],
  palette: { fur: "#dcb994", cream: "#f8eedc", antler: "#d6d0f0", star: "#a8e6ff" },
  shiny: { fur: "#7274c0", cream: "#cfd2f4", antler: "#ffe0a0", star: "#ff9edc" },
  lore: "Said not to exist, which suits it: it only reads books nobody believes in. Each tine of its antlers holds one star it borrowed from the margins.",
  hint: "Rabbit ears, and something branching between them.",
  // A slow breath, the head riding it a beat behind and the long ears
  // following through after the head; the borrowed stars glint now and
  // then. Its act is a curious sniff: the head lifts, the ears rise
  // upright, the nose twitches twice, and the stars on its tines glint
  // one after another before the ears settle back.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const perk = a < 0 ? 0 : ease(0.06, 0.3)(a) * (1 - ease(0.66, 0.92)(a));
    const sniff = a < 0 ? 0 : Math.round(pulse(0.32, 0.1)(a) + pulse(0.46, 0.1)(a));
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The head rides the breath a beat behind, and holds up a pixel while
     *  it listens. */
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.08), Math.round(perk)), shift: [0, -1] };
    /** The long ears tip outward a little after the head moves, and rise
     *  upright as it listens. `base` is the left ear's root. */
    const earMoves = (base: V): Move[] => [
      { at: base, wave: (u) => (1 - perk) * calm * sine(1, -0.2)(u), turn: -4, pair: true },
      { at: base, wave: () => perk, turn: 12, pair: true },
    ];
    const ears = (cx: number, cy: number, rx: number, ry: number, rot: number, ms: Move[]): Part => {
      const r = (rot * Math.PI) / 180;
      return {
        mat: "fur",
        prims: both(ell(cx, cy, rx, ry, rot)),
        paint: [{ mat: "blush", prims: both(ell(cx + 0.2, cy + 0.2, rx * 0.42, ry * 0.7, rot)) }],
        move: [...earMoves([cx + Math.sin(-r) * ry * 0.9, cy + Math.cos(r) * ry * 0.9]), ...ms],
      };
    };
    const face = (ey: number, style: "tall" | "round", ms: Move[]) => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], pose, style), ...blush([10, ey + (style === "tall" ? 4 : 3)], [20, ey + (style === "tall" ? 4 : 3)])));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(...rig(ms, { ...stamp(15, ny, ["nn"], { n: "blush:2" }), move: [{ at: [15, ny], wave: () => sniff, shift: [0, -1] }] }, stamp(15, ny + 1, ["kk"], { k: "fur:1" })));
    };
    /** The tine stars glint one after another in the act. */
    const glints = (tips: V[], ms: Move[]) => {
      if (a < 0) return;
      tips.forEach(([x, y], i) => decals.push(...rig(ms, ...twinkle(Math.round(x) - 1, Math.round(y) - 1, a, 0.3 + (i * 0.28) / tips.length, "star:5", 0.18))));
    };
    if (stage === 0) {
      // One blob: it swells as a whole, the face, ears and nubs riding along.
      const swell: Move = { at: [16, 29.4], wave: (u) => Math.max(breath(u), Math.round(perk)), grow: [0.02, 0.07] };
      parts.push(
        { mat: "fur", prims: both(ell(13, 29.2, 2.2, 1.2)), back: true },
        ears(11, 15.6, 1.9, 4.4, -18, [swell]),
        ...rig([swell], { mat: "antler", prims: both(cap(14, 18.2, 13.4, 15.8, 1, 0.9)) }),
        ...rig([swell], { mat: "fur", round: 8, prims: [ell(16, 23.4, 7, 6)] }),
      );
      face(21, "tall", [swell]);
      glints([[16, 12.6]], [swell]);
      if (pose === "sleep") decals.push(zzz(26, 5));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    const chest: Move = { at: [16, 29.4], wave: breath, grow: [0.02, 0.06] };
    if (stage === 1) {
      parts.push(
        ears(9.6, 11.2, 1.9, 5, -34, [lift]),
        ...rig([lift], { mat: "antler", prims: both(path([[14.2, 11], [13.2, 7.6], [11.4, 5.4]], 1.1, 0.85)),
          paint: [{ mat: "star", level: 4, prims: both(ell(11.2, 5.2, 1.2)) }] }),
        { mat: "fur", prims: [...rig([lift], ell(16, 16, 7, 6)), ...rig([chest], ell(16, 24.6, 6, 5)), ...both(ell(11.8, 26.4, 2.6, 2.6))], blend: 4,
          paint: [{ mat: "cream", level: 4, prims: rig([chest], ell(16, 23.4, 2.8, 2.6)) }] },
        { mat: "fur", round: 6, prims: both(ell(12.8, 29.2, 2.4, 1.2)) },
      );
      face(14, "tall", [lift]);
      decals.push(...rig([lift], ...twinkle(10, 4, t, 0.1, "star:4"), ...twinkle(19, 4, t, 0.6, "star:4")));
      glints([[11.2, 5.2], [20.8, 5.2]], [lift]);
    } else {
      parts.push(
        ears(7.8, 11.6, 2, 4.8, -42, [lift]),
        ...rig([lift], { mat: "antler", prims: [
          ...both(path([[14.4, 9.6], [12.8, 6], [9.6, 3.8], [5.6, 3.2]], 1.3, 0.85)),
          ...both(path([[12.9, 6.6], [13.2, 2.6]], 0.95, 0.8)),
          ...both(path([[9.6, 3.9], [9.2, 1.6]], 0.9, 0.8)),
        ], paint: [{ mat: "star", level: 4, prims: [...both(ell(5.4, 3.2, 1.3)), ...both(ell(13.2, 2.2, 1.2)), ...both(ell(9.2, 1.2, 1.2))] }] }),
        { mat: "fur", prims: [...rig([lift], ell(16, 14.8, 7.2, 6)), ...rig([chest], ell(16, 23.6, 7, 6)), ...both(ell(11, 26, 2.8, 3))], blend: 4,
          paint: [{ mat: "cream", level: 4, prims: rig([chest], ell(16, 22.8, 3.4, 3.2)) }] },
        { mat: "fur", round: 6, prims: both(ell(12, 29.3, 2.4, 1.2)) },
      );
      face(13, "round", [lift]);
      decals.push(...twinkle(3, 2, t, 0.15, "star:4"), ...twinkle(26, 2, t, 0.65, "star:4"));
      decals.push(...rig([lift], stamp(13, 1, ["s"], { s: "star:5" }, true), stamp(18, 1, ["s"], { s: "star:5" }, true),
        stamp(9, 0, ["s"], { s: "star:5" }, true), stamp(22, 0, ["s"], { s: "star:5" }, true)));
      glints([[5.4, 3.2], [9.2, 1.6], [13.2, 2.2], [18.8, 2.2], [22.8, 1.6], [26.6, 3.2]], [lift]);
    }
    if (pose === "sleep") decals.push(zzz(26, 12));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

/// ── Baku ──

export const baku: Species = {
  id: "baku",
  name: "Baku",
  element: "moon",
  tier: "epic",
  stages: ["Snoozlet", "Dozer", "Baku"],
  palette: { hide: "#9298e8", saddle: "#d8cff4", dream: "#f0a8f4", star: "#ffe07a" },
  shiny: { hide: "#eca0bf", saddle: "#5e5aa8", dream: "#98f0dc", star: "#fff3b0" },
  lore: "Eats bad dreams and leaves the good ones, like a careful editor. Falls asleep on open books and wakes up having read them.",
  hint: "It snacks on nightmares; you won't miss them.",
  // A slow, heavy breath through the round body, the big head riding it a
  // beat behind, the trunk swaying and the dream bubbles bobbing over its
  // back each in its own time. Its act is a snack: a little nightmare
  // wisp gathers under its trunk and is sniffed up, shrinking into the
  // tip; then it shuts its eyes contentedly, curls its trunk, and the good
  // dream overhead glints.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const glad = a < 0 ? 0 : ease(0.5, 0.64)(a) * (1 - ease(0.8, 0.94)(a));
    const look = awake(pose) && glad < 0.35 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** Tapir authored at adult size, facing left; `s` shrinks it toward the
     *  ground point (16, 29.6). */
    const k = [0.62, 0.8, 1][stage];
    const P = (x: number, y: number): V => [16 + (x - 16) * k, 29.6 + (y - 29.6) * k];
    const E = (x: number, y: number, rx: number, ry = rx, rot = 0) => ell(...P(x, y), rx * k, ry * k, rot);
    const leg = (x: number) => cap(...P(x, 25), ...P(x, 28.6), 2.2 * k, 2.3 * k);
    /** The body swells on the breath; the head rides it a beat behind and
     *  lifts a pixel while it savours the snack. */
    const chest: Move = { at: P(20, 28), wave: breath, grow: [0.02, 0.05] };
    const lift: Move = { at: P(10, 16), wave: (u) => Math.max(breath(u - 0.1), Math.round(glad)), shift: [0, -1] };
    /** The trunk sways from its root, the wave running down to the tip; it
     *  curls in, pleased, after the snack. */
    const root = P(5, 18.4);
    const trunk: Move[] = [
      { at: root, wave: (u) => (1 - glad) * sine(1, 0.2)(u), turn: 5 * calm, bend: 6 * k, lag: 0.3 },
      { at: root, wave: () => glad, turn: -10, bend: 6 * k, lag: 0.1 },
    ];
    /** The dream bubble bobs a pixel; the little ones under it follow a
     *  beat later and settle a beat sooner, so they never bump into it. */
    const up = stepped(rise(1, 0.3));
    const bubble: Move = { at: [16, 8], wave: up, shift: [0, -1] };
    const bob = (lag: number): Move => ({ at: [16, 8], wave: (u) => up(u) * up(u - lag) * up(u + lag), shift: [0, -1] });
    parts.push(
      { mat: "hide", back: true, round: 7, prims: [leg(15.6), leg(23.4)] },
      // Chubby body: arched back rising to a round rump.
      ...rig([chest], { mat: "hide", round: 12, blend: 4, prims: [E(18.4, 21.4, 8.4, 6), E(24.4, 19.6, 5.8, 6.4)],
        paint: [
          { mat: "saddle", level: 3, prims: [E(26.6, 19.2, 6.4, 8.4, 10)] },
          { mat: "saddle", level: 4, prims: [E(25.6, 16.4, 5.8, 4.2, 10)] },
        ] }),
      { mat: "hide", round: 7, prims: [leg(11.6), leg(26.2)] },
      // Big round head with a droopy trunk.
      ...rig([lift], { mat: "hide", round: 14, blend: 2, prims: [E(10.4, 15.6, 7, 6.4),
        ...rig(trunk, path([P(5, 18.4), P(2.8, 20.6), P(2.4, 23.6)], 2.6 * k, 1.5 * k))] }),
      ...rig([lift], { mat: "hide", prims: [E(5.6, 10, 2, 1.9), E(14.6, 9.6, 2, 1.9)],
        paint: [{ mat: "saddle", level: 4, prims: [E(5.5, 9.7, 1, 0.9), E(14.5, 9.3, 1, 0.9)] }] }),
    );
    const [ex, ey] = P(6.4, 13.6).map(Math.round);
    const gap = stage === 0 ? 4 : 5;
    decals.push(...rig([lift], ...eyes([ex, ey], [ex + gap, ey], look, "tall")));
    decals.push(...rig([lift], ...blush([ex - 1, ey + 4], [ex + gap + 1, ey + 4], stage === 0 ? 1 : 2)));
    // The nightmare: a dark wisp gathers under the trunk's tip, churns a
    // moment, then is sniffed up into it, shrinking as it rises.
    if (a >= 0) {
      const [tx, ty] = P(2.4, 23.6).map(Math.round);
      const seq: [number, string[], number, number][] = [
        [0.08, ["d"], 0, 4],
        [0.12, ["dk", "kd"], -1, 3],
        [0.16, [".kd.", "kddk", ".dk."], -2, 3],
        [0.24, ["..k.", "kddk", ".dk."], -2, 3],
        [0.3, [".kd.", "kddk", ".dk."], -2, 3],
        [0.37, ["dk", "kd"], -1, 2],
        [0.41, ["d"], 0, 1],
        [0.45, [], 0, 0],
      ];
      const f = seq.filter(([at]) => a >= at).pop();
      if (f && f[1].length) decals.push(stamp(tx + f[2], ty + f[3], f[1], { k: "hide:1", d: "dream:2" }, true));
    }
    /** The good dream glints once the bad one is gone. */
    const glint = (x: number, y: number, ms: Move[]) => {
      if (glad > 0.5) decals.push(...rig(ms, ...twinkle(x, y, a, 0.62, "star:5", 0.2)));
    };
    if (stage === 0) {
      const b = bubble;
      parts.push(...rig([b], { mat: "dream", glow: true, prims: [ell(22.4, 16.4, 1.8)] }));
      glint(22, 12, [b]);
    } else if (stage === 1) {
      const b = bubble;
      parts.push(...rig([b], { mat: "dream", glow: true, prims: [ell(24.2, 8.2, 2.7)] }),
        { mat: "dream", glow: true, prims: [...rig([bob(0.06)], ell(20.4, 12.4, 1.3)), ...rig([bob(0.1)], ell(28.4, 12.2, 1.1))] });
      decals.push(...rig([b], stamp(23, 7, [".s.", "sss", ".s."], { s: "star:5" })));
      glint(26, 3, [b]);
    } else {
      const b = bubble;
      parts.push(
        ...rig([b], { mat: "dream", glow: true, prims: [ell(24.4, 5, 3)] }),
        { mat: "dream", glow: true, prims: [...rig([bob(0.06)], ell(19.8, 8.6, 1.4)), ...rig([bob(0.1)], ell(28.6, 9.4, 1.6))] },
      );
      decals.push(
        ...rig([b], stamp(23, 4, [".s.", "sss", ".s."], { s: "star:5" })),
        ...rig([chest], twinkleSpot(24, 16, "star:3"), stamp(22, 21, ["s"], { s: "star:3" }), stamp(28, 22, ["s"], { s: "star:3" })),
      );
      glint(27, 0, [b]);
    }
    if (pose === "sleep") decals.push(stage === 0 ? zzz(26, 8) : zzz(15, stage === 2 ? 1 : 4));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

// ── Starwhale ──

const constellation = (x: number, y: number): Decal =>
  stamp(x, y, [
    "s.....",
    ".k...s",
    "..k.k.",
    "...s..",
  ], { s: "star:5", k: "body:5" });

export const starwhale: Species = {
  id: "starwhale",
  name: "Starwhale",
  element: "moon",
  tier: "legendary",
  stages: ["Starfry", "Skycalf", "Starwhale"],
  palette: { body: "#6679dc", belly: "#cfe6ff", fin: "#7cf0cf", aurora: "#e59cff", star: "#ffe38a" },
  shiny: { body: "#e08cbf", belly: "#fff0c8", fin: "#9fb4ff", aurora: "#fff09a", star: "#ffffff" },
  lore: "Swims the night sky, humming the constellations back into order. Every book finished anywhere adds one more star to its back.",
  hint: "A song beneath the stars, and it is swimming.",
  // It swims in place on a slow rise and fall, the flukes sweeping a beat
  // behind with the wave running out to their tips, the fins paddling in
  // turn. Its act is a hum: it draws a slow breath, closes its eyes and
  // rounds its mouth, the flukes lift, and the stars on its back light up
  // one after another as the song puts them back in order.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const hum = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.66, 0.92)(a));
    const look = awake(pose) && hum < 0.4 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The swim: up a pixel and back on a slow rise. */
    const hover: Move = { at: [16, 16], wave: stepped(rise(1)), shift: [0, -1] };
    /** The flukes sweep a beat behind the body, the wave running out to
     *  their tips; mid-hum they lift. */
    const flukes = (root: V, len: number): Move[] => [
      { at: root, wave: (u) => calm * sine(1, -0.15)(u), turn: 6, bend: len, lag: 0.3 },
      { at: root, wave: () => hum, turn: -6, bend: len, lag: 0.15 },
      hover,
    ];
    /** A fin paddles from its root. */
    const paddle = (root: V, phase: number, deg: number): Move[] => [{ at: root, wave: (u) => calm * sine(1, phase)(u), turn: deg }, hover];
    /** The body draws a breath for the song. */
    const chest = (c: V): Move => ({ at: c, wave: () => Math.round(hum), grow: [0.03, 0.07] });
    /** Mid-hum the mouth rounds. */
    const mouth = (x: number, y: number, rows: string[], ms: Move[]) =>
      decals.push(...rig(ms, stamp(x, y, rows, { k: "body:1" })));
    /** The stars light up in turn as it hums. */
    const lights = (pts: V[], ms: Move[]) => {
      if (hum < 0.5) return;
      pts.forEach(([x, y], i) => decals.push(...rig(ms, ...twinkle(x - 1, y - 1, a, 0.3 + i * 0.06, "star:5", 0.2))));
    };
    if (stage === 0) {
      const c = chest([16, 20.5]);
      parts.push(
        ...rig(flukes([20, 21], 7), { mat: "body", prims: [path([[20, 21], [23.5, 19], [25, 15.5]], 2.2, 1), ell(23.8, 14.3, 1.9, 1, -35), ell(26.3, 15.3, 1.8, 1, 40)],
          paint: [{ mat: "aurora", prims: [ell(26.6, 15.2, 1.2)] }] }),
        ...rig([c, hover], { mat: "body", prims: [ell(16, 20.5, 7, 5.5)], paint: [{ mat: "belly", level: 3, prims: [ell(15.5, 26, 6, 3)] }, { mat: "belly", level: 4, prims: [ell(15.5, 25.2, 6, 2)] }] }),
        ...rig(paddle([10.4, 21.4], 0.1, 8), { mat: "fin", glow: true, prims: [ell(8.6, 22.2, 2.3, 1.1, -25)] }),
        ...rig([hover], { mat: "star", glow: true, prims: [star(15.5, 12, 2.6, 0.3)] }),
      );
      decals.push(...rig([hover], ...eyes([12, 18], [18, 18], look, "tall"), ...blush([10, 22], [20, 22])));
      mouth(15, 22, hum > 0.4 ? [".kk.", "k..k", ".kk."] : ["k..k", ".kk."], [hover]);
      lights([[11, 9], [20, 8]], [hover]);
    } else if (stage === 1) {
      const c = chest([15, 18.5]);
      parts.push(
        ...rig(flukes([21, 20], 10), { mat: "body", prims: [path([[21, 20], [25.5, 17], [27, 12.5]], 3, 1.2), ell(25, 10.8, 2.5, 1.2, -40), ell(28.5, 11.8, 2.2, 1.1, 50)],
          paint: [{ mat: "aurora", prims: [ell(28.9, 11.9, 1.4)] }] }),
        ...rig(paddle([21.8, 20.6], 0.6, -7), { mat: "fin", glow: true, back: true, prims: [ell(23.8, 21.5, 2.4, 1.1, 25)] }),
        ...rig([c, hover], { mat: "body", prims: [ell(15, 18.5, 9.5, 6.5)], paint: [{ mat: "belly", level: 3, prims: [ell(14, 25.2, 8.5, 3.8)] }, { mat: "belly", level: 4, prims: [ell(14, 24.2, 8.5, 2.6)] }] }),
        ...rig(paddle([8.4, 19.6], 0.1, 7), { mat: "fin", glow: true, prims: [ell(5.3, 21, 3.3, 1.5, -25)],
          paint: [{ mat: "aurora", prims: [ell(2.8, 22.5, 1.6)] }] }),
        ...rig([hover], { mat: "star", glow: true, prims: [star(12, 9.4, 2.8, 0.3)] }),
      );
      decals.push(...rig([hover], ...eyes([10, 17], [16, 17], look, "tall"), ...blush([8, 21], [18, 21])));
      mouth(12, 21, hum > 0.4 ? [".kk.", "k..k", ".kk."] : ["k..k", ".kk."], [hover]);
      decals.push(...rig([c, hover], constellation(15, 13), stamp(21, 16, ["s"], { s: "star:5" })));
      lights([[15, 13], [20, 14], [18, 16], [21, 16]], [c, hover]);
    } else {
      const c = chest([15, 16.5]);
      parts.push(
        ...rig(flukes([21, 16], 13), { mat: "body", prims: [path([[21, 16], [25.5, 11.5], [27, 6.5]], 4, 1.5), ell(24.8, 4.6, 2.9, 1.4, -35), ell(28.6, 5.4, 2.4, 1.2, 55)],
          paint: [{ mat: "aurora", prims: [ell(29.4, 5.8, 1.6), ell(22.6, 4, 1.4)] }] }),
        ...rig(paddle([22, 20], 0.6, -6), { mat: "fin", glow: true, back: true, prims: [path([[22, 20], [26, 20.5], [29, 22.5]], 2.4, 1)],
          paint: [{ mat: "aurora", prims: [ell(28.5, 22.3, 1.8)] }] }),
        ...rig([c, hover], { mat: "body", prims: [ell(15, 16.5, 11, 8.3)], paint: [{ mat: "belly", level: 3, prims: [ell(14, 25.4, 10, 5)] }, { mat: "belly", level: 4, prims: [ell(14, 24.2, 10, 3.2)] }] }),
        ...rig(paddle([7.5, 21.5], 0.1, 6), { mat: "fin", glow: true, prims: [path([[7.5, 21.5], [4, 23], [1.8, 26]], 2.8, 1.2)],
          paint: [{ mat: "aurora", prims: [ell(2.2, 25.3, 2.3)] }] }),
        ...rig([hover], { mat: "star", glow: true, prims: [star(9.5, 5.5, 3, 0.35)] }),
      );
      decals.push(...rig([hover], ...eyes([9, 13], [16, 13], look, "tall"), ...blush([7, 17], [18, 17])));
      if (hum > 0.4) mouth(12, 17, [".k.", "k.k", ".k."], [hover]);
      else mouth(11, 17, ["k...k", ".kkk."], [hover]);
      decals.push(...rig([c, hover],
        constellation(17, 10),
        stamp(20, 17, ["s.", "..", ".s"], { s: "star:5" }),
        stamp(5, 12, ["s"], { s: "star:5" }),
        stamp(13, 11, ["s"], { s: "star:5" }),
        stamp(24, 15, ["s"], { s: "star:5" }),
      ));
      decals.push(...twinkle(1, 3, t, 0.1, "star:5"), ...twinkle(28, 16, t, 0.45), ...twinkle(0, 16, t, 0.75, "fin:5"));
      if (pose !== "sleep") decals.push(...twinkle(15, 0, t, 0.3));
      lights([[5, 12], [13, 11], [17, 10], [20, 13], [22, 11], [24, 15], [20, 17], [21, 19]], [c, hover]);
    }
    // At the canvas top the adult's "z" drifts sideways only, so it never
    // leaves the canvas.
    if (pose === "sleep") decals.push(stage === 2 ? zzz(16, 0) : zzz(26, 2));
    return { parts, decals, head: [hover], neck: [hover] };
  },
};

// ── helpers: thread / web lines as crisp 1px decals ──

/** True inside any of the given ellipses/paths grown by `pad` px — keeps
 *  web lines off the creature. */
function covered(prims: Prim[], x: number, y: number, pad = 1.2): boolean {
  for (const p of prims) {
    if (p.k === "ell") {
      const dx = (x - p.c[0]) / (p.r[0] + pad);
      const dy = (y - p.c[1]) / (p.r[1] + pad);
      if (dx * dx + dy * dy <= 1) return true;
    } else if (p.k === "path" || p.k === "cap") {
      const pts = p.k === "path" ? p.pts : [p.a, p.b];
      const r = (p.k === "path" ? Math.max(p.r0, p.r1) : Math.max(p.ra, p.rb)) + pad;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const ex = bx - ax;
        const ey = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
        if (Math.hypot(x - ax - ex * t, y - ay - ey * t) <= r) return true;
      }
    }
  }
  return false;
}

/** 1px lines (Bresenham) as one decal, skipping pixels near `hide`. */
function lines(segs: [V, V][], ink: string, hide: Prim[] = [], over = true): Decal {
  const g: string[][] = Array.from({ length: 32 }, () => Array(32).fill("."));
  for (const [a, b] of segs) {
    let x0 = Math.round(a[0]);
    let y0 = Math.round(a[1]);
    const x1 = Math.round(b[0]);
    const y1 = Math.round(b[1]);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < 32 && y0 < 32 && !covered(hide, x0 + 0.5, y0 + 0.5)) g[y0][x0] = "w";
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  return { x: 0, y: 0, rows: g.map((r) => r.join("")), inks: { w: ink }, over };
}

/** Points of a radial web: `spokes` rays and polygonal rings through them. */
function webPt(cx: number, cy: number, i: number, r: number, spokes: number, rot: number): V {
  const a = ((rot + (i * 360) / spokes) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}
function web(cx: number, cy: number, radii: number[], spokes: number, rot = 0): [V, V][] {
  const segs: [V, V][] = [];
  const R = radii[radii.length - 1];
  for (let i = 0; i < spokes; i++) segs.push([[cx, cy], webPt(cx, cy, i, R, spokes, rot)]);
  for (const r of radii) {
    for (let i = 0; i < spokes; i++) segs.push([webPt(cx, cy, i, r, spokes, rot), webPt(cx, cy, i + 1, r, spokes, rot)]);
  }
  return segs;
}

// ── Batling ──

/** Bat wings wrapped shut like a cloak: pointed wrists above the
 *  shoulders, a zig-zag hem at the finger tips, the left wing overlapping
 *  the right so a seam runs down the front. Authored at adult size around
 *  the bottom-center pivot (16, 30.8); `s` scales it for younger stages. */
function batCloak(s: number): Part[] {
  const P = (x: number, y: number): V => [16 + (x - 16) * s, 30.8 + (y - 30.8) * s];
  const left: V[] = [
    [4.4, 5.6], [4.6, 9.6], [3, 14.6], [2.8, 21], [3.4, 26.6], [4.6, 30.4], [7.8, 27.6], [10.8, 30.8],
    [13.8, 28], [17.6, 30.8], [17.8, 24], [15.6, 19.4], [11, 15], [7.6, 10.6],
  ];
  const r = 0.45;
  return [
    { mat: "wing", prims: [poly(left.map(([x, y]) => P(32 - x, y)), r)] },
    { mat: "wing", prims: [poly(left.map(([x, y]) => P(x, y)), r)] },
  ];
}

export const batling: Species = {
  id: "batling",
  name: "Duskwing",
  element: "moon",
  tier: "common",
  stages: ["Batling", "Flutterpuff", "Duskwing"],
  palette: { fur: "#b4a6ea", wing: "#7a58aa", fluff: "#f4dfb4" },
  shiny: { fur: "#f3c08e", wing: "#9c4f58", fluff: "#fff2d8" },
  lore: "Sleeps upside down between two tall books and wakes the moment you switch off the lamp. Wraps itself in its wings like a reader in a blanket.",
  hint: "A blanket with ears, waiting for dusk.",
  // Snug in its wings: a soft breath through the fur, the ears tilting in
  // turn, a ripple along the cloak's hem. Its act is a slow stretch — the
  // wings ease open, eyes closed, then wrap it up again.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const open = a < 0 ? 0 : ease(0.06, 0.4)(a) * (1 - ease(0.6, 0.94)(a));
    const look = awake(pose) && open < 0.4 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The fur ball swells on the breath; the face and ears ride it. */
    const swell = (cy: number, ry: number): Move => ({ at: [16, cy + ry], wave: (u) => Math.max(breath(u), Math.round(open)), grow: [0.03, 0.5 / ry] });
    const ear = (base: V, tip: V, inner: V, w: number, ms: Move[]): Part => ({
      mat: "fur",
      prims: both(poly([[base[0] - w * 0.2, base[1]], tip, [base[0] + w, base[1] - w * 0.55]], 0.9)),
      paint: [{ mat: "blush", prims: both(poly([[base[0] + 0.6, base[1] - 1.2], [inner[0], inner[1]], [base[0] + w - 1.4, base[1] - w * 0.55 - 0.2]], 0)) }],
      move: [
        // Each ear tilts out and back in turn, eased.
        { at: [base[0] + w * 0.4, base[1]], wave: sine(1, 0), turn: -3 * calm, side: "left" },
        { at: [base[0] + w * 0.4, base[1]], wave: sine(1, 0.5), turn: -3 * calm, side: "right", pair: true },
        ...ms,
      ],
    });
    /** The cloak: a ripple runs down its hem; in the stretch the wings
     *  swing open about the shoulders. */
    const cloak = (s: number): Part[] => {
      const shoulder: V = [16 - 4.5 * s, 30.8 - 22 * s];
      return rig(
        [
          { at: shoulder, wave: sine(1, 0.25), turn: 2 * calm, bend: 22 * s, lag: 0.35, pair: true },
          { at: shoulder, wave: () => open, turn: 13, pair: true },
        ],
        ...batCloak(s),
      );
    };
    const face = (ey: number, ms: Move[]) => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], look, "tall"), ...blush([10, ey + 4], [20, ey + 4])));
      decals.push(...rig(ms, stamp(15, ey + 4, ["kk", "w."], { k: "eye:3", w: "white:4" })));
    };
    let head: Move[];
    if (stage === 0) {
      head = [swell(22.6, 5.8)];
      parts.push(
        ear([10, 20.4], [8.4, 11.6], [9.6, 14.4], 5, head),
        ...cloak(0.55),
        ...rig(head, { mat: "fur", round: 8, prims: [ell(16, 22.6, 6.8, 5.8)] }),
      );
      face(20, head);
    } else if (stage === 1) {
      head = [swell(16.2, 5.6)];
      parts.push(
        ear([10, 15.6], [8, 5.6], [9.2, 8.8], 5, head),
        ...cloak(0.74),
        { mat: "fluff", line: false, prims: [ell(16, 22, 3.4, 1.8)], paint: [{ mat: "fluff", level: 4, prims: [ell(16, 21.6, 3.4, 1.6)] }] },
        ...rig(head, { mat: "fur", round: 8, prims: [ell(16, 16.2, 6.8, 5.6)] }),
      );
      face(15, head);
    } else {
      head = [swell(13, 6.2)];
      parts.push(
        ear([9.4, 11], [6.8, 2.2], [8.2, 5.4], 5.6, head),
        ...cloak(1),
        { mat: "fluff", line: false, prims: [ell(16, 20.4, 4.4, 2.2)], paint: [{ mat: "fluff", level: 4, prims: [ell(16, 20, 4.4, 2)] }] },
        ...rig(head, { mat: "fur", round: 9, prims: [ell(16, 13, 7.2, 6.2)] }),
      );
      face(12, head);
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head, neck: [] };
  },
};

// ── Glowbug ──

export const glowbug: Species = {
  id: "glowbug",
  name: "Glowbug",
  element: "moon",
  tier: "common",
  stages: ["Glowgrub", "Blinkbug", "Glowbug"],
  palette: { shell: "#8293de", wing: "#a9c6f2", glow: "#dcf76c" },
  shiny: { shell: "#d97a98", wing: "#f2b6d2", glow: "#7ff2ff" },
  lore: "Blinks once for every line you read, and twice when you skip one. Bookworms who stay up late tend to collect a few.",
  hint: "A small lantern that found its own wings.",
  // Its lantern breathes light, a soft glow swelling and fading through
  // the loop; the antennae sway with their tips trailing, and the winged
  // stages hover a pixel on slow, fanning wings. Its act is two happy
  // blinks: the lantern flashes bright twice, its eyes blinking along
  // and a glint winking off each flash, the wings fanning a little wider.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const flash = a < 0 ? 0 : Math.max(pulse(0.16, 0.2)(a), pulse(0.42, 0.2)(a));
    const fan = a < 0 ? 0 : ease(0.1, 0.24)(a) * (1 - ease(0.56, 0.72)(a));
    const look = awake(pose) && flash < 0.5 ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    /** How bright the lantern is: it breathes between dim and its usual
     *  glow over the idle loop, and flashes bright in the act. Drawn as a
     *  core repainted a step dimmer or brighter, so it changes in steps. */
    const light = (u: number) => Math.max(rise(1, 0.1)(u) * 0.55 + 0.05, flash);
    const glowCore = (c: V, r: V): Paint[] => {
      if (t === undefined) return [];
      const g = light(t);
      return g > 0.6 ? [{ mat: "glow", level: 5, prims: [ell(c[0], c[1], r[0] * 0.8, r[1] * 0.8)] }]
        : g < 0.2 ? [{ mat: "glow", level: 4, prims: [ell(c[0], c[1], r[0] * 0.55, r[1] * 0.55)] }] : [];
    };
    /** A glint off each flash. */
    const glints = (pts: V[], ms: Move[]) => {
      if (a < 0) return;
      decals.push(...rig(ms, ...twinkle(pts[0][0], pts[0][1], a, 0.18, "glow:5", 0.18), ...twinkle(pts[1][0], pts[1][1], a, 0.44, "glow:5", 0.18)));
    };
    /** Antennae sway as a mirrored pair, the glowing tips trailing. */
    const antennae = (x0: number, y0: number, tip: V, r: number, ms: Move[]): Part[] => {
      const pts: V[] = [[x0, y0], [x0 - 1, (y0 + tip[1]) / 2 - 0.4], tip];
      const sway: Move = { at: [x0, y0], wave: (u) => calm * sine(1, 0.1)(u), turn: 7, bend: Math.hypot(tip[0] - x0, tip[1] - y0), lag: 0.3, pair: true };
      const c: V = [tip[0] - 0.4, tip[1] - 0.2];
      return [
        { mat: "shell", line: false, prims: both(path(pts, 0.9, 0.8)), move: [sway, ...ms] },
        { mat: "glow", glow: true, line: false, prims: both(ell(c[0], c[1], r)), move: [...carried([sway], c, reachOf(pts, 0.9, [x0, y0]), true), ...ms] },
      ];
    };
    const face = (ey: number, ms: Move[], style: "tall" | "round" = "tall") => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], look, style), ...blush([10, ey + 4], [20, ey + 4])));
      decals.push(...rig(ms, stamp(15, ey + 4, ["kk"], { k: "eye:3" })));
    };
    if (stage === 0) {
      // The grub: it breathes as one blob, the lantern behind it glowing.
      const swell: Move = { at: [16, 28.8], wave: stepped(rise(1)), grow: [0.02, 0.07] };
      parts.push(
        { mat: "glow", glow: true, prims: [ell(23, 25.8, 3.4, 3.1)], paint: glowCore([23, 25.8], [3.4, 3.1]) },
        { mat: "shell", prims: [ell(19.6, 26.4, 2.8, 2.6)] },
        ...rig([swell], { mat: "shell", round: 7, prims: [ell(15, 23.2, 6.4, 5.6)] }),
        ...antennae(13, 18, [11.4, 14.8], 1, [swell]),
      );
      decals.push(...rig([swell], ...eyes([11, 21], [17, 21], look, "tall"), ...blush([9, 25], [19, 25])));
      decals.push(...rig([swell], stamp(14, 25, ["kk"], { k: "eye:3" })));
      glints([[25, 20], [27, 22]], []);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    /** The hover: up a pixel and back on a slow rise. */
    const hover: Move = { at: [16, 16], wave: stepped(rise(1)), shift: [0, -1] };
    /** The wings fan slowly from the shoulders, a little wider in the act. */
    const wings = (root: V, phase: number): Move[] => [
      { at: root, wave: (u) => calm * sine(1, phase)(u), turn: 6, pair: true },
      { at: root, wave: () => fan, turn: 7, pair: true },
      hover,
    ];
    if (stage === 1) {
      parts.push(
        ...rig(wings([12, 15.4], 0.2), { mat: "wing", glow: true, prims: both(cap(12, 15.4, 8, 10.6, 1.4, 3)) }),
        ...rig([hover], { mat: "glow", glow: true, prims: [ell(16, 24, 4.6, 4.2)], paint: glowCore([16, 24], [4.6, 4.2]) }),
        ...rig([hover], { mat: "shell", round: 8, prims: [ell(16, 16.4, 6.8, 5.8)] }),
        ...antennae(13.6, 11.4, [10.6, 6.4], 1.2, [hover]),
      );
      face(15, [hover]);
      glints([[21, 25], [9, 24]], [hover]);
    } else {
      parts.push(
        ...rig(wings([12, 17.4], 0.3), { mat: "wing", glow: true, prims: both(cap(12, 17.4, 6.6, 20, 1.4, 2.8)) }),
        ...rig(wings([11.6, 12.6], 0.2), { mat: "wing", glow: true, prims: both(cap(11.6, 12.6, 5.8, 6.2, 1.8, 4)) }),
        ...rig([hover], { mat: "glow", glow: true, prims: [ell(16, 23.4, 6.2, 5.2)], paint: glowCore([16, 23.4], [6.2, 5.2]) }),
        ...rig([hover], { mat: "shell", prims: [ell(16, 18.2, 5, 2.2)] }),
        ...rig([hover], { mat: "shell", round: 9, prims: [ell(16, 12.8, 7.4, 6.2)] }),
        ...antennae(13.2, 7.2, [9.4, 2.4], 1.4, [hover]),
      );
      face(11, [hover]);
      glints([[23, 25], [7, 23]], [hover]);
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(26, 25) : zzz(25, 2));
    return { parts, decals, head: [hover], neck: [hover] };
  },
};

// ── Raven ──

export const raven: Species = {
  id: "raven",
  name: "Nightraven",
  element: "moon",
  tier: "rare",
  stages: ["Inkchick", "Quillraven", "Nightraven"],
  palette: { plume: "#5a64b0", beak: "#b9bcdc", key: "#f6cb5c" },
  shiny: { plume: "#dcd6f2", beak: "#7c78b0", key: "#7fd8ff" },
  lore: "Collects the keys to locked diaries and the last lines of unfinished poems. It will trade either for a good bookmark.",
  hint: "Clever dark feathers, and something that opens.",
  // A slow breath through the chest, the head riding it a beat behind, the
  // crest and tail feathers swaying, and the adult's key swinging gently
  // from its beak. Its act is a curious head-cock: the head tips to peer
  // at something, blinks once, the key swings and glints, and it rights
  // itself.
  motion: { idle: 3.4, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const cock = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.64, 0.88)(a));
    const look = awake(pose) && !(a >= 0.4 && a < 0.47) ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const eyeInk = "key:3";
    const star = (x: number, y: number) => stamp(x, y, ["s"], { s: "key:5" });
    /** A glint on the key (or the beak's tip) as it peers. */
    const glint = (x: number, y: number, ms: Move[]) => {
      if (cock > 0.6) decals.push(...rig(ms, ...twinkle(x, y, a, 0.36, "key:5", 0.24)));
    };
    if (stage === 0) {
      // The chick is one round blob: it swells on the breath, and leans in
      // to peer, beak and all.
      const swell: Move = { at: [16, 29], wave: breath, grow: [0.02, 0.06] };
      const lean: Move = { at: [16, 29], wave: () => cock, turn: -6 };
      const tuft = (root: V): Move => ({ at: root, wave: (u) => calm * sine(1, 0.3)(u), turn: 8, bend: 3.5, lag: 0.3 });
      const head = [lean, swell];
      parts.push(
        { mat: "beak", prims: [cap(14, 27.5, 13.6, 29.8, 0.9), cap(17.4, 27.5, 17.8, 29.8, 0.9)] },
        ...rig(head, { mat: "plume", round: 7, prims: [ell(16, 23.2, 7, 6.2), ...rig([tuft([17.5, 17.8])], path([[17.5, 17.8], [19, 14.6]], 1.3, 0.8)),
          ...rig([tuft([15.6, 17.6])], path([[15.6, 17.6], [15.4, 14.8]], 1, 0.8))], blend: 1.5 }),
        ...rig(head, { mat: "plume", prims: [ell(21.4, 24.6, 2, 3.2, -25)] }),
        ...rig(head, { mat: "beak", prims: [poly([[13.2, 22], [9.4, 23.2], [8.2, 24.2], [9.6, 24.8], [13.2, 25.2]], 0.6)] }),
      );
      decals.push(...rig(head, ...eyes([11, 20], [16, 20], look, "tall", eyeInk), stamp(18, 24, ["bb"], { b: "blush:3" })));
      glint(7, 22, head);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head, neck: [swell] };
    }
    /** The chest swells on the breath; the head rides it a beat behind and
     *  cocks about the neck to peer. */
    const neck: V = stage === 1 ? [15, 17] : [15, 15];
    const chest: Move = { at: [16.4, 29], wave: breath, grow: [0.02, 0.05] };
    const lift: Move = { at: neck, wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const tilt: Move = { at: neck, wave: () => cock, turn: -10 };
    const head = [tilt, lift];
    /** Crest feathers sway a beat after the head. */
    const crest = (root: V, len: number): Move => ({ at: root, wave: (u) => calm * sine(1, 0.25)(u), turn: 8, bend: len, lag: 0.3 });
    /** The tail sways from under the body. */
    const tail = (root: V): Move => ({ at: root, wave: (u) => calm * sine(1, -0.1)(u), turn: 6 });
    if (stage === 1) {
      parts.push(
        ...rig([tail([18.5, 22])], { mat: "plume", back: true, prims: [poly([[16.5, 22], [20.5, 22], [24, 29.6], [19, 30]], 0.6)] }),
        { mat: "beak", prims: [path([[13.6, 26], [13.2, 29.8], [11.4, 30]], 0.9), path([[17, 26], [17.2, 29.8], [15.4, 30]], 0.9)] },
        { mat: "plume", prims: [...rig(head, ell(15, 13.6, 5.6, 5)), ...rig([chest], ell(16.4, 21.8, 5.8, 6.4, -8)),
          ...rig([crest([17.6, 9.6], 3.5), ...head], path([[17.6, 9.6], [20.2, 7.2]], 1.2, 0.8)), path([[11.6, 17], [12.2, 19.6]], 1.4, 0.8)], blend: 3 },
        ...rig([chest], { mat: "plume", prims: [path([[19, 16], [21, 21.6], [21.6, 27.6]], 3, 1)] }),
        ...rig(head, { mat: "beak", prims: [poly([[12.6, 12.4], [8.6, 13.4], [5.4, 15], [6.8, 15.8], [9.6, 16.2], [12.6, 16.4]], 0.6)] }),
      );
      decals.push(...rig(head, ...eyes([10, 11], [15, 11], look, "round", eyeInk)));
      decals.push(...rig([chest], star(20, 20), star(15, 23), star(22, 25)));
      glint(4, 13, head);
    } else {
      /** The key swings from the beak's tip, a beat behind the head: its
       *  shaft steps a pixel to either side below the bow, as a pixel
       *  artist would tilt a thin line. Mid-peer it swings a little more. */
      const sway = t === undefined ? 0 : Math.round(calm * 0.9 * sine(1, -0.15)(t) + cock * Math.sin(Math.PI * 4 * a) * 0.7);
      const key = [".k.", "k.k", ".k.", ".k.", ".kk", ".k.", ".kk"];
      const keyRows = t === undefined ? key : key.map((r, i) => (i < 4 ? `.${r}.` : sway < 0 ? `${r}..` : sway > 0 ? `..${r}` : `.${r}.`));
      parts.push(
        ...rig([tail([19.5, 22])], { mat: "plume", back: true, prims: [poly([[17, 22], [22, 22], [26.4, 30.4], [20.4, 30.8]], 0.6)] }),
        { mat: "beak", prims: [path([[14, 25.4], [13.4, 29.8], [11.2, 30]], 1), path([[18, 25.4], [18.4, 29.8], [16.2, 30]], 1)] },
        { mat: "plume", prims: [...rig(head, ell(15, 11, 6.2, 5.6)), ...rig([chest], ell(16.6, 20.4, 6.8, 7.4, -8)),
          ...rig([crest([18.6, 6.6], 4.5), ...head], path([[18.6, 6.6], [22, 3.8]], 1.5, 0.8)), ...rig([crest([16.4, 5.8], 4), ...head], path([[16.4, 5.8], [17.8, 2.2]], 1.3, 0.8)),
          path([[10.6, 15], [11, 18.8]], 1.6, 0.8), path([[13, 16], [13.8, 19.4]], 1.3, 0.8)], blend: 3 },
        ...rig([chest], { mat: "plume", prims: [path([[19.6, 13.8], [22.6, 20.4], [23.6, 27.8]], 3.6, 1)],
          paint: [{ mat: "plume", level: 4, prims: [path([[18.6, 14.2], [20.2, 18.2]], 0.9)] }] }),
        ...rig(head, { mat: "beak", prims: [poly([[12.4, 9.6], [8, 10.6], [3.6, 12.8], [4.4, 14], [8.4, 14.2], [12.4, 14.4]], 0.6)] }),
      );
      decals.push(...rig(head, ...eyes([9, 8], [15, 8], look, "round", eyeInk)));
      // The key, hanging from the beak tip by its bow.
      decals.push(...rig(head, stamp(t === undefined ? 3 : 2, 14, keyRows, { k: "key:4" })));
      decals.push(...rig([chest], twinkleSpot(20, 19, "key:5"), star(15, 21), star(22, 25), star(18, 26), star(12, 19)));
      decals.push(...twinkle(27, 11, t, 0.2, "key:5"));
      glint(sway, 17, head);
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head, neck: [lift] };
  },
};

// ── Slumbersloth ──

export const slumbersloth: Species = {
  id: "slumbersloth",
  name: "Slumbersloth",
  element: "moon",
  tier: "rare",
  stages: ["Snugglet", "Drowsloth", "Slumbersloth"],
  palette: { fur: "#bca78f", mask: "#f3e8d2", bark: "#9c7c64", cap: "#7c9ef0", gold: "#ffd970" },
  shiny: { fur: "#d4d0ea", mask: "#fffaf2", bark: "#8a7fb4", cap: "#f08cb0", gold: "#8ff0ff" },
  lore: "Reads one sentence per night, very thoroughly. Has been on the same bedtime story for three years and loves every word.",
  hint: "Hangs on, nods off, never lets go.",
  // Hanging from its branch it sways like a slow pendulum, the nightcap's
  // tip and pompom swinging a beat behind (the little one, sitting,
  // breathes instead). Its act is a drowsy nod: the eyes close, the face
  // and cap sink a pixel as it dozes over its sentence, then it lifts its
  // head and blinks twice, sleepily.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const nod = a < 0 ? 0 : ease(0.1, 0.34)(a) * (1 - ease(0.6, 0.8)(a));
    const look = awake(pose) && nod < 0.3 && !(a >= 0.84 && a < 0.88) ? pose : "blink";
    const calm = pose === "sleep" ? 0.4 : 1;
    /** Mid-nod the face and cap sink a pixel. */
    const droop: Move = { at: [16, 16], wave: () => Math.round(nod), shift: [0, 1] };
    /** Cream mask with the drooping dark patches round the eyes. */
    const face = (cx: number, cy: number, s = 1, ms: Move[] = []): Paint[] => [
      { mat: "mask", level: 4, prims: rig(ms, ell(cx, cy + 0.4 * s, 5.4 * s, 4 * s)) },
      { mat: "bark", level: 1, prims: rig(ms, ell(cx - 3.2 * s, cy + 0.9 * s, 2.5 * s, 1.3 * s, -28), ell(cx + 3.2 * s, cy + 0.9 * s, 2.5 * s, 1.3 * s, 28)) },
    ];
    const features = (ey: number, style: "tall" | "round", ms: Move[]) => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], look, style)));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(...rig(ms, stamp(14, ny, ["k..k", ".kk."], { k: "bark:1" })));
    };
    /** Floppy nightcap: a cone flopping over to the right, cream brim, gold
     *  pompom. (cx, by) is the brim center; s scales it. Its tip swings a
     *  beat behind whatever carries it, the pompom riding the tip. */
    const nightcap = (cx: number, by: number, s: number, ms: Move[]): Part[] => {
      const P = (x: number, y: number): V => [cx + x * s, by + y * s];
      const cone = [P(-4, -1), P(1, -4.4), P(6, -3.6), P(9, 0.4), P(9.8, 3.6)];
      const flop: Move = { at: P(3, -4), wave: (u) => (1 - nod) * calm * sine(1, -0.3)(u), turn: 8, bend: 8 * s, lag: 0.3 };
      return [
        { mat: "cap", prims: [path(cone, 3.4 * s, 0.9)], move: [flop, ...ms] },
        { mat: "mask", prims: [ell(...P(0, 0), 6.6 * s, 1.5 * s)], move: ms },
        { mat: "gold", prims: [ell(...P(10, 4.6), 1.7 * s)], move: [...carried([flop], P(10, 4.6), reachOf(cone, 3.4 * s, P(3, -4))), ...ms] },
      ];
    };
    if (stage === 0) {
      // Sitting: it breathes as one round blob, cap and all.
      const swell: Move = { at: [16, 29.8], wave: stepped(rise(1)), grow: [0.02, 0.06] };
      parts.push(
        ...rig([swell], { mat: "fur", round: 8, prims: [ell(16, 23.4, 7.4, 6.4)], paint: face(16, 22.6, 0.85, [droop]) }),
        ...rig([swell], { mat: "fur", prims: both(path([[9.8, 25.2], [12, 27.8], [14.4, 27.8]], 1.6, 1.3)) }),
        ...nightcap(16, 18.2, 0.8, [droop, swell]),
      );
      features(21, "tall", [droop, swell]);
      if (pose === "sleep") decals.push(zzz(26, 5));
      return { parts, decals, head: [droop, swell], neck: [swell] };
    }
    /** Hanging, it sways from its grip on the branch like a slow pendulum:
     *  the body swings a pixel to each side and the arms tilt about the
     *  hands so they stay on the branch. Stilled while it dozes. */
    const swing = (u: number) => (1 - nod) * (pose === "sleep" ? 0.6 : 1) * sine(1, 0)(u);
    const sway: Move = { at: [16, 16], wave: swing, shift: [1, 0] };
    /** An arm tilts about its hand by the angle that carries its elbow end
     *  the same pixel. */
    const arm = (pts: V[], r0: number, r1: number): Prim[] => {
      const hand = pts[pts.length - 1];
      const deg = -180 / Math.PI / reachOf(pts, r0, hand);
      const [l, rt] = both(path(pts, r0, r1));
      return [...rig([{ at: hand, wave: swing, turn: deg }], l), ...rig([{ at: [32 - hand[0], hand[1]], wave: swing, turn: deg }], rt)];
    };
    const head = [droop, sway];
    if (stage === 1) {
      parts.push(
        { mat: "bark", prims: [path([[4.6, 6.4], [16, 5.6], [27.4, 6.2]], 1.3, 1.1)] },
        ...rig([sway], { mat: "fur", round: 9, prims: [ell(16, 20.6, 7.2, 7.4)], paint: face(16, 18.2, 0.9, [droop]) }),
        { mat: "fur", prims: arm([[10.6, 18.6], [10.2, 12], [11.6, 7]], 1.8, 1.4) },
        { mat: "mask", line: false, prims: both(path([[11.2, 5.6], [12.2, 4.6], [13.4, 5.2]], 0.8)) },
        ...rig([sway], { mat: "fur", prims: both(ell(12, 27.4, 2.2, 1.8)) }),
        ...nightcap(16, 13.8, 0.8, head),
      );
      features(17, "tall", head);
    } else {
      parts.push(
        { mat: "bark", prims: [path([[2.4, 5.2], [10, 4.4], [22, 4.6], [29.6, 5.8]], 1.5, 1.2), path([[22.6, 4.6], [25.2, 2.4]], 0.9, 0.8)] },
        ...rig([sway], { mat: "fur", round: 10, prims: [ell(16, 19.4, 8.8, 9.2)],
          paint: [...face(16, 16.4, 1, [droop]), { mat: "gold", prims: [ell(15.6, 24.8, 2.6)], cut: [ell(17.1, 23.9, 2.2)] }] }),
        { mat: "fur", prims: arm([[9.4, 18.4], [9, 11], [10.8, 5.8]], 2.3, 1.7) },
        { mat: "mask", line: false, prims: both(path([[10.2, 4.4], [11.4, 3], [13, 3.6]], 0.85)) },
        ...rig([sway], { mat: "fur", prims: both(ell(11.6, 28, 2.8, 2)) }),
        ...nightcap(16, 11.2, 1, head),
      );
      features(15, "round", head);
    }
    if (pose === "sleep") decals.push(zzz(26, 20));
    return { parts, decals, head, neck: [sway] };
  },
};

// ── Starweaver ──

export const starweaver: Species = {
  id: "starweaver",
  name: "Starweaver",
  element: "moon",
  tier: "epic",
  stages: ["Spinlet", "Threadling", "Starweaver"],
  palette: { body: "#e79ab8", web: "#9cc4f0", star: "#ffe27a" },
  shiny: { body: "#6cc7b6", web: "#f0a8d8", star: "#fff0a0" },
  lore: "Weaves the constellations back together whenever the sky gets dog-eared. Reads by the light of its own web.",
  hint: "It mends the sky one thread at a time.",
  // A slow breath, the abdomen and its star swaying a beat behind, the
  // sparkles on its web winking in turn. Its act mends the sky: the
  // hatchling sends a glint up its thread to light the star it hangs from;
  // the grown ones give their web a gentle tug and light runs out through
  // it ring by ring, the far stars twinkling as it arrives.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const face = (ey: number, look: Pose, ms: Move[]) => {
      decals.push(...rig(ms, ...eyes([12, ey], [18, ey], look, "tall"), ...blush([10, ey + 3], [20, ey + 3])));
      decals.push(...rig(ms, stamp(13, ey - 2, ["k....k"], { k: "eye:3" }), stamp(15, ey + 3, ["kk"], { k: "eye:3" })));
    };
    if (stage === 0) {
      // A glint climbs the thread and lights the star it hangs from.
      const climb = a < 0 ? -1 : (a - 0.2) / 0.3;
      const lit = a < 0 ? 0 : ease(0.44, 0.52)(a) * (1 - ease(0.7, 0.82)(a));
      const look = awake(pose) && lit < 0.4 ? pose : "blink";
      const swell: Move = { at: [16, 29.8], wave: breath, grow: [0.02, 0.06] };
      /** The little legs paddle a touch, the back pair a beat later. */
      const paddle = (root: V, phase: number): Move => ({ at: root, wave: (u) => calm * sine(1, phase)(u), turn: 6, pair: true });
      parts.push(
        ...rig([paddle([11.6, 23], 0.35), swell], { mat: "body", back: true, prims: both(path([[11.6, 23], [8.6, 21.8], [7, 25]], 1, 0.85)) }),
        ...rig([paddle([11.6, 26.4], 0.1)], { mat: "body", prims: both(path([[11.6, 26.4], [9.2, 26.6], [8.6, 29.4]], 1, 0.85)) }),
        ...rig([swell], { mat: "body", round: 12, prims: [ell(16, 24, 6.6, 5.8)] }),
        { mat: "star", glow: true, prims: [star(16, 8.4, 2.6, 0.3)],
          paint: lit > 0.4 ? [{ mat: "star", level: 5, prims: [ell(16, 8.8, 1.5)] }] : undefined },
      );
      decals.push(lines([[[16, 11], [16, 17]]], "web:4"));
      if (climb >= 0 && climb < 1) decals.push(stamp(16, Math.round(17 - 6 * climb * climb * (3 - 2 * climb)), ["s"], { s: "star:5" }, true));
      if (lit > 0.4) decals.push(...twinkle(11, 5, a, 0.48, "star:5", 0.24), ...twinkle(19, 4, a, 0.54, "star:5", 0.24));
      face(22, look, [swell]);
      if (pose === "sleep") decals.push(zzz(26, 2));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    // Sits in the middle of its web, legs splayed along the threads.
    const tug = a < 0 ? 0 : pulse(0.1, 0.22)(a);
    const look = awake(pose) && tug < 0.5 ? pose : "blink";
    const k = stage === 2 ? 1 : 0.74;
    const cx = 16;
    const cy = stage === 2 ? 18.4 : 20;
    const P = (x: number, y: number): V => [cx + x * k, cy + y * k];
    /** A short two-segment leg splayed at `deg` (left side), knee lifted. */
    const leg = (deg: number): Prim[] => {
      const d = (deg * Math.PI) / 180;
      const at = (r: number, dy: number) => P(Math.cos(d) * r, Math.sin(d) * r + dy);
      return both(path([at(5.6, 0), at(10, -2), at(12.6, 0.6)], 0.95, 0.8));
    };
    /** The body breathes; in the act it tugs on the web, down a pixel. */
    const chest: Move = { at: P(0, 7.4), wave: breath, grow: [0.02, 0.05] };
    const pull: Move = { at: [16, 16], wave: () => Math.round(tug), shift: [0, 1] };
    /** The abdomen and its star sway a pixel to each side, a beat behind
     *  the breath. */
    const swing: Move = { at: P(0, -8), wave: (u) => (pose === "sleep" ? 0.6 : 1) * sine(1, -0.1)(u), shift: [1, 0] };
    const legsA = [...leg(208), ...leg(138)];
    const legsB = [...leg(172)];
    const abd = ell(...P(0, -8), 5.8 * k, 4.6 * k);
    const body = ell(...P(0, 0.6), 7.4 * k, 6.8 * k);
    const radii = stage === 2 ? [6, 10.5, 14.4] : [5, 9.5];
    const wy = stage === 2 ? 14.6 : 16;
    const hide = [abd, body, ...legsA, ...legsB, ...(pose === "sleep" ? [ell(27.5, 4, 2.6, 3.2)] : [])];
    decals.push(lines(web(cx, wy, radii, 8, 22.5), "web:3", hide));
    // After the tug, light runs out along the spokes, then travels round
    // the rim thread by thread.
    const R = radii[radii.length - 1];
    const rimAt = (j: number) => 0.4 + j * 0.04;
    if (a >= 0) {
      const lit: [V, V][] = [];
      const out = (a - 0.24) / 0.16;
      if (out >= 0 && out < 1) {
        const d = 4 + out * (R - 2);
        for (let j = 0; j < 8; j++) lit.push([webPt(cx, wy, j, d - 2.5, 8, 22.5), webPt(cx, wy, j, Math.min(d, R), 8, 22.5)]);
      }
      for (let j = 0; j < 8; j++) {
        if (a >= rimAt(j) && a < rimAt(j) + 0.14) lit.push([webPt(cx, wy, j, R, 8, 22.5), webPt(cx, wy, j + 1, R, 8, 22.5)]);
      }
      if (lit.length) decals.push(lines(lit, "web:5", hide));
    }
    parts.push(
      { mat: "body", back: true, prims: legsA },
      { mat: "body", back: true, prims: legsB },
      ...rig([swing, pull], { mat: "body", prims: [abd] }),
      ...rig([swing, pull], { mat: "star", glow: true, prims: [star(...P(0, -9), 3.9 * k, 0.3)] }),
      ...rig([chest, pull], { mat: "body", round: 12, prims: [body] }),
    );
    const node = (i: number, r: number) => webPt(cx, wy, i, r, 8, 22.5).map((v) => Math.round(v)) as V;
    // The web's sparkles wink in turn, and each twinkles as the light
    // round the rim reaches it.
    const spark = (i: number, idle: number) => {
      const reached = a >= rimAt(i) - 0.02 && a < rimAt(i) + 0.3;
      return twinkle(node(i, R)[0] - 1, node(i, R)[1] - 1, reached ? a : t, reached ? rimAt(i) : idle, "star:5");
    };
    decals.push(...spark(6, 0.15), stamp(...node(1, R), ["s"], { s: "star:5" }, true));
    if (stage === 2) {
      decals.push(
        ...spark(3, 0.6),
        stamp(...node(7, 10.5), ["s"], { s: "star:5" }, true),
        stamp(...node(4, 10.5), ["s"], { s: "star:5" }, true),
      );
    }
    face(Math.round(cy - 1.4), look, [chest, pull]);
    if (pose === "sleep") decals.push(zzz(26, 2));
    return { parts, decals, head: [chest, pull], neck: [pull] };
  },
};

export const MOON: Species[] = [mooncat, lanternwisp, batling, glowbug, jackalope, raven, slumbersloth, baku, starweaver, starwhale];
