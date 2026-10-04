import type { Species } from "../kit.ts";
import { blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move, Wave } from "../motion.ts";
import { ease, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Paint, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, mirror, path, poly } from "../pixel.ts";

/** Mirror a list of primitives and keep the originals. */
const sym = (prims: Prim[]): Prim[] => [...prims, ...prims.map((p) => mirror(p))];

/** A fan of feathers radiating from (x, y): each [angle°, length] pair is one
 *  tapered capsule. 0° points right, 90° points down. */
function fan(x: number, y: number, feathers: [number, number][], ra: number, rb: number): Prim[] {
  return feathers.map(([deg, len]) => {
    const a = (deg * Math.PI) / 180;
    return cap(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, ra, rb);
  });
}

/** A feathered wing pair as two interleaved parts (every other feather), so
 *  each feather casts a thin separation line on its neighbour and the fan
 *  reads as feathers instead of one lumpy blob. Mirrored across x = 16. */
function wingFan(
  mat: string, x: number, y: number, feathers: [number, number][], ra: number, rb: number,
  opt: { back?: boolean; paint?: Paint[]; one?: boolean; round?: number; flat?: number } = {},
): Part[] {
  const pick = (odd: number) => {
    const ps = fan(x, y, feathers.filter((_, i) => i % 2 === odd), ra, rb);
    return opt.one ? ps : sym(ps);
  };
  return [0, 1].map((odd) => {
    const prims = pick(odd);
    // `flat` evens out a thin pale fan (white feathers otherwise shade to grey).
    const flat: Paint[] = opt.flat === undefined ? [] : [{ mat, level: opt.flat, prims }];
    return { mat, blend: 0.3, back: opt.back, round: opt.round, prims, paint: [...flat, ...(opt.paint ?? [])] };
  });
}

/** Points along a spiral around (cx, cy): angle a0 → a1 (degrees), radius r0 → r1. */
function spiral(cx: number, cy: number, a0: number, a1: number, r0: number, r1: number, n = 12): V[] {
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** The breath: in and out once a loop, held to whole poses so big parts
 *  step instead of shimmering. */
const breath = stepped(rise(1));

// ── Cloudlamb ──

export const cloudlamb: Species = {
  id: "cloudlamb",
  name: "Nimbram",
  element: "sky",
  tier: "common",
  stages: ["Cloudlamb", "Fleecelet", "Nimbram"],
  palette: { wool: "#eaf0ff", face: "#a39bd8", horn: "#f2c46b" },
  shiny: { wool: "#ffd0de", face: "#6f5fb0", horn: "#9fe3ff" },
  lore: "A stray cloud that wandered into a library and refused to leave. Its wool gets fluffier with every page, and it rains a little on sad endings.",
  hint: "A soft grey shape that counts pages instead of sheep.",
  // A woolly breath: the fleece swells on the inhale and the face rises a
  // beat after it, the ears drifting out and back. Its act is a little
  // shower: it puffs itself up, shuts its eyes, and a few raindrops fall
  // from under the wool before it settles again.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const puff = a < 0 ? 0 : ease(0.06, 0.3)(a) * (1 - ease(0.66, 0.92)(a));
    const look = puff > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    /** The fleece swells about the ground, held full through the shower. */
    const swell = (ground: number, h: number): Move => ({ at: [16, ground], wave: (u) => Math.max(breath(u), Math.round(puff)), grow: [0.025, 1 / h] });
    /** The face rides a beat behind the fleece. */
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.1), Math.round(puff)), shift: [0, -1] };
    /** The ears drift out and back, slow. */
    const flop = (root: V): Move => ({ at: root, wave: sine(1, 0.15), turn: -9 * calm, pair: true });
    /** A raindrop falling from under the wool, 2 px tall. */
    const rain = (x: number, y: number, at: number, fall: number): Decal[] => {
      if (a < at || a >= at + 0.24) return [];
      return [stamp(x, y + Math.floor(((a - at) / 0.24) * (fall + 1)), ["d", "d"], { d: "#a6d2ff" }, true)];
    };
    /** A ring of wool puffs around an ellipse: a cumulus outline. */
    const puffs = (cx: number, cy: number, rx: number, ry: number, n: number, r: number, from = 0, to = 360): Prim[] => {
      const out: Prim[] = [];
      for (let i = 0; i < n; i++) {
        const a = ((from + ((to - from) * (i + 0.5)) / n) * Math.PI) / 180;
        out.push(ell(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r));
      }
      return out;
    };
    /** Four stubby legs: far pair shaded back, near pair in front; flat
     *  shading so they read as legs, not stripes. */
    const legs = (far: number, near: number, top: number, r: number): Part[] => {
      const hoof = (x: number): Paint => ({ mat: "face", level: 1, prims: both(ell(x, 29.7, r + 0.4, 0.9)) });
      return [
        { mat: "face", round: 0.8, back: true, prims: both(cap(far, top, far, 29.2, r, r)), paint: [hoof(far)] },
        { mat: "face", round: 0.8, prims: both(cap(near, top + 0.5, near, 29.2, r, r)), paint: [hoof(near)] },
      ];
    };
    if (stage === 0) {
      // One cloud: it swells as a whole, ears and face riding along.
      const s = swell(27, 12);
      parts.push(
        ...rig([flop([11.2, 21.6]), s], { mat: "face", prims: both(ell(9.2, 21.5, 2.3, 1.1, 25)), back: true }),
        ...rig([s], { mat: "wool", blend: 0.8, prims: [
          ell(16, 22, 6.5, 4.8), ell(10.5, 23.5, 3.4, 3), ell(21.5, 23.5, 3.4, 3),
          ell(13, 18, 3, 2.8), ell(18.5, 18, 3.2, 3), ell(16, 25.2, 5, 1.8),
        ] }),
      );
      decals.push(...rig([s],
        ...eyes([12, 20], [18, 20], look, "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(15, 23, ["k.k", ".k."], { k: "face:1" }),
      ));
      if (a >= 0) decals.push(...rain(12, 28, 0.3, 2), ...rain(19, 28, 0.4, 2), ...rain(15, 28, 0.5, 2));
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head: [s], neck: [s] };
    }
    const head = [lift];
    if (stage === 1) {
      const s = swell(29, 16);
      parts.push(
        ...legs(10.4, 13.4, 25, 1.3),
        ...rig([s], { mat: "wool", blend: 0.8, prims: [ell(16, 22.4, 7.4, 4.4), ...puffs(16, 22.4, 7, 4, 9, 2.6, -200, 20)] }),
        ...rig([s], { mat: "wool", blend: 0.8, prims: [ell(16, 24.4, 5.4, 2.6), ...puffs(16, 24, 5.4, 2.4, 4, 2, 20, 160)] }),
        ...rig([flop([12.6, 16.6]), lift], { mat: "face", prims: both(ell(10.4, 16.2, 2.6, 1.2, 30)), back: true }),
        ...rig(head, { mat: "face", prims: [ell(16, 16.6, 4.2, 3.8), ell(16, 19, 3, 2.2)], blend: 2 }),
        ...rig(head, { mat: "wool", blend: 1.5, prims: [ell(16, 12.6, 2.6, 1.8), ell(13.7, 13.3, 1.7), ell(18.3, 13.3, 1.7)] }),
      );
      decals.push(...rig(head,
        ...eyes([13, 15], [17, 15], look, "tall"),
        ...blush([11, 18], [19, 18], 1),
        stamp(15, 19, ["k.k", ".k."], { k: "face:1" }),
      ));
      if (a >= 0) decals.push(...rain(6, 25, 0.3, 3), ...rain(25, 25, 0.42, 3), ...rain(7, 26, 0.55, 3));
    } else {
      const s = swell(29, 20);
      const horn = spiral(9.6, 14.6, -40, -380, 4.2, 1.3, 16);
      parts.push(
        ...legs(9.6, 13, 24, 1.55),
        ...rig([s], { mat: "wool", blend: 0.8, prims: [ell(16, 19.4, 10.6, 5.6), ...puffs(16, 19.4, 10.4, 5.6, 12, 3, -205, 25), ell(16, 24, 9, 2.6)] }),
        ...rig([s], { mat: "wool", blend: 0.8, prims: [ell(16, 23.2, 7.8, 2.8), ...puffs(16, 22.8, 8.4, 2.8, 5, 2.4, 15, 165)] }),
        ...rig(head, { mat: "horn", prims: both(path(horn, 2, 0.9)) }),
        ...rig(head, { mat: "face", prims: [ell(16, 17.2, 4.2, 4.2), ell(16, 20.4, 3.1, 2.4)], blend: 2 }),
        ...rig(head, { mat: "wool", blend: 1.5, prims: [ell(16, 12.8, 3.2, 2), ell(13.4, 13.6, 1.9), ell(18.6, 13.6, 1.9)] }),
      );
      decals.push(...rig(head,
        ...eyes([13, 16], [17, 16], look, "round"),
        ...blush([11, 19], [20, 19], 1),
        stamp(15, 21, ["k.k", ".k."], { k: "face:1" }),
      ));
      if (a >= 0) decals.push(...rain(5, 24, 0.3, 4), ...rain(26, 24, 0.42, 4), ...rain(4, 25, 0.55, 3));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 3 : 6));
    return { parts, decals, head, neck: head };
  },
};

// ── Zephyrin ──

