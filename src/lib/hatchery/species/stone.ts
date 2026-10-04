import type { Species } from "../kit.ts";
import { blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move } from "../motion.ts";
import { ease, pulse, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, path, poly } from "../pixel.ts";

/** Flat-topped hexagon of circumradius r — shell plates. */
const hexa = (cx: number, cy: number, r: number, sy = 1): Prim =>
  poly(
    [0, 60, 120, 180, 240, 300].map((a): [number, number] => [
      cx + r * Math.cos((a * Math.PI) / 180),
      cy + r * sy * Math.sin((a * Math.PI) / 180),
    ]),
  );

/** Everything below y is removed — flat undersides for domes. */
const below = (y: number): Prim => poly([[0, y], [32, y], [32, 40], [0, 40]]);
/** A faceted gem (rhombus). */
const diamond = (cx: number, cy: number, rx: number, ry: number, round = 0.3): Prim =>
  poly([[cx - rx, cy], [cx, cy - ry], [cx + rx, cy], [cx, cy + ry]], round);
/** A crystal shard: base centered at (x, y), leaning tip at (x + lean, y - h). */
const shard = (x: number, y: number, w: number, h: number, lean = 0): Prim =>
  poly([[x - w / 2, y], [x - w * 0.35 + lean * 0.6, y - h * 0.62], [x + lean, y - h], [x + w * 0.4 + lean * 0.5, y - h * 0.55], [x + w / 2, y]], 0.35);

/** The shadowed right face of a `shard` — paint it a step down so the
 *  crystal reads faceted instead of as a glowing flame. */
const facet = (x: number, y: number, w: number, h: number, lean = 0): Prim =>
  poly([[x + lean, y - h], [x + w * 0.4 + lean * 0.5, y - h * 0.55], [x + w / 2, y], [x + w * 0.08, y]]);
/** Crystal shards in one glow part, each with its shaded facet. */
const crystals = (mat: string, list: [number, number, number, number, number?][], line = true): Part => ({
  mat, glow: true, line,
  prims: list.map(([x, y, w, h, l]) => shard(x, y, w, h, l ?? 0)),
  paint: [{ mat, level: 2, prims: list.map(([x, y, w, h, l]) => facet(x, y, w, h, l ?? 0)) }],
});

// ── pebblit · common ──

