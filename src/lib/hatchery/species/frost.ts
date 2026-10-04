import type { Pose, Species } from "../kit.ts";
import { awake, blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move, Wave } from "../motion.ts";
import { ease, pulse, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, egg, ell, path, poly } from "../pixel.ts";

// ── local helpers ──

/** Crystal shards radiating from (cx, cy): each [angle°, inner, outer, width]
 *  (0° = right, −90° = straight up). */
function shards(cx: number, cy: number, list: [number, number, number, number][]): Prim[] {
  return list.map(([deg, r0, r1, w]) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return cap(cx + c * r0, cy + s * r0, cx + c * r1, cy + s * r1, w, 0.45);
  });
}

/** Spikes rooted along a line: each [x, y, angle°, length]. */
function crest(list: [number, number, number, number][], w = 1.6): Prim[] {
  return list.map(([x, y, deg, len]) => {
    const a = (deg * Math.PI) / 180;
    return cap(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, w, 0.45);
  });
}

/** Raptor eyes (4×4 or 5×5): gold iris ring, dark pupil, one highlight.
 *  Closed, they become a happy upturned lash arc. */
function owlEyes(l: [number, number], r: [number, number], pose: Pose, size: 4 | 5 = 4): Decal[] {
  const inks = { g: "beak:4", k: "eye:3", w: "white:4" };
  const open =
    size === 4
      ? [".gg.", "gwkg", "gkkg", ".gg."]
      : [".ggg.", "gwkkg", "gkkkg", "gkkkg", ".ggg."];
  const shut = size === 4 ? [".kk.", "k..k"] : [".kkk.", "k...k"];
  if (!awake(pose)) {
    const dy = size === 4 ? 2 : 2;
    return [stamp(l[0], l[1] + dy, shut, inks), stamp(r[0], r[1] + dy, shut, inks)];
  }
  return [stamp(l[0], l[1], open, inks), stamp(r[0], r[1], open, inks)];
}

/** Points along an ellipse from a0° to a1° (0° = right, 90° = down). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): V[] {
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** A round ball with a scalloped, fluffy rim: bumps every `step`° except
 *  across the face-free bottom. */
function puffball(cx: number, cy: number, r: number, bump: number, step = 40, skip: [number, number] = [60, 120]): Prim[] {
  const prims: Prim[] = [ell(cx, cy, r, r * 0.94)];
  for (let a = -90; a < 270; a += step) {
    const n = ((a % 360) + 360) % 360;
    if (n > skip[0] && n < skip[1]) continue;
    const t = (a * Math.PI) / 180;
    prims.push(ell(cx + Math.cos(t) * (r - bump * 0.35), cy + Math.sin(t) * (r * 0.94 - bump * 0.35), bump));
  }
  return prims;
}

// ── Snowpuff · common ──

export const snowpuff: Species = {
  id: "snowpuff",
  name: "Snowpuff",
  element: "frost",
  tier: "common",
  stages: ["Snowpuff", "Yetling", "Snowpuff Yeti"],
  palette: { fur: "#dde7f8", face: "#86a9e4", ice: "#74d6ff" },
  shiny: { fur: "#d4f2e4", face: "#3fae8c", ice: "#ffc95a" },
  lore: "Rolled itself up from the snow on a library windowsill. Grows shaggier with every chapter and insists on reading under a blanket anyway.",
  hint: "A snowball that blinks back.",
  // One fluffy blob: it swells on a slow breath, the arms swaying out a
  // beat later. Its act is a happy rock: eyes shut, it rolls its weight
  // from foot to foot like a snowball settling, lifting the free foot.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const env = a < 0 ? 0 : ease(0.06, 0.24)(a) * (1 - ease(0.72, 0.94)(a));
    const rock = a < 0 ? 0 : env * Math.sin(2 * Math.PI * 1.5 * a);
    const look = env > 0.35 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The whole snowball swells on the breath and rocks about its feet. */
    const body = (h: number): Move[] => [
      { at: [16, 30], wave: (u) => breath(u) * (1 - env), grow: [0.02, 1 / h] },
      { at: [16, 30.5], wave: () => rock, turn: 5 },
    ];
    /** The free foot lifts as the weight rolls onto the other. */
    const feet: Move[] = [
      { at: [16, 30], wave: () => Math.max(0, rock), shift: [0, -1], side: "left" },
      { at: [16, 30], wave: () => Math.max(0, -rock), shift: [0, -1], side: "right" },
    ];
    /** The arms sway out and in, a beat behind the breath. */
    const arms = (sh: V, deg: number): Move => ({ at: sh, wave: sine(1, 0.15), turn: -deg * calm * (1 - env), pair: true });
    if (stage === 0) {
      const b = body(13);
      parts.push(
        ...rig(b, { mat: "ice", prims: [path([[14.4, 18.8], [13.6, 16.6], [14.4, 15.2]], 1, 0.5), path([[17.6, 18.8], [18.4, 16.6], [17.6, 15.2]], 1, 0.5)] }),
        ...rig(feet, { mat: "fur", prims: both(ell(13.2, 29.2, 1.8, 1.1)), paint: [{ mat: "face", prims: both(ell(13.2, 29.8, 1.3, 0.5)) }] }),
        ...rig(b, { mat: "fur", prims: puffball(16, 23.8, 6.2, 1.5, 45, [45, 135]), blend: 1 }),
      );
      decals.push(...rig(b,
        ...eyes([12, 22], [18, 22], look, "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(15, 25, ["kk"], { k: "eye:3" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: b, neck: b };
    } else if (stage === 1) {
      const b = body(17);
      parts.push(
        ...rig(b, { mat: "ice", prims: both(path([[12.8, 14.6], [11, 12.4], [11.2, 10]], 1.3, 0.5)) }),
        ...rig(feet, { mat: "fur", prims: both(ell(12.4, 29.2, 2.3, 1.3)), paint: [{ mat: "face", prims: both(ell(12.4, 29.9, 1.8, 0.6)) }] }),
        ...rig(b, { mat: "fur", prims: puffball(16, 21.8, 7.8, 2, 45, [50, 130]), blend: 1 }),
        ...rig([arms([9.4, 22.4], 12), ...b], { mat: "fur", prims: both(ell(8.2, 23.4, 1.9, 1.8)), paint: [{ mat: "face", prims: both(ell(8, 24.4, 1.3, 0.8)) }] }),
      );
      decals.push(...rig(b,
        ...eyes([12, 19], [18, 19], look, "tall"),
        ...blush([10, 22], [20, 22]),
        stamp(14, 22, ["kkkk", ".tt."], { k: "eye:3", t: "blush:2" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 7));
      return { parts, decals, head: b, neck: b };
    }
    const b = body(22);
    parts.push(
      ...rig(b, { mat: "ice", prims: both(path([[11.4, 10.4], [8.6, 8.2], [7.4, 5.2], [8.4, 2.6]], 1.8, 0.6)) }),
      ...rig(feet, { mat: "fur", prims: both(ell(11.8, 29.2, 3, 1.5)), paint: [{ mat: "face", prims: both(ell(11.8, 29.9, 2.3, 0.7)) }] }),
      ...rig(b, { mat: "fur", prims: puffball(16, 18.8, 10.2, 2.4, 40, [50, 130]), blend: 1 }),
      ...rig([arms([7.6, 20.4], 5), ...b], {
        mat: "fur",
        prims: both(path([[7.4, 20.4], [5.2, 22.6], [4.8, 24.4]], 2.3, 2.1)),
        paint: [{ mat: "face", prims: both(ell(4.8, 25.8, 1.4, 0.8)) }],
      }),
    );
    decals.push(...rig(b,
      ...eyes([11, 16], [19, 16], look, "tall"),
      ...blush([9, 20], [21, 20]),
      stamp(13, 20, ["kkkkkk", "kwttwk", ".kkkk."], { k: "eye:3", w: "white:4", t: "blush:2" }),
    ));
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: b, neck: b };
  },
};

// ── Frostmoth · common ──

export const frostmoth: Species = {
  id: "frostmoth",
  name: "Frostmoth",
  element: "frost",
  tier: "common",
  stages: ["Rimegrub", "Frostpupa", "Frostmoth"],
  palette: { body: "#c6c9f2", fluff: "#f1f4ff", wing: "#86d6fb" },
  shiny: { body: "#ebb9d6", fluff: "#fff4e4", wing: "#ffc466" },
  lore: "Spins its cocoon from the frost on cold windowpanes and sleeps a whole semester in it. Wakes up drawn to every reading lamp in the house.",
  hint: "Sleeps wrapped in winter, wakes up with wings.",
  // Drawn to the reading lamp at every stage. The grub ripples a slow wave
  // from tail to head; the cocoon breathes, its antennae swaying; the moth
  // eases its wings open and closed. Its act reaches for the light: the
  // grub rears up and stretches, the cocoon stirs twice, and the moth
  // fans its wings wide in one slow beat, shaking frost dust off the tips.
  motion: { idle: 3.6, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const env = a < 0 ? 0 : ease(0.08, 0.36)(a) * (1 - ease(0.62, 0.9)(a));
    const look = env > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    if (stage === 0) {
      // The crawl ripple: each segment swells up a pixel in turn, tail
      // first, and the head nods a beat after. Rearing up, the front
      // segment tips up and the head lifts two.
      const ripple = (lag: number): Wave => stepped((u) => rise(1, -lag)(u) * (1 - env));
      const seg = (x: number, ry: number, lag: number): Move => ({ at: [x, 30], wave: ripple(lag), grow: [0, 0.55 / ry] });
      const tuft = (lag: number): Move => ({ at: [0, 0], wave: ripple(lag), shift: [0, -1] });
      const rear: Move = { at: [19, 29], wave: () => env, turn: -7 };
      const head: Move[] = [
        { at: [12, 30], wave: (u) => breath(u - 0.36) * (1 - env), shift: [0, -1] },
        { at: [12, 30], wave: stepped(() => env, 2), shift: [0, -2] },
      ];
      // Feelers sway together and, rearing up, spread apart.
      const feeler = (root: V, out: number): Move[] => [
        { at: root, wave: sine(1, 0.1), turn: 6 * calm, bend: 5, lag: 0.3 },
        { at: root, wave: () => env, turn: 9 * out, bend: 4 },
        ...head,
      ];
      const fl = feeler([10.4, 20.4], -1), fr = feeler([13.6, 20.4], 1);
      parts.push(
        {
          mat: "wing",
          prims: [
            ...rig([tuft(0)], cap(24.4, 25.4, 25.2, 23.2, 0.9, 0.45)),
            ...rig([tuft(0.12)], cap(20.6, 23.6, 21, 21.2, 1, 0.45)),
            ...rig([tuft(0.24), rear], cap(17, 22.8, 17.2, 20.4, 1, 0.45)),
          ],
        },
        ...rig([seg(24.4, 2.2, 0)], { mat: "body", prims: [ell(24.4, 27.6, 2.6, 2.2)] }),
        ...rig([seg(20.8, 2.9, 0.12)], { mat: "body", prims: [ell(20.8, 26.8, 3, 2.9)] }),
        ...rig([seg(17, 3.6, 0.24), rear], { mat: "body", prims: [ell(17, 25.8, 3.4, 3.6)] }),
        { mat: "body", prims: [...rig(fl, path([[10.4, 20.4], [9.4, 18.2], [8.2, 17.6]], 0.7)), ...rig(fr, path([[13.6, 20.4], [14.6, 18.2], [15.8, 17.6]], 0.7))] },
        { mat: "wing", prims: [...rig(fl, ell(8, 17.4, 1.1)), ...rig(fr, ell(16, 17.4, 1.1))], line: false },
        ...rig(head, { mat: "body", prims: [ell(12, 24.6, 5.4, 5)] }),
      );
      decals.push(...rig(head, ...eyes([9, 22], [13, 22], look, "tall"), ...blush([7, 25], [15, 25]), stamp(11, 26, ["kk"], { k: "eye:3" })));
      if (env > 0) decals.push(...twinkle(18, 15, a, 0.3, "#e6fbff", 0.3), ...twinkle(21, 18, a, 0.44, "#e6fbff", 0.26));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head, neck: head };
    }
    if (stage === 1) {
      // The cocoon breathes as one; mid-act it stirs twice, as if
      // something inside were stretching, and its wing buds flex.
      const stir = a < 0 ? 0 : stepped((u) => pulse(0.14, 0.3)(u) + pulse(0.48, 0.3)(u))(a);
      const swell: Move[] = [
        { at: [16, 30], wave: (u) => breath(u) * (1 - env), grow: [0.02, 1 / 17] },
        { at: [16, 30], wave: () => stir, grow: [0.08, -0.03] },
      ];
      const feelers: Move = { at: [14.8, 14.4], wave: sine(1, 0.15), turn: 7 * calm, bend: 5, lag: 0.3, pair: true };
      const buds: Move = { at: [10.6, 19.6], wave: (u) => (1 - env) * calm * sine(1, 0.3)(u) + stir * 1.6, turn: 6, pair: true };
      parts.push(
        ...rig([feelers, ...swell], { mat: "body", prims: both(path([[14.8, 14.4], [13.8, 11.8], [12, 10.8]], 0.8)) }),
        ...rig([feelers, ...swell], { mat: "wing", prims: both(ell(11.4, 10.8, 1.1)), line: false }),
        ...rig([buds, ...swell], { mat: "wing", prims: both(ell(9.8, 22, 1.4, 3, -22)) }),
        ...rig(swell, {
          mat: "fluff",
          prims: [egg(16, 21.4, 6.4, 8.4, 0.3)],
          paint: [
            { mat: "body", prims: [ell(16, 18.2, 3.9, 2.8)] },
            { mat: "fluff", level: 2, prims: [cap(9.8, 22.6, 22.2, 24.6, 0.5), cap(10.4, 27.2, 21.6, 25.4, 0.5)] },
          ],
        }),
      );
      if (awake(look)) {
        const inks = { k: "eye:3", w: "white:4" };
        decals.push(...rig(swell, stamp(13, 17, ["wk", "kk"], inks), stamp(17, 17, ["wk", "kk"], inks)));
      } else {
        decals.push(...rig(swell, stamp(13, 18, ["kk"], { k: "eye:3" }), stamp(17, 18, ["kk"], { k: "eye:3" })));
      }
      decals.push(...rig(swell, ...blush([12, 19], [19, 19], 1), stamp(15, 20, ["kk"], { k: "body:1" })));
      if (env > 0) decals.push(...twinkle(21, 12, a, 0.22, "#e6fbff", 0.3), ...twinkle(8, 15, a, 0.54, "#e6fbff", 0.3));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: swell, neck: swell };
    }
    // The moth: wings ease open and closed about the shoulders, the hind
    // pair a beat behind; in the act they fan up wide once and settle.
    const late = a < 0 ? 0 : ease(0.12, 0.42)(a) * (1 - ease(0.66, 0.94)(a));
    const fore: Move[] = [
      { at: [14.6, 15], wave: sine(1, 0.1), turn: 4 * calm * (1 - env), pair: true },
      { at: [14.6, 15], wave: () => env, turn: 8, pair: true },
    ];
    const hind: Move[] = [
      { at: [14.6, 19.5], wave: sine(1, 0.02), turn: 5 * calm * (1 - env), pair: true },
      { at: [14.6, 19.5], wave: () => late, turn: 9, pair: true },
    ];
    const head: Move[] = [{ at: [16, 16], wave: (u) => breath(u - 0.08), shift: [0, -1] }];
    const feelers: Move[] = [
      { at: [14.8, 8.8], wave: sine(1, -0.1), turn: 5 * calm, bend: 7, lag: 0.3, pair: true },
      { at: [14.8, 8.8], wave: () => late, turn: -7, bend: 7, lag: 0.15, pair: true },
      ...head,
    ];
    parts.push(
      ...rig(hind, {
        mat: "wing",
        prims: both(poly([[14.6, 18.6], [9.6, 19.4], [6.4, 22.4], [7.2, 26], [10.6, 26.6], [14.6, 22.4]], 0.9)),
        back: true,
      }),
      ...rig(fore, {
        mat: "wing",
        prims: both(poly([[14.6, 12.4], [8.6, 7.4], [3, 5.6], [1.6, 9], [3.2, 14.6], [8.6, 17.6], [14.6, 17.4]], 0.7)),
        paint: [
          { mat: "fluff", level: 4, prims: both(path([[2.4, 7.6], [2.6, 11.8], [4.4, 15.2]], 0.6)) },
          { mat: "fluff", level: 4, prims: both(ell(7.6, 11.6, 1.5)) },
          { mat: "wing", level: 1, prims: both(ell(7.6, 11.6, 0.6)) },
        ],
      }),
      ...rig(feelers, { mat: "body", prims: both(path([[14.8, 8.8], [13.8, 6], [12.2, 4]], 0.7)) }),
      ...rig(feelers, { mat: "wing", prims: both(ell(11.2, 3.6, 1.3, 2.6, 45)), paint: [{ mat: "fluff", level: 4, prims: both(cap(13, 5, 9.8, 2, 0.4)) }] }),
      {
        mat: "body",
        prims: [egg(16, 23, 3.1, 5.2, -0.2)],
        paint: [{ mat: "body", level: 2, prims: [ell(16, 22.6, 3.4, 0.45), ell(16, 25, 3.4, 0.45)] }],
      },
      {
        mat: "fluff",
        prims: [ell(16, 16.4, 5.8, 2.4), ...both(ell(11, 15.2, 1.6, 1.5)), ...both(ell(12.8, 18.2, 1.8, 1.4)), ell(16, 18.8, 1.8, 1.4)],
        blend: 1.5,
        round: 4,
        paint: [{ mat: "fluff", level: 4, prims: [ell(16, 15.6, 5.6, 1.8)] }],
      },
      ...rig(head, { mat: "body", prims: [ell(16, 11.6, 4.6, 4.1)] }),
    );
    decals.push(...rig(head, ...eyes([12, 10], [18, 10], look, "tall"), ...blush([11, 13], [19, 13], 2)));
    // Frost dust shaken off the wingtips at the top of the fan, drifting down.
    for (const [x, y, at, fall, dx] of [[2, 4, 0.36, 6, -1], [29, 5, 0.42, 5, 1], [3, 14, 0.5, 5, -1], [28, 15, 0.56, 4, 1]] as const) {
      const f = a < 0 ? -1 : (a - at) / 0.3;
      if (f >= 0 && f < 1) decals.push(stamp(Math.round(x + f * dx), Math.round(y + f * fall), ["d"], { d: f < 0.6 ? "#ffffff" : "fluff:4" }, true));
    }
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head, neck: [] };
  },
};