export const zephyrin: Species = {
  id: "zephyrin",
  name: "Zephyrin",
  element: "sky",
  tier: "common",
  stages: ["Puffwhistle", "Gustling", "Zephyrin"],
  palette: { feather: "#6fb8f0", belly: "#fff4e0", beak: "#ffae4a" },
  shiny: { feather: "#ff9f7a", belly: "#fff0c8", beak: "#6fd0ff" },
  lore: "Rides the draft of a turning page. A Zephyrin can't sit still through a preface, but it will sing the whole last chapter back to you.",
  hint: "Whistles whenever a window opens.",
  // A light breath, the head bobbing a beat after it, the crest curl
  // nodding along and the wings stirring as if in a draft. Its act is a
  // song: it lifts its head, shuts its eyes, and whistles two notes that
  // float up and away.
  motion: { idle: 3.2, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const sing = a < 0 ? 0 : ease(0.08, 0.28)(a) * (1 - ease(0.66, 0.9)(a));
    const look = sing > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const curl = (x: number, y: number, k: number): Prim =>
      path([[x, y], [x - 0.3 * k, y - 2.4 * k], [x + 1 * k, y - 3.9 * k], [x + 2.8 * k, y - 3.6 * k], [x + 3.4 * k, y - 2.2 * k]], 1.1 * Math.min(k, 1.1), 0.5);
    const feet = (y: number): Decal[] => [stamp(13, y, ["bb"], { b: "beak:2" }), stamp(17, y, ["bb"], { b: "beak:2" })];
    /** The body swells about the feet. */
    const swell = (ground: number, h: number): Move => ({ at: [16, ground], wave: (u) => Math.max(breath(u), Math.round(sing)), grow: [0.02, 1 / h] });
    /** The head bobs a beat behind the breath and holds up through the song. */
    const lift: Move = { at: [16, 14], wave: (u) => Math.max(breath(u - 0.1), Math.round(sing)), shift: [0, -1] };
    /** The crest curl nods from its root, a wave running out to the tip,
     *  and sways with the tune. */
    const nod = (root: V, len: number): Move[] => [
      { at: root, wave: sine(1, 0.2), turn: 8 * calm, bend: len, lag: 0.3 },
      { at: root, wave: () => sing * Math.sin(Math.PI * 4 * a), turn: 8, bend: len, lag: 0.15 },
    ];
    /** Wings and tail stir as if in a draft. */
    const stir = (at: V, turn: number, len: number, phase: number, pair = true): Move =>
      ({ at, wave: sine(1, phase), turn: turn * calm, bend: len, lag: 0.25, pair });
    /** A whistled note: it rises and drifts right, a dot as it comes and goes. */
    const note = (x: number, y: number, at: number): Decal[] => {
      const len = 0.36;
      if (a < at || a >= at + len) return [];
      const k = (a - at) / len;
      const nx = x + Math.round(2 * k);
      const ny = y - Math.round(5 * k);
      const ink = { k: "#d6efff" };
      return [k < 0.15 || k > 0.85 ? stamp(nx + 1, ny + 2, ["k"], ink, true) : stamp(nx, ny, [".k.", ".kk", ".k.", "kk."], ink, true)];
    };
    if (stage === 0) {
      const s = swell(29.6, 11);
      parts.push(
        ...rig([...nod([15.5, 19.5], 4), s], { mat: "feather", prims: [curl(15.5, 19.5, 1)] }),
        ...rig([s], { mat: "feather", blend: 1.5, prims: [ell(16, 24, 6.6, 5.6)],
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 27.2, 3.8, 2.6)] }] }),
        ...rig([stir([11, 23], -10, 0, 0.1), s], { mat: "feather", prims: both(ell(9.9, 24.8, 1.5, 2.4, 25)) }),
        ...rig([s], { mat: "beak", prims: [ell(16, 24.6, 1.2, 0.9)], line: false }),
      );
      decals.push(...rig([s], ...eyes([12, 21], [18, 21], look, "tall"), ...blush([10, 25], [20, 25])), ...feet(29));
      if (a >= 0) decals.push(...note(21, 18, 0.2), ...note(23, 17, 0.46));
      if (pose === "sleep") decals.push(zzz(24, 6));
      return { parts, decals, head: [s], neck: [s] };
    }
    const head = [lift];
    if (stage === 1) {
      const s = swell(28, 10);
      parts.push(
        ...rig([stir([16, 23.5], 6, 5, 0.35, false)], ...wingFan("feather", 16, 23.5, [[68, 5.6], [90, 4.6], [112, 5.6]], 1.3, 0.8, { back: true, one: true })),
        ...rig([stir([11.2, 19.6], -8, 6, 0.15)], ...wingFan("feather", 11.2, 19.6, [[132, 5.2], [152, 6.6], [172, 6.4], [-168, 4.6]], 1.4, 0.8)),
        ...rig([...nod([15.5, 13.5], 5), lift], { mat: "feather", prims: [curl(15.5, 13.5, 1.2)] }),
        { mat: "feather", blend: 3, prims: [...rig(head, ell(16, 17.5, 5.3, 4.9)), ...rig([s], ell(16, 22.8, 5.6, 5))],
          paint: [{ mat: "belly", level: 4, prims: rig([s], ell(16, 24.6, 3.4, 3.2)) }] },
        ...rig(head, { mat: "beak", prims: [ell(16, 19.6, 1.3, 0.9), cap(16, 19.6, 16, 20.6, 0.8, 0.5)], line: false }),
      );
      decals.push(...rig(head, ...eyes([12, 16], [18, 16], look, "tall"), ...blush([10, 20], [20, 20])), ...feet(27));
      if (a >= 0) decals.push(...note(21, 12, 0.2), ...note(23, 11, 0.46));
    } else {
      const s = swell(25, 11);
      parts.push(
        ...rig([stir([16, 22], 4, 8, 0.35, false)], ...wingFan("feather", 16, 22, [[60, 8.2], [76, 6.2], [90, 5.4], [104, 6.2], [120, 8.2]], 1.4, 0.7, { back: true, one: true })),
        ...rig([stir([12.2, 16.2], 6, 10, 0.15), { at: [12.2, 16.2], wave: () => sing, turn: 6, pair: true }],
          ...wingFan("feather", 12.2, 16.2, [[-178, 7.2], [-160, 9.2], [-142, 10.4], [-124, 10], [-106, 7.8]], 1.7, 0.85, {
            paint: [{ mat: "feather", level: 2, prims: both(ell(12.2, 16.2, 14, 14)), cut: both(ell(12.2, 16.2, 7.6, 7.6)) }],
          })),
        ...rig([...nod([15.5, 9.6], 6), lift], { mat: "feather", prims: [curl(15.5, 9.6, 1.3)] }),
        { mat: "feather", blend: 3, prims: [...rig(head, ell(16, 13.5, 4.8, 4.3)), ...rig([s], ell(16, 19.6, 5, 5.2))],
          paint: [{ mat: "belly", level: 4, prims: rig([s], ell(16, 21.2, 3.2, 3.6)) }] },
        ...rig(head, { mat: "beak", prims: [ell(16, 15.6, 1.4, 0.9), cap(16, 15.6, 16, 16.8, 0.85, 0.5)], line: false }),
      );
      decals.push(...rig(head, ...eyes([12, 12], [18, 12], look, "round")), ...feet(24));
      if (a >= 0) decals.push(...note(20, 6, 0.2), ...note(22, 6, 0.46));
    }
    if (pose === "sleep") decals.push(zzz(24, stage === 2 ? 2 : 6));
    return { parts, decals, head, neck: head };
  },
};

// ── Griffin ──