export const pebblit: Species = {
  id: "pebblit",
  name: "Pebblit",
  element: "stone",
  tier: "common",
  stages: ["Pebblit", "Cairnling", "Bouldergolem"],
  palette: { rock: "#c6b196", moss: "#86c25e", gem: "#7ee8d6" },
  shiny: { rock: "#a6b8de", moss: "#e79ac4", gem: "#ffd46e" },
  lore: "A pebble that fell out of a geology textbook and never went back. Each finished chapter stacks it one stone taller.",
  hint: "Sits very, very still on the bookshelf.",
  // Very, very still: a slow breath, the moss tuft nodding on top. Its act
  // is stacking one stone taller: it stretches up, eyes shut in effort, the
  // tuft lagging, holds, and settles back down with a soft squash.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const up = a < 0 ? 0 : ease(0.08, 0.36)(a) * (1 - ease(0.56, 0.78)(a));
    const settle = a < 0 ? 0 : pulse(0.74, 0.2)(a);
    const look = up > 0.35 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const tuft = (x: number, y: number, s: number): Part =>
      ({ mat: "moss", blend: 1.5, prims: [ell(x - 1.2 * s, y, 2.2 * s, 1.1 * s), ell(x + 1.2 * s, y - 0.3 * s, 1.8 * s, 1 * s), cap(x + 0.6 * s, y - 0.6 * s, x + 1.4 * s, y - 2.6 * s, 0.6, 0.5)] });
    /** The tuft nods on its rock, a beat behind it, and flops as it lands. */
    const nod = (x: number, y: number, s: number): Move[] => [
      { at: [x, y + s], wave: sine(1, 0.3), turn: 16 * calm, bend: 3 * s, lag: 0.3 },
      { at: [x, y + s], wave: () => settle - 0.3 * up, turn: 18 },
    ];
    if (stage === 0) {
      const swell: Move[] = [
        { at: [16, 30], wave: (u) => breath(u) * (1 - Math.min(1, up * 3)), grow: [0.02, 0.09] },
        { at: [16, 30], wave: () => Math.round(up * 2) / 2, grow: [-0.03, 0.15] },
        { at: [16, 30], wave: () => Math.round(settle * 2) / 2, grow: [0.03, -0.07] },
      ];
      parts.push(
        ...rig(swell, { mat: "rock", prims: [ell(16, 24.8, 7.4, 5), ell(15, 23.4, 5.4, 4.4)], blend: 3 }),
        ...rig([...nod(15.6, 19.6, 0.9), ...swell], tuft(15.6, 19.6, 0.9)),
      );
      decals.push(...rig(swell,
        ...eyes([12, 22], [18, 22], look, "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(15, 26, ["kk"], { k: "rock:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head: swell, neck: swell };
    }
    /** The top stone: up a pixel on the breath; stacking, up two. */
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.08), Math.round((stage === 2 ? 2 : 1) * up)), shift: [0, -1] };
    if (stage === 1) {
      /** Then the top stone stretches a pixel taller. */
      const stretch: Move = { at: [16, 24], wave: () => (up > 0.8 ? 1 : 0), grow: [0, 0.1] };
      const head = [lift, stretch];
      parts.push(
        { mat: "rock", prims: [ell(16, 27, 8, 3.2)] },
        crystals("gem", [[21.4, 25.6, 2.4, 4.2, 0.5]]),
        ...rig(head,
          { mat: "rock", prims: [ell(16, 19.4, 6.6, 5.6), ell(15, 18, 5, 4.2)], blend: 3 },
          { mat: "rock", prims: both(ell(8.6, 23.6, 1.9, 1.8)) },
        ),
        ...rig([...nod(15.4, 13.8, 1.1), ...head], tuft(15.4, 13.8, 1.1)),
      );
      decals.push(...rig(head,
        ...eyes([12, 18], [18, 18], look, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 22, ["kk"], { k: "rock:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head, neck: head };
    }
    /** The arms rise a little with the breath, and lift as it stacks. */
    const arms: Move[] = [
      { at: [8.4, 20.6], wave: (u) => breath(u - 0.04) * calm, turn: 7, pair: true },
      { at: [8.4, 20.6], wave: () => Math.round(up * 2) / 2, turn: 12, pair: true },
    ];
    parts.push(
      { mat: "rock", back: true, prims: both(ell(11, 29.2, 3.2, 1.6)) },
      crystals("gem", [[22.8, 18.2, 4, 10.5, 0.8], [26, 19.4, 3, 7, 1.6], [19.8, 17.8, 2.6, 5.5, -0.6]]),
      { mat: "rock", prims: [ell(16, 22.6, 9.6, 6.8), ell(15, 21, 7, 5)], blend: 3,
        paint: [{ mat: "moss", prims: [ell(9.4, 18.2, 2.6, 1.3), ell(11.4, 17.2, 1.6, 1)] }] },
      ...rig([lift], { mat: "rock", prims: [ell(16, 13, 7, 5.6), ell(15, 11.8, 5.4, 4.4)], blend: 3 }),
      ...rig([...nod(15.4, 7.8, 1.3), lift], tuft(15.4, 7.8, 1.3)),
      ...rig(arms, { mat: "rock", prims: both(ell(6, 23.4, 3.2, 3.6)) }),
    );
    decals.push(...rig([lift],
      ...eyes([12, 12], [18, 12], look, "tall"),
      ...blush([10, 15], [20, 15]),
      stamp(14, 16, ["k..k", ".kk."], { k: "rock:1" }),
    ));
    if (up > 0.6) decals.push(...twinkle(22, 5, a, 0.34, "#effffb", 0.26));
    if (pose === "sleep") decals.push(zzz(3, 3));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── geodillo · common ──

export const geodillo: Species = {
  id: "geodillo",
  name: "Geodillo",
  element: "stone",
  tier: "common",
  stages: ["Rollidillo", "Bandillo", "Geodillo"],
  palette: { shell: "#bca088", skin: "#efc8a8", gem: "#b98cff" },
  shiny: { shell: "#d7b35e", skin: "#f3d9c2", gem: "#ff8fbf" },
  lore: "Curls into a ball at the first sign of a pop quiz. The older ones crack open to show off amethyst they grew from pure concentration.",
  hint: "Hollow, and glittering inside.",
  // The banded shell rises on a slow breath, the face a beat after it, the
  // little tail swaying. Its act is a contented rock from side to side on
  // its round shell, eyes shut, ears flopping after; grown, its amethyst
  // glints at each end of the sway.
  motion: { idle: 3.6, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const env = a < 0 ? 0 : ease(0.04, 0.22)(a) * (1 - ease(0.72, 0.96)(a));
    const sway = (u: number) => env * Math.sin(Math.PI * 4 * (u - 0.04));
    const look = env > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** It sways a pixel to each side on its round shell, the face a beat
     *  behind (shifts, not turns, keep the bands crisp). */
    const rock: Move = { at: [16, 24], wave: () => Math.round(sway(a)), shift: [1, 0] };
    const rockLate: Move = { at: [16, 24], wave: () => Math.round(sway(a - 0.05)), shift: [1, 0] };
    /** The ears flop after the rock, a beat late. */
    const flop = (x: number, y: number): Move => ({ at: [x, y], wave: () => sway(a - 0.07), turn: 14 });
    const tail = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.4), turn: 9 * calm, bend: len, lag: 0.3 });
    const swell = (h: number): Move => ({ at: [16, 30], wave: (u) => breath(u) * (1 - env), grow: [0.02, 1 / h] });
    /** The face lifts a pixel on the breath, a beat behind the shell. */
    const lift: Move = { at: [16, 24], wave: (u) => breath(u - 0.1) * (1 - env), shift: [0, -1] };
    /** A band ring over the shell — reads as an armadillo's ∩ arches. */
    const band = (cy: number, rx: number, ry: number) =>
      ({ mat: "shell", level: 1, prims: [ell(16, cy, rx, ry)], cut: [ell(16, cy, rx - 1.1, ry - 1.1)] });
    if (stage === 0) {
      const body = [swell(13), rock];
      const face = [lift, rockLate];
      parts.push(
        ...rig([tail([21, 27.6], 5), rock], { mat: "skin", back: true, prims: [path([[21, 27.6], [24, 27.8], [25.4, 25.8]], 1, 0.7)] }),
        ...rig(body, { mat: "shell", prims: [ell(16, 23.4, 7.8, 6.6)],
          paint: [band(31, 9.6, 10.6), band(31, 10.4, 13.2)] }),
        ...rig(face, { mat: "skin", prims: [ell(16, 26.4, 4.4, 3.2), ...rig([flop(12.6, 24.6)], ...both(ell(12.4, 23.2, 1, 1.7, -30)))], blend: 1 }),
      );
      decals.push(...rig(face,
        ...eyes([13, 24], [17, 24], look, "tall"),
        stamp(15, 27, ["nn"], { n: "skin:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: face, neck: face };
    }
    if (stage === 1) {
      const body = [swell(15), rock];
      const face = [lift, rockLate];
      parts.push(
        ...rig([tail([23, 26.5], 6), rock], { mat: "skin", back: true, prims: [path([[23, 26.5], [26.5, 27.5], [28, 25.5]], 1.2, 0.7)] }),
        ...rig(body, { mat: "shell", prims: [ell(16, 20.8, 9.8, 7.2)],
          paint: [band(27, 6.6, 9.4), band(27, 8.8, 11.4)] }),
        ...rig([flop(13, 18.4), ...face], { mat: "skin", prims: both(cap(13.4, 18.5, 11.2, 14.6, 1.4, 1)) }),
        ...rig(face, { mat: "skin", prims: [ell(16, 22.6, 5, 4.2), ell(16, 26.4, 2, 1.9)], blend: 2 }),
        { mat: "skin", prims: both(ell(11, 28.8, 2.2, 1.4)) },
      );
      decals.push(...rig(face,
        ...eyes([13, 21], [17, 21], look, "tall"),
        ...blush([11, 24], [20, 24], 1),
        stamp(15, 27, ["nn"], { n: "skin:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: face, neck: face };
    }
    const body = [swell(18), rock];
    const face = [lift, rockLate];
    const crack: [number, number][] = [[7.6, 16], [9.6, 12.8], [11.6, 13.8], [13.6, 11], [16.4, 12.2], [18.6, 10.4], [20.6, 12.6], [22.6, 11.8], [24.6, 15.8], [21.4, 17.2], [18.4, 16], [15.8, 17.4], [13, 16.2], [10.4, 17.4]];
    parts.push(
      ...rig([tail([25, 26.5], 7), rock], { mat: "skin", back: true, prims: [path([[25, 26.5], [28.5, 27.8], [30, 25.8]], 1.4, 0.7)] }),
      ...rig(body,
        { mat: "shell", prims: [ell(16, 19.5, 12, 8.6)],
          paint: [
            band(28, 11.4, 14.6), band(28, 8.6, 11.8),
            { mat: "shell", level: 5, prims: [poly(crack, 0.9)] },
            { mat: "gem", level: 1, prims: [poly(crack)] },
          ] },
        crystals("gem", [[13, 15.4, 2.4, 4.4, -0.7], [16.2, 15.2, 3, 7.6, -0.1], [19.2, 14.8, 2.4, 5.4, 0.6]]),
      ),
      ...rig([flop(12.8, 20), ...face], { mat: "skin", prims: both(cap(13.2, 20.5, 10, 17.8, 1.5, 1)) }),
      ...rig(face, { mat: "skin", prims: [ell(16, 23.6, 5.2, 4.3), ell(16, 27.2, 2.1, 1.9)], blend: 2 }),
      { mat: "skin", prims: both(ell(9.4, 28.8, 2.8, 1.5)) },
    );
    decals.push(...rig(face,
      ...eyes([13, 22], [17, 22], look, "tall"),
      ...blush([11, 25], [20, 25], 1),
      stamp(15, 28, ["nn"], { n: "skin:1" }),
    ));
    // The amethyst glints at each end of the sway.
    if (env > 0.5) decals.push(...rig(body, ...twinkle(15, 6, a, 0.2, "#fff4ff", 0.2), ...twinkle(11, 10, a, 0.45, "#fff4ff", 0.2), ...twinkle(18, 9, a, 0.7, "#fff4ff", 0.2)));
    if (pose === "sleep") decals.push(zzz(24, 4));
    return { parts, decals, head: face, neck: face };
  },
};

// ── gargoyle · rare ──

export const gargoyle: Species = {
  id: "gargoyle",
  name: "Gargoyle",
  element: "stone",
  tier: "rare",
  stages: ["Gargling", "Gargoyl", "Gargoyle"],
  palette: { stone: "#a7b0c6", wing: "#8e88ae", horn: "#e8dab6" },
  shiny: { stone: "#86c9ae", wing: "#4f9c86", horn: "#f5e3a0" },
  lore: "Perched on library rooftops for centuries, pretending to be a statue so no one asks it to return its books.",
  hint: "Grins from the gutter.",
  // Wings fanning a little on a slow breath, the tail curling after. Its
  // act is playing statue: wings fold, eyes shut, every motion stops, then
  // one eye peeks open to check if anyone's looking, and it relaxes.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const still = a < 0 ? 0 : ease(0.05, 0.22)(a) * (1 - ease(0.72, 0.92)(a));
    const peek = a >= 0.42 && a < 0.6;
    const calm = (pose === "sleep" ? 0.4 : 1) * (1 - still);
    const breath = stepped(rise(1));
    const live = (u: number) => (still > 0 ? 0 : breath(u));
    /** Eyes shut while it plays statue — all but the one that peeks. */
    const face = (l: V, r: V, style: "tall") => {
      if (still <= 0.4) return eyes(l, r, pose, style);
      const shut = eyes(l, r, "blink", style);
      return peek ? [eyes(l, r, pose, style)[0], shut[1]] : shut;
    };
    /** Wings fan with the breath; playing statue they fold up tight. */
    const wings = (at: V, fan: number, fold: number): Move[] => [
      { at, wave: (u) => sine(1, 0.1)(u) * calm, turn: fan, pair: true },
      { at, wave: () => Math.round(still * 2) / 2, turn: fold, pair: true },
    ];
    const tail = (root: V, len: number, deg: number): Move => ({ at: root, wave: (u) => sine(1, 0.45)(u) * calm, turn: deg, bend: len, lag: 0.3 });
    const tailPart = (pts: [number, number][], r0: number, r1: number, tip: Prim): Part =>
      ({ mat: "stone", prims: [path(pts, r0, r1), tip], back: true });
    if (stage === 0) {
      const swell: Move = { at: [16, 30], wave: live, grow: [0.02, 0.08] };
      parts.push(
        ...rig([tail([20, 28], 7, 12), swell], tailPart([[20, 28], [24, 28], [25.5, 25]], 1, 0.7, poly([[24, 24.5], [25.5, 21.5], [27.5, 24]], 0.4))),
        ...rig([...wings([11.6, 20.6], 13, 14), swell], { mat: "wing", prims: both(ell(9.4, 19.5, 2.6, 1.6, -35)), back: true }),
        ...rig([swell], { mat: "stone", prims: [ell(16, 23.2, 6.8, 6), ...both(poly([[10.5, 20], [7.5, 16.5], [12.5, 18.5]], 0.4)), ...both(ell(13, 29, 1.8, 1.2))], blend: 1.2 }),
        ...rig([swell], { mat: "horn", prims: both(ell(13.4, 17.4, 1, 1.1)) }),
      );
      decals.push(...rig([swell],
        ...face([12, 21], [18, 21], "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(14, 25, ["k..k", ".kk.", ".w.."], { k: "stone:1", w: "white:4" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    const lift: Move = { at: [16, 16], wave: (u) => live(u - 0.08), shift: [0, -1] };
    if (stage === 1) {
      parts.push(
        ...rig([tail([20, 28], 9, 9)], tailPart([[20, 28], [25, 28.5], [27, 25]], 1.2, 0.8, poly([[25.5, 24.5], [27.2, 21], [29, 24.2]], 0.4))),
        ...rig(wings([10.6, 19.4], 6, 11), { mat: "wing", back: true, prims: both(poly([[11, 19], [4.5, 10.5], [2.8, 16.5], [4.8, 16], [5.6, 19.8], [7.8, 19], [9.6, 22]], 0.4)) }),
        { mat: "stone", blend: 3, prims: [...rig([lift], ell(16, 17.5, 7, 6), ...both(poly([[10, 16], [6.5, 12.5], [11.5, 13.5]], 0.4))), ell(16, 25, 5.5, 4.5), ...both(ell(12.8, 28.8, 2, 1.3))] },
        ...rig([lift], { mat: "horn", prims: both(cap(13, 12.4, 12, 10, 1.2, 0.7)) }),
        { mat: "stone", prims: both(ell(11.6, 24.5, 1.6, 1.8)) },
      );
      decals.push(...rig([lift],
        ...face([12, 16], [18, 16], "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(14, 20, ["k..k", ".kk.", ".w.."], { k: "stone:1", w: "white:4" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [lift], neck: [] };
    }
    parts.push(
      ...rig(wings([11.2, 16], 4, 10), { mat: "wing", back: true, prims: both(poly([[11.5, 15.5], [4, 3.5], [1.2, 11], [2.5, 16.5], [4.5, 15], [5.5, 19.5], [8, 18], [10, 21]], 0.4)) }),
      ...rig([tail([21, 28.6], 12, 7)], tailPart([[21, 28.6], [26, 29], [28.8, 26.5], [28.6, 22.5], [27.2, 20.8]], 1.5, 0.8, poly([[25, 21.5], [26.5, 17.5], [29.5, 20]], 0.4))),
      { mat: "stone", blend: 2.5, round: 4, prims: [
        ell(16, 23.8, 7.4, 5.6), ...both(ell(9.8, 26.4, 4, 3.6)), ...both(ell(8.4, 29, 2.8, 1.3)),
      ] },
      ...rig([lift],
        { mat: "stone", blend: 1.5, prims: [ell(16, 15, 7.6, 5.8), ...both(poly([[10, 14.5], [4.2, 11.2], [10.2, 11]], 0.4))] },
        { mat: "horn", prims: both(path([[12.4, 10.6], [10.2, 7.6], [9.9, 4.6], [11.4, 3]], 1.4, 0.6)) },
      ),
      { mat: "stone", prims: both(ell(13.2, 28.2, 2.2, 1.7)) },
    );
    decals.push(
      ...rig([lift],
        ...face([12, 13], [18, 13], "tall"),
        ...blush([10, 16], [20, 16]),
        stamp(13, 17, ["k....k", ".kkkk.", ".w..w."], { k: "stone:1", w: "white:4" }),
      ),
      stamp(11, 29, ["k.k", "..."], { k: "stone:1" }),
      stamp(18, 29, ["k.k"], { k: "stone:1" }),
    );
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── basilisk · epic ──

export const basilisk: Species = {
  id: "basilisk",
  name: "Basilisk",
  element: "stone",
  tier: "epic",
  stages: ["Lizlet", "Crestling", "Basilisk"],
  palette: { scale: "#d9a26c", belly: "#f3dfb3", crown: "#f0c24e", gem: "#5ee6c8" },
  shiny: { scale: "#7f9fe6", belly: "#e3e9ff", crown: "#e4e6f2", gem: "#ff6f9e" },
  lore: "Its stare once turned people to stone; now it only turns them into very focused readers. Wears its crown to every study session.",
  hint: "A king who rules from a sunny rock.",
  // A regal calm: the head rises on a slow breath, the frill fans a
  // little, the tail's tip sways. Its act is basking: the frill lifts,
  // the chin rises, eyes close in the sun, and its gems glint.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const bask = a < 0 ? 0 : ease(0.06, 0.32)(a) * (1 - ease(0.66, 0.94)(a));
    const look = bask > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.08), Math.round(bask)), shift: [0, -1] };
    const tail = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.4), turn: 6 * calm, bend: len, lag: 0.35 });
    /** Glints on the gems while it basks, one after the other. */
    const glint = (x: number, y: number, at: number, ms: Move[]) => {
      if (bask > 0.5) decals.push(...rig(ms, ...twinkle(x, y, a, at, "#fffbe0", 0.25)));
    };
    if (stage === 0) {
      const swell: Move = { at: [16, 30], wave: (u) => Math.max(breath(u), Math.round(bask)), grow: [0.02, 0.07] };
      parts.push(
        ...rig([tail([20, 28], 8)], { mat: "scale", back: true, prims: [path([[20, 28], [25, 28.5], [27.5, 25.5]], 1.6, 0.6)] }),
        ...rig([swell], { mat: "crown", prims: [ell(13.2, 16.4, 1, 1.3), ell(16, 15.5, 1.1, 1.5), ell(18.8, 16.4, 1, 1.3)], blend: 0 }),
        ...rig([swell], { mat: "scale", blend: 3, prims: [ell(16, 20.8, 7, 4.8), ell(16, 26.2, 5, 3.6), ...both(ell(12, 29.2, 2, 1.2))],
          paint: [{ mat: "belly", prims: [ell(16, 27, 3, 2.6)] }] }),
      );
      decals.push(...rig([swell],
        ...eyes([12, 19], [18, 19], look, "tall"),
        ...blush([10, 22], [20, 22]),
        stamp(15, 23, ["kk"], { k: "scale:1" }),
      ));
      glint(15, 12, 0.3, [swell]);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    if (stage === 1) {
      parts.push(
        ...rig([tail([20, 27.5], 11)], { mat: "scale", back: true, prims: [path([[20, 27.5], [26, 28.5], [28.5, 25], [27.5, 22]], 2, 0.7)] }),
        ...rig([lift], { mat: "crown", prims: [poly([[11.5, 13], [11.2, 8.5], [13.6, 10.8], [16, 7.5], [18.4, 10.8], [20.8, 8.5], [20.5, 13]], 0.4)] }),
        { mat: "scale", blend: 3, prims: [...rig([lift], ell(16, 16.8, 7.2, 5)), ell(16, 24, 5.4, 5), ...both(ell(12.2, 28.8, 2.4, 1.4))],
          paint: [{ mat: "belly", prims: [ell(16, 25, 3.4, 3.6)] }] },
        { mat: "scale", prims: both(cap(11.5, 21.5, 11.8, 24.5, 1.2, 1.2)) },
      );
      decals.push(...rig([lift],
        ...eyes([12, 15], [18, 15], look, "tall"),
        ...blush([10, 18], [20, 18]),
        stamp(15, 19, ["kk"], { k: "scale:1" }),
        stamp(15, 10, ["g"], { g: "gem:4" }),
      ));
      glint(16, 6, 0.3, [lift]);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [lift], neck: [] };
    }
    /** The frill fans a little; basking, it lifts. */
    const frill: Move[] = [
      { at: [10.5, 14], wave: sine(1, 0.15), turn: 3 * calm, pair: true },
      { at: [10.5, 14], wave: () => bask, turn: 9, pair: true },
      lift,
    ];
    parts.push(
      ...rig([tail([21, 27.5], 14)], { mat: "scale", back: true, prims: [path([[21, 27.5], [27, 28.4], [29.6, 24.5], [29, 20], [26.8, 18.4]], 2.6, 0.9)] }),
      ...rig(frill, { mat: "crown", back: true, prims: both(poly([[10.5, 12], [4.4, 7.4], [5.8, 10.8], [2.4, 12.2], [5.8, 14], [4, 17], [10.5, 16]], 0.4)) }),
      { mat: "scale", blend: 2.5, round: 5, prims: [ell(16, 23.6, 7, 5.8), ...both(ell(10.8, 27, 3.4, 2.8)), ...both(ell(10.2, 29.2, 2.8, 1.2))],
        paint: [
          { mat: "belly", prims: [ell(16, 24.4, 4.4, 4.8)] },
          { mat: "belly", level: 2, prims: [cap(12.6, 26.6, 19.4, 26.6, 0.4)] },
        ] },
      ...rig([lift],
        { mat: "scale", prims: [ell(16, 13.8, 8.2, 5.6), ell(16, 16, 6, 3.6)], blend: 2 },
        { mat: "crown", prims: [poly([[10.5, 10], [10, 4.8], [12.4, 7], [14, 3.2], [16, 6], [18, 3.2], [19.6, 7], [22, 4.8], [21.5, 10]], 0.4)] },
        { mat: "gem", glow: true, prims: [ell(16, 8.2, 1.2, 1.2)] },
      ),
      { mat: "scale", round: 2.5, prims: both(cap(10.4, 19.8, 13, 24.4, 1.7, 1.5)) },
      { mat: "gem", glow: true, prims: [ell(16, 22.4, 2.6, 2.4)] },
    );
    decals.push(...rig([lift],
      ...eyes([12, 12], [18, 12], look, "round"),
      ...blush([10, 14], [20, 14]),
      stamp(13, 15, ["k....k", ".kkkk."], { k: "scale:1" }),
    ));
    glint(16, 5, 0.3, [lift]);
    glint(17, 19, 0.5, []);
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── genbu · legendary ──

export const genbu: Species = {
  id: "genbu",
  name: "Genbu",
  element: "stone",
  tier: "legendary",
  stages: ["Genbit", "Genshell", "Genbu"],
  palette: {
    shell: "#7a90a4", rim: "#afc2d0", skin: "#a8c8b0", serpent: "#6fcaa6",
    rock: "#a197ae", snow: "#eef3ff", glow: "#9ff0ff",
  },
  shiny: {
    shell: "#c4a25a", rim: "#f3dc9a", skin: "#e2cfae", serpent: "#e27ea4",
    rock: "#d4c3e6", snow: "#fff6e6", glow: "#ffe38a",
  },
  lore: "The Black Tortoise of the north carries a whole mountain of finished books on its back. Its tail, a serpent, reads over its shoulder.",
  hint: "A mountain that walks, a tail that whispers.",
  // The mountain heaves on a slow tortoise breath, the head a beat after,
  // the serpent swaying above it and the sparkles twinkling in turn. Its act
  // is the serpent reading over its shoulder: it rises tall and nods along
  // two lines while the tortoise listens, eyes shut; then the sparkles all
  // glint.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const lean = a < 0 ? 0 : ease(0.06, 0.28)(a) * (1 - ease(0.64, 0.88)(a));
    const nods = a < 0 ? 0 : pulse(0.3, 0.14)(a) + pulse(0.46, 0.14)(a);
    const look = a > 0.26 && a < 0.68 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The serpent sways from its root; reading, it rises tall (the
     *  hatchling's nub just curls up). */
    const serpent = (root: V, len: number, sway: number, tall: number): Move[] => [
      { at: root, wave: (u) => sine(1, 0.3)(u) * calm * (1 - lean), turn: sway, bend: len, lag: 0.3 },
      stage === 0 ? { at: root, wave: () => lean, turn: -tall, bend: len } : { at: root, wave: () => Math.round(lean * 2) / 2, grow: [0, tall] },
    ];
    /** Its head dips a pixel at each line it reads. */
    const nod: Move = { at: [26, 8], wave: () => Math.round(nods), shift: [0, 1] };
    /** The sparkles twinkle in turn; at the act's end, all at once. */
    const glints = (list: [number, number, string?][]) => {
      const ring = a > 0.7 && a < 0.95 ? a : undefined;
      if (stage < 2 && !ring) return;
      list.forEach(([x, y, ink], i) => decals.push(...twinkle(x, y, ring ?? t, ring ? [0.7, 0.8, 0.75][i] : [0.08, 0.7, 0.38][i], ink, ring ? 0.15 : 0.3)));
    };
    if (stage === 0) {
      const swell: Move = { at: [16, 30], wave: (u) => breath(u), grow: [0.02, 0.08] };
      parts.push(
        ...rig([...serpent([21, 26], 5, 14, 22), swell], { mat: "serpent", back: true, prims: [path([[21, 26], [24.5, 25.5], [25.5, 22.5]], 1.3, 0.9)] }),
        ...rig([swell],
          { mat: "rock", prims: [poly([[14, 19], [16, 15.6], [18, 19]], 0.5)] },
          { mat: "shell", prims: [ell(16, 22.5, 8, 5.4)],
            paint: [{ mat: "rim", prims: [hexa(16, 20.6, 2.2, 0.75), hexa(11.8, 22.4, 1.6, 0.75), hexa(20.2, 22.4, 1.6, 0.75)] }] },
          { mat: "skin", prims: [ell(16, 25.2, 4.8, 3.9), ...both(ell(10.8, 28.6, 2.2, 1.5))] },
        ),
      );
      decals.push(...rig([swell],
        ...eyes([13, 23], [17, 23], pose, "tall"),
        ...blush([11, 26], [19, 26], 1),
        stamp(15, 27, ["kk"], { k: "skin:1" }),
      ));
      glints([[16, 11, "#bff6ff"]]);
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    /** The shell heaves a pixel on its legs; the head follows a beat late. */
    const heave: Move = { at: [16, 20], wave: (u) => breath(u), shift: [0, -1] };
    const lift: Move = { at: [16, 25], wave: (u) => breath(u - 0.1), shift: [0, -1] };
    if (stage === 1) {
      const tail = [...serpent([22, 24], 10, 7, 0.2), heave];
      parts.push(
        ...rig(tail, { mat: "serpent", back: true, prims: [path([[22, 24], [26.5, 23.5], [28, 19], [26.5, 15.5]], 1.6, 1.2)] }),
        ...rig([nod, ...tail], { mat: "serpent", prims: [ell(26, 13.5, 2.6, 2)] }),
        ...rig([heave],
          { mat: "rock", prims: [poly([[11.5, 15.5], [16, 8.5], [20.5, 15.5]], 0.5)],
            paint: [{ mat: "snow", prims: [poly([[14.4, 11.4], [16, 8.2], [17.6, 11.4]], 0.3)] }] },
          { mat: "shell", prims: [ell(16, 20, 10.4, 6.6)],
            paint: [{ mat: "rim", prims: [
              hexa(16, 17.8, 2.4, 0.75), hexa(11, 19.3, 2.2, 0.75), hexa(21, 19.3, 2.2, 0.75), hexa(7.2, 21.2, 1.4, 0.75), hexa(24.8, 21.2, 1.4, 0.75),
            ] }] },
        ),
        { mat: "skin", prims: both(ell(9.5, 27.2, 2.6, 2.2)) },
        ...rig([lift], { mat: "skin", prims: [ell(16, 25, 4.4, 3.8)] }),
      );
      decals.push(
        ...rig([lift],
          ...eyes([13, 23], [17, 23], look, "tall"),
          ...blush([11, 26], [19, 26], 1),
          stamp(15, 27, ["kk"], { k: "skin:1" }),
        ),
        ...rig([nod, ...tail], stamp(25, 13, ["k.k"], { k: "eye:3" })),
      );
      glints([[6, 9, "#bff6ff"], [21, 4]]);
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: [lift], neck: [lift] };
    }
    const tail = [...serpent([24, 21], 12, 5, 0.14), heave];
    parts.push(
      ...rig(tail, { mat: "serpent", back: true, prims: [path([[24, 21], [28.6, 19.4], [29.6, 14.5], [27, 11.5], [27.4, 8.2]], 2.1, 1.5)] }),
      ...rig([nod, ...tail], { mat: "serpent", prims: [ell(26.2, 6.4, 2.8, 2.2), ell(24, 7, 1.6, 1.3)], blend: 1.5 }),
      ...rig([heave],
        { mat: "rock", prims: [poly([[5.5, 17], [10.5, 9.5], [12.6, 11.2], [16.5, 3], [21, 10], [22.4, 9], [26, 17]], 0.5)],
          paint: [{ mat: "snow", prims: [
            poly([[14.4, 7.6], [16.5, 2.8], [19.2, 7.6], [17.6, 6.8], [16.2, 8.4]], 0.3),
            poly([[9.6, 11], [10.6, 9.2], [11.8, 10.6]], 0.2),
          ] }] },
        crystals("glow", [[20.2, 15.8, 3.2, 6.6, 0.2], [23.2, 15.8, 2.2, 4, 0.5], [9.6, 15.8, 2.6, 4, -0.4]]),
        { mat: "shell", prims: [ell(16, 19.8, 12.6, 6.8)],
          paint: [{ mat: "rim", prims: [
            hexa(16, 17.4, 2.8, 0.7), hexa(10.2, 18.8, 2.5, 0.7), hexa(21.8, 18.8, 2.5, 0.7), hexa(5.2, 21.2, 1.6, 0.7), hexa(26.8, 21.2, 1.6, 0.7),
          ] }] },
        { mat: "glow", glow: true, line: false, prims: [hexa(16, 17.4, 1.3, 0.75)] },
        { mat: "rim", round: 1.6, prims: [ell(16, 24.2, 13.6, 2.2)] },
      ),
      { mat: "skin", prims: both(ell(7.4, 27.8, 3.2, 2.6)) },
      ...rig([lift], { mat: "skin", prims: [ell(16, 25.8, 5.6, 4.4)] }),
    );
    decals.push(
      ...rig([lift],
        ...eyes([12, 24], [18, 24], look, "tall"),
        ...blush([11, 27], [20, 27], 1),
        stamp(15, 28, ["kk"], { k: "skin:1" }),
      ),
      ...rig([nod, ...tail], stamp(24, 5, ["k..k"], { k: "eye:3" })),
    );
    glints([[2, 8], [21, 0], [1, 15, "#bff6ff"]]);
    if (pose === "sleep") decals.push(zzz(6, 1));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

// ── gemmole · common ──

export const gemmole: Species = {
  id: "gemmole",
  name: "Gemmole",
  element: "stone",
  tier: "common",
  stages: ["Moleling", "Burrowbit", "Gemmole"],
  palette: { fur: "#ae9fc6", paw: "#f4b9a8", gem: "#ff5d7e" },
  shiny: { fur: "#e2c173", paw: "#f7a38e", gem: "#5cc4ff" },
  lore: "Tunnels under the library and pops up in the reading room, nose-gem first. It can't see the print, so it listens very hard when you read aloud.",
  hint: "A glint at the end of a tunnel.",
  // A soft breath and, once a loop, two gentle sniffs of the gem nose; grown,
  // its big digging paws paddle a little. Its act is listening very hard:
  // it tilts its head, eyes shut, and the nose gem glints as it hears.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const tilt = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.66, 0.9)(a));
    const look = tilt > 0.4 ? "blink" : pose;
    const awakeNow = pose !== "sleep";
    const breath = stepped(rise(1));
    const swell = (h: number): Move => ({ at: [16, 30], wave: (u) => breath(u), grow: [0.02, 1 / h] });
    /** It tilts its head to listen (whole body, it's all head). */
    const lean = (deg: number): Move => ({ at: [16, 30], wave: () => Math.round(tilt * 2) / 2, turn: deg });
    /** Two soft sniffs a loop: the snout and gem rise a pixel. */
    const sniff: Move = { at: [16, 22], wave: (u) => (awakeNow ? Math.round((pulse(0.5, 0.12)(u) + pulse(0.66, 0.12)(u)) * (1 - tilt)) : 0), shift: [0, -1] };
    const glint = (x: number, y: number, ms: Move[]) => {
      if (tilt > 0.6) decals.push(...rig(ms, ...twinkle(x, y, a, 0.36, "#fff4f6", 0.26)));
    };
    if (stage === 0) {
      const body = [swell(12), lean(5)];
      parts.push(
        { mat: "paw", back: true, prims: both(ell(12.5, 29.4, 1.8, 1.1)) },
        ...rig(body, { mat: "fur", prims: [ell(16, 24, 7.4, 5.8), ell(16, 21.5, 5.5, 4.5)], blend: 3 }),
        ...rig([sniff, ...body],
          { mat: "paw", line: false, prims: [ell(16, 25.8, 2.4, 1.7)] },
          { mat: "gem", glow: true, prims: [diamond(16, 24.6, 1.6, 1.4)] },
        ),
        ...rig(body, { mat: "paw", prims: both(ell(9.6, 26.8, 2.2, 1.6, -25)) }),
      );
      decals.push(...rig(body, ...eyes([12, 21], [18, 21], look, "tall"), ...blush([10, 24], [20, 24])));
      glint(16, 22, [sniff, ...body]);
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: body, neck: body };
    }
    if (stage === 1) {
      const body = [swell(15), lean(7)];
      parts.push(
        { mat: "paw", back: true, prims: both(ell(12, 29.4, 2.2, 1.2)) },
        ...rig(body, { mat: "fur", prims: [ell(16, 21.5, 7.8, 6.8), ell(16, 25.5, 8.6, 4.2)], blend: 4, round: 5 }),
        ...rig([sniff, ...body],
          { mat: "paw", line: false, prims: [ell(16, 23.2, 2.8, 2)] },
          { mat: "gem", glow: true, prims: [diamond(16, 21.6, 2, 1.8)] },
        ),
        ...rig([{ at: [9.6, 22.6], wave: sine(1, 0.2), turn: 8 * (awakeNow ? 1 : 0.4), pair: true }, ...body],
          { mat: "paw", prims: both(ell(7.4, 24, 3, 2.3, -30)) }),
      );
      decals.push(...rig(body,
        ...eyes([12, 17], [18, 17], look, "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(15, 25, ["kk"], { k: "fur:1" }),
      ));
      glint(16, 19, [sniff, ...body]);
      if (pose === "sleep") decals.push(zzz(24, 4));
      return { parts, decals, head: body, neck: body };
    }
    const body = [swell(20), lean(6)];
    /** The big digging paws paddle slowly, a beat apart. */
    const paddle: Move = { at: [8.4, 22.4], wave: sine(1, 0.2), turn: 8 * (awakeNow ? 1 : 0.4), pair: true };
    parts.push(
      { mat: "paw", back: true, prims: both(ell(11, 29.3, 3, 1.4)) },
      ...rig(body, { mat: "fur", prims: [ell(16, 19.5, 10, 8.5), ell(16, 25, 11, 5.2), ell(16, 15, 7.5, 4.5)], blend: 4, round: 6 }),
      ...rig([sniff, ...body],
        { mat: "paw", line: false, prims: [ell(16, 21.6, 3.4, 2.5)] },
        { mat: "gem", glow: true, prims: [diamond(16, 19.4, 2.7, 2.4)] },
      ),
      ...rig([paddle, ...body], { mat: "paw", blend: 1.2, prims: [
        ...both(ell(6, 22, 3.8, 3.4)),
        ...both(cap(3.6, 20.4, 1.2, 19, 1, 0.6)), ...both(cap(3.2, 22.4, 0.8, 22.6, 1, 0.6)),
        ...both(cap(3.6, 24.4, 1.6, 26, 1, 0.6)), ...both(cap(5.8, 25, 5.2, 27.8, 1, 0.6)),
      ], paint: [{ mat: "white", level: 3, prims: [
        ...both(ell(1.5, 19.2, 0.9)), ...both(ell(1, 22.6, 0.9)), ...both(ell(1.8, 25.8, 0.9)), ...both(ell(5.2, 27.6, 0.9)),
      ] }] }),
    );
    decals.push(...rig(body,
      ...eyes([11, 14], [19, 14], look, "tall"),
      ...blush([9, 18], [21, 18]),
      stamp(14, 24, ["k..k", ".kk."], { k: "fur:1" }),
    ));
    glint(16, 16, [sniff, ...body]);
    if (pose === "sleep") decals.push(zzz(24, 4));
    return { parts, decals, head: body, neck: body };
  },
};

// ── rollypolly · common ──

export const rollypolly: Species = {
  id: "rollypolly",
  name: "Rollypolly",
  element: "stone",
  tier: "common",
  stages: ["Pillbit", "Rollipede", "Rollypolly"],
  palette: { plate: "#9db0c8", skin: "#ecc9a2", crystal: "#ffc44d" },
  shiny: { plate: "#d59ac0", skin: "#f6e3cf", crystal: "#8ff4ff" },
  lore: "Curls up tight whenever a chapter gets scary, then uncurls to see how it ends. Every book it finishes leaves a little crystal on its back.",
  hint: "Rolls up at the scary parts.",
  // The plated dome rises on a slow breath and the antennae wave, the tips
  // a beat behind. Its act is a scary part: it tucks its head under its
  // plates, antennae folded back, eyes shut; peeks; then uncurls, antennae
  // springing up after it.
  motion: { idle: 3.6, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const tuck = a < 0 ? 0 : ease(0.06, 0.24)(a) * (1 - ease(0.62, 0.84)(a));
    const spring = a < 0 ? 0 : pulse(0.76, 0.2)(a);
    const look = tuck > 0.4 && a < 0.46 ? "blink" : pose;
    const calm = (pose === "sleep" ? 0.4 : 1) * (1 - tuck);
    const breath = stepped(rise(1));
    /** The dome swells on the breath, about its foot. */
    const dome = (cx: number, h: number): Move => ({ at: [cx, 28.6], wave: (u) => breath(u), grow: [0.01, 1 / h] });
    /** Tucking, the head slides in under the plates and down a pixel. */
    const head: Move[] = [
      { at: [10, 24], wave: () => tuck, shift: [1, 0] },
      { at: [10, 24], wave: () => (tuck > 0.75 ? 1 : 0), shift: [0, 1] },
    ];
    /** The antennae wave, fold back as it tucks, and spring up after. */
    const feelers = (at: V, len: number, deg: number): Move[] => [
      { at, wave: (u) => sine(1, 0.2)(u) * calm, turn: deg, bend: len, lag: 0.3 },
      { at, wave: () => tuck - 0.3 * spring, turn: 3 * deg, bend: len, lag: 0 },
    ];
    /** Plate seams: meridian rings around the dome's center. */
    const seams = (cx: number, cy: number, ry: number, rxs: number[]) =>
      rxs.map((rx) => ({ mat: "plate", level: 1, prims: [ell(cx, cy, rx, ry)], cut: [ell(cx, cy, rx - 0.9, ry)] }));
    if (stage === 0) {
      parts.push(
        ...rig([dome(19, 10)], { mat: "plate", prims: [ell(19, 24.5, 6.4, 5)], cut: [below(28.6)], paint: seams(19, 24.5, 6, [2.4, 4.6]) }),
        { mat: "skin", line: false, prims: [ell(15, 28.6, 5, 0.9), ell(21.5, 28.6, 3, 0.9)] },
        ...rig([...feelers([11, 21], 4, 9), ...head], { mat: "skin", prims: [path([[11, 21], [9.5, 18.5], [8, 18.2]], 0.7, 0.6)] }),
        ...rig(head,
          { mat: "skin", prims: [ell(12.5, 24.8, 5, 4)] },
          { mat: "plate", prims: [ell(12.8, 21.4, 4.6, 1.9)] },
        ),
      );
      decals.push(...rig(head, ...eyes([10, 23], [14, 23], look, "tall"), stamp(12, 27, ["kk"], { k: "skin:1" })));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head, neck: head };
    }
    if (stage === 1) {
      const body = [dome(19, 12)];
      parts.push(
        { mat: "skin", line: false, prims: [ell(18.5, 28.6, 8, 1)] },
        ...rig(body,
          { mat: "plate", prims: [ell(19, 23, 9, 6.2)], cut: [below(28.4)], paint: seams(19, 23, 7.2, [3, 6, 8.8]) },
          { mat: "crystal", glow: true, prims: [shard(19, 17.8, 2.4, 3)] },
        ),
        ...rig([...feelers([9.8, 20.6], 5, 8), ...head], { mat: "skin", prims: [path([[8, 21], [5.5, 17], [3.5, 16.5]], 0.8, 0.6), path([[11.5, 20.5], [12.5, 16.5], [14.5, 15.5]], 0.8, 0.6)] }),
        ...rig(head,
          { mat: "skin", prims: [ell(9.8, 24.6, 5.2, 4.2)] },
          { mat: "plate", prims: [ell(10, 21, 5, 2)] },
        ),
      );
      decals.push(...rig(head, ...eyes([7, 23], [11, 23], look, "tall"), stamp(9, 27, ["k..k", ".kk."], { k: "skin:1" })));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head, neck: head };
    }
    const body = [dome(18.5, 15)];
    parts.push(
      { mat: "skin", line: false, prims: [ell(19, 28.8, 11, 1.1)] },
      ...rig(body,
        { mat: "plate", prims: [ell(18.5, 21.5, 12, 8)], cut: [below(28.4)],
          paint: seams(18.5, 21.5, 9, [3, 6.2, 9.4, 12]) },
        { mat: "crystal", glow: true, prims: [
          shard(12.2, 16.6, 2.2, 3, -0.4), shard(15.5, 14.4, 2.4, 3.6, -0.2), shard(21.5, 14.4, 2.4, 3.6, 0.2),
          shard(24.9, 16.6, 2.2, 3, 0.4), shard(27.8, 19.6, 1.8, 2.4, 0.5),
        ] },
      ),
      ...rig([...feelers([8.2, 19.2], 6, 7), ...head], { mat: "skin", prims: [path([[6, 19.5], [3.5, 14.5], [1.5, 13.5]], 0.9, 0.6), path([[10.5, 19], [11.5, 14], [13.8, 12.5]], 0.9, 0.6)] }),
      ...rig(head,
        { mat: "skin", prims: [ell(8.5, 24.2, 5.6, 4.4)] },
        { mat: "plate", prims: [ell(8.8, 20, 5.8, 2.3)] },
      ),
    );
    decals.push(...rig(head,
      ...eyes([5, 22], [10, 22], look, "tall"),
      ...blush([3, 25], [12, 25], 1),
      stamp(7, 26, ["k..k", ".kk."], { k: "skin:1" }),
    ));
    if (pose === "sleep") decals.push(zzz(24, 3));
    return { parts, decals, head, neck: head };
  },
};

// ── rhinolith · rare ──

export const rhinolith: Species = {
  id: "rhinolith",
  name: "Rhinolith",
  element: "stone",
  tier: "rare",
  stages: ["Rhinopip", "Rhinoquartz", "Rhinolith"],
  palette: { hide: "#c4a898", crystal: "#86d8ff", geode: "#a894f0" },
  shiny: { hide: "#8f9fd4", crystal: "#ffa6d6", geode: "#ffd070" },
  lore: "Charges straight through the hardest chapters horn-first. The horn is a geode; crack a tough book and it grows another crystal inside.",
  hint: "Its horn is hollow and full of light.",
  // A slow, heavy breath, the head following a beat late, ears turning and
  // the little tail swishing. Its act is squaring up to a hard chapter: it
  // lowers its horn, gives one soft snort, and the horn crystal glints.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const dip = a < 0 ? 0 : ease(0.06, 0.26)(a) * (1 - ease(0.66, 0.88)(a));
    const look = a > 0.3 && a < 0.44 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const swell = (cx: number, h: number): Move => ({ at: [cx, 30], wave: (u) => breath(u), grow: [0.01, 1 / h] });
    /** The head: up a pixel a beat after the body; squaring up, it dips
     *  below rest, horn lowered. */
    const head = (neck: V): Move[] => [
      { at: neck, wave: (u) => breath(u - 0.1) * (1 - Math.ceil(dip)) - Math.round(dip), shift: [0, -1] },
    ];
    /** Each ear turns on its own slow beat. */
    const ear = (x: number, y: number, ph: number): Move => ({ at: [x, y + 1.6], wave: sine(1, ph), turn: 16 * calm });
    const tail = (root: V): Move => ({ at: root, wave: sine(1, 0.45), turn: 16 * calm, bend: 3, lag: 0.25 });
    /** The snort: a little puff leaving the nostril, drifting down and away. */
    const snort = (x: number, y: number, ms: Move[]) => {
      const f = a < 0 ? -1 : (a - 0.34) / 0.2;
      if (f >= 0 && f < 1) decals.push(...rig(ms, stamp(Math.max(0, x - 1 - Math.round(f * 1.6)), y + 1 + Math.round(f), f < 0.55 ? ["pp", "p."] : ["p"], { p: "#e9f1ec" }, true)));
    };
    const glint = (x: number, y: number, ms: Move[]) => {
      if (dip > 0.5) decals.push(...rig(ms, ...twinkle(x, y, a, 0.44, "#f2fbff", 0.22)));
    };
    // ¾ view facing left: the snout horn is the whole read.
    if (stage === 0) {
      const body = [swell(19, 8)];
      const hd = head([17, 24]);
      parts.push(
        { mat: "hide", back: true, prims: [ell(21.5, 29.2, 1.7, 1.2)] },
        ...rig(body, { mat: "hide", prims: [ell(19.5, 25.8, 5.5, 3.8), ell(17, 29, 1.8, 1.3), ell(23.5, 28.8, 1.6, 1.2)], blend: 2 }),
        ...rig(hd, { mat: "hide", prims: [...rig([ear(17.6, 18.8, 0.1)], ell(17.6, 18.8, 1, 1.7, 25)), ...rig([ear(14.4, 18.4, 0.6)], ell(14.4, 18.4, 1, 1.7, -15))] }),
        ...rig(hd,
          { mat: "hide", prims: [ell(14.2, 23.5, 6, 5), ell(10.6, 26, 3.6, 2.8)], blend: 3 },
          crystals("crystal", [[9.8, 24.8, 2.4, 3.6, -0.4]]),
        ),
      );
      decals.push(...rig(hd,
        ...eyes([12, 21], [16, 21], look, "tall"),
        ...blush([11, 25], [18, 25], 1),
        stamp(8, 26, ["k"], { k: "hide:1" }),
      ));
      snort(8, 26, hd);
      glint(8, 19, hd);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: hd, neck: hd };
    }
    if (stage === 1) {
      const body = [swell(20, 11)];
      const hd = head([15, 22]);
      parts.push(
        { mat: "hide", back: true, prims: [ell(20.5, 29, 1.8, 1.3), ell(26.8, 28.8, 1.7, 1.3)] },
        ...rig(body, { mat: "hide", prims: [ell(20, 23.2, 7.8, 5.2), ell(16.5, 27.8, 2.3, 2.2), ell(24, 27.8, 2.3, 2.2), ...rig([tail([27.5, 22])], path([[27.5, 22], [28.8, 24.5]], 0.7, 0.6))], blend: 2 }),
        ...rig(hd, { mat: "hide", prims: [...rig([ear(15.6, 15.4, 0.1)], ell(15.6, 15.4, 1.1, 2, 25)), ...rig([ear(12.4, 15.2, 0.6)], ell(12.4, 15.2, 1.2, 2.1, -15))] }),
        ...rig(hd,
          { mat: "hide", prims: [ell(12, 21, 5.4, 4.6), ell(8.2, 23.8, 3.6, 2.9)], blend: 3 },
          crystals("crystal", [[7.2, 22.2, 3.4, 7.6, -0.8]]),
        ),
      );
      decals.push(...rig(hd,
        ...eyes([10, 19], [14, 19], look, "tall"),
        ...blush([9, 23], [16, 23], 1),
        stamp(5, 24, ["k"], { k: "hide:1" }),
      ));
      snort(5, 24, hd);
      glint(5, 13, hd);
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: hd, neck: hd };
    }
    const body = [swell(20, 16)];
    const hd = head([14, 21]);
    parts.push(
      { mat: "hide", back: true, prims: [ell(19.5, 28.6, 2.4, 1.8), ell(28, 28.3, 2.2, 1.8)] },
      ...rig(body, { mat: "hide", prims: [ell(19.5, 20.5, 10, 7.5), ell(15, 27, 3, 3), ell(25, 27, 3, 3), ...rig([tail([29, 18.5])], path([[29, 18.5], [30.4, 22]], 0.8, 0.6))], blend: 2 }),
      ...rig(hd,
        { mat: "hide", prims: [...rig([ear(15.2, 12, 0.1)], ell(15.2, 12, 1.3, 2, 25)), ...rig([ear(11.8, 11.8, 0.6)], ell(11.8, 11.8, 1.4, 2.1, -15))] },
        crystals("geode", [[10.2, 13.8, 2.4, 3.8, 0.2]]),
        { mat: "hide", prims: [ell(11, 18, 6.6, 5.6), ell(5.6, 21.8, 4.4, 3.6)], blend: 3 },
        crystals("geode", [[2, 19.6, 2.4, 7, -0.9], [6.6, 19.4, 2.4, 8.4, 1]]),
        crystals("crystal", [[4.2, 19.2, 3.8, 15, -0.5]]),
      ),
    );
    decals.push(...rig(hd,
      ...eyes([9, 16], [14, 16], look, "round"),
      ...blush([8, 19], [15, 19], 1),
      stamp(2, 22, ["k"], { k: "hide:1" }),
    ));
    snort(2, 22, hd);
    glint(2, 2, hd);
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head: hd, neck: hd };
  },
};

// ── mosstroll · rare ──

export const mosstroll: Species = {
  id: "mosstroll",
  name: "Mosstroll",
  element: "stone",
  tier: "rare",
  stages: ["Trollpip", "Mossnob", "Mosstroll"],
  palette: { skin: "#b3b99e", moss: "#7cc25a", nose: "#e59f7d", flower: "#ff9ec4" },
  shiny: { skin: "#c7b2dc", moss: "#e8983c", nose: "#f7c86b", flower: "#8fd3ff" },
  lore: "Lives under the footbridge to the library and charges no toll but a story. Moss grows thickest on the ones who listen best.",
  hint: "Waits under the bridge for a story.",
  // A big slow breath, ears drifting after it, the long arms settling in
  // and the flower nodding on its mossy head. Its act is hearing a good
  // story: eyes shut, ears drooping happily, a flower blooms on its moss
  // beside the old one, which opens wide, and both fold away again.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const hum = a < 0 ? 0 : ease(0.06, 0.24)(a) * (1 - ease(0.7, 0.9)(a));
    const bloom = a < 0 ? 0 : ease(0.2, 0.42)(a) * (1 - ease(0.6, 0.8)(a));
    const look = hum > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const swell = (h: number): Move => ({ at: [16, 30], wave: (u) => breath(u), grow: [0.02, 1 / h] });
    /** Ears drift a beat after the breath and droop as it listens. */
    const ears = (at: V, deg: number): Move[] => [
      { at, wave: (u) => sine(1, 0.2)(u) * calm * (1 - hum), turn: deg, pair: true },
      { at, wave: () => Math.round(hum * 2) / 2, turn: -1.6 * deg, pair: true },
    ];
    /** The arms settle in toward the body on each breath. */
    const arms = (at: V, deg: number): Move => ({ at, wave: (u) => breath(u - 0.12) * calm, turn: -deg, pair: true });
    /** A bud on the moss opens into a flower and folds away again. */
    const bud = (x: number, y: number, r: number, ms: Move[]) => {
      if (bloom < 0.3) return;
      const k = Math.round(bloom * 2) / 2;
      parts.push(...rig(ms, { mat: "flower", prims: [ell(x, y, r * k, r * k)] }));
      if (k === 1) decals.push(...rig(ms, stamp(Math.round(x - 0.5), Math.round(y - 0.5), ["y"], { y: "#ffe27a" })));
    };
    if (stage === 0) {
      const body = [swell(12)];
      parts.push(
        { mat: "skin", back: true, prims: both(ell(12.5, 29.4, 1.9, 1.1)) },
        ...rig([...ears([10.2, 22], 14), ...body], { mat: "skin", prims: both(poly([[10.2, 21.2], [7.6, 18.2], [10.4, 23.4]], 0.5)) }),
        ...rig(body,
          { mat: "skin", prims: [ell(16, 24, 7.2, 5.8)] },
          { mat: "moss", prims: [ell(16, 18.8, 4, 1.6), ell(14, 19.8, 1.6, 1.3), ell(18.5, 19.6, 1.4, 1.2)], blend: 1.5 },
          { mat: "nose", prims: [ell(16, 24.8, 2.2, 1.8)] },
          { mat: "skin", prims: both(ell(9.5, 26.5, 1.8, 1.6)) },
        ),
      );
      bud(17, 17.4, 1.3, body);
      decals.push(...rig(body,
        ...eyes([12, 21], [18, 21], look, "tall"),
        ...blush([10, 24], [20, 24]),
        stamp(14, 27, ["k..k", ".kk."], { k: "skin:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: body, neck: body };
    }
    if (stage === 1) {
      const body = [swell(16)];
      parts.push(
        { mat: "skin", back: true, prims: both(ell(12.4, 29.3, 2.3, 1.3)) },
        ...rig([...ears([9.4, 18], 10), ...body], { mat: "skin", prims: both(poly([[9.5, 17.5], [4.8, 15], [9, 20]], 0.5)) }),
        ...rig(body,
          { mat: "skin", prims: [ell(16, 20.5, 6.8, 7), ell(16, 25.5, 7.2, 4.2)], blend: 4 },
          { mat: "moss", prims: [ell(16, 13.6, 6.4, 2.6), ell(10.6, 15.6, 1.5, 2.1), ell(21.4, 15.4, 1.5, 1.9), ell(13.6, 15.9, 1.3, 1.5), ell(18.6, 15.9, 1.2, 1.3), ell(14.5, 11.2, 1.8, 1.2)], blend: 1.5 },
          { mat: "nose", prims: [ell(16, 20.4, 2.6, 2.3)] },
        ),
        ...rig([arms([9.4, 18.6], 6), ...body], { mat: "skin", prims: [...both(path([[9.6, 18.5], [7.6, 22], [7.2, 25]], 1.3, 1.6)), ...both(ell(7.2, 26, 1.9, 1.8))] }),
      );
      bud(18.4, 11.4, 1.5, body);
      decals.push(...rig(body,
        ...eyes([11, 17], [19, 17], look, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(13, 24, ["k....k", ".kwkk."], { k: "skin:1", w: "white:4" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: body, neck: body };
    }
    const body = [swell(21)];
    /** The old flower nods on the breath, and opens wide as the bud blooms. */
    const flower: Move[] = [
      { at: [21, 8.4], wave: (u) => sine(1, 0.35)(u) * calm, turn: 16 },
      { at: [21, 7.2], wave: () => Math.round(bloom * 2) / 2, grow: [0.35, 0.35] },
      ...body,
    ];
    parts.push(
      { mat: "skin", back: true, prims: both(ell(11, 29.3, 3, 1.5)) },
      ...rig([...ears([8.4, 12.6], 7), ...body], { mat: "skin", prims: both(poly([[8.5, 11.5], [2.8, 8.2], [8, 15]], 0.6)) }),
      ...rig(body,
        { mat: "skin", prims: [ell(16, 18.5, 9, 9), ell(16, 24.5, 9.6, 5.5)], blend: 5 },
        { mat: "moss", blend: 1.5, prims: [
          ell(16, 9.6, 9, 3.8), ell(12, 6.4, 2.2, 1.4), ell(19.2, 6.2, 2.6, 1.5),
          ell(7.9, 12.6, 1.8, 2.8), ell(11.6, 13.4, 1.6, 2), ell(15.8, 12.8, 1.4, 1.4), ell(20.2, 13.6, 1.7, 2.2), ell(24.1, 12.3, 1.8, 3),
        ] },
      ),
      ...rig(flower, { mat: "flower", prims: [ell(21, 7.2, 1.6)] }),
      ...rig(body, { mat: "nose", prims: [ell(16, 18, 3.3, 3)] }),
      ...rig([arms([8.4, 15.8], 5), ...body], { mat: "skin", prims: [...both(path([[8.2, 15.5], [5.2, 20], [4.4, 24.5]], 1.8, 2.2)), ...both(ell(4.4, 26, 2.6, 2.4))] }),
    );
    bud(12.4, 5.4, 1.6, body);
    decals.push(
      ...rig(body,
        ...eyes([10, 15], [20, 15], look, "round"),
        ...blush([8, 19], [22, 19]),
        stamp(12, 22, ["k......k", ".kkwkkk."], { k: "skin:1", w: "white:4" }),
      ),
      ...rig(flower, stamp(20, 6, ["y"], { y: "#ffe27a" })),
    );
    if (pose === "sleep") decals.push(zzz(27, 0));
    return { parts, decals, head: body, neck: body };
  },
};

// ── stegolith · epic ──

export const stegolith: Species = {
  id: "stegolith",
  name: "Stegolith",
  element: "stone",
  tier: "epic",
  stages: ["Stegglet", "Shardback", "Stegolith"],
  palette: { hide: "#c5ab88", belly: "#f1e2c2", crystal: "#6fe8a8", shard: "#3fae9e" },
  shiny: { hide: "#8e9bc8", belly: "#e6ecff", crystal: "#ff9fd6", shard: "#a86ee8" },
  lore: "An old reader from before the libraries had roofs. Each crystal plate on its back is a book it knows by heart.",
  hint: "A walking ridge of shards.",
  // An old, slow breath under its plates, the head a beat after, the tail
  // swaying. Its act is recalling its books: eyes shut, a wave of light runs
  // along its back from head to tail, each plate lifting a pixel and
  // glinting at its tip as the wave passes.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const look = a > 0.06 && a < 0.74 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const swell = (h: number): Move => ({ at: [17, 30], wave: (u) => breath(u), grow: [0.01, 1 / h] });
    const lift: Move = { at: [8, 22], wave: (u) => breath(u - 0.1), shift: [0, -1] };
    const tail = (root: V, len: number, deg: number): Move => ({ at: root, wave: sine(1, 0.4), turn: deg * calm, bend: len, lag: 0.3 });
    /** The wave reaches the k-th plate from the head. */
    const lit = (k: number) => (a < 0 ? 0 : pulse(0.1 + k * 0.07, 0.26)(a));
    /** Crystal plates (as `crystals`), each lifting a pixel as the wave
     *  passes it and glinting at its tip. */
    const plates = (mat: string, list: [number, number, number, number, number?][], ks: number[], ms: Move[]): Part => {
      const up = (k: number): Move => ({ at: [16, 16], wave: () => Math.round(lit(k)), shift: [0, -1] });
      list.forEach(([x, y, , h, l], i) => {
        if (lit(ks[i]) > 0.6) decals.push(...rig([up(ks[i]), ...ms], ...twinkle(Math.round(x + (l ?? 0)) - 1, Math.round(y - h) - 2, a, 0.1 + ks[i] * 0.07 + 0.08, "#efffff", 0.12)));
      });
      return {
        mat, glow: true, line: true,
        prims: list.map(([x, y, w, h, l], i) => rig([up(ks[i]), ...ms], shard(x, y, w, h, l ?? 0))[0]),
        paint: [{ mat, level: 2, prims: list.map(([x, y, w, h, l], i) => rig([up(ks[i]), ...ms], facet(x, y, w, h, l ?? 0))[0]) }],
      };
    };
    if (stage === 0) {
      const body = [swell(9)];
      const sway = [tail([20, 26], 6, 12), ...body];
      parts.push(
        plates("shard", [[18.2, 21.2, 2.4, 3]], [1], body),
        ...rig(sway, { mat: "hide", prims: [path([[20, 26], [23.5, 26.5], [25.5, 24.5]], 1.6, 0.7)] }),
        ...rig(body, { mat: "hide", prims: [ell(17, 25, 6, 4.4), ell(13.5, 29, 1.8, 1.2), ell(19.5, 29, 1.8, 1.2)], blend: 2 }),
        plates("crystal", [[15.8, 21.6, 2.6, 3.2, -0.3], [20.6, 22.4, 2.2, 2.6, 0.3]], [0, 2], body),
        ...rig([lift], { mat: "hide", prims: [ell(12, 23.5, 5.4, 4.8)], paint: [{ mat: "belly", level: 4, prims: [ell(11, 27, 3.5, 1.8)] }] }),
      );
      decals.push(...rig([lift], ...eyes([9, 22], [13, 22], look, "tall"), ...blush([8, 25], [15, 25], 1)));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head: [lift], neck: [lift] };
    }
    if (stage === 1) {
      const body = [swell(12)];
      const sway = [tail([22, 24], 8, 8), ...body];
      parts.push(
        plates("shard", [[15.8, 19.2, 3, 5, -0.3], [21.2, 19.2, 3, 5, 0.4]], [1, 3], body),
        ...rig(sway, { mat: "hide", prims: [path([[22, 24], [25.5, 23], [28, 20]], 2, 0.8)] }),
        plates("crystal", [[28, 21, 2, 3.4, 0.6]], [5], sway),
        { mat: "hide", back: true, prims: [ell(14, 28.8, 1.8, 1.4), ell(22, 28.8, 1.8, 1.4)] },
        ...rig(body, { mat: "hide", prims: [ell(18, 23.5, 7.5, 5), ell(13, 28, 2.2, 2), ell(20.5, 28, 2.2, 2)], blend: 2,
          paint: [{ mat: "belly", level: 4, prims: [ell(17, 27.6, 5.5, 1.6)] }] }),
        plates("crystal", [[12.8, 20.2, 3, 4.6, -0.6], [18.5, 18.9, 3.4, 6.6], [23.8, 20.4, 2.6, 4.2, 0.6]], [0, 2, 4], body),
        ...rig([lift], { mat: "hide", prims: [ell(9, 23, 4.6, 4), ell(7.2, 25, 3, 2.2)], blend: 2 }),
      );
      decals.push(...rig([lift], ...eyes([6, 21], [10, 21], look, "tall"), ...blush([5, 24], [11, 24], 1)));
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head: [lift], neck: [lift] };
    }
    const body = [swell(15)];
    const sway = [tail([24, 21], 10, 7), ...body];
    parts.push(
      plates("shard", [[14.2, 15.8, 4, 8.5, -0.6], [20.8, 15.6, 4, 8.8, 0.6]], [1, 3], body),
      ...rig(sway, { mat: "hide", prims: [path([[24, 21], [28, 19], [30.4, 15.5]], 2.6, 1)] }),
      plates("crystal", [[30, 16.8, 2.2, 4.6, 0.6], [27.6, 18.6, 2, 3.8, -0.2]], [6, 5], sway),
      { mat: "hide", back: true, prims: [ell(13, 28.5, 2, 1.8), ell(23, 28.5, 2, 1.8)] },
      ...rig(body, { mat: "hide", prims: [ell(17.5, 21, 9.5, 6.5), ell(11.5, 27.5, 2.6, 2.6), ell(21.5, 27.5, 2.6, 2.6)], blend: 2,
        paint: [{ mat: "belly", level: 4, prims: [ell(16.5, 26.2, 7, 2)] }] }),
      plates("crystal", [[10.6, 18, 4, 7.4, -1.2], [17.4, 15.4, 4.6, 11.5, -0.2], [24.4, 17.2, 3.8, 7.8, 1]], [0, 2, 4], body),
      ...rig([lift], { mat: "hide", prims: [ell(7, 20.2, 5.6, 4.8), ell(4.6, 23, 3.6, 2.6)], blend: 2 }),
    );
    decals.push(...rig([lift],
      ...eyes([4, 18], [9, 18], look, "round"),
      ...blush([3, 21], [10, 21], 1),
      stamp(3, 24, ["kk"], { k: "hide:1" }),
    ));
    if (pose === "sleep") decals.push(zzz(2, 3));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

export const STONE: Species[] = [
  pebblit, geodillo, gemmole, rollypolly,
  gargoyle, rhinolith, mosstroll,
  basilisk, stegolith,
  genbu,
];