// ── Pengwin · common ──

export const pengwin: Species = {
  id: "pengwin",
  name: "Pengwin",
  element: "frost",
  tier: "common",
  stages: ["Fluffchick", "Pengling", "Pengwin"],
  palette: { back: "#6576ab", down: "#b9c3d8", belly: "#e8f0fc", beak: "#ffad4a", scarf: "#ff5f73" },
  shiny: { back: "#9a6fc4", down: "#dccbe9", scarf: "#4fd9b0", beak: "#ffd166" },
  lore: "Waddles to the library every morning in the same knitted scarf. Can't fly, but has read every book about it.",
  hint: "Dressed for dinner, wrapped for winter.",
  // A slow breath through the chest, the head a beat behind, flippers
  // easing out and in, the scarf's tail stirring in a draught. Its act is
  // the flight it has only read about: up on its toes, eyes shut, two slow
  // hopeful flaps, then it settles back down.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const flap = a < 0 ? 0 : pulse(0.14, 0.34)(a) + pulse(0.5, 0.34)(a);
    const env = a < 0 ? 0 : ease(0.08, 0.2)(a) * (1 - ease(0.78, 0.9)(a));
    const look = env > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** Up on its toes for the flaps. */
    const toes: Move = { at: [16, 30], wave: stepped(() => env), shift: [0, -1] };
    /** The flippers ease out a beat after the breath; flapping, they lift. */
    const flippers = (sh: V, deg: number, sway = 4): Move[] => [
      { at: sh, wave: sine(1, 0.05), turn: sway * calm * (1 - env) },
      { at: sh, wave: () => flap, turn: deg },
    ].map((m) => ({ ...m, pair: true }));
    /** The scarf's tail stirs, and flutters as it flaps. */
    const tail = (knot: V, len: number): Move[] => [
      { at: knot, wave: sine(1, 0.3), turn: 6 * calm, bend: len, lag: 0.3 },
      { at: knot, wave: () => flap, turn: -8, bend: len, lag: 0.1 },
    ];
    if (stage === 0) {
      const swell: Move[] = [{ at: [16, 30], wave: (u) => breath(u) * (1 - env), grow: [0.02, 1 / 13] }, toes];
      parts.push(
        { mat: "beak", prims: both(ell(13.4, 29.5, 1.8, 0.9)) },
        ...rig(swell, {
          mat: "down",
          prims: [ell(16, 23.4, 6.9, 6.2)],
          blend: 1.6,
          paint: [
            { mat: "back", prims: [ell(16, 17.4, 8, 4.4)] },
            { mat: "belly", level: 4, prims: [ell(16, 22.4, 5.4, 2.8), ...both(ell(13.4, 21.4, 2.4, 2))] },
          ],
        }),
        ...rig([...flippers([10.4, 23], 22, 10), ...swell], { mat: "down", prims: both(ell(9.5, 25.2, 1.3, 2.4, 20)) }),
        ...rig([{ at: [16, 18.4], wave: sine(1, 0.2), turn: 14 * calm }, ...swell], { mat: "down", prims: [ell(15.2, 17.4, 1.2, 1.1), ell(17.2, 16.9, 1.2, 1.2)], blend: 0.5 }),
      );
      decals.push(...rig(swell,
        ...eyes([12, 20], [18, 20], look, "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(15, 23, ["bb"], { b: "beak:3" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: swell, neck: swell };
    }
    // The chest swells; the head, blended into it, rides a beat later.
    const top = stage === 1 ? 15.4 : 12;
    const grow: Move = { at: [16, 30], wave: (u) => breath(u) * (1 - env), grow: [0.02, 1 / (30 - top)] };
    const lift: Move = { at: [16, 16], wave: (u) => breath(u - 0.08) * (1 - env), shift: [0, -1] };
    const chest: Move[] = [grow, toes];
    const head: Move[] = [lift, toes];
    if (stage === 1) {
      parts.push(
        { mat: "beak", prims: both(ell(13.2, 29.5, 2, 1)) },
        ...rig([toes], {
          mat: "back",
          prims: [...rig([grow], egg(16, 22.6, 6.8, 7.2, 0.14)), ...rig([lift], ell(16, 15.2, 5.4, 4.8))],
          blend: 3,
          paint: [
            { mat: "belly", level: 4, prims: [...rig([lift], ...both(ell(13.6, 15.8, 2.3, 2.4)), ell(16, 17.4, 2.8, 1.6)), ...rig([grow], ell(16, 24.2, 4.6, 5.2))] },
            { mat: "down", prims: rig([grow], ell(16, 29.8, 7.6, 3.2), ...both(ell(10.6, 27.2, 1.6, 1.3)), ell(14.3, 27.4, 1.4, 1.1), ell(17.7, 27.4, 1.4, 1.1)) },
          ],
        }),
        ...rig([...flippers([9.8, 19.6], 18), ...chest], { mat: "back", prims: both(path([[9.8, 19.6], [8.2, 23], [8, 25.8]], 1.6, 1)) }),
        ...rig([{ at: [16, 11.8], wave: sine(1, 0.2), turn: 12 * calm }, ...head], { mat: "down", prims: [ell(15.4, 10.8, 1.1, 1), ell(17, 10.4, 1.1, 1.1)], blend: 0.5 }),
        ...rig(chest, { mat: "scarf", prims: [ell(16, 19.6, 5, 1.4)] }),
        ...rig([...tail([18.8, 20.4], 4), ...chest], { mat: "scarf", prims: [cap(18.8, 20.4, 19.6, 23.8, 1.1, 1)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 14], [18, 14], look, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 17, ["bb"], { b: "beak:3" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head, neck: chest };
    }
    parts.push(
      { mat: "beak", prims: both(ell(12.8, 29.5, 2.4, 1.1)) },
      ...rig([toes], {
        mat: "back",
        prims: [...rig([grow], egg(16, 20.8, 8, 8.8, 0.18)), ...rig([lift], ell(16, 10, 6, 5.2))],
        blend: 4,
        paint: [
          { mat: "belly", level: 4, prims: [...rig([lift], ...both(ell(13.6, 10.8, 2.5, 2.6)), ell(16, 12.4, 2.8, 1.6)), ...rig([grow], ell(16, 22.4, 5.6, 7))] },
        ],
      }),
      ...rig([...flippers([8.8, 16], 14), ...chest], { mat: "back", prims: both(path([[8.8, 16], [6.4, 20.4], [5.6, 24.4]], 2, 0.9)) }),
      ...rig(chest, { mat: "scarf", prims: [ell(16, 15.2, 6.2, 1.9)], paint: [{ mat: "scarf", level: 2, prims: [cap(10.6, 16.3, 21.4, 16.3, 0.45)] }] }),
      ...rig([...tail([19.6, 16], 7), ...chest], {
        mat: "scarf",
        prims: [path([[20.4, 15.6], [22.8, 17], [23.6, 19.6]], 1.3, 1.1), cap(19.2, 16.2, 20.2, 21.8, 1.4, 1.3)],
        blend: 0.6,
        paint: [{ mat: "belly", level: 4, prims: [cap(18.6, 19.6, 21.6, 19.6, 0.45), cap(22, 18.4, 25, 18.4, 0.45)] }],
      }),
    );
    decals.push(...rig(head,
      ...eyes([12, 9], [18, 9], look, "round"),
      ...blush([10, 12], [20, 12]),
      stamp(15, 12, ["bb", "dd"], { b: "beak:4", d: "beak:2" }),
    ));
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head, neck: chest };
  },
};

// ── Ermine · common ──

export const ermine: Species = {
  id: "ermine",
  name: "Ermine",
  element: "frost",
  tier: "common",
  stages: ["Snowkit", "Stoatling", "Ermine"],
  palette: { fur: "#d4e0f6", belly: "#f6f9ff", tip: "#4f4a6e", nose: "#ff97b3" },
  shiny: { fur: "#c89468", belly: "#fbeed6", tip: "#3c2a2a", nose: "#ff8a7a" },
  lore: "Stands up tall to peek over the top of your book, then pretends it wasn't reading along. Turns snow-white every winter so it can hide in the margins.",
  hint: "White as a fresh page, dipped in ink at the end.",
  // A slow breath up the long body, the head riding it a beat later, and
  // the ink-dipped tail swaying, the sway running out to its tip. Its act
  // is the peek over your book: it stretches up tall, glances left and
  // right along the line, then sinks back and blinks as if it never looked.
  motion: { idle: 3.6, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const up = a < 0 ? 0 : ease(0.06, 0.3)(a) * (1 - ease(0.64, 0.86)(a));
    const glance = a < 0 ? 0 : pulse(0.32, 0.15)(a) - pulse(0.47, 0.15)(a);
    const look = a > 0.86 && a < 0.93 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The stretch: the head rises two pixels (one for the kit). */
    const rise2 = (n: number): Move => ({ at: [16, 16], wave: stepped(() => up, n), shift: [0, -n] });
    /** Stoat head: a wide flat oval with a little snout, ears low on the sides. */
    const head = (cy: number, rx: number, ry: number, ms: Move[]): Part[] => rig(ms,
      {
        mat: "fur",
        prims: both(ell(16 - rx + 0.9, cy - ry + 0.9, 2, 1.9)),
        paint: [{ mat: "nose", prims: both(ell(16 - rx + 1.1, cy - ry + 1.3, 0.9, 0.9)) }],
      },
      {
        mat: "fur",
        prims: [ell(16, cy, rx, ry), ell(16, cy + ry * 0.55, 2.4, 1.7)],
        blend: 2,
        paint: [{ mat: "belly", level: 4, prims: [ell(16, cy + ry * 0.7, 2.5, 1.5), ...both(ell(16 - rx * 0.55, cy + ry * 0.35, 1.5, 1.1))] }],
      },
    );
    /** The eyes glance along the line while it peeks. */
    const eyesOn: Move = { at: [16, 16], wave: () => glance, shift: [-1, 0] };
    /** The tail sways from its root, a wave running out to the tip. */
    const sway = (root: V, len: number, deg: number): Move[] => [
      { at: root, wave: sine(1, 0.3), turn: deg * calm, bend: len, lag: 0.3 },
      { at: root, wave: () => up, turn: -deg * 0.8, bend: len, lag: 0.12 },
    ];
    if (stage === 0) {
      // One round kit: the body swells, the head rides a beat later; the
      // tail lying along the ground lifts its tip now and then.
      const swell: Move = { at: [16, 30], wave: (u) => breath(u) * (1 - up), grow: [0.02, 0.12] };
      const stretch: Move = { at: [16, 30], wave: () => up, grow: [-0.02, 0.18] };
      const hd: Move[] = [{ at: [16, 16], wave: (u) => breath(u - 0.08) * (1 - up), shift: [0, -1] }, rise2(1)];
      parts.push(
        ...rig([swell, stretch], {
          mat: "fur",
          prims: [ell(16, 26.2, 5.8, 3.8)],
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 27, 3.2, 2.6)] }],
        }),
        ...head(21.4, 4.9, 4.1, hd),
        ...rig([{ at: [21, 27.6], wave: (u) => rise(1, 0.1)(u) * (1 - up) * calm + up, turn: 7, bend: 11, lag: 0.25 }], {
          mat: "fur",
          prims: [path([[21, 27], [20, 29.4], [15, 29.9], [10.4, 29.3]], 1.4, 1.7)],
          paint: [{ mat: "tip", prims: [ell(9.6, 29.2, 2.6, 2.2)] }],
        }),
      );
      decals.push(
        ...rig([...hd, eyesOn], ...eyes([12, 20], [18, 20], look, "tall")),
        ...rig(hd, ...blush([10, 23], [20, 23], 1), stamp(15, 23, ["nn"], { n: "nose:3" })),
      );
      if (pose === "sleep") decals.push(zzz(23, 10));
      return { parts, decals, head: hd, neck: hd };
    }
    // The long body breathes from the hips; the neck stretches up to peek.
    const s = stage === 1 ? { cy: 14.8, rx: 5, ry: 3.7, neck: 17, paws: 21.2, eye: 13 } : { cy: 8.8, rx: 5.2, ry: 3.9, neck: 12, paws: 17.8, eye: 7 };
    const swell: Move = { at: [16, 30], wave: (u) => breath(u) * (1 - up), grow: [0.02, 1 / (30 - s.neck)] };
    const stretch: Move = { at: [16, 25], wave: () => up, grow: [-0.06, 2 / (25 - s.neck)] };
    const hd: Move[] = [{ at: [16, 16], wave: (u) => breath(u - 0.08) * (1 - up), shift: [0, -1] }, rise2(2)];
    const paws: Move[] = [swell, { at: [16, 16], wave: stepped(() => up), shift: [0, -1] }];
    if (stage === 1) {
      parts.push(
        ...rig(sway([19.5, 27.2], 10, 7), {
          mat: "fur",
          prims: [path([[19.5, 27.2], [23.8, 28], [26.2, 25.4], [26.2, 21]], 1.4, 1.8)],
          paint: [{ mat: "tip", prims: [ell(26.2, 20.2, 2.4, 3)] }],
        }),
        ...rig([swell], {
          mat: "fur",
          prims: [ell(16, 25.8, 4.6, 3.8), ...rig([stretch], path([[16, 25], [16, 20], [16, 17]], 3, 2.4))],
          blend: 2,
          paint: [{ mat: "belly", level: 4, prims: rig([stretch], ell(16, 24.2, 2.4, 4.2)) }],
        }),
        ...head(s.cy, s.rx, s.ry, hd),
        ...rig(paws, { mat: "fur", prims: both(ell(14.4, 21.2, 1.3, 1.1)), paint: [{ mat: "belly", level: 4, prims: [ell(16, 21, 4, 2)] }] }),
        { mat: "fur", prims: both(ell(13.2, 29.3, 2, 1)) },
      );
      decals.push(
        ...rig([...hd, eyesOn], ...eyes([12, 13], [18, 13], look, "tall")),
        ...rig(hd, ...blush([10, 16], [21, 16], 1), stamp(15, 16, ["nn"], { n: "nose:3" })),
      );
      if (pose === "sleep") decals.push(zzz(22, 6));
      return { parts, decals, head: hd, neck: hd };
    }
    parts.push(
      ...rig(sway([19, 27.4], 14, 6), {
        mat: "fur",
        prims: [path([[19, 27.4], [24.4, 28.4], [27.8, 25.8], [28.4, 21.4], [27.2, 16.8]], 1.5, 2.2)],
        paint: [{ mat: "tip", prims: [ell(27, 15.6, 2.8, 4.4, 10)] }],
      }),
      ...rig([swell], {
        mat: "fur",
        prims: [ell(16, 25.4, 5, 4.4), ...rig([stretch], path([[16, 24], [16, 18], [16, 12]], 3.3, 2.4))],
        blend: 2,
        paint: [{ mat: "belly", level: 4, prims: rig([stretch], ell(16, 22.4, 2.6, 6.2)) }],
      }),
      ...head(s.cy, s.rx, s.ry, hd),
      ...rig(paws, { mat: "fur", prims: both(ell(14.3, 17.8, 1.5, 1.2)), paint: [{ mat: "belly", level: 4, prims: [ell(16, 17.6, 4, 2)] }] }),
      { mat: "fur", prims: both(ell(12.8, 29.3, 2.4, 1)) },
    );
    decals.push(
      ...rig([...hd, eyesOn], ...eyes([12, 7], [18, 7], look, "round")),
      ...rig(hd, ...blush([10, 10], [21, 10], 1), stamp(15, 10, ["nn"], { n: "nose:3" })),
    );
    if (pose === "sleep") decals.push(zzz(22, 1));
    return { parts, decals, head: hd, neck: hd };
  },
};