export const griffin: Species = {
  id: "griffin",
  name: "Griffin",
  element: "sky",
  tier: "rare",
  stages: ["Griffkit", "Griffling", "Griffin"],
  palette: { head: "#f6eee0", fur: "#e2a95c", wing: "#b27d4c", beak: "#ffcf4d" },
  shiny: { head: "#fdf6ff", fur: "#8fa2e6", wing: "#5b67c0", beak: "#ffb3d1" },
  lore: "Half eagle, half lion, wholly convinced it guards your bookshelf. Griffins hoard bookmarks the way their ancestors hoarded gold.",
  hint: "Talons in front, a tufted tail behind.",
  // A watchful sentry: a deep, slow breath through the lion chest, the
  // eagle head rising a beat after it, the wings settling on its back and
  // the tufted tail swaying behind. Its act is a rouse: eyes shut, it lifts
  // its wings and fluffs up proudly, then folds everything back neatly.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const rouse = a < 0 ? 0 : ease(0.08, 0.36)(a) * (1 - ease(0.6, 0.9)(a));
    const look = rouse > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The lion chest swells about the ground, fluffed through the rouse. */
    const swell = (ground: number, h: number): Move => ({ at: [16, ground], wave: (u) => Math.max(breath(u), Math.round(rouse)), grow: [0.03, 1 / h] });
    /** The eagle head rises a beat behind the chest. */
    const lift: Move = { at: [16, 14], wave: (u) => Math.max(breath(u - 0.1), Math.round(rouse)), shift: [0, -1] };
    /** The wings settle and lift on the breath; in the rouse they rise. */
    const wingMoves = (shoulder: V, len: number, up: number): Move[] => [
      { at: shoulder, wave: sine(1, 0.05), turn: 3 * calm, bend: len, lag: 0.2, pair: true },
      { at: shoulder, wave: () => rouse, turn: up, bend: len, lag: 0.12, pair: true },
    ];
    /** The tail sways from its root, a wave running out to the tuft. */
    const swish = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.3), turn: 7 * calm, bend: len, lag: 0.3 });
    const talons = (x: number, y: number) => stamp(x, y, ["k.k"], { k: "beak:1" });
    /** Feathered bib: the eagle half ends in a zigzag over the lion half. */
    const bib = (y: number, w: number, h: number): Prim =>
      poly([[16 - w, y], [16 + w, y], [16 + w * 0.8, y + h * 0.8], [16 + w * 0.5, y + h * 0.6], [16 + w * 0.3, y + h], [16, y + h * 0.75],
        [16 - w * 0.3, y + h], [16 - w * 0.5, y + h * 0.6], [16 - w * 0.8, y + h * 0.8]], 0.7);
    const beak = (y: number, k: number): Part => ({
      mat: "beak", line: false, prims: [ell(16, y, 1.6 * k, 1.2 * k), cap(16, y + 0.2, 16, y + 1.9 * k, 0.95 * k, 0.5)],
    });
    const head = [lift];
    if (stage === 0) {
      const tail = swish([20, 28.5], 6);
      parts.push(
        ...rig([tail], { mat: "fur", prims: [path([[20, 28.5], [23.5, 27.8], [24.6, 25]], 0.95, 0.8)] }),
        ...rig([tail], { mat: "wing", prims: [ell(24.6, 23.8, 1.6, 1.9)] }),
        ...rig(wingMoves([12, 24.4], 4, 12), ...wingFan("wing", 12, 24.4, [[-165, 3.6], [-140, 4], [-116, 3.2]], 1.1, 0.8)),
        ...rig([swell(29.8, 8)], { mat: "fur", prims: [ell(16, 26, 5.4, 3.8)] }),
        { mat: "beak", round: 0.9, prims: both(cap(13.5, 26.5, 13.5, 29.2, 1.15, 1.1)) },
        ...rig(head, { mat: "head", blend: 2, prims: [ell(16, 20.4, 5.8, 4.8), bib(22.5, 4, 3.2), cap(16, 16, 17.4, 13.8, 1, 0.6), cap(15.6, 16, 14.4, 14.2, 0.9, 0.5)] }),
        ...rig(head, beak(21.8, 1)),
      );
      decals.push(...rig(head, ...eyes([12, 19], [18, 19], look, "tall"), ...blush([10, 22], [20, 22])), talons(12, 29), talons(17, 29));
    } else if (stage === 1) {
      const tail = swish([21, 28.5], 8);
      parts.push(
        ...rig(wingMoves([11.8, 18.4], 7, 10), ...wingFan("wing", 11.8, 18.4, [[-172, 5.8], [-150, 7.4], [-128, 7.6], [-106, 6]], 1.6, 0.9, {
          paint: [{ mat: "wing", level: 2, prims: both(ell(11.8, 18.4, 12, 12)), cut: both(ell(11.8, 18.4, 5.2, 5.2)) }],
        })),
        ...rig([tail], { mat: "fur", prims: [path([[21, 28.5], [25, 28.2], [26.8, 25], [26.3, 22.5]], 1, 0.9)] }),
        ...rig([tail], { mat: "wing", prims: [ell(26.2, 21.4, 1.8, 2.1)] }),
        { mat: "fur", prims: both(ell(10.6, 26.5, 3, 3)), back: true },
        ...rig([swell(29.2, 11)], { mat: "fur", prims: [ell(16, 23.8, 5.6, 5.4)] }),
        { mat: "beak", round: 1, prims: both(ell(12.6, 28.6, 2.2, 1.5)) },
        ...rig(head, { mat: "head", blend: 2, prims: [ell(16, 14.2, 5, 4.6), bib(17, 4.4, 4.2), ...both(path([[12.2, 15.4], [9.6, 16.2], [8.4, 17.8]], 1.3, 0.6))] }),
        ...rig(head, beak(16.4, 1.05)),
      );
      decals.push(...rig(head, ...eyes([12, 13], [18, 13], look, "tall")), stamp(11, 30, ["k.k"], { k: "beak:1" }, true), stamp(18, 30, ["k.k"], { k: "beak:1" }, true));
    } else {
      const tail = swish([21, 28.8], 10);
      parts.push(
        ...rig(wingMoves([11.6, 15.6], 11, 8), ...wingFan("wing", 11.6, 15.6, [[-176, 8.8], [-158, 11], [-140, 12], [-122, 11.6], [-104, 9]], 2, 1, {
          paint: [{ mat: "wing", level: 2, prims: both(ell(11.6, 15.6, 16, 16)), cut: both(ell(11.6, 15.6, 8, 8)) }],
        })),
        ...rig([tail], { mat: "fur", prims: [path([[21, 28.8], [25.5, 28.6], [28.3, 26], [28.2, 23.2]], 1.2, 1)] }),
        ...rig([tail], { mat: "wing", prims: [ell(28.1, 21.8, 2, 2.4)] }),
        { mat: "fur", prims: both(ell(9.8, 26, 3.6, 3.6)), back: true },
        ...rig([swell(29.2, 12)], { mat: "fur", prims: [ell(16, 23.2, 6.2, 6)] }),
        { mat: "beak", round: 1, prims: both(ell(12.2, 28.5, 2.6, 1.7)) },
        ...rig(head, { mat: "head", blend: 2, prims: [ell(16, 10.6, 5, 4.6), bib(13.6, 4.8, 5.6), ...both(path([[12.2, 12.6], [10.2, 14], [9.6, 16]], 1.3, 0.6)), ...both(path([[12.4, 9.6], [9.8, 9.8], [8.2, 11.2]], 1.2, 0.6))] }),
        ...rig(head, beak(13.2, 1.2)),
      );
      decals.push(
        ...rig(head,
          ...eyes([12, 10], [18, 10], look, "round"),
          stamp(11, 9, ["kk"], { k: "head:1" }),
          stamp(19, 9, ["kk"], { k: "head:1" })),
        stamp(10, 30, ["k.k.k"], { k: "beak:1" }, true), stamp(17, 30, ["k.k.k"], { k: "beak:1" }, true),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : 5));
    return { parts, decals, head, neck: head };
  },
};

// ── Thunderbird ──

export const thunderbird: Species = {
  id: "thunderbird",
  name: "Thunderbird",
  element: "sky",
  tier: "epic",
  stages: ["Sparkchick", "Stormfledge", "Thunderbird"],
  palette: { storm: "#8a96c8", cloud: "#5f6aa0", belly: "#d4dcf0", bolt: "#ffe45c", beak: "#ffb05a" },
  shiny: { storm: "#8a6fc7", cloud: "#4b3f86", belly: "#e2d4ff", bolt: "#7ff3ff", beak: "#ff9ad0" },
  lore: "Every beat of its wings is a clap of thunder, so it has learned to read very, very quietly. Lightning strikes whenever it reaches a plot twist.",
  hint: "The rumble comes before the flash.",
  // A storm at rest: a slow breath, the head riding it a beat later, the
  // crest bolt swaying and the wings stirring like gathering cloud, stray
  // sparks glinting. Its act is the quiet flash: it draws itself up, the
  // crest stretches tall, and sparks crackle softly along its bolts before
  // the charge fades.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const charge = a < 0 ? 0 : ease(0.06, 0.32)(a) * (1 - ease(0.66, 0.92)(a));
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The body swells about the feet; drawn up through the charge. */
    const swell = (ground: number, h: number): Move => ({ at: [16, ground], wave: (u) => Math.max(breath(u), Math.round(charge)), grow: [0.02, 1 / h] });
    /** The head rides a beat behind the breath. */
    const lift: Move = { at: [16, 12], wave: (u) => Math.max(breath(u - 0.1), Math.round(charge)), shift: [0, -1] };
    /** The crest bolt sways from its base and stretches tall in the charge. */
    const crest = (base: V, len: number): Move[] => [
      { at: base, wave: sine(1, 0.25), turn: 5 * calm, bend: len, lag: 0.25 },
      { at: base, wave: stepped(() => charge), grow: [0, 1.4 / len] },
    ];
    /** The wings stir like gathering cloud, lifting a touch in the charge. */
    const stir = (shoulder: V, len: number, turn: number): Move[] => [
      { at: shoulder, wave: sine(1, 0.1), turn: turn * calm, bend: len, lag: 0.25, pair: true },
      { at: shoulder, wave: () => charge, turn, bend: len, pair: true },
    ];
    /** Sparks crackling in turn at the charge's height. */
    const crackle = (pts: V[], at: number, gap: number): Decal[] =>
      a < 0 ? [] : pts.flatMap(([x, y], i) => twinkle(x, y, a, at + i * gap, "#fffbe6", 0.22));
    /** A lightning bolt whose top-left tip sits near (x, y), about 3.4s × 7s. */
    const bolt = (x: number, y: number, sc: number): Prim =>
      poly([[1, 0], [-1.3, 3.5], [0.3, 3.5], [-1, 7.2], [2.4, 2.6], [0.9, 2.6], [2.2, 0]].map(([px, py]) => [x + px * sc, y + py * sc] as [number, number]), 0.25);
    const feet = (y: number): Decal[] => [stamp(12, y, ["b.b"], { b: "beak:2" }), stamp(17, y, ["b.b"], { b: "beak:2" })];
    if (stage === 0) {
      const s = swell(29.4, 11);
      parts.push(
        ...rig([...crest([15, 18.4], 7), s], { mat: "bolt", glow: true, prims: [bolt(15.6, 11.8, 0.95)] }),
        ...rig([s], { mat: "storm", blend: 1.2, prims: [ell(16, 23.5, 6.2, 5.8), ...sym(fan(16, 23.2, [[155, 7.2], [175, 7.6], [196, 7.2], [240, 6.6]], 1.3, 0.5))],
          paint: [{ mat: "belly", prims: [ell(16, 26.6, 4, 3)] }] }),
        ...rig([s], { mat: "beak", prims: [ell(16, 24.3, 1.2, 0.9)], line: false }),
      );
      decals.push(
        ...rig([s], ...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 25], [20, 25])),
        ...feet(29),
        ...crackle([[19, 10], [10, 13], [19, 15]], 0.26, 0.12),
      );
      if (pose === "sleep") decals.push(zzz(25, 4));
      return { parts, decals, head: [s], neck: [s] };
    }
    const head = [lift];
    if (stage === 1) {
      const s = swell(28, 10);
      const w = stir([10.5, 17.5], 9, 5);
      parts.push(
        { mat: "storm", prims: sym(fan(16, 23, [[100, 6.8], [80, 6.8]], 1.4, 0.7)), back: true },
        ...rig([...crest([14.6, 13.2], 8), lift], { mat: "bolt", glow: true, prims: [bolt(15.4, 5.2, 1.15)] }),
        { mat: "storm", blend: 2, prims: [...rig(head, ell(16, 17, 5.8, 5.3)), ...rig([s], ell(16, 22.3, 6.2, 5.2)), ...rig(head, ...sym(fan(16, 17, [[165, 6.8], [190, 6.4]], 1.2, 0.5)))],
          paint: [{ mat: "belly", prims: rig([s], ell(16, 23.5, 3.8, 3.8)) }] },
        ...rig(w, { mat: "storm", prims: both(poly([[10.5, 17.5], [6.5, 19.5], [4.8, 24.5], [7, 23.8], [7.5, 26], [9.2, 24.5], [10.8, 26]], 0.7)) }),
        ...rig(w, { mat: "bolt", glow: true, line: false, prims: both(path([[9.8, 19.5], [8, 21.2], [9.3, 21.8], [7.2, 24]], 0.55, 0.45)) }),
        ...rig(head, { mat: "beak", prims: [ell(16, 18.5, 1.4, 1), cap(16, 18.6, 16, 19.8, 0.7, 0.4)], line: false }),
      );
      /** The stray sparks glint in turn: each shrinks to a dot for a while. */
      const glint = (d: Decal, dot: Decal, at: number): Decal => {
        if (t === undefined) return d;
        const u = (((t - at) % 1) + 1) % 1;
        return u < 0.3 * calm + 0.1 ? dot : d;
      };
      decals.push(
        ...rig(head, ...eyes([12, 15], [18, 15], pose, "tall")),
        ...feet(28),
        glint(stamp(3, 12, [".y.", "yyy", ".y."], { y: "bolt:4" }, true), stamp(4, 13, ["y"], { y: "bolt:4" }, true), 0.1),
        glint(stamp(26, 13, ["y"], { y: "bolt:5" }, true), stamp(26, 13, ["y"], { y: "bolt:3" }, true), 0.75),
        glint(stamp(25, 18, [".y", "y."], { y: "bolt:4" }, true), stamp(25, 19, ["y"], { y: "bolt:4" }, true), 0.45),
        ...rig(w, ...crackle([[2, 19], [2, 24]], 0.28, 0.12), ...crackle([[27, 19], [27, 24]], 0.3, 0.12)),
        ...crackle([[18, 4]], 0.38, 0),
      );
    } else {
      const s = swell(28, 14);
      const w = stir([12, 13.8], 12, 3);
      parts.push(
        ...rig(w, ...wingFan("storm", 11.5, 13.8, [[-150, 10.4], [-166, 11.2], [178, 10.8], [162, 9.8], [146, 8.6], [130, 7.6], [114, 6.6]], 2, 1.05, {
          paint: [{ mat: "cloud", prims: both(ell(11.5, 13.8, 16, 16)), cut: both(ell(11.5, 13.8, 8.4, 8.4)) }],
        })),
        ...rig(w, { mat: "storm", prims: both(cap(12.4, 13.6, 5.6, 9.6, 2.6, 2)) }),
        ...rig(w, { mat: "bolt", glow: true, line: false, prims: both(path([[11.8, 14], [9.4, 10.6], [8.6, 14.4], [5.8, 10.8], [4.8, 14.6], [2.2, 11.6]], 0.7, 0.5)) }),
        { mat: "storm", prims: sym(fan(16, 22, [[104, 7.6], [90, 8], [76, 7.6]], 1.6, 0.8)), back: true,
          paint: [{ mat: "cloud", prims: [ell(16, 29.5, 6, 2)] }] },
        ...rig([...crest([14.4, 10], 9), lift], { mat: "bolt", glow: true, prims: [bolt(15.2, 1.2, 1.25)] }),
        { mat: "storm", blend: 3, prims: [...rig(head, ell(16, 11.5, 4.8, 4.4)), ...rig([s], ell(16, 19.2, 5.6, 6))],
          paint: [{ mat: "belly", prims: rig([s], ell(16, 21, 3.7, 4.3)) }] },
        ...rig([s], { mat: "bolt", glow: true, line: false, prims: [path([[16.8, 17.6], [15, 20], [17, 20.4], [15.2, 23.4]], 0.55, 0.45)] }),
        ...rig(head, { mat: "beak", prims: [ell(16, 13.5, 1.7, 1.2), cap(16, 13.7, 16, 15.6, 0.9, 0.4)], line: false }),
      );
      decals.push(
        ...rig(head,
          ...eyes([12, 10], [18, 10], pose, "round"),
          stamp(11, 9, ["kk"], { k: "storm:1" }),
          stamp(19, 9, ["kk"], { k: "storm:1" })),
        ...feet(25),
        ...rig(w, ...crackle([[8, 7], [4, 7], [1, 8]], 0.28, 0.1), ...crackle([[21, 7], [25, 7], [28, 8]], 0.3, 0.1)),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 4));
    return { parts, decals, head, neck: head };
  },
};

// ── Quetzalcoatl ──

export const quetzal: Species = {
  id: "quetzal",
  name: "Quetzalcoatl",
  element: "sky",
  tier: "legendary",
  stages: ["Plumewyrm", "Quillserpent", "Quetzalcoatl"],
  palette: { scale: "#3ccf8a", belly: "#ffe08a", plume: "#ff5d8f", wing: "#4fb8ff", gem: "#fff08a" },
  shiny: { scale: "#ffc94d", belly: "#fff3c4", plume: "#9b6bff", wing: "#ff7ad9", gem: "#7ff3ff" },
  lore: "The feathered serpent of the high winds, said to have taught the first scribes their letters. It coils around finished books to keep their stories warm.",
  hint: "Scales below, feathers above, a rainbow in between.",
  // Coiled and serene: the coils swell on a slow breath, the head rises a
  // beat after, the rainbow wings drift with a ripple to their tips, and
  // stars glint about it. Its act is a crest display: the head lifts, the
  // plumes fan open, a ripple runs out along the wings and the brow gem
  // flashes, then all of it folds back.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** The display's envelope over act time (a wave, so a ripple can lag it). */
    const show: Wave = (x) => ease(0.08, 0.36)(x) * (1 - ease(0.58, 0.86)(x));
    const a = pose === "act" ? (t ?? 0) : -1;
    const env = a < 0 ? 0 : show(a);
    const calm = pose === "sleep" ? 0.4 : 1;
    const acting = a >= 0;
    /** The coils swell about the ground. */
    const swell = (h: number): Move => ({ at: [16, 29.5], wave: (u) => Math.max(breath(u), Math.round(env)), grow: [0.015, 1 / h] });
    /** The head rises a beat behind the coils. */
    const lift: Move = { at: [16, 10], wave: (u) => Math.max(breath(u - 0.1), Math.round(env)), shift: [0, -1] };
    /** The crest plumes fan open in the display. */
    const fanOut = (base: V, turn: number): Move => ({ at: base, wave: () => env, turn, pair: true });
    /** The wings drift, a ripple running to the tips; in the display a
     *  wider ripple runs out along them. */
    const drift = (shoulder: V, len: number, turn: number): Move[] => [
      { at: shoulder, wave: sine(1, 0.1), turn: turn * calm, bend: len, lag: 0.25, pair: true },
      { at: shoulder, wave: (u) => (acting ? show(u) : 0), turn: turn * 2, bend: len, lag: 0.12, pair: true },
    ];
    /** A serpent run; `belly` paints the gold underside where it shows. */
    const coil = (pts: [number, number][], r0: number, r1: number, belly: Prim[], extra: Prim[] = []): Part => ({
      mat: "scale", blend: 1.5, prims: [path(pts, r0, r1), ...extra], paint: [{ mat: "belly", prims: belly }],
    });
    /** Rainbow wing pair: azure flight feathers (interleaved so each one
     *  reads), a rose band, gold coverts on the arm. */
    const wings = (x: number, y: number, k: number): Part[] => {
      const f: [number, number][] = [[-150, 10.2], [-165, 10.2], [180, 9.8], [165, 9], [150, 8], [134, 6.8]];
      const band: Paint[] = [
        { mat: "plume", prims: both(ell(x + 1, y - 0.5, 5.4 * k, 5 * k)) },
        { mat: "belly", prims: both(ell(x + 1.8, y - 1.2, 2.8 * k, 2.4 * k)) },
      ];
      return [
        ...wingFan("wing", x, y, f.map(([d, l]) => [d, l * k] as [number, number]), 1.4 * Math.sqrt(k), 0.8, { paint: band }),
        { mat: "wing", prims: both(cap(x + 3, y + 1, x + 3 - 7.5 * k, y + 1 - 5 * k, 2.2 * Math.sqrt(k), 1.6 * Math.sqrt(k))), paint: band },
      ];
    };
    const head = [lift];
    if (stage === 0) {
      parts.push(
        ...rig([swell(8)], coil([[23.5, 22.8], [22.5, 26.5], [19.5, 29], [12, 29], [9.5, 26.8], [12, 24.6], [16, 24.8]], 0.8, 2.4, [])),
        ...rig([fanOut([16, 15.5], -14), lift], { mat: "plume", prims: [cap(15.5, 15.5, 12.8, 12.6, 0.9, 0.6), cap(16.5, 15.5, 19.2, 12.6, 0.9, 0.6)] }),
        ...rig(head, { mat: "wing", prims: [cap(16, 15.5, 16, 11.4, 1, 0.6)] }),
        ...rig(head, { mat: "scale", prims: [ell(16, 19.5, 5, 4.2), cap(16, 21, 16, 24.5, 2.4)], blend: 2,
        }),
      );
      decals.push(...rig(head,
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 21, ["k.k"], { k: "scale:1" }),
      ));
      if (acting) decals.push(...rig(head, ...twinkle(15, 9, a, 0.3, "#ffffff", 0.3)));
    } else if (stage === 1) {
      parts.push(
        ...rig(drift([12.8, 18.8], 6, 5), ...wings(12.8, 18.8, 0.42)),
        ...rig([swell(15)], coil([[26.5, 20.5], [26, 25], [22, 28.6], [14, 29], [8.6, 26.8], [9.5, 23], [14, 21.8], [19, 20.8], [20.5, 17.5], [17.5, 15]], 0.7, 2.5,
          [ell(19.5, 18.5, 1.2, 2.2)])),
        ...rig([fanOut([16, 9.5], -12), lift], { mat: "plume", prims: [cap(16, 9.5, 12.8, 5.2, 1.1, 0.6), cap(16, 9.5, 19.2, 5.2, 1.1, 0.6)] }),
        ...rig(head, { mat: "wing", prims: [cap(16, 9.5, 16, 4, 1.1, 0.7)] }),
        ...rig(head, { mat: "scale", prims: [ell(16, 13, 4.8, 4), ell(16, 16, 2.8, 2.2)], blend: 2 }),
        ...rig(head, { mat: "gem", glow: true, prims: [ell(16, 10.3, 0.9, 0.9)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 12], [18, 12], pose, "tall"),
        stamp(15, 15, ["k.k"], { k: "scale:1" }),
      ));
      if (acting) decals.push(...rig(head, ...twinkle(15, 9, a, 0.32, "#ffffff", 0.3)));
    } else {
      parts.push(
        ...rig(drift([12, 15], 11, 4), ...wings(11, 15, 1)),
        ...rig([swell(19)], coil([[26.5, 20], [27.2, 25], [24, 28.6], [17, 29.5], [10.5, 28.8], [8, 25.5], [10.5, 22.6], [16, 21.6], [19.5, 19], [18.5, 15], [16.5, 11]], 0.8, 2.7,
          [ell(18.8, 16.5, 1.2, 2.6), ell(15.5, 21.4, 2.5, 1)])),
        ...rig([fanOut([13.4, 5], -9), lift], { mat: "wing", prims: both(path([[13, 5], [10.5, 3], [8.2, 3.4]], 1.1, 0.6)) }),
        ...rig([fanOut([14.2, 4.8], -12), lift], { mat: "plume", prims: both(path([[14, 4.5], [12.8, 1.8], [10.8, 1.2]], 1.1, 0.6)) }),
        ...rig(head, { mat: "belly", prims: [cap(16, 5, 16, 1.4, 1.2, 0.8)] }),
        ...rig(head, { mat: "scale", prims: [ell(16, 7.8, 5, 4), ell(16, 10.8, 3.1, 2.1)], blend: 2,
          paint: [{ mat: "belly", prims: [ell(16, 12.4, 2.4, 1.1)] }] }),
        ...rig(head, { mat: "gem", glow: true, prims: [ell(16, 5.2, 1.1, 1)] }),
      );
      decals.push(
        ...rig(head,
          ...eyes([12, 7], [18, 7], pose, "round"),
          stamp(15, 10, ["k.k"], { k: "scale:1" })),
        ...twinkle(1, 21, t, 0.05),
        ...twinkle(21, 25, t, 0.4, "#b8fff0"),
        ...twinkle(26, 1, t, 0.72),
      );
      if (acting) decals.push(...rig(head, ...twinkle(15, 4, a, 0.32, "#ffffff", 0.3)));
    }
    if (pose === "sleep") decals.push(zzz(25, 4));
    return { parts, decals, head, neck: head };
  },
};