// ── Fenrir · rare ──

export const fenrir: Species = {
  id: "fenrir",
  name: "Fenrir",
  element: "frost",
  tier: "rare",
  stages: ["Frostpup", "Rimewolf", "Fenrir"],
  palette: { fur: "#9fb5de", cream: "#eef3fb", ice: "#8cf0ff" },
  shiny: { fur: "#8a7fc8", cream: "#e6dcf8", ice: "#ffcf66" },
  lore: "Howls once at the end of every chapter, whether or not the moon is out. Its mane frosts over faster the longer you read without a break.",
  hint: "Its breath leaves frost on the page.",
  // A slow breath through the chest, the head riding it a beat later; the
  // tail swaying, the sway running out to its tip; the ice crest shimmering
  // spike by spike. Its act is a soft howl for the end of the chapter: the
  // muzzle lifts, eyes shut, and its breath drifts up as frost.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const howl = a < 0 ? 0 : ease(0.08, 0.34)(a) * (1 - ease(0.64, 0.9)(a));
    const shut = !awake(pose) || howl > 0.4;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** A ¾ wolf head looking left: skull, long muzzle, pale cheeks, two
     *  tall ears (the far one a step darker). */
    const head = (x: number, y: number, s: number, ms: Move[]): Part[] => rig(ms,
      {
        mat: "fur",
        prims: [poly([[x + 1.4 * s, y - 2.6 * s], [x + 3.6 * s, y - 7.4 * s], [x + 4.6 * s, y - 1.6 * s]], 0.7)],
        back: true,
      },
      {
        mat: "fur",
        prims: [ell(x, y, 4.8 * s, 4.1 * s), cap(x - 1.2 * s, y + 2 * s, x - 5.6 * s, y + 3 * s, 2.4 * s, 1.7 * s)],
        blend: 2,
        paint: [{ mat: "cream", level: 4, prims: [ell(x - 3.4 * s, y + 4 * s, 3.4 * s, 1.5 * s), ell(x + 1.6 * s, y + 3 * s, 2.4 * s, 1.6 * s)] }],
      },
      {
        mat: "fur",
        prims: [poly([[x - 3.4 * s, y - 1.6 * s], [x - 3.6 * s, y - 7.8 * s], [x + 0.2 * s, y - 3.6 * s]], 0.7)],
        paint: [{ mat: "cream", prims: [poly([[x - 2.6 * s, y - 2.6 * s], [x - 2.8 * s, y - 6 * s], [x - 0.8 * s, y - 3.6 * s]], 0)] }],
      },
    );
    /** The ice crest shimmers, a ripple running spike by spike. */
    const crestOf = (list: [number, number, number, number][], w: number, ms: (i: number) => Move[]): Prim[] =>
      crest(list, w).map((p, i) => rig([{ at: [list[i][0], list[i][1]], wave: sine(1, -0.12 * i), turn: 7 * calm }, ...ms(i)], p)[0]);
    /** The tail sways from its root, the sway running out to the tip. */
    const sway = (root: V, len: number): Move[] => [{ at: root, wave: sine(1, 0.3), turn: 6 * calm, bend: len, lag: 0.3 }];
    /** The howl's breath: pale motes drifting up and away from the muzzle. */
    const frost = (x: number, y: number) => {
      for (const [at, dx, dy] of [[0.3, -2, -5], [0.42, -1, -6], [0.54, -3, -4]] as const) {
        const f = a < 0 ? -1 : (a - at) / 0.32;
        if (f >= 0 && f < 1) decals.push(stamp(Math.round(x + f * dx), Math.round(y + f * dy), ["d"], { d: f < 0.55 ? "#e6fbff" : "ice:4" }, true));
      }
    };
    if (stage === 0) {
      // A round pup: the body swells, the head (blended into it) rides a
      // beat later, and howling it lifts its chin a pixel more.
      const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.08) * (1 - howl), stepped(() => howl, 2)(u) * 2), shift: [0, -1] };
      const swell: Move = { at: [16, 30], wave: (u) => breath(u) * (1 - howl), grow: [0.03, 0.12] };
      parts.push(
        ...rig(sway([20.5, 27.5], 7), { mat: "fur", prims: [path([[20.5, 27.5], [23.5, 25.5], [24.4, 22]], 1.8, 1.4)], paint: [{ mat: "cream", prims: [ell(24.4, 21.8, 1.9)] }] }),
        ...rig([lift], {
          mat: "fur",
          prims: both(poly([[9.6, 19], [8.8, 11.4], [14.2, 16]], 0.7)),
          paint: [{ mat: "cream", prims: both(poly([[10.4, 17.4], [10, 13.8], [12.4, 16.2]], 0)) }],
        }),
        { mat: "ice", prims: crestOf([[16, 16.4, -90, 2.6], [18, 16.8, -60, 2.2], [14, 16.8, -120, 2.2]], 1.1, () => [lift]), glow: true },
        {
          mat: "fur",
          prims: [...rig([lift], ell(16, 21, 6.8, 5.4)), ...rig([swell], ell(16, 26.2, 5.2, 3.8)), ...rig([lift], ...both(poly([[10, 20.5], [7.8, 24.4], [11.6, 24.2]], 0.4)))],
          blend: 2.5,
          paint: [{ mat: "cream", level: 4, prims: [...rig([lift], ell(16, 24.4, 3.6, 2.2), ...both(ell(12.4, 23.6, 2.2, 1.5))), ...rig([swell], ell(16, 28, 2.8, 2.2))] }],
        },
        { mat: "fur", prims: both(ell(13.3, 29.2, 1.9, 1.2)), paint: [{ mat: "cream", level: 4, prims: both(ell(13.3, 29.8, 1.6, 0.6)) }] },
      );
      decals.push(...rig([lift],
        ...eyes([12, 19], [18, 19], shut ? "blink" : "idle", "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(15, 22, ["kk", ".."], { k: "eye:3" }),
        howl > 0.4 ? stamp(15, 24, ["kk"], { k: "fur:1" }) : stamp(14, 23, ["k..k"], { k: "fur:1" }),
      ));
      if (howl > 0.4) frost(17, 12);
      if (pose === "sleep") decals.push(zzz(25, 7));
      return { parts, decals, head: [lift], neck: [lift] };
    }
    // The chest swells; the head rides a beat later and, howling, tips its
    // muzzle up about the neck.
    const k = stage === 1 ? { neck: [14.4, 16.4] as V, top: 15 } : { neck: [15, 13.4] as V, top: 12 };
    const swell: Move = { at: [17, 29], wave: (u) => breath(u) * (1 - howl), grow: [0.02, 1 / (29 - k.top)] };
    const hd: Move[] = [
      { at: k.neck, wave: () => howl, turn: 10 },
      { at: k.neck, wave: (u) => breath(u - 0.08) * (1 - howl), shift: [0, -1] },
    ];
    if (stage === 1) {
      parts.push(
        ...rig(sway([20, 27.6], 9), {
          mat: "fur",
          prims: [path([[20, 27.6], [24.6, 27.2], [26.6, 23.6], [26, 20.2]], 1.8, 2)],
          paint: [{ mat: "cream", level: 4, prims: [ell(26, 19.6, 2, 2.2)] }],
        }),
        { mat: "ice", prims: crestOf([[15.4, 11.8, -60, 3.6], [17.6, 14, -38, 4], [19.4, 17, -18, 3.6]], 1.2, (i) => (i === 0 ? hd : [swell])), glow: true },
        { mat: "fur", prims: [cap(15.4, 21, 15.8, 28.8, 1.4, 1.3)], back: true, round: 1.2 },
        ...rig([swell], {
          mat: "fur",
          prims: [ell(19, 24.4, 4.8, 4.4), ell(14, 20, 3.8, 4.8)],
          blend: 3,
          paint: [{ mat: "cream", level: 4, prims: [ell(12.6, 20.8, 2.4, 3.6)] }],
        }),
        { mat: "fur", prims: [cap(12.2, 22, 11.8, 28.6, 1.7, 1.5), ell(11.6, 29.2, 2.1, 1.1), ell(20.4, 29.2, 2.6, 1.1)], round: 1.4 },
        ...head(12.4, 13.2, 0.82, hd),
      );
      decals.push(...rig(hd, ...eyes([8, 12], [12, 12], shut ? "blink" : "idle", "tall"), stamp(5, 15, ["kk"], { k: "eye:3" })));
      if (howl > 0.4) decals.push(...rig(hd, stamp(7, 17, ["k"], { k: "fur:1" })));
      if (howl > 0.4) frost(4, 13);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: hd, neck: [swell] };
    }
    parts.push(
      ...rig(sway([21.6, 28], 12), {
        mat: "fur",
        prims: [path([[21.6, 28], [26.4, 27.4], [28.8, 23.4], [28, 18.6]], 2.2, 2.6)],
        paint: [{ mat: "cream", level: 4, prims: [ell(28, 17.6, 2.6, 2.8)] }],
      }),
      {
        mat: "ice",
        prims: crestOf([[15.8, 7.4, -70, 5], [18.4, 9.6, -48, 5.8], [20.6, 12.6, -30, 6], [22, 16, -12, 5.4], [22.6, 19.6, 6, 4.4]], 1.6, (i) => (i < 2 ? hd : [swell])),
        glow: true,
      },
      { mat: "fur", prims: [cap(16.4, 21, 16.8, 29, 1.8, 1.6), ell(17.2, 29.2, 2.2, 1.1)], back: true, round: 1.4 },
      ...rig([swell], {
        mat: "fur",
        prims: [ell(20.4, 23.6, 6, 5.6), ell(14.6, 18.6, 4.8, 6.4)],
        blend: 3,
        paint: [{ mat: "cream", level: 4, prims: [ell(12.8, 20.4, 2.8, 4.8)] }],
      }),
      ...rig([swell], {
        mat: "cream",
        prims: [ell(13.6, 15.8, 4.4, 2.6), ell(10.4, 17.6, 1.6), ell(12.6, 19.4, 1.7), ell(15.2, 19.6, 1.6), ell(17.2, 17.8, 1.5)],
        blend: 1.2,
        round: 4,
        paint: [{ mat: "cream", level: 4, prims: [ell(13.6, 15.6, 4.4, 2.6), ell(11.4, 17.4, 1.4), ell(14, 18.6, 1.6), ell(16.4, 17.4, 1.2)] }],
      }),
      ...rig([swell], { mat: "ice", prims: [cap(12.6, 19.8, 12.8, 22.8, 1.1, 0.45), cap(15.4, 20.2, 15.3, 23.2, 1.2, 0.45)], glow: true }),
      { mat: "fur", prims: [cap(12.4, 21.4, 12, 28.6, 2.1, 1.9), ell(11.6, 29.2, 2.5, 1.2), ell(22.6, 29.2, 3.2, 1.2)], round: 1.6, paint: [{ mat: "cream", level: 4, prims: [ell(11.4, 29.8, 2.2, 0.6)] }] },
      ...head(12.6, 9.4, 1, hd),
    );
    decals.push(...rig(hd, ...eyes([8, 8], [13, 8], shut ? "blink" : "idle", "tall"), stamp(6, 11, ["kk"], { k: "eye:3" })));
    if (howl > 0.4) decals.push(...rig(hd, stamp(8, 13, ["kk"], { k: "fur:1" })));
    if (howl > 0.4) frost(4, 10);
    if (howl > 0.5) decals.push(...twinkle(24, 4, a, 0.38, "#e6fbff", 0.3));
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: hd, neck: [swell] };
  },
};