// ── Flutterpig ──

export const flutterpig: Species = {
  id: "flutterpig",
  name: "Flutterpig",
  element: "sky",
  tier: "common",
  stages: ["Oinklet", "Flapling", "Flutterpig"],
  palette: { pig: "#f7a9bd", snout: "#ec7f9c", wing: "#f4f8ff" },
  shiny: { pig: "#ffd36e", snout: "#f0a13e", wing: "#a9dcff" },
  lore: "Proof that pigs can fly: just not far, and only as high as the top shelf. It flaps up, reads the first page of whatever is there, and floats back down very pleased.",
  hint: "Happens right after someone says it never will.",
  // A round, contented breath, the little wings fluttering lazily, the ears
  // flopping a beat behind and the curly tail wiggling. Its act is a short
  // flight: a few busy little flaps lift it off the shelf, it
  // hangs there pleased with its eyes shut, then floats softly back down.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const up = a < 0 ? 0 : ease(0.12, 0.42)(a) * (1 - ease(0.6, 0.94)(a));
    const flapping = a < 0 ? 0 : ease(0.04, 0.14)(a) * (1 - ease(0.4, 0.52)(a));
    const look = up > 0.85 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The whole pig lifts in the flight. */
    const fly: Move = { at: [16, 16], wave: () => (stage === 2 ? 1 : 2) * up, shift: [0, -1] };
    /** The round body swells about the ground. */
    const swell = (ground: number, h: number): Move => ({ at: [16, ground], wave: breath, grow: [0.025, 1 / h] });
    /** Lazy flutters; in the flight, a few busy little downstrokes, then
     *  the wings held spread for the glide down. */
    const flutter = (shoulder: V, turn: number): Move[] => [
      { at: shoulder, wave: sine(1, 0.05), turn: turn * calm * (1 - flapping) },
      { at: shoulder, wave: () => flapping * (0.5 - 0.5 * Math.cos(Math.PI * 2 * 4 * a)) + 0.5 * (up - flapping) * (a > 0.4 ? 1 : 0), turn: -turn * 1.2 },
    ].map((m) => ({ ...m, pair: true }));
    /** The ears flop a beat behind; they trail a little in the flight. */
    const flop = (base: V): Move[] => [
      { at: base, wave: sine(1, -0.12), turn: -8 * calm, pair: true },
      { at: base, wave: () => up, turn: 9, pair: true },
    ];
    /** The curly tail wiggles from its root. */
    const wiggle = (root: V): Move => ({ at: root, wave: sine(1, 0.35), turn: 12 * calm });
    /** Floppy pig ears: a triangle pointing up-and-out whose tip folds forward. */
    const ears = (x: number, y: number, k: number): Part => ({
      mat: "pig", blend: 0.5,
      prims: both(poly([[x + 2.6 * k, y + 0.6 * k], [x - 1.6 * k, y - 2.4 * k], [x - 1 * k, y + 1.6 * k]], 0.6 * k)),
      paint: [{ mat: "snout", prims: both(poly([[x + 1.2 * k, y + 0.3 * k], [x - 0.9 * k, y - 1.2 * k], [x - 0.5 * k, y + 0.9 * k]], 0.2)) }],
    });
    let s: Move;
    if (stage === 0) {
      s = swell(29.5, 12);
      parts.push(
        ...rig([...flutter([11.5, 20], 9), s], ...wingFan("wing", 11.5, 20, [[-160, 4], [-132, 4.8], [-106, 3.6]], 1.3, 1, { flat: 3 })),
        ...rig([s], { mat: "pig", blend: 1.2, prims: [ell(16, 23.2, 6.8, 5.6), ...both(ell(12.6, 28.3, 1.6, 1.2))] }),
        ...rig([...flop([12, 19.4]), s], ears(10.8, 18.6, 1)),
        ...rig([s], { mat: "snout", round: 1.2, prims: [ell(16, 25.2, 2.9, 1.9)] }),
      );
      decals.push(...rig([s],
        ...eyes([12, 20], [18, 20], look, "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(14, 25, ["k..k"], { k: "snout:1" }),
      ));
    } else if (stage === 1) {
      s = swell(29.5, 17);
      parts.push(
        ...rig([wiggle([21.8, 22.5]), s], { mat: "snout", prims: [path(spiral(23.4, 23.4, 180, -150, 0.4, 1.8, 10).reverse(), 0.9, 0.9)] }),
        ...rig([...flutter([11, 17], 8), s], ...wingFan("wing", 11, 17, [[-172, 5.2], [-148, 6.6], [-124, 6.4], [-100, 4.8]], 1.6, 0.95, { flat: 3 })),
        ...rig([s], { mat: "pig", blend: 3, prims: [ell(16, 18.2, 6.4, 5.4), ell(16, 23.6, 6.6, 4.8)] }),
        { mat: "pig", round: 0.9, blend: 0.5, prims: both(cap(12.8, 25, 13, 28.8, 1.7, 1.6)),
          paint: [{ mat: "snout", level: 2, prims: both(ell(13, 29.4, 2, 0.9)) }] },
        ...rig([...flop([11.8, 13.7]), s], ears(10.4, 13.2, 1.15)),
        ...rig([s], { mat: "snout", round: 1.2, prims: [ell(16, 20.2, 3.1, 2)] }),
      );
      decals.push(...rig([s],
        ...eyes([12, 15], [18, 15], look, "tall"),
        ...blush([10, 18], [20, 18]),
        stamp(14, 20, ["k..k"], { k: "snout:1" }),
      ));
    } else {
      s = swell(28.5, 20);
      parts.push(
        ...rig([wiggle([23.6, 22]), s], { mat: "snout", prims: [path(spiral(25.8, 21.6, 180, -170, 0.5, 2.2, 12).reverse(), 1, 1)] }),
        ...rig([...flutter([9.8, 13.6], 7), s], ...wingFan("wing", 9.8, 13.6, [[-180, 6.4], [-160, 8.2], [-138, 9], [-115, 8.2], [-94, 6.2]], 1.9, 1.05, { flat: 3 })),
        { mat: "pig", round: 0.9, blend: 0.5, prims: [...both(cap(11, 22, 10.4, 26.4, 1.8, 1.7)), ...both(cap(14.2, 23, 14.1, 27.6, 1.8, 1.7))], back: true,
          paint: [{ mat: "snout", level: 2, prims: [...both(ell(10.4, 27, 2.2, 0.9)), ...both(ell(14.1, 28.2, 2.2, 0.9))] }] },
        ...rig([s], { mat: "pig", blend: 3, prims: [ell(16, 16.8, 8.6, 7.4), ell(16, 20, 7.4, 5.2)] }),
        ...rig([...flop([11, 11.4]), s], ears(9.2, 10.6, 1.35)),
        ...rig([s], { mat: "snout", round: 1.2, prims: [ell(16, 18.6, 3.6, 2.4)] }),
      );
      decals.push(...rig([s],
        ...eyes([11, 13], [19, 13], look, "tall"),
        ...blush([8, 17], [22, 17], 2),
        stamp(14, 18, ["k..k"], { k: "snout:1" }),
        stamp(15, 22, ["kk"], { k: "pig:1" }),
      ));
    }
    if (a >= 0) {
      rig([fly], ...parts);
      rig([fly], ...decals);
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : 6));
    return { parts, decals, head: [s, fly], neck: [s, fly] };
  },
};

// ── Zipwing ──