// ── Yeti · rare ──

export const yeti: Species = {
  id: "yeti",
  name: "Yeti",
  element: "frost",
  tier: "rare",
  stages: ["Yetikin", "Shaggling", "Yeti"],
  palette: { fur: "#d6e1f8", skin: "#ab9cf0" },
  shiny: { fur: "#f0d6a8", skin: "#6a9ae0" },
  lore: "Nobody has ever photographed one, because it only comes down the mountain to return overdue books. Gives the gentlest hugs in the whole library.",
  hint: "Big footprints lead to the reading room.",
  // A big slow breath through the shaggy chest, the head a beat behind,
  // the long arms swinging a little after it and the cowlick bobbing. Its
  // act is the gentlest hug: the arms fold in around itself, eyes shut and
  // cheeks pink, it squeezes once, then lets go.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const hug = a < 0 ? 0 : ease(0.08, 0.36)(a) * (1 - ease(0.64, 0.92)(a));
    const squeeze = a < 0 ? 0 : stepped(pulse(0.38, 0.24))(a);
    const look = hug > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The arms swing out a little after the breath; hugging, they fold in. */
    const arms = (sh: V, deg: number): Move[] => [
      { at: sh, wave: sine(1, 0.1), turn: 3 * calm * (1 - hug), pair: true },
      { at: sh, wave: () => hug, turn: -deg, pair: true },
    ];
    /** Fur-framed head: skin face with a widow's peak, a curling cowlick
     *  and shaggy cheek tufts. The cowlick bobs a beat behind the head. */
    const head = (cy: number, rx: number, ry: number, fx: number, fy: number, lick: number, ms: Move[], extra: Prim[] = []): Part[] => [
      ...rig([{ at: [15.4, cy - ry + 1.4], wave: sine(1, -0.05), turn: 7 * calm, bend: lick + 1, lag: 0.3 }, ...ms], {
        mat: "fur",
        prims: [path([[15.4, cy - ry + 1.6], [15, cy - ry - lick * 0.5], [16.4, cy - ry - lick], [18, cy - ry - lick * 0.8]], 1.5, 0.7)],
        back: true,
      }),
      ...rig(ms, {
        mat: "fur",
        prims: [ell(16, cy, rx, ry), ...both(cap(16 - rx + 0.8, cy + 1, 16 - rx - 1, cy + 2.2, 1.2, 0.5)), ...extra],
        blend: 2,
        paint: [{ mat: "skin", prims: [ell(16, cy + 0.9, fx, fy)], cut: [poly([[14.6, cy + 0.9 - fy - 0.2], [17.4, cy + 0.9 - fy - 0.2], [16, cy + 0.9 - fy + 1.6]], 0)] }],
      }),
    ];
    if (stage === 0) {
      // One shaggy blob: it swells as a whole and hugs itself with its stubby arms.
      const swell: Move[] = [
        { at: [16, 30], wave: (u) => breath(u) * (1 - hug), grow: [0.02, 0.075] },
        { at: [16, 30], wave: () => squeeze, grow: [-0.04, 0.03] },
      ];
      parts.push(
        { mat: "fur", prims: both(ell(12.8, 29.3, 2.2, 1.1)), paint: [{ mat: "skin", prims: both(ell(12.8, 29.9, 1.6, 0.5)) }] },
        ...head(23.2, 6.8, 6, 4.8, 3.8, 3, swell, [ell(16, 26, 6, 3.6)]),
        ...rig([...arms([10, 25.2], 22), ...swell], { mat: "fur", prims: both(path([[10.2, 25.2], [9.4, 27.2], [9.8, 28.2]], 1.6, 1.3)), paint: [{ mat: "skin", prims: both(ell(9.9, 28.6, 1.1, 0.6)) }] }),
      );
      decals.push(...rig(swell,
        ...eyes([12, 22], [18, 22], look, "tall"),
        stamp(14, 26, ["kkkk", ".kk."], { k: "skin:1" }),
        ...blush([10, 25], [20, 25], 2),
      ));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: swell, neck: swell };
    }
    // The chest swells and squeezes in the hug; the head rides a beat later.
    const top = stage === 1 ? 18 : 12.2;
    const chest: Move[] = [
      { at: [16, 30], wave: (u) => breath(u) * (1 - hug), grow: [0.02, 1 / (30 - top)] },
      { at: [16, 30], wave: () => squeeze, grow: [-0.03, 0] },
    ];
    const hd: Move[] = [{ at: [16, 16], wave: (u) => breath(u - 0.08) * (1 - hug) + squeeze, shift: [0, -1] }];
    if (stage === 1) {
      parts.push(
        ...rig(chest, {
          mat: "fur",
          prims: [ell(16, 23.6, 7.4, 5.8), ...both(cap(9.4, 26, 8.2, 27.6, 1.3, 0.6))],
          blend: 2,
          paint: [{ mat: "fur", level: 4, prims: [ell(16, 24.6, 3.6, 3.2)] }],
        }),
        ...head(15.8, 6.2, 5.2, 4.4, 3.5, 3.4, hd),
        ...rig([...arms([9.8, 19.6], 16), ...chest], {
          mat: "fur",
          prims: both(path([[9.8, 19.6], [7.6, 23.2], [7.2, 26.6]], 2.1, 2)).concat(both(cap(6.4, 22.4, 5, 23.8, 1.1, 0.5))),
          paint: [{ mat: "skin", prims: both(ell(7.2, 27.7, 1.8, 0.9)) }],
        }),
        { mat: "fur", prims: both(ell(12.6, 29.2, 2.7, 1.3)), paint: [{ mat: "skin", prims: both(ell(12.6, 29.9, 2.1, 0.6)) }] },
      );
      decals.push(...rig(hd,
        ...eyes([12, 15], [18, 15], look, "tall"),
        stamp(14, 19, ["k..k", ".kk."], { k: "skin:1" }),
        ...(hug > 0.4 ? blush([10, 18], [20, 18], 2) : []),
      ));
      if (pose === "sleep") decals.push(zzz(25, 5));
      return { parts, decals, head: hd, neck: chest };
    }
    parts.push(
      { mat: "fur", prims: both(cap(12.4, 25, 12.2, 28.4, 2.8, 2.6)), round: 1.8, back: true },
      ...rig(chest, {
        mat: "fur",
        prims: [egg(16, 19.8, 8.2, 7.6, -0.16), ...both(cap(10.2, 24.6, 9.4, 26.6, 1.3, 0.5)), cap(16, 26.4, 16, 28, 1.2, 0.5)],
        blend: 2.5,
        paint: [{ mat: "fur", level: 4, prims: [ell(16, 20.6, 4.2, 4.4)] }],
      }),
      ...head(11, 6.6, 5.6, 5.2, 4.2, 3.4, hd),
      ...rig([...arms([8.4, 14.6], 14), ...chest], {
        mat: "fur",
        prims: both(path([[8.4, 14.6], [5.2, 19.2], [4.4, 25]], 2.8, 2.5)).concat(both(cap(5.4, 15.4, 3.4, 16.4, 1.4, 0.5)), both(cap(3, 20.4, 1.4, 21.8, 1.2, 0.5))),
        paint: [{ mat: "skin", prims: both(ell(4.4, 26.6, 2.3, 1.2)) }],
      }),
      { mat: "fur", prims: both(ell(11.8, 29.2, 3.3, 1.4)), paint: [{ mat: "skin", prims: both(ell(11.8, 29.9, 2.7, 0.6)) }] },
    );
    decals.push(...rig(hd,
      ...eyes([12, 10], [18, 10], look, "tall"),
      stamp(13, 14, ["kwkkwk", ".kkkk."], { k: "skin:1", w: "white:4" }),
      ...(hug > 0.4 ? blush([10, 13], [20, 13], 2) : []),
    ));
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: hd, neck: chest };
  },
};