export const zipwing: Species = {
  id: "zipwing",
  name: "Zipwing",
  element: "sky",
  tier: "common",
  stages: ["Hummbean", "Zipling", "Zipwing"],
  palette: { plume: "#4fcf98", blur: "#c6ecfa", beak: "#5b6288", throat: "#ff4f9e" },
  shiny: { plume: "#b184ff", blur: "#fff0d6", throat: "#ffc93c" },
  lore: "Hovers over each line for exactly one heartbeat, then zips to the next. It sips from ink pots and has never once skimmed.",
  hint: "You hear the hum long before you see the blur.",
  // It hovers on a slow bob, the real wing sweeping softly inside its blur
  // and the tail trailing a beat behind. Its act is two slow sips from an
  // ink pot: it tips forward, beak dipping with its eyes shut, and levels
  // out again between them.
  motion: { idle: 3.4, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    /** Two sips, each an eased dip and return. */
    const sip = (x: number) => x < 0 ? 0 : (x < 0.5 ? ease(0.08, 0.22)(x) * (1 - ease(0.3, 0.44)(x)) : ease(0.52, 0.66)(x) * (1 - ease(0.74, 0.9)(x)));
    const dip = sip(a);
    const look = dip > 0.5 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    /** The hover: a slow 1 px bob, held still while it sips. */
    const hover: Move = { at: [16, 16], wave: (u) => (a < 0 ? 1 : 1 - ease(0.02, 0.1)(a) * (1 - ease(0.9, 0.98)(a))) * breath(u), shift: [0, -1] };
    /** Tipping forward to sip, about the body. */
    const tilt = (c: V): Move => ({ at: c, wave: () => dip, turn: 8 });
    /** The real wing sweeps softly inside its blur. */
    const hum = (l: V, r: V): Move[] => [
      { at: l, wave: sine(2), turn: 9 * calm, side: "left" },
      { at: r, wave: sine(2), turn: -9 * calm, side: "right" },
    ];
    /** The tail trails the bob, a wave running to its tips. */
    const trail = (root: V, len: number): Move => ({ at: root, wave: sine(1, -0.15), turn: 5 * calm, bend: len, lag: 0.3 });
    /** A wing in a blur: one real wing stroke inside a pale glowing fan of
     *  its own afterimages. Returns [halo, wing] for one side. */
    const blurWing = (x: number, y: number, d0: number, d1: number, len: number, w: number): Part[] => {
      const halo: Prim[] = [];
      for (let i = 0; i <= 3; i++) {
        const d = d0 + ((d1 - d0) * i) / 3;
        const a = (d * Math.PI) / 180;
        halo.push(ell(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, len * 0.5, w, d));
      }
      const m = ((d0 + d1) / 2) * (Math.PI / 180);
      return [
        { mat: "blur", glow: true, line: false, blend: 2.5, prims: halo },
        { mat: "plume", back: true, line: false, prims: rig(hums, cap(x, y, x + Math.cos(m) * len * 0.85, y + Math.sin(m) * len * 0.85, w * 0.8, 0.6)) },
      ];
    };
    let hums: Move[] = [];
    let body: V;
    if (stage === 0) {
      hums = hum([11.8, 20.6], [20.2, 20.6]);
      body = [16, 23];
      parts.push(
        ...blurWing(11.8, 20.6, -170, -125, 5.6, 1.3),
        ...blurWing(20.2, 20.6, -55, -10, 5.6, 1.3),
        { mat: "plume", blend: 1.5, prims: [ell(16, 23, 5.4, 4.8), ell(15.2, 18.6, 1.2, 1.3), ell(16.6, 18.3, 1, 1.1)],
          paint: [{ mat: "blur", level: 4, prims: [ell(15.4, 26.4, 2.8, 1.6)] }] },
        { mat: "beak", round: 1, prims: [cap(20, 23.8, 24.8, 24.6, 0.8, 0.6)] },
      );
      decals.push(...eyes([12, 21], [17, 21], look, "tall"), ...blush([10, 24], [19, 24], 1));
    } else if (stage === 1) {
      hums = hum([12, 15.5], [19.5, 15.5]);
      body = [16, 18];
      parts.push(
        ...blurWing(12, 15.5, -160, -105, 8.5, 1.5),
        ...blurWing(19.5, 15.5, -75, -20, 8.5, 1.5),
        ...rig([trail([15.6, 21.5], 6)], { mat: "plume", prims: [poly([[14.6, 21], [11, 26.6], [12.2, 27.8], [13.4, 26.2], [14.4, 27.4], [17, 22]], 0.5)], back: true }),
        { mat: "plume", blend: 2.5, prims: [ell(16.4, 15.6, 4.2, 3.8), ell(15.2, 20.4, 3.4, 4.2, -20)],
          paint: [{ mat: "blur", level: 4, prims: [ell(15.8, 22.4, 2, 2)] }] },
        { mat: "beak", round: 1, prims: [cap(20, 16.6, 27.6, 18.2, 0.8, 0.55)] },
      );
      decals.push(...eyes([13, 14], [18, 14], look, "round"));
    } else {
      hums = hum([12.4, 13.5], [20.4, 13.5]);
      body = [16, 16];
      parts.push(
        ...blurWing(12.4, 13.5, -165, -100, 11, 1.7),
        ...blurWing(20.4, 13.5, -80, -15, 11, 1.7),
        ...rig([trail([15.8, 21.6], 8)], { mat: "plume", prims: [poly([[14.4, 21], [9.2, 27.4], [10.8, 29], [12.4, 27.2], [13.4, 29.2], [17.4, 22.4]], 0.6)], back: true,
          paint: [{ mat: "blur", level: 4, prims: [ell(10.4, 28.4, 1.2, 1), ell(13.2, 28.8, 1, 1)] }] }),
        { mat: "plume", blend: 2.5, prims: [ell(16.6, 12, 4.4, 4), ell(15.2, 18, 3.8, 5.2, -18)],
          paint: [
            { mat: "throat", prims: [ell(17.4, 15.6, 3.4, 2.1, -12)] },
            { mat: "blur", level: 4, prims: [ell(15.6, 21, 2.2, 2)] },
          ] },
        { mat: "beak", round: 1, prims: [cap(20.4, 13.2, 30, 15.2, 0.85, 0.55)] },
      );
      decals.push(...eyes([13, 10], [18, 10], look, "round"));
    }
    const carry = [tilt(body), hover];
    rig(carry, ...parts);
    rig(carry, ...decals);
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : 6));
    return { parts, decals, head: carry, neck: carry };
  },
};

/// ── Pegasus ──

export const pegasus: Species = {
  id: "pegasus",
  name: "Pegasus",
  element: "sky",
  tier: "rare",
  stages: ["Foalfeather", "Wingcolt", "Pegasus"],
  palette: { coat: "#eceefe", wing: "#d3e6ff", mane: "#6aaeff", hoof: "#f2c35e" },
  shiny: { coat: "#9a90de", wing: "#c7b8f4", mane: "#ffb0d6", hoof: "#fff0b0" },
  lore: "Foaled from a thundercloud that had read too many epics. It lets only its most devoted readers ride, and always lands softly on the last page.",
  hint: "Hooves that never stay on the ground for long.",
  // Proud and easy: a slow breath through the chest, the head rising a beat
  // after it, the mane and tail rippling as if in a breeze and the wings
  // drifting. Its act is a little prance: it lifts a forehoof and tosses
  // its head, mane flowing, wings lifting, then sets the hoof down softly.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const prance = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.6, 0.88)(a));
    const toss = a < 0 ? 0 : ease(0.18, 0.38)(a) * (1 - ease(0.5, 0.74)(a));
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The chest swells about the ground. */
    const swell = (h: number): Move => ({ at: [16, 29.5], wave: breath, grow: [0.02, 1 / h] });
    /** The head rises a beat behind the breath; in the prance it tosses. */
    const headMoves = (neck: V): Move[] => [
      { at: neck, wave: () => toss, turn: -5 },
      { at: neck, wave: (u) => Math.max(breath(u - 0.1), Math.round(prance)), shift: [0, -1] },
    ];
    /** Mane and tail ripple out from their roots, a beat behind; the toss
     *  sends a wave down the mane. */
    const ripple = (root: V, len: number, turn: number, phase: number, mane = true): Move[] => [
      { at: root, wave: sine(1, phase), turn: turn * calm, bend: len, lag: 0.3 },
      ...(mane ? [{ at: root, wave: () => toss, turn: turn * 1.2, bend: len }] : []),
    ];
    /** The wings drift and lift a touch in the prance. */
    const drift = (shoulder: V, len: number): Move[] => [
      { at: shoulder, wave: sine(1, 0.1), turn: 3 * calm, bend: len, lag: 0.25, pair: true },
      { at: shoulder, wave: () => prance, turn: 4, bend: len, pair: true },
    ];
    /** The wings ride the swelling chest up a pixel. */
    const rideUp: Move = { at: [16, 16], wave: breath, shift: [0, -1] };
    /** The left forehoof lifts. */
    const paw = (knee: V): Move => ({ at: knee, wave: () => prance, shift: [0, -2], side: "left" });
    let head: Move[];
    /** A pair of legs as one flat-shaded part (no light/dark comb), gold hooves. */
    const legs = (x: number, top: number, r: number, back = false): Part => ({
      mat: "coat", round: 0.9, blend: 0.3, back,
      prims: both(cap(x, top, x, 29.3, r * 1.2, r * 0.95)),
      paint: [{ mat: "hoof", prims: both(ell(x, 29.6, r + 0.8, 1.5)) }],
    });
    /** Raised wings with sky-blue primaries past radius `tip`. */
    const wings = (x: number, y: number, f: [number, number][], ra: number, rb: number, tip: number): Part[] =>
      wingFan("wing", x, y, f, ra, rb, {
        flat: 3, paint: [{ mat: "mane", prims: both(ell(x, y, 16, 16)), cut: both(ell(x, y, tip, tip)) }],
      });
    if (stage === 0) {
      head = headMoves([16, 21]);
      const s = swell(6);
      const foot = paw([11.8, 27.5]);
      parts.push(
        ...rig(ripple([20, 26], 6, 8, 0.3, false), { mat: "mane", prims: [path([[20, 26], [23.4, 26.6], [25, 28.6]], 1.3, 0.8)] }),
        ...rig(drift([12.4, 23.4], 5), ...wingFan("wing", 12.4, 23.4, [[-160, 4.4], [-134, 5], [-108, 4]], 1.25, 0.9, { flat: 3 })),
        ...rig([s], { mat: "coat", blend: 1.5, prims: [ell(16, 25.8, 6.4, 3.4), ...rig([foot], ...both(ell(11.8, 28.2, 2.4, 1.3)))],
          paint: [{ mat: "hoof", prims: rig([foot], ...both(ell(9.8, 28.6, 1, 1))) }] }),
        ...rig([...ripple([18.4, 15.4], 8, 6, 0.2), ...head], { mat: "mane", prims: [path([[18.4, 15.4], [20.6, 17.6], [20.6, 21], [21.6, 23]], 1.5, 1)] }),
        ...rig(head, { mat: "coat", blend: 3, prims: [ell(16, 18.4, 4.5, 3.8), ell(16, 21.8, 3, 2.3), ...both(cap(13.2, 15.6, 12.4, 12.8, 1.2, 0.6))] }),
        ...rig(head, { mat: "mane", prims: [path([[15, 14.4], [16.8, 15.2], [17.4, 17]], 1.2, 0.8)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 17], [18, 17], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(14, 22, ["k..k"], { k: "coat:1" }),
      ));
    } else if (stage === 1) {
      head = headMoves([16, 14]);
      const s = swell(14);
      parts.push(
        ...rig(ripple([19, 19.5], 8, 7, 0.3, false), { mat: "mane", prims: [path([[19, 19.5], [22.6, 20.4], [24.4, 23.4], [24.2, 26.4]], 1.4, 0.8)] }),
        ...rig([...drift([12.6, 17.4], 7), rideUp], ...wings(12.6, 17.4, [[-164, 5.4], [-140, 6.8], [-116, 6.6], [-94, 5]], 1.4, 0.95, 5)),
        ...rig([s], { mat: "coat", blend: 2.5, prims: [ell(16, 20, 4.8, 3.2), cap(16, 14.5, 16, 18.5, 2, 2.6)] }),
        ...rig([paw([13.9, 22.5])], legs(13.9, 21.5, 1)),
        ...rig([...ripple([18.2, 7.8], 9, 6, 0.2), ...head], { mat: "mane", prims: [path([[18.2, 7.8], [20.4, 10.2], [20.2, 13.6], [21.2, 16.4]], 1.6, 1)] }),
        ...rig(head, { mat: "coat", blend: 3, prims: [ell(16, 10.8, 4.3, 3.7), ell(16, 14.2, 2.8, 2.2), ...both(cap(13.3, 8, 12.4, 5, 1.2, 0.6))] }),
        ...rig(head, { mat: "mane", prims: [path([[14.8, 6.8], [16.8, 7.6], [17.4, 9.4]], 1.25, 0.8)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 10], [18, 10], pose, "tall"),
        ...blush([10, 13], [20, 13], 1),
        stamp(14, 15, ["k..k"], { k: "coat:1" }),
      ));
    } else {
      head = headMoves([16, 11]);
      const s = swell(18);
      const w = [...drift([12.8, 15.6], 12), rideUp];
      parts.push(
        ...rig(ripple([19.5, 21], 10, 6, 0.3, false), { mat: "mane", prims: [path([[19.5, 21], [23.2, 22], [25.6, 25], [27, 29.2]], 1.9, 0.9), path([[20.6, 22.6], [23.4, 25.4], [23.6, 29]], 1.2, 0.7)] }),
        ...rig(w, ...wings(12.6, 15.4, [[-168, 9], [-150, 11.4], [-132, 12.6], [-114, 12], [-96, 9.4]], 2.1, 1.3, 8.4)),
        ...rig(w, { mat: "wing", prims: both(path([[13.6, 16.4], [10.2, 12.4], [8, 9.2]], 2.2, 1.2)), paint: [{ mat: "wing", level: 4, prims: both(ell(9.6, 10.6, 2.4, 1, -55)) }] }),
        ...rig([s], { mat: "coat", blend: 3, prims: [ell(16, 20.2, 5.4, 4), cap(16, 12.4, 16, 18, 2.4, 3.2)] }),
        ...rig([paw([13.5, 24])], legs(13.5, 23, 1.1)),
        ...rig([...ripple([18.2, 4.6], 13, 5, 0.2), ...head], { mat: "mane", prims: [path([[18.2, 4.6], [20.6, 7.2], [20.8, 10.8], [20, 14.2], [21.2, 18]], 2, 1.1)] }),
        ...rig(head, { mat: "coat", blend: 3, prims: [ell(16, 7.6, 4, 3.4), ell(16, 11.4, 2.7, 2.3), ...both(cap(13.4, 4.6, 12.6, 1.6, 1.2, 0.6))] }),
        ...rig(head, { mat: "mane", prims: [path([[14.4, 3.4], [16.8, 4.2], [17.6, 6.4]], 1.4, 0.8)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 7], [18, 7], pose, "round"),
        stamp(14, 12, ["k..k"], { k: "coat:1" }),
      ));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 0 ? 8 : 1));
    return { parts, decals, head, neck: head };
  },
};

// ── Skyray ──

export const skyray: Species = {
  id: "skyray",
  name: "Skyray",
  element: "sky",
  tier: "rare",
  stages: ["Raylet", "Glidelet", "Skyray"],
  palette: { ray: "#6f9ce8", belly: "#eef6ff", spot: "#ffe27a" },
  shiny: { ray: "#e37fb0", belly: "#fff1f7", spot: "#8ff3ff" },
  lore: "Glides between clouds the way a bookmark slides between pages. When its shadow passes over the grass, it means a quiet afternoon for reading.",
  hint: "A kite with no string and a tail with no end.",
  // It hangs in the air on slow wingbeats: each one runs out to the wing
  // tips, the body lifting on the downstroke, the tail streaming a beat
  // behind. Its act is a gentle rise: one long, deep stroke carries it up
  // two pixels, and it glides back down on outstretched wings.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const spots = (list: V[]): Decal[] =>
      list.flatMap(([x, y]) => [stamp(x, y, ["s"], { s: "spot:4" }), stamp(31 - x, y, ["s"], { s: "spot:4" })]);
    const a = pose === "act" ? (t ?? 0) : -1;
    // The rise: the deep stroke's share of the motion (0–1) and the climb.
    const deep = a < 0 ? 0 : ease(0, 0.15)(a) * (1 - ease(0.45, 0.6)(a));
    const climb = a < 0 ? 0 : 2 * ease(0.15, 0.5)(a) * (1 - ease(0.55, 0.95)(a));
    const calm = pose === "sleep" ? 0.4 : 1;
    /** The wingbeat (+ is up). The deep stroke is one slow sweep down,
     *  eased in from the loop and back out to it. */
    const beatW: Wave = (u) => (1 - deep) * calm * Math.sin(Math.PI * 2 * u) + deep * -1.6 * Math.sin(Math.PI * u);
    const wing = (shoulder: V, span: number): Move => ({ at: shoulder, wave: beatW, turn: 7, bend: span, lag: 0.12, pair: true });
    /** The body lifts on the downstroke, a quarter beat behind it. */
    const hover: Move = {
      at: [16, 16],
      wave: (u) => (1 - deep) * calm * 0.5 * (1 - Math.cos(Math.PI * 2 * (u - 0.1))) + climb,
      shift: [0, -1],
    };
    /** The tail streams after the body, the wave running out to its tip. */
    const tail = (root: V, len: number): Move => ({
      at: root,
      wave: (u) => calm * Math.sin(Math.PI * 2 * (u - 0.3)),
      turn: 8,
      bend: len,
      lag: 0.35,
    });
    if (stage === 0) {
      const w = wing([12.4, 22.6], 6);
      parts.push(
        ...rig([tail([16, 25], 6), hover], { mat: "ray", prims: [path([[16, 25], [17, 27.6], [19.6, 28.4], [21.4, 27.2]], 1, 0.7)] }),
        ...rig([hover], { mat: "ray", blend: 1.5, prims: [ell(16, 22.8, 5, 3.6), ...rig([w], ...both(poly([[12.4, 21], [7.6, 21.4], [6.6, 23.6], [11.8, 25.6]], 0.9)))],
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 25.6, 2.6, 1.2)] }] }),
        ...rig([hover], { mat: "ray", prims: both(path([[13.2, 20.4], [12.6, 18.4], [13.8, 17.6]], 1.1, 0.85)) }),
      );
      decals.push(...rig([hover],
        ...eyes([11, 21], [19, 21], pose, "tall"),
        ...blush([9, 24], [21, 24]),
        stamp(15, 23, ["kk"], { k: "ray:1" }),
      ));
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head: [hover], neck: [hover] };
    }
    if (stage === 1) {
      const w = wing([12, 18], 9);
      parts.push(
        ...rig([hover], { mat: "belly", round: 1, prims: [...rig([w], ...both(ell(7, 23.4, 2.4, 1.4))), ...rig([tail([16, 22], 10)], ell(24.6, 26.4, 2, 1.2))] }),
        ...rig([tail([16, 22], 10), hover], { mat: "ray", prims: [path([[16, 22], [16.6, 25.6], [19.4, 27.4], [23, 27], [24.6, 25]], 1.1, 0.65)] }),
        ...rig([hover], { mat: "ray", blend: 1.5, prims: [ell(16, 18.8, 5.4, 4.2), ...rig([w], ...both(poly([[12.2, 16.2], [7.4, 16.4], [4, 16], [6.4, 19.4], [12.4, 22.4]], 1)))],
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 22.6, 3, 1.3)] }] }),
        ...rig([hover], { mat: "ray", prims: both(path([[13, 15.6], [12.2, 13], [13.8, 12]], 1.2, 0.85)) }),
      );
      decals.push(
        ...rig([hover], ...eyes([11, 16], [19, 16], pose, "round"), stamp(14, 19, ["k..k", ".kk."], { k: "ray:1" })),
        ...rig([w, hover], ...spots([[8, 18], [10, 20]])),
      );
      if (pose === "sleep") decals.push(zzz(25, 6));
      return { parts, decals, head: [hover], neck: [hover] };
    }
    const w = wing([12, 14], 12);
    const tl = tail([16, 19], 14);
    parts.push(
      ...rig([hover], { mat: "belly", round: 1, blend: 1.5, prims: [
        ...rig([w], ...both(ell(4.2, 17.8, 3, 1.7)), ...both(ell(7.4, 18.6, 2.2, 1.5))),
        ...rig([tl], ell(26, 27.4, 2.6, 1.4), ell(23, 28, 1.8, 1.1)),
      ] }),
      ...rig([tl, hover], { mat: "ray", prims: [path([[16, 19], [16.4, 23], [18.6, 26.2], [22.8, 27.2], [26.8, 25.4], [28.6, 22.4]], 1.25, 0.65)] }),
      ...rig([hover], { mat: "ray", blend: 1.5, prims: [ell(16, 14.6, 6.2, 5.4), ...rig([w], ...both(poly([[11.6, 11], [6.4, 11], [1.4, 9.8], [3.6, 13.2], [7.6, 16.4], [12.4, 19.6]], 1)))],
        paint: [{ mat: "belly", level: 4, prims: [ell(16, 19.8, 3.6, 1.6)] }] }),
      ...rig([hover], { mat: "ray", prims: both(path([[13, 10], [12, 6.8], [13.8, 5.4]], 1.35, 0.9)) }),
    );
    decals.push(
      ...rig([hover], ...eyes([11, 10], [19, 10], pose, "round"), stamp(13, 13, ["k....k", ".kkkk."], { k: "ray:1" })),
      ...rig([w, hover], ...spots([[4, 11], [7, 12], [6, 14], [9, 15], [10, 13]])),
    );
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals, head: [hover], neck: [hover] };
  },
};