// ── Mammoth · rare ──

export const mammoth: Species = {
  id: "mammoth",
  name: "Mammoth",
  element: "frost",
  tier: "rare",
  stages: ["Woollet", "Tuskling", "Mammoth"],
  palette: { wool: "#b98a6c", snow: "#e6eefc", tusk: "#f4e4c1" },
  shiny: { wool: "#8e8ad0", snow: "#fff1f7", tusk: "#ffcf5c" },
  lore: "Remembers every book it has ever read, all the way back to the Ice Age. Uses its trunk as a very gentle bookmark.",
  hint: "Old as the ice, and it never forgets a page.",
  // A deep, slow breath through the woolly bulk, the head nodding a beat
  // after; the ears fanning softly and the trunk swaying, the sway running
  // down to its curl. Its act is the bookmark: eyes shut, ears spread, it
  // lifts its trunk in a slow curl, a snowflake glints at the tip, and it
  // lowers it again.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const curl = a < 0 ? 0 : ease(0.1, 0.42)(a) * (1 - ease(0.62, 0.92)(a));
    const look = curl > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** Pillar legs: flat-shaded so they read as solid columns, toenails pale. */
    const legs = (xs: number[], top: number, r: number, back = false): Part => ({
      mat: "wool",
      prims: xs.map((x) => cap(x, top, x, 29, r, r)),
      round: 1.4,
      back,
      paint: [{ mat: "tusk", prims: xs.map((x) => ell(x, 30.2, r * 0.6, 0.7)) }],
    });
    /** Hanging wool fringe: tufts pointing down from y, between x0 and x1. */
    const hem = (x0: number, x1: number, y: number, n: number, len: number): Prim[] =>
      Array.from({ length: n }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / (n - 1);
        const lean = (x - 16) * 0.08;
        return cap(x, y, x + lean, y + len - (i % 2) * 0.8, 1.3, 0.5);
      });
    /** The ears fan out a little on each breath, and wide in the act. */
    const ears = (root: V): Move[] => [
      { at: root, wave: stepped((u) => rise(1, -0.15)(u) * calm * (1 - curl) + curl * 2, 2), grow: [0.1, 0.03], pair: true },
    ];
    /** The trunk sways from its root, the sway running down to the curl;
     *  in the act it lifts in a slow curl. */
    const trunk = (root: V, len: number, lift: number): Move[] => [
      { at: root, wave: sine(1, 0.2), turn: 4 * calm * (1 - curl), bend: len, lag: 0.3 },
      { at: root, wave: () => curl, turn: -lift, bend: len, lag: 0.08 },
    ];
    if (stage === 0) {
      // One woolly blob: it swells as a whole, all of it riding along.
      const swell: Move[] = [{ at: [16, 30], wave: (u) => breath(u) * (1 - curl), grow: [0.02, 0.075] }];
      parts.push(
        ...rig([...ears([12, 21]), ...swell], { mat: "wool", prims: both(ell(10.4, 21.4, 1.8, 2.4, 10)), back: true }),
        legs([13, 19], 25, 1.9),
        ...rig(swell, {
          mat: "wool",
          prims: [ell(16, 22, 6.4, 5.8), ell(16, 25.4, 5.8, 3.2), cap(15.4, 16.8, 14.8, 15, 1, 0.5), cap(16.6, 16.6, 17.4, 14.8, 1, 0.5)],
          blend: 2,
          paint: [{ mat: "snow", level: 4, prims: [ell(14.8, 14.8, 1, 1), ell(17.4, 14.6, 1, 1)] }],
        }),
        ...rig(swell, { mat: "tusk", prims: both(cap(13.6, 24.4, 12.6, 25.6, 0.8, 0.5)) }),
        ...rig([...trunk([16, 22.4], 5, 34), ...swell], { mat: "wool", prims: [path([[16, 22.4], [16, 25.6], [17.2, 27.2]], 1.6, 1.1)], round: 1.6 }),
      );
      decals.push(...rig(swell, ...eyes([12, 20], [18, 20], look, "tall"), ...blush([10, 23], [20, 23])));
      if (curl > 0.6) decals.push(...twinkle(19, 22, a, 0.36, "#e6fbff", 0.28));
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: swell, neck: swell };
    }
    // The body swells; the head (and the ears, tusks and trunk on it)
    // rides a beat later.
    const top = stage === 1 ? 13.6 : 8.4;
    const body: Move = { at: [16, 29], wave: (u) => breath(u) * (1 - curl), grow: [0.015, 1 / (29 - top)] };
    const hd: Move[] = [{ at: [16, 16], wave: (u) => breath(u - 0.1) * (1 - curl), shift: [0, -1] }];
    if (stage === 1) {
      parts.push(
        ...rig([...ears([11.6, 15.4]), ...hd], { mat: "wool", prims: both(ell(10.2, 16, 2, 2.8, 8)), back: true }),
        legs([12, 20], 24, 2.3),
        ...rig([body], { mat: "wool", prims: [ell(16, 20.6, 9.4, 5.2), ell(16, 17.6, 7.6, 4), ...hem(8, 24, 23.6, 7, 3)], blend: 2 }),
        ...rig(hd, {
          mat: "wool",
          prims: [ell(16, 15.4, 5.6, 5), ...both(cap(15, 10.8, 14.2, 8.8, 1, 0.5)), cap(16.4, 10.6, 17.4, 8.6, 1, 0.5)],
          blend: 2,
          paint: [{ mat: "snow", level: 4, prims: [ell(14, 8.4, 1.2, 1), ell(16, 7.9, 1, 1.2), ell(17.9, 8.2, 1.2, 1)] }],
        }),
        ...rig(hd, { mat: "tusk", prims: both(path([[13.6, 19.4], [12.2, 22.2], [10, 22.6], [8.8, 21]], 1.1, 0.6)) }),
        ...rig([...trunk([16, 17], 9, 30), ...hd], { mat: "wool", prims: [path([[16, 17], [16, 21.6], [16.4, 24.4], [18, 25.6]], 2, 1.2)], round: 1.6 }),
      );
      decals.push(...rig(hd, ...eyes([12, 14], [18, 14], look, "tall"), ...blush([10, 18], [20, 18])));
      if (curl > 0.6) decals.push(...twinkle(22, 19, a, 0.36, "#e6fbff", 0.28));
      if (pose === "sleep") decals.push(zzz(25, 5));
      return { parts, decals, head: hd, neck: hd };
    }
    parts.push(
      ...rig([...ears([11, 12]), ...hd], { mat: "wool", prims: both(ell(8.8, 12.6, 2.4, 3.4, 8)), back: true }),
      legs([10.6, 21.4], 24, 3),
      ...rig([body], { mat: "wool", prims: [ell(16, 18.2, 12.2, 6.4), ell(16, 13.6, 9.8, 5.2), ...hem(5, 27, 22.4, 10, 4)], blend: 2.5 }),
      ...rig(hd, {
        mat: "wool",
        prims: [ell(16, 10.4, 6.6, 5.8), ell(16, 6, 5, 3), ...both(cap(10.6, 13.6, 9.4, 15.6, 1.3, 0.5)), cap(15.4, 3.4, 14.4, 1.4, 1, 0.5), cap(16.6, 3.2, 17.8, 1.2, 1, 0.5)],
        blend: 3,
        paint: [{ mat: "snow", level: 4, prims: [ell(14, 1.2, 1.4, 1.2), ell(18.3, 1, 1.4, 1.2), ell(16, 3.2, 3, 0.7)] }],
      }),
      ...rig(hd, { mat: "tusk", prims: [path([[13, 15.6], [10.4, 20.2], [6.6, 21.8], [3.6, 19.8], [2.8, 16.2], [4.2, 13.4]], 1.6, 0.6)] }),
      ...rig(hd, { mat: "tusk", prims: [path([[19, 15.6], [21.6, 20.2], [25.4, 21.8], [28.4, 19.8], [29.2, 16.2], [27.8, 13.4]], 1.6, 0.6)] }),
      ...rig([...trunk([16, 13], 14, 26), ...hd], { mat: "wool", prims: [path([[16, 13], [16, 20], [16.3, 24.4], [17.8, 26.6], [19.6, 26]], 2.5, 1.3)], round: 1.8 }),
    );
    decals.push(...rig(hd, ...eyes([11, 9], [19, 9], look, "tall"), ...blush([9, 13], [21, 13])));
    if (curl > 0.6) decals.push(...twinkle(24, 19, a, 0.36, "#e6fbff", 0.28));
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: hd, neck: hd };
  },
};

// ── Aurorowl · epic ──

export const aurorowl: Species = {
  id: "aurorowl",
  name: "Aurorowl",
  element: "frost",
  tier: "epic",
  stages: ["Owlflake", "Glimmerowl", "Aurorowl"],
  palette: { feather: "#e2eaf8", wing: "#a3b6e0", beak: "#f2c25a", aurora: "#6ff2c4", aurora2: "#c49bff" },
  shiny: { feather: "#8a90d0", wing: "#5d6199", aurora: "#ff9ccf", aurora2: "#ffe27a" },
  lore: "Stays up past every deadline and remembers every footnote. Its crown flickers green when you learn something new and violet when you only pretend to.",
  hint: "Wears the northern sky as a crown.",
  // A soft breath through the round body, the wings easing a beat after,
  // and the aurora crown rippling shard by shard like the northern lights.
  // Its act is a little insight: the crown fans out from the middle,
  // glints run along it, and it gives one slow, approving owl blink before
  // the lights settle.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const glow = a < 0 ? 0 : ease(0.08, 0.34)(a) * (1 - ease(0.66, 0.92)(a));
    const look = a > 0.52 && a < 0.66 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** Breast chevrons as crisp little V stamps. */
    const chevrons = (list: [number, number][]): Decal[] => list.map(([x, y]) => stamp(x, y, ["k.k", ".k."], { k: "wing:2" }));
    /** The body swells; the crown and face ride it by whole pixels. */
    const swell = (top: number): Move => ({ at: [16, 30], wave: breath, grow: [0.02, 1 / (30 - top)] });
    const lift: Move = { at: [16, 16], wave: breath, shift: [0, -1] };
    /** One crown shard: it shimmers about its root, out of step with its
     *  neighbours, and fans away from the middle in the act, the middle
     *  first and the outer ones after. */
    const shard = (p: Prim, root: V, i: number, out: number, delay: number): Prim =>
      rig([
        { at: root, wave: sine(1, 0.13 * i), turn: 5 * calm * (1 - glow) },
        { at: root, wave: () => (a < 0 ? 0 : ease(0.08 + delay, 0.34 + delay)(a) * (1 - ease(0.66, 0.92)(a))), turn: 9 * out },
        lift,
      ], p)[0];
    /** Glints running along the crown at its brightest. */
    const glints = (list: [number, number][]) => {
      if (glow > 0) list.forEach(([x, y], i) => decals.push(...twinkle(x, y, a, 0.3 + i * 0.07, "#e6fbff", 0.26)));
    };
    /** The wings ease out and in a beat after the breath. */
    const wings = (sh: V, deg: number): Move => ({ at: sh, wave: sine(1, 0.1), turn: deg * calm, pair: true });
    if (stage === 0) {
      const body = swell(17.6);
      parts.push(
        { mat: "aurora", prims: [shard(cap(16, 18, 16, 15, 1.2, 0.45), [16, 18], 0, 0, 0)], glow: true },
        ...rig([body], {
          mat: "feather",
          prims: [ell(16, 23.8, 6.8, 6.2), ell(14, 17.8, 1.4, 1.2), ell(18, 17.8, 1.4, 1.2)],
          blend: 2,
          paint: [{ mat: "feather", level: 4, prims: [...both(ell(12.6, 22, 2.8, 2.6)), ell(16, 26, 3.6, 2.6)] }],
        }),
        ...rig([wings([10, 23], 12), body], { mat: "wing", prims: both(ell(9.6, 25, 1.5, 2.6, 15)) }),
        { mat: "beak", prims: both(ell(14, 29.6, 1.1, 0.8)) },
      );
      decals.push(...rig([lift],
        ...owlEyes([10, 20], [18, 20], look),
        stamp(15, 23, ["bb", "dd"], { b: "beak:4", d: "beak:2" }),
        ...blush([9, 24], [21, 24]),
      ));
      glints([[15, 12]]);
      if (pose === "sleep") decals.push(zzz(25, 8));
      return { parts, decals, head: [lift], neck: [body] };
    }
    if (stage === 1) {
      const body = swell(13.2);
      parts.push(
        {
          mat: "aurora2",
          prims: [shard(cap(13.4, 14.5, 11.6, 10.4, 1.2, 0.45), [13.4, 14.5], 1, -1, 0.06), shard(cap(18.6, 14.5, 20.4, 10.4, 1.2, 0.45), [18.6, 14.5], 2, 1, 0.06)],
          glow: true,
        },
        { mat: "aurora", prims: [shard(cap(16, 14, 16, 9, 1.4, 0.5), [16, 14], 0, 0, 0)], glow: true },
        ...rig([body], {
          mat: "feather",
          prims: [egg(16, 21.6, 7.6, 8.4, 0.12)],
          paint: [{ mat: "feather", level: 4, prims: [...both(ell(13, 18.4, 3.3, 3)), ell(16, 25, 4, 3.6)] }],
        }),
        ...rig([wings([10, 18.4], 5), body], {
          mat: "wing",
          prims: both(ell(9.4, 23, 2.4, 5.2, 12)),
          paint: [{ mat: "aurora2", prims: both(ell(9.6, 27.4, 2, 1.4, 12)) }],
        }),
        { mat: "beak", prims: both(ell(13.5, 29.6, 1.3, 0.9)) },
      );
      decals.push(
        ...rig([lift], ...owlEyes([11, 17], [17, 17], look), stamp(15, 20, ["bb", "dd"], { b: "beak:4", d: "beak:2" })),
        ...rig([body], ...chevrons([[13, 24], [17, 24]])),
      );
      glints([[15, 6], [9, 8], [20, 8]]);
      if (pose === "sleep") decals.push(zzz(25, 8));
      return { parts, decals, head: [lift], neck: [body] };
    }
    const body = swell(9.2);
    /** The crown's shards, each [angle°, inner, outer, width]. */
    const crown = (list: [number, number, number, number][], i0: number): Prim[] =>
      shards(16, 13, list).map((p, k) => {
        const [deg, r0] = list[k];
        const rad = (deg * Math.PI) / 180;
        const side = Math.abs(deg + 90) < 1 ? 0 : deg < -90 ? -1 : 1;
        return shard(p, [16 + Math.cos(rad) * r0, 13 + Math.sin(rad) * r0], i0 + k, side, Math.abs(deg + 90) / 75 * 0.12);
      });
    parts.push(
      { mat: "aurora", prims: crown([[-90, 3, 12.2, 2], [-143, 3, 9.6, 1.6], [-37, 3, 9.6, 1.6]], 0), glow: true },
      { mat: "aurora2", prims: crown([[-116, 3, 11.4, 1.8], [-64, 3, 11.4, 1.8], [-165, 4, 9, 1.4], [-15, 4, 9, 1.4]], 3), glow: true },
      ...rig([body], {
        mat: "feather",
        prims: [egg(16, 19.6, 9.6, 10.4, 0.14)],
        paint: [
          { mat: "feather", level: 4, prims: [...both(ell(12.6, 15.4, 4.2, 3.8)), ell(16, 24, 5, 4.6)] },
        ],
      }),
      ...rig([wings([8.4, 15.6], 4), body], {
        mat: "wing",
        prims: both(path([[8.4, 15.6], [6, 21], [6.8, 27.6]], 3, 1.6)),
        paint: [
          { mat: "wing", level: 4, prims: both(ell(6.6, 18.6, 1.4, 1.8, 20)) },
          { mat: "aurora2", prims: both(ell(6.8, 26.6, 2, 1.8)) },
        ],
      }),
      { mat: "beak", prims: both(ell(13.2, 29.6, 1.6, 1)) },
    );
    decals.push(
      ...rig([lift], ...owlEyes([10, 13], [17, 13], look, 5), stamp(15, 18, ["bb", "dd"], { b: "beak:4", d: "beak:2" })),
      ...rig([body], ...chevrons([[11, 22], [18, 22], [14, 24], [11, 26], [18, 26]])),
    );
    glints([[15, 0], [5, 3], [25, 3], [1, 9], [29, 9]]);
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: [lift], neck: [body] };
  },
};