// ── Galewyrm ──

export const galewyrm: Species = {
  id: "galewyrm",
  name: "Galewyrm",
  element: "sky",
  tier: "epic",
  stages: ["Draftling", "Squallwing", "Galewyrm"],
  palette: { hide: "#72c2d6", feather: "#eef6ff", belly: "#fff0c8", horn: "#ffcf5c", ribbon: "#a8fff0" },
  shiny: { hide: "#b596ec", feather: "#fff2fa", belly: "#ffe1f1", horn: "#8ff0ff", ribbon: "#ffb8ec" },
  lore: "Sleeps in the jet stream and wakes whenever a page is turned somewhere far below. Its wind ribbons are said to be every sentence ever read aloud.",
  hint: "It trails the wind the way a quill trails ink.",
  // Always in a breeze: its wind ribbons stream and curl, a wave running out
  // along them, the tail sways, the wings drift, and the head rises a beat
  // after each slow breath. Its act is a passing gust: eyes shut, head
  // raised into the wind, its ribbons lift and billow out to their tips,
  // then everything settles.
  motion: { idle: 3.8, sleep: 5.8, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** The gust's envelope over act time (a wave, so ribbons can lag it). */
    const gust: Wave = (x) => ease(0.06, 0.32)(x) * (1 - ease(0.5, 0.8)(x));
    const a = pose === "act" ? (t ?? 0) : -1;
    const acting = a >= 0;
    const env = acting ? gust(a) : 0;
    const look = env > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    /** A wind ribbon streams from its root, a wave running to the tip; in
     *  the gust it lifts (`dir` 1 swings it clockwise) and billows. */
    const stream = (root: V, len: number, dir: number, phase: number): Move[] => [
      { at: root, wave: sine(1, phase), turn: 8 * calm, bend: len, lag: 0.35 },
      { at: root, wave: (u) => (acting ? gust(u) : 0), turn: 14 * dir, bend: len, lag: 0.18 },
    ];
    const ribbon = (pts: V[], r0: number, r1: number, dir = -1, phase = 0): Part[] =>
      rig(stream(pts[0], Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]), dir, phase),
        { mat: "ribbon", glow: true, line: false, prims: [path(pts, r0, r1)] });
    /** The body swells about the ground. */
    const swell = (h: number): Move => ({ at: [16, 29.5], wave: (u) => Math.max(breath(u), Math.round(env)), grow: [0.02, 1 / h] });
    /** The head rises a beat behind the breath. */
    const lift: Move = { at: [16, 10], wave: (u) => Math.max(breath(u - 0.1), Math.round(env)), shift: [0, -1] };
    /** The tail sways from its root. */
    const swish = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.4), turn: 6 * calm, bend: len, lag: 0.3 });
    /** The wings drift. */
    const drift = (shoulder: V, len: number): Move => ({ at: shoulder, wave: sine(1, 0.1), turn: 3 * calm, bend: len, lag: 0.25, pair: true });
    const head = [lift];
    if (stage === 0) {
      const s = swell(12);
      const tail = swish([20.2, 26], 9);
      parts.push(
        ...ribbon([[22.5, 26.5], [25.5, 24.5], [24.6, 21.6], [27, 19.6]], 0.9, 0.6, -1, 0.1),
        ...rig([drift([12, 22], 4), s], ...wingFan("feather", 12, 22, [[-160, 4], [-132, 4.8], [-106, 3.8]], 1.2, 0.9, { flat: 3 })),
        ...rig([s], { mat: "hide", blend: 1.5, prims: [ell(16, 25.6, 5, 3.6)], paint: [{ mat: "belly", prims: [ell(16, 26.6, 2.6, 2.4)] }] }),
        ...rig([tail], { mat: "hide", prims: [path([[20.2, 26], [20.4, 28.6], [17, 29.4], [12.6, 29.2], [10.4, 28]], 1.6, 0.8)] }),
        ...rig(head, { mat: "horn", prims: both(path([[13.2, 16.2], [11.8, 14.4], [10.2, 14.2]], 1, 0.6)) }),
        ...rig(head, { mat: "hide", blend: 2, prims: [ell(16, 18.8, 4.8, 3.9), ell(16, 21.6, 3.2, 2)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 18], [18, 18], look, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(14, 21, ["k..k"], { k: "hide:1" }),
      ));
    } else if (stage === 1) {
      const s = swell(18);
      const w = [drift([12.6, 16.6], 7), s];
      parts.push(
        ...ribbon([[24.6, 26.4], [27.6, 22.6], [26, 19], [28.2, 15.2]], 1, 0.6, -1, 0.1),
        ...rig([swish([18.5, 24], 8)], { mat: "hide", prims: [path([[18.5, 24], [22, 27.4], [25.4, 26.4], [26, 23.4]], 1.8, 0.8)] }),
        ...rig(w, ...wingFan("feather", 12, 16.5, [[-172, 5.4], [-150, 7], [-128, 7.2], [-106, 5.6]], 1.4, 0.9, { flat: 3 })),
        ...rig(w, { mat: "hide", prims: both(path([[13, 16.4], [10, 12.6], [7.6, 11.2]], 1.4, 0.9)) }),
        { mat: "hide", back: true, round: 1, prims: both(cap(12.4, 25.8, 12, 29, 1.7, 1.5)) },
        ...rig([s], { mat: "hide", blend: 2.5, prims: [ell(16, 21.8, 4.4, 4.8), cap(16, 13, 16, 18, 1.8, 2.6), ...both(ell(12.4, 25, 2.2, 2.6))],
          paint: [{ mat: "belly", prims: [ell(16, 22.6, 2.2, 3.8)] }] }),
        ...rig(head, { mat: "horn", prims: both(path([[13.4, 9.4], [11.6, 7.2], [9.4, 6.6]], 1.1, 0.6)) }),
        ...rig(head, { mat: "hide", blend: 2, prims: [ell(16, 11.6, 4.2, 3.4), ell(16, 14.2, 2.8, 1.9)] }),
      );
      decals.push(...rig(head,
        ...eyes([12, 11], [18, 11], look, "round"),
        stamp(14, 14, ["k..k"], { k: "hide:1" }),
      ));
    } else {
      const s = swell(22);
      const w = [drift([12.6, 15.2], 12), s];
      const tail = swish([18.4, 25], 10);
      parts.push(
        ...ribbon([[12, 24], [7.6, 26.4], [3.6, 24.6], [2.4, 20.6], [0.9, 17.6]], 1.1, 0.5, 1, 0.35),
        ...ribbon([[20.5, 22], [24.8, 20.2], [28.4, 21.4], [30.4, 18.2]], 1, 0.5, -1, 0.1),
        ...rig([tail], { mat: "hide", prims: [path([[18.4, 25], [22, 28.4], [26.2, 28.2], [27.6, 25]], 2.2, 0.9)] }),
        ...rig([tail], ...wingFan("feather", 26.8, 24.4, [[-120, 3.4], [-80, 3.6], [-40, 3]], 1.1, 0.8, { flat: 3, one: true })),
        ...rig(w, ...wingFan("feather", 12, 15, [[-172, 9], [-154, 11], [-136, 12], [-118, 11.4], [-100, 8.6]], 1.7, 0.95, {
          flat: 3, paint: [{ mat: "hide", level: 4, prims: both(ell(12, 15, 16, 16)), cut: both(ell(12, 15, 9, 9)) }],
        })),
        ...rig(w, { mat: "hide", prims: both(path([[13.4, 15.6], [10.2, 10.8], [7.6, 6.6], [6.2, 5.8]], 1.9, 0.8)) }),
        { mat: "hide", back: true, round: 1, prims: both(cap(12, 26.2, 11.4, 29.2, 1.9, 1.6)) },
        ...rig([s], { mat: "hide", blend: 2.5, prims: [ell(16, 20.8, 4.8, 5.6), cap(16, 10.5, 16, 16.5, 2, 2.8), ...both(ell(12, 24.6, 2.6, 3))],
          paint: [{ mat: "belly", prims: [ell(16, 21.6, 2.4, 4.6), cap(16, 12, 16, 16, 1, 1.4)] }] }),
        ...rig(head, { mat: "horn", prims: both(path([[13.8, 5.4], [13, 2.8], [11.6, 1.2]], 1.2, 0.6)) }),
        ...rig(head, { mat: "hide", blend: 2, prims: [ell(16, 7.6, 4.3, 3.4), ell(16, 10.4, 2.9, 1.9), ...both(cap(12.4, 8.4, 9.8, 7, 1.1, 0.6))] }),
      );
      decals.push(
        ...rig(head,
          ...eyes([12, 7], [18, 7], look, "round"),
          stamp(14, 10, ["k..k"], { k: "hide:1" })),
        stamp(10, 29, ["k.k"], { k: "horn:2" }),
        stamp(20, 29, ["k.k"], { k: "horn:2" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 0 ? 8 : 1));
    return { parts, decals, head, neck: head };
  },
};

export const SKY: Species[] = [cloudlamb, zephyrin, flutterpig, zipwing, griffin, pegasus, skyray, thunderbird, galewyrm, quetzal];