// ── Icewyrm · epic ──

export const icewyrm: Species = {
  id: "icewyrm",
  name: "Icewyrm",
  element: "frost",
  tier: "epic",
  stages: ["Wyrmlet", "Rimecoil", "Icewyrm"],
  palette: { scale: "#78a9ee", belly: "#dcf1ff", crystal: "#9ffbff", horn: "#c6a8ff" },
  shiny: { scale: "#8a74d6", belly: "#ffe3f3", crystal: "#ffb3e0", horn: "#ffd66e" },
  lore: "Coils around the coldest bookshelf and hibernates between chapters. Every icicle on its back is a sentence it refused to forget.",
  hint: "A spiral of glass with a dragon's patience.",
  // The neck breathes, rising a pixel with the head on top, and sways
  // slowly from the coil, the sway reaching the head a beat late; the tail
  // tip curls in now and then. Its act is a nap between chapters: the head
  // droops, eyes shut, rests a moment, then lifts again as a glint runs
  // down the icicles on its back.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const doze = a < 0 ? 0 : ease(0.06, 0.34)(a) * (1 - ease(0.58, 0.8)(a));
    const look = doze > 0.3 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** One coil of the body as a tube around an ellipse: the far half first
     *  (a shade darker), the near half drawn over whatever rises out of it. */
    const coil = (cx: number, cy: number, rx: number, ry: number, r: number): [Part, Part] => [
      { mat: "scale", prims: [path(arc(cx, cy, rx, ry, 180, 360, 14), r, r)], back: true },
      {
        mat: "scale",
        prims: [path(arc(cx, cy, rx, ry, -10, 190, 16), r, r)],
        paint: [{ mat: "belly", prims: [path(arc(cx, cy + r * 0.75, rx, ry, 30, 150, 10), 0.6, 0.6)] }],
      },
    ];
    /** A ¾ head looking down-left: skull, snout, pale chin. */
    const head = (cx: number, cy: number, s: number): Part => ({
      mat: "scale",
      prims: [ell(cx, cy, 4.6 * s, 3.8 * s), ell(cx - 2.2 * s, cy + 1.9 * s, 2.8 * s, 2 * s)],
      blend: 2,
      paint: [{ mat: "belly", level: 4, prims: [ell(cx - 2.2 * s, cy + 3 * s, 2.4 * s, 1 * s)] }],
    });
    /** The neck from its root in the coil: it stretches a pixel on the
     *  breath and sways, the sway reaching the head a beat late; dozing,
     *  it bows forward and the head sinks. */
    const neckMoves = (root: V, len: number) => {
      const sway: Move = { at: root, wave: sine(1, 0.1), turn: 3 * calm * (1 - doze), bend: len, lag: 0.15 };
      const bow: Move = { at: root, wave: () => doze, turn: -6, bend: len };
      const up = (u: number) => breath(u - 0.05) * (1 - doze);
      return {
        neck: [{ at: root, wave: up, grow: [0, 1 / len] }, sway, bow] as Move[],
        head: [{ at: root, wave: up, shift: [0, -1] }, { at: root, wave: stepped(() => doze), shift: [0, 1] }, sway, bow] as Move[],
      };
    };
    /** The tail tip curls in a little now and then. */
    const curl = (root: V, len: number): Move[] => [{ at: root, wave: rise(1, 0.6), turn: -6 * calm, bend: len, lag: 0.3 }];
    /** Waking, a glint runs down the icicles. */
    const glints = (list: [number, number][]) => {
      if (a > 0.55) list.forEach(([x, y], i) => decals.push(...twinkle(x, y, a, 0.6 + i * 0.05, "#e6fbff", 0.18)));
    };
    if (stage === 0) {
      const [b0, f0] = coil(16, 26.6, 6.8, 2, 2.1);
      const m = neckMoves([17.4, 26], 6);
      parts.push(
        b0,
        { mat: "crystal", prims: [...rig(m.neck, ...crest([[19.6, 19.6, -30, 2.6]], 1.2)), ...crest([[21.4, 23.4, -20, 2.6], [23, 25.4, -40, 2.4]], 1.2)], glow: true },
        ...rig(m.head, { mat: "horn", prims: [path([[16.8, 18], [18.8, 16.4], [20, 14.8]], 1.1, 0.5), path([[13.2, 17.6], [12.6, 15.8], [12.8, 14.6]], 1, 0.5)] }),
        ...rig(m.neck, { mat: "scale", prims: [path([[17.4, 26], [19.4, 23.4], [18, 21]], 2.2, 2.2)] }),
        ...rig(m.head, head(15.4, 21, 0.95)),
        f0,
        ...rig(curl([21.6, 29], 4), { mat: "scale", prims: [path([[21.6, 29], [24.8, 28.6], [26, 26.2]], 1.3, 0.5)] }),
      );
      decals.push(...rig(m.head, ...eyes([12, 20], [17, 20], look, "tall"), ...blush([10, 23], [19, 23], 1)));
      glints([[18, 16], [21, 20]]);
      if (pose === "sleep") decals.push(zzz(25, 10));
      return { parts, decals, head: m.head, neck: m.head };
    }
    if (stage === 1) {
      const [b0, f0] = coil(16, 25.6, 8.6, 2.6, 2.3);
      const m = neckMoves([17, 25], 11);
      parts.push(
        b0,
        { mat: "crystal", prims: [...rig(m.neck, ...crest([[21.2, 18.6, -35, 3.2], [21.4, 21.6, -15, 3]], 1.3)), ...crest([[24.2, 23.2, -40, 3], [7.8, 23.2, -140, 3]], 1.3)], glow: true },
        ...rig(m.head, { mat: "horn", prims: [path([[15.4, 11.4], [17.8, 9.4], [19.4, 7.6]], 1.2, 0.5), path([[12.4, 11], [11.4, 9], [11.4, 7.4]], 1.1, 0.5)] }),
        ...rig(m.neck, {
          mat: "scale",
          prims: [path([[17, 25], [19.8, 21], [18.8, 17.4], [15.6, 15]], 2.3, 2.2)],
          paint: [{ mat: "belly", level: 4, prims: [path([[16, 25], [18.4, 21], [17.4, 17.6]], 0.9, 0.9)] }],
        }),
        ...rig(m.head, head(14, 13.4, 1)),
        f0,
        ...rig(curl([23.6, 28.6], 5), { mat: "scale", prims: [path([[23.6, 28.6], [27.2, 28.2], [28.4, 25.6]], 1.5, 0.5)] }),
      );
      decals.push(...rig(m.head, ...eyes([11, 12], [16, 12], look, "tall")));
      glints([[22, 15], [23, 19], [26, 20]]);
      if (pose === "sleep") decals.push(zzz(25, 5));
      return { parts, decals, head: m.head, neck: m.head };
    }
    const [b0, f0] = coil(16, 25.4, 11, 3, 2.6);
    const m = neckMoves([17, 25.4], 17);
    const tail = curl([25.4, 28.8], 7);
    parts.push(
      b0,
      {
        mat: "crystal",
        prims: [
          ...rig(m.neck, ...crest([[21.2, 7.8, -45, 4.2], [22.8, 12.4, -20, 4.6], [23.4, 17.4, 0, 4.4]], 1.35)),
          ...crest([[26.6, 23.2, -38, 4.4], [5.4, 23.2, -142, 4.4], [9.6, 22.4, -110, 3.4]], 1.35),
        ],
        glow: true,
      },
      ...rig(m.head, { mat: "horn", prims: [path([[15.8, 4.6], [18.2, 2.4], [19.6, 0.6]], 1.6, 0.5), path([[11.4, 4], [10, 2], [10.4, 0.6]], 1.3, 0.5)] }),
      ...rig(m.neck, {
        mat: "scale",
        prims: [path([[17, 25.4], [21.6, 20.4], [21.4, 14.4], [18.6, 9.6]], 2.8, 2.6)],
        paint: [{ mat: "belly", level: 4, prims: [path([[16, 25.6], [19.8, 20.6], [19.6, 14.8], [17.4, 11]], 1.1, 1)] }],
      }),
      ...rig(m.head, head(14.6, 7.2, 1.15)),
      f0,
      ...rig(tail, { mat: "scale", prims: [path([[25.4, 28.8], [29, 28.4], [30.4, 25.6], [29.6, 23]], 2, 0.5)] }),
      ...rig(tail, { mat: "crystal", prims: [poly([[29.6, 23.6], [30.8, 21.6], [29.9, 19.2], [28.6, 21.4]], 0.1)], glow: true }),
    );
    decals.push(...rig(m.head, ...eyes([10, 6], [16, 6], look, "round"), stamp(9, 10, ["k.k"], { k: "scale:1" })));
    glints([[23, 3], [26, 9], [27, 15], [29, 19]]);
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: m.head, neck: m.head };
  },
};

// ── Byakko · legendary ──

export const byakko: Species = {
  id: "byakko",
  name: "Byakko",
  element: "frost",
  tier: "legendary",
  stages: ["Snowcub", "Frostclaw", "Byakko"],
  palette: { fur: "#d9e5fc", stripe: "#4a62c4", crystal: "#8eeeff", aura: "#b8a2ff", nose: "#ff9ec0", iris: "#ffcf5a" },
  shiny: { fur: "#ffe6c4", stripe: "#7a4fc9", crystal: "#ffb0dc", aura: "#ffd970", iris: "#6fe0ff" },
  lore: "Guardian of the west wing of every library, where the oldest books sleep. Its crystal mane rings like a bell when someone dog-ears a page.",
  hint: "The west wind's guardian, striped like cold ink.",
  // A slow breath that rises through the chest into the head, the tail
  // swaying with its tip curling now and then, one ear easing back, the
  // crystal mane drifting. Its act is a slow yawn: the head lifts a pixel
  // with jaws wide and eyes shut, the mane spreads a little and its
  // sparkles chime, then it settles.
  motion: { idle: 3, sleep: 4.8, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const yawn = a < 0 ? 0 : ease(0.08, 0.35)(a) * (1 - ease(0.6, 0.92)(a));
    const shut = !awake(pose) || yawn > 0.45;
    const calm = pose === "sleep" ? 0.5 : 1;
    /** Gold cat eyes, 3×2 (3×3 with a heavy upper lid on the adult). */
    const catEyes = (l: [number, number], r: [number, number], lined = false): Decal[] => {
      const inks = { w: "white:4", g: "iris:3", k: "eye:3" };
      const dy = lined ? 1 : 0;
      if (shut) return [stamp(l[0], l[1] + 1 + dy, ["kkk"], inks), stamp(r[0], r[1] + 1 + dy, ["kkk"], inks)];
      const rows = lined ? ["kkk", "wkg", "gkg"] : ["wkg", "gkg"];
      return [stamp(l[0], l[1], rows, inks), stamp(r[0], r[1], rows, inks)];
    };
    /** Nose and mouth; mid-yawn the jaws open wide. */
    const face = (nx: number, ny: number, wide = false): Decal[] => [
      stamp(nx, ny, ["nn"], { n: "nose:3" }),
      yawn > 0.45
        ? stamp(nx - 1, ny + 1, wide ? [".kk.", "kppk", "kppk", ".kk."] : [".kk.", "kppk", ".kk."], { k: "fur:1", p: "nose:2" })
        : stamp(nx - 1, ny + 1, [".kk.", "k..k"], { k: "fur:1" }),
    ];
    /** Round tiger ears with pink insides. */
    const ears = (x: number, y: number, r: number): Part => ({
      mat: "fur",
      prims: both(ell(x, y, r, r * 0.95)),
      paint: [{ mat: "nose", prims: both(ell(x + 0.1, y + 0.3, r * 0.5, r * 0.5)) }],
    });
    /** One ear eases back about its base, now and then. */
    const flick = (x: number, y: number): Move => ({ at: [x, y], wave: pulse(pose === "sleep" ? 0.7 : 0.4, 0.3), turn: -16, side: "left" });
    /** Striped tail curling up on the right. */
    const tail = (pts: [number, number][], r0: number, r1: number, bands: [number, number, number, number][]): Part => ({
      mat: "fur",
      prims: [path(pts, r0, r1)],
      paint: [{ mat: "stripe", level: 3, prims: bands.map(([ax, ay, bx, by]) => cap(ax, ay, bx, by, 0.75)) }],
    });
    /** The tail sways from its root, a wave running out to the tip, and
     *  the tip curls in once a loop; mid-yawn it curls in too. */
    const swish = (root: V, len: number): Move[] => [
      { at: root, wave: sine(1, 0.25), turn: 7 * calm, bend: len, lag: 0.3 },
      { at: root, wave: pulse(0.55, 0.35), turn: -8 * calm, bend: len, lag: 0.15 },
      { at: root, wave: () => yawn, turn: -8, bend: len },
    ];
    // The breath: the chest swells, the head rides it a beat later; the
    // yawn holds the head up a pixel.
    const breath = stepped(rise(1));
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.06), Math.round(yawn)), shift: [0, -1] };
    if (stage === 0) {
      // One blob: it swells as a whole, everything on it riding along.
      const swell: Move = { at: [16, 30], wave: (u) => Math.max(breath(u), Math.round(yawn)), grow: [0.02, 0.07] };
      parts.push(
        ...rig(swish([20.5, 27.6], 6),
          tail([[20.5, 27.6], [23.8, 26.4], [25, 23]], 1.6, 1.3, [[22.6, 25.2, 23.6, 28], [23.6, 23.8, 26.4, 24.2]])),
        ...rig([swell], { mat: "crystal", prims: [cap(16, 16.4, 16, 13.2, 1.2, 0.45)], glow: true }),
        ...rig([flick(11.6, 18), swell], ears(10.6, 16.4, 2.1)),
        ...rig([swell], {
          mat: "fur",
          prims: [ell(16, 21, 7, 5.6), ...both(poly([[9.5, 20], [7.6, 23.6], [11, 24.6]], 0.5)), ell(16, 26.6, 5, 3.6)],
          blend: 2.5,
          paint: [
            { mat: "stripe", level: 3, prims: [cap(16, 15.4, 16, 17.2, 0.8), ...both(path([[7.6, 22.2], [10.4, 22.6]], 0.8, 0.5)), ...both(path([[10.4, 25.4], [11.8, 27.6]], 0.8, 0.5))] },
            { mat: "fur", level: 5, prims: both(ell(14.8, 23.6, 1.8, 1.4)) },
          ],
        }),
        { mat: "fur", prims: both(ell(13.2, 29.2, 1.9, 1.3)) },
      );
      decals.push(...rig([swell], ...eyes([12, 19], [18, 19], shut ? "blink" : "idle", "tall"), ...blush([10, 23], [20, 23]), ...face(15, 22)));
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    const chest: Move = { at: [16, 29], wave: (u) => Math.max(breath(u), Math.round(yawn)), grow: [0.02, 0.075] };
    if (stage === 1) {
      parts.push(
        ...rig(swish([21, 28], 8),
          tail([[21, 28], [25, 26.8], [26.4, 23], [25.2, 19.8]], 1.6, 1.2, [[23, 26, 23.6, 28.8], [25, 24, 27.8, 24.2], [24.4, 21, 27, 20.6]])),
        {
          mat: "fur",
          prims: both(ell(11, 26.6, 3, 3.3)),
          back: true,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[7.8, 25.2], [10, 26.2]], 0.8, 0.45)) }],
        },
        ...rig([chest], { mat: "fur", prims: [ell(16, 23.6, 4.8, 5.2)] }),
        ...rig([flick(12.4, 12.6), lift], ears(10.8, 10.8, 2.2)),
        ...rig([lift], { mat: "crystal", prims: [cap(16, 11, 16, 6.6, 1.4, 0.45), ...both(cap(14, 11.2, 13.2, 8.6, 1, 0.45))], glow: true }),
        ...rig([lift], {
          mat: "fur",
          prims: [ell(16, 15.6, 6.4, 5), ...both(poly([[10.2, 15], [7.8, 18.6], [11.4, 19.2]], 0.5))],
          blend: 2,
          paint: [
            { mat: "stripe", level: 3, prims: [...both(path([[13.4, 11], [14, 12.8]], 0.8, 0.5)), ...both(path([[7.6, 17.2], [10.6, 17.4]], 0.8, 0.45))] },
            { mat: "fur", level: 5, prims: both(ell(14.8, 18.4, 1.7, 1.3)) },
          ],
        }),
        {
          mat: "fur",
          prims: both(cap(13.6, 23, 13.4, 28.6, 1.6)).concat(both(ell(13.4, 29.2, 2, 1.2))),
          round: 1.5,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[11.8, 25.4], [13.6, 25.8]], 0.8, 0.45)) }],
        },
      );
      decals.push(...rig([lift], ...catEyes([12, 14], [17, 14]), ...face(15, 17)));
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head: [lift], neck: [lift] };
    }
    // The mane drifts outward and back, a ripple running down each side;
    // mid-yawn it spreads a little.
    const mane: Move[] = [
      { at: [10, 9], wave: sine(1, 0.15), turn: 4 * calm, bend: 14, lag: 0.25, pair: true },
      { at: [10, 9], wave: () => yawn, turn: 5, bend: 14, lag: 0.1, pair: true },
      lift,
    ];
    parts.push(
      ...rig(mane,
        { mat: "aura", prims: both(path([[10.4, 8], [6.4, 7.4], [3.4, 9.6], [2, 13.6], [1.4, 18.4]], 1.8, 0.5)), glow: true },
        { mat: "crystal", prims: both(path([[9.6, 12], [6.4, 12.6], [4.6, 15.6], [3.8, 19.6], [3.2, 24]], 1.8, 0.5)), glow: true }),
      ...rig(swish([22.5, 28], 10),
        tail([[22.5, 28], [27, 26.5], [28.5, 22.5], [27.5, 18.5]], 1.9, 1.4, [[24.4, 26, 25.2, 29], [26.6, 23.4, 30, 23.8], [26, 20.4, 29.4, 19.6]])),
      {
        mat: "fur",
        prims: both(ell(9.6, 25.8, 3.9, 4.2)),
        back: true,
        paint: [{ mat: "stripe", level: 3, prims: both(path([[5.6, 23.6], [8, 24.4], [9, 26.2]], 0.85, 0.45)) }],
      },
      ...rig([chest], { mat: "fur", prims: [ell(16, 22, 6, 6.6)], paint: [{ mat: "fur", level: 4, prims: [ell(16, 23, 3.4, 5)] }] }),
      ...rig([flick(12, 9), lift], ears(10, 6.4, 2.5)),
      ...rig([lift], {
        mat: "fur",
        prims: [ell(16, 11.8, 7.2, 5.6), ...both(poly([[9.5, 11], [6, 15.8], [11, 16.6]], 0.6))],
        blend: 2,
        paint: [
          { mat: "stripe", prims: [...both(path([[6.4, 14.2], [10, 14.4]], 0.9, 0.45))] },
          { mat: "fur", level: 5, prims: both(ell(14.7, 14.6, 2, 1.5)) },
        ],
      }),
      {
        mat: "fur",
        prims: both(cap(13.4, 21, 12.8, 28.4, 1.9, 2)).concat(both(ell(12.6, 29.1, 2.5, 1.3))),
        round: 1.8,
        paint: [{ mat: "stripe", level: 3, prims: both(path([[10.6, 24], [12.8, 24.6]], 0.8, 0.45)) }],
      },
      ...rig([chest], { mat: "crystal", prims: [poly([[16, 17.6], [17.6, 19.6], [16, 22], [14.4, 19.6]], 0.2)], glow: true }),
      ...rig([lift], { mat: "crystal", prims: [cap(16, 7, 16, 1.6, 1.7, 0.45), ...both(cap(13.4, 7.2, 12, 3.4, 1.2, 0.45))], glow: true }),
    );
    // When animated the sparkles twinkle in turn — and all at once as the
    // mane rings mid-yawn.
    const ring = yawn > 0.6 ? a : undefined;
    decals.push(
      ...rig([lift], ...catEyes([12, 10], [17, 10]), ...face(15, 13, true)),
      ...twinkle(1, 1, ring ?? t, ring ? 0.25 : 0, "#e6fbff"),
      ...(pose === "sleep" ? [] : twinkle(27, 3, ring ?? t, ring ? 0.3 : 0.5, "#e6fbff")),
      ...(ring ? [...twinkle(0, 15, ring, 0.35, "#e6fbff", 0.25), ...twinkle(29, 13, ring, 0.42, "#e6fbff", 0.25)] : []),
      stamp(29, 30, ["s"], { s: "#fff4c2" }, true),
      stamp(2, 29, ["s"], { s: "#e6fbff" }, true),
    );
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

export const FROST: Species[] = [snowpuff, frostmoth, pengwin, ermine, fenrir, yeti, mammoth, aurorowl, icewyrm, byakko];
