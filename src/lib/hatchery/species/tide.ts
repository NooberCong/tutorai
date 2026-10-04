import type { Species } from "../kit.ts";
import { awake, blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move, Wave } from "../motion.ts";
import { ease, pulse, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, egg, ell, path, poly } from "../pixel.ts";

/** Points along an elliptical arc (degrees; 0 = right, 90 = down). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): V[] {
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/** A water droplet / splash fleck floating outside the body. */
const drop = (x: number, y: number, ink = "splash:4"): Decal => ({
  x, y, over: true, rows: [".d", "dd"], inks: { d: ink },
});

/** A tiny floating bubble ring. */
const bubble = (x: number, y: number, ink: string): Decal => ({
  x, y, over: true, rows: [".b.", "b.b", ".b."], inks: { b: ink },
});

// ── Bubblet · common ──────────────────────────────────────────────

export const bubblet: Species = {
  id: "bubblet",
  name: "Bellumine",
  element: "tide",
  tier: "common",
  stages: ["Bubblet", "Jellet", "Bellumine"],
  palette: { jelly: "#93d8f2", tent: "#f4a6d4", glow: "#fff0a0" },
  shiny: { jelly: "#c9a3f7", tent: "#8ff0c8", glow: "#9ff7ff" },
  lore: "Drifts over open books like a reading lamp nobody plugged in. Glows a little brighter at every plot twist.",
  hint: "A bubble that learned to blink.",
  // It drifts on slow pulses: the bell narrows a touch, the whole jelly
  // lifts a pixel a beat later and sinks back, its ribbons trailing in
  // waves that run down to their tips; its bubbles rise and settle on their
  // own. Its act is a plot twist: eyes closed, the lamp in its bell swells
  // and glows, the ribbons fan out softly and a sparkle or two twinkles.
  motion: { idle: 4, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** What carries the face: hats and glasses ride the bell's pulse. */
    let carry: Move[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const lamp = a < 0 ? 0 : ease(0.1, 0.38)(a) * (1 - ease(0.6, 0.9)(a));
    const look = lamp > 0.45 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const beat = stepped(rise(1));
    /** The bell narrows on the pulse; the jelly lifts a beat later. */
    const squeeze = (c: V): Move => ({ at: c, wave: beat, grow: [-0.04, 0.03] });
    const hover: Move = { at: [16, 16], wave: (u) => beat(u - 0.12), shift: [0, -1] };
    /** A ribbon trails from its root, the wave running down to its tip. */
    const trail = (top: V, len: number, phase: number): Move => ({ at: top, wave: sine(1, phase), turn: 6 * calm, bend: len, lag: 0.3 });
    /** Mid-act the ribbons ease outward. */
    const fan = (top: V): Move => ({ at: top, wave: () => lamp, turn: 5, pair: true });
    const trailing = (p: Prim, top: V, len: number, phase: number, spread?: Move): Prim =>
      rig(spread ? [trail(top, len, phase), spread] : [trail(top, len, phase)], p)[0];
    /** The lamp swells as it brightens. */
    const bright = (c: V): Move => ({ at: c, wave: () => Math.round(lamp * 2) / 2, grow: [0.4, 0.5] });
    /** Each bubble rises a pixel and settles, on its own beat. */
    const drift = (b: Decal, phase: number): Decal => rig([{ at: [b.x, b.y], wave: stepped(rise(1, phase)), shift: [0, -1] }], b)[0];
    // A bell: dome with a scalloped rim, flat-cut underneath.
    const bell = (cx: number, cy: number, rx: number, ry: number, rimY: number, n: number, rs: number): Part => {
      const scallops: Prim[] = [];
      for (let i = 0; i < n; i++) {
        const x = cx - rx + 1.4 + ((2 * rx - 2.8) * i) / (n - 1);
        scallops.push(ell(x, rimY, rs, rs * 0.85));
      }
      return {
        mat: "jelly", prims: [ell(cx, cy, rx, ry), ...scallops], blend: 1.2, round: ry + 3,
        cut: [poly([[0, rimY + 0.1], [32, rimY + 0.1], [32, 32], [0, 32]])],
      };
    };
    // A ribbon (oral arm) that waves down from the bell.
    const ribbon = (x: number, y0: number, y1: number, amp: number, r: number): Prim => {
      const pts: V[] = [];
      for (let y = y0; y <= y1 + 0.01; y += 1) pts.push([x + amp * Math.sin((y - y0) * 0.75), y]);
      return path(pts, r, r * 0.55);
    };
    const thin = (x: number, y0: number, y1: number, amp: number): Prim => ribbon(x, y0, y1, amp, 0.75);
    if (stage === 0) {
      const sq = squeeze([16, 18.6]);
      carry = [sq, hover];
      const f = fan([14, 22]);
      parts.push(
        ...rig([hover], { mat: "tent", prims: [trailing(thin(14, 22, 26.5, 0.6), [14, 22], 4.5, 0, f), trailing(thin(18, 22, 26.5, -0.6), [18, 22], 4.5, 0.12, f)], round: 1.2 }),
        ...rig([sq, hover], bell(16, 18.6, 6.6, 5.8, 22.4, 5, 1.3)),
      );
      if (lamp > 0.3) parts.push(...rig([bright([16, 14.8]), sq, hover], { mat: "glow", prims: [ell(16, 14.8, 1.6, 1.1)], glow: true, line: false }));
      decals.push(
        ...rig([sq, hover],
          stamp(12, 14, ["ww", "w."], { w: "white:4" }),
          ...eyes([12, 17], [18, 17], look, "tall"),
          ...blush([10, 20], [20, 20]),
          stamp(15, 20, ["kk"], { k: "tent:1" })),
        drift(bubble(24, 11, "jelly:4"), 0.35),
        drift(bubble(6, 9, "jelly:4"), 0.75),
      );
      if (a >= 0) decals.push(...twinkle(3, 15, a, 0.3, "glow:5", 0.3));
    } else if (stage === 1) {
      const sq = squeeze([16, 13.6]);
      carry = [sq, hover];
      const f = fan([13.6, 18]);
      const g = fan([10.5, 18]);
      parts.push(
        ...rig([hover], { mat: "jelly", prims: [trailing(thin(10.5, 18, 26, 0.7), [10.5, 18], 8, 0.2, g), trailing(thin(21.5, 18, 26, -0.7), [21.5, 18], 8, 0.4, g)], back: true, round: 1.2 }),
        ...rig([hover], { mat: "tent", prims: [trailing(ribbon(13.6, 18, 27.5, 0.9, 1.5), [13.6, 18], 9.5, 0, f), trailing(ribbon(18.4, 18, 27.5, 0.9, 1.5), [18.4, 18], 9.5, 0.12, f)], blend: 0.4, round: 1.8 }),
        ...rig([sq, hover], bell(16, 13.6, 8.4, 7.2, 18.6, 6, 1.5)),
        ...rig([bright([16, 8.6]), sq, hover], { mat: "glow", prims: [ell(16, 8.6, 2.4, 1.6)], glow: true, line: false }),
      );
      decals.push(
        ...rig([sq, hover],
          stamp(10, 9, ["ww", "w."], { w: "white:4" }),
          ...eyes([12, 13], [18, 13], look, "tall"),
          ...blush([10, 16], [20, 16]),
          stamp(15, 16, ["kk"], { k: "tent:1" })),
        drift(bubble(4, 5, "jelly:4"), 0.55),
      );
      if (a >= 0) decals.push(...twinkle(24, 6, a, 0.28, "glow:5", 0.3), ...twinkle(5, 12, a, 0.4, "glow:5", 0.25));
    } else {
      const sq = squeeze([16, 10.4]);
      carry = [sq, hover];
      const f = fan([12.8, 15]);
      const g = fan([6.5, 15]);
      const h = fan([10, 16]);
      parts.push(
        ...rig([hover], { mat: "jelly", prims: [
          trailing(thin(6.5, 15, 27, 0.8), [6.5, 15], 12, 0.3, g), trailing(thin(10, 16, 29, -0.8), [10, 16], 13, 0.1, h),
          trailing(thin(22, 16, 29, 0.8), [22, 16], 13, 0.45, h), trailing(thin(25.5, 15, 27, -0.8), [25.5, 15], 12, 0.2, g),
        ], back: true, round: 1.2 }),
        ...rig([hover], { mat: "tent", prims: [trailing(ribbon(12.8, 15, 30, 1.1, 1.8), [12.8, 15], 15, 0, f), trailing(ribbon(19.2, 15, 30, 1.1, 1.8), [19.2, 15], 15, 0.12, f)], blend: 0.4, round: 2 }),
        ...rig([sq, hover], bell(16, 10.4, 11.4, 8.6, 15.6, 8, 1.7)),
        ...rig([bright([16, 5.4]), sq, hover], { mat: "glow", prims: [ell(16, 5.4, 3.4, 2.2)], glow: true, line: false }),
      );
      decals.push(
        ...rig([sq, hover],
          stamp(7, 6, ["ww", "w."], { w: "white:4" }),
          ...eyes([12, 10], [18, 10], look, "tall"),
          ...blush([9, 13], [21, 13]),
          stamp(15, 13, ["kk"], { k: "tent:1" })),
        drift(bubble(2, 2, "jelly:4"), 0.55),
      );
      if (a >= 0) decals.push(...twinkle(27, 2, a, 0.28, "glow:5", 0.3), ...twinkle(1, 12, a, 0.4, "glow:5", 0.25));
    }
    if (pose === "sleep") decals.push(zzz(25, 0));
    return { parts, decals, head: carry, neck: carry };
  },
};

// ── Kappa · common ────────────────────────────────────────────────

export const kappa: Species = {
  id: "kappa",
  name: "Kappa",
  element: "tide",
  tier: "common",
  stages: ["Dishling", "Kappling", "Kappa"],
  palette: { skin: "#88d07e", shell: "#b08a5c", beak: "#f5c653", dish: "#e8dfc4", water: "#74cdf0", cuke: "#3f9a78" },
  shiny: { skin: "#86b9f2", shell: "#8a6fc0", beak: "#ff9fb0", dish: "#f4e9ff", water: "#ffd66e", cuke: "#e0a040" },
  lore: "Bows politely before every chapter, then spends the next page mopping up its dish. Will trade secrets for a cucumber.",
  hint: "Mind the puddle on its head.",
  // A slow breath lifting the head, light sliding across the water in its
  // dish, the cucumber swaying in its hand. Its act is a polite bow, eyes
  // closed, that spills a single drop from the dish.
  motion: { idle: 3.6, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const bow = a < 0 ? 0 : ease(0.08, 0.32)(a) * (1 - ease(0.62, 0.9)(a));
    const look = awake(pose) && bow < 0.5 ? pose : "blink";
    const breath = stepped(rise(1));
    /** The head: up a pixel on the breath, down two in the bow, the dish
     *  tipping toward us as it goes. */
    const lift: Move = { at: [16, 16], wave: (u) => (bow > 0.05 ? -Math.round(2 * bow) : breath(u - 0.08)), shift: [0, -1] };
    const tip = (cy: number): Move => ({ at: [16, cy], wave: () => bow, grow: [0, 0.35] });
    // The head-dish: a pale rim holding water, ringed by a bowl-cut fringe.
    const crown = (cy: number, rx: number, ry: number): Part[] => [
      { mat: "cuke", prims: [ell(16, cy + 0.5, rx + 1.1, ry + 0.8)], round: 3 },
      { mat: "dish", prims: [ell(16, cy, rx, ry)], round: 3,
        paint: [{ mat: "water", prims: [ell(16, cy + ry * 0.25, rx - 1, ry * 0.6)] }] },
    ];
    /** Light on the water, sliding slowly across the dish. */
    const glint = (y: number, reach: number): Decal =>
      ({ ...stamp(16, y, ["w"], { w: "water:5" }), move: [{ at: [16, y], wave: sine(1, 0.1), shift: [reach, 0] }] });
    /** Mid-bow a drop spills from the dish's front rim and falls. */
    const spill = (x: number, y: number) => {
      const f = a < 0 ? -1 : (a - 0.34) / 0.24;
      if (f >= 0 && f < 1) decals.push(drop(x, Math.round(y + f * f * 7), "water:4"));
    };
    if (stage === 0) {
      const swell: Move = { at: [16, 29.5], wave: (u) => breath(u) * (1 - bow), grow: [0.02, 0.07] };
      const nod: Move = { at: [16, 20], wave: () => Math.round(bow), shift: [0, 1] };
      parts.push(
        { mat: "skin", prims: both(ell(12.2, 29, 1.9, 1.2, -15)), back: true },
        ...rig([swell], { mat: "skin", prims: [ell(16, 23, 7.2, 6)], round: 4 }),
        ...rig([tip(17.8), nod, swell], ...crown(17.8, 3.2, 1.2)),
        ...rig([nod, swell], { mat: "beak", prims: [ell(16, 25.6, 1.8, 1)], round: 2 }),
      );
      decals.push(...rig([nod, swell], ...eyes([12, 21], [18, 21], look, "tall"), ...blush([10, 24], [20, 24]), glint(17, 1)));
      spill(19, 18);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: [nod, swell], neck: [swell] };
    }
    if (stage === 1) {
      parts.push(
        { mat: "shell", prims: [ell(16, 20.4, 9.4, 7.4)], round: 4,
          paint: [{ mat: "shell", level: 4, prims: [ell(16, 20.4, 9.4, 7.4)], cut: [ell(16, 21, 8.2, 6.4)] }] },
        { mat: "skin", prims: both(ell(12.5, 29.2, 2.4, 1.4)), back: true },
        { mat: "skin", prims: [...rig([lift], ell(16, 15.6, 7.6, 6)), ell(16, 24, 5.4, 4.8)], blend: 2, round: 4,
          paint: [{ mat: "beak", prims: [ell(16, 24.8, 3.4, 3.4)] }] },
        { mat: "skin", prims: both(ell(9.8, 23.5, 1.4, 2.2, 20)), round: 2 },
        ...rig([tip(10.4), lift], ...crown(10.4, 3.6, 1.3)),
        ...rig([lift], { mat: "beak", prims: [ell(16, 19, 2.2, 1.1)], round: 2 }),
      );
      decals.push(
        ...rig([lift], ...eyes([12, 14], [18, 14], look, "tall"), ...blush([10, 17], [20, 17]), glint(10, 1.4)),
        stamp(15, 24, ["kk", "..", "kk"], { k: "beak:2" }),
      );
      spill(21, 11);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: [lift], neck: [] };
    }
    /** The cucumber sways gently in its hand. */
    const sway: Move = { at: [22.2, 22.4], wave: sine(1, 0.3), turn: 4 };
    parts.push(
      { mat: "shell", prims: [ell(16, 21.4, 10, 7)], round: 4,
        paint: [{ mat: "shell", level: 4, prims: [ell(16, 21.4, 10, 7)], cut: [ell(16, 22, 8.6, 5.8)] }] },
      { mat: "skin", prims: both(ell(12, 29.2, 2.8, 1.5)), back: true },
      { mat: "skin", prims: [...rig([lift], ell(16, 11.6, 8.6, 6.6)), ell(16, 23, 6.2, 5.8)], blend: 2, round: 4,
        paint: [{ mat: "beak", prims: [ell(16, 23.8, 3.8, 4.4)] }] },
      { mat: "skin", prims: [ell(9.4, 22.5, 1.6, 2.5, 20)], round: 2 },
      ...rig([sway], { mat: "cuke", prims: [cap(20.5, 26.5, 25.6, 16.6, 1.8, 1.6)],
        paint: [{ mat: "dish", level: 4, prims: [ell(25.7, 16.4, 1.4, 1.2)] }] }),
      { mat: "skin", prims: [ell(22.2, 22.4, 1.8, 1.7)], round: 2 },
      ...rig([tip(5.4), lift], ...crown(5.4, 4.2, 1.5)),
      ...rig([lift], { mat: "beak", prims: [ell(16, 15.6, 2.6, 1.3)], round: 2 }),
    );
    decals.push(
      ...rig([lift], ...eyes([12, 10], [18, 10], look, "tall"), ...blush([10, 13], [20, 13]), glint(5, 1.4)),
      stamp(14, 22, ["kkkk", "....", "kkkk"], { k: "beak:2" }),
      ...rig([sway], stamp(24, 20, ["g", ".", "g"], { g: "cuke:4" })),
      drop(21, 0, "water:4"),
    );
    spill(22, 6);
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── Selkie · rare ─────────────────────────────────────────────────

export const selkie: Species = {
  id: "selkie",
  name: "Selkie",
  element: "tide",
  tier: "rare",
  stages: ["Pupkin", "Sealet", "Selkie"],
  palette: { fur: "#b2c3d6", foam: "#eef4f8", pelt: "#7089ad", coral: "#ff8c86" },
  shiny: { fur: "#d9b98f", foam: "#fff3dc", pelt: "#8a5a9e", coral: "#6fe0d0" },
  lore: "Slips out of its skin to borrow books from the seaside library, and always returns them slightly damp.",
  hint: "Sings under the pier at closing time.",
  // A slow breath: the pup swells as one round blob, the older ones lift
  // their heads a beat after the body, flippers easing out and back. Its
  // act is a song under the pier: chin up and eyes closed, a small round
  // mouth, flippers lifting, while two notes float up and away.
  motion: { idle: 3.6, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const sing = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.66, 0.92)(a));
    const look = sing > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const breath = stepped(rise(1));
    /** The head: up a pixel on the breath, and held up through the song. */
    const lift: Move = { at: [16, 16], wave: (u) => Math.max(breath(u - 0.08), Math.round(1.6 * sing)), shift: [0, -1] };
    /** Flippers ease out and back, a beat behind the breath, and lift
     *  while it sings. */
    const paddle = (at: V): Move[] => [
      { at, wave: sine(1, 0.6), turn: 9 * calm, pair: true },
      { at, wave: () => sing, turn: 12, pair: true },
    ];
    // Seal face: a dark button nose over two small whisker puffs (painted).
    const muzzle = (y: number): Decal[] => [
      stamp(15, y, ["kk"], { k: "eye:3" }),
      ...(sing > 0.25 ? [stamp(15, y + 2, sing > 0.6 ? ["mm", "mm"] : ["mm"], { m: "coral:2" })] : []),
    ];
    /** Two notes float up and away from the song, one after the other. */
    const notes = (x: number, y: number) => {
      for (const at of [0.24, 0.46]) {
        const f = a < 0 ? -1 : (a - at) / 0.36;
        if (f < 0 || f >= 1) continue;
        const e = f * f * (3 - 2 * f);
        decals.push(stamp(x + Math.round(3 * e), y - Math.round(7 * e), f < 0.12 || f > 0.88 ? ["n"] : [".nn", ".n.", "nn."], { n: "coral:4" }, true));
      }
    };
    if (stage === 0) {
      // Fluffy white pup: one round blob that swells as it breathes, and
      // stretches a pixel taller to sing.
      const swell: Move = { at: [16, 29.5], wave: (u) => Math.max(breath(u), Math.round(sing * 2)), grow: [0.02, 0.075] };
      const fluff = arc(16, 23.5, 6.6, 5.6, 200, 340, 6).map(([x, y]) => ell(x, y, 1.5));
      parts.push(
        { mat: "foam", prims: both(ell(12.5, 29.2, 2.4, 1.1, -12)), back: true },
        ...rig([swell], { mat: "foam", prims: [ell(16, 24, 7.2, 5.8), ...fluff], blend: 1.2, round: 4,
          paint: [{ mat: "foam", level: 5, prims: [ell(14.6, 25.4, 1.5, 1.1), ell(17.4, 25.4, 1.5, 1.1)] }] }),
        ...rig([...paddle([10.4, 24.8]), swell], { mat: "foam", prims: both(ell(9.6, 26.3, 1.3, 2, 40)), round: 2 }),
      );
      decals.push(...rig([swell], ...eyes([11, 21], [18, 21], look, "big"), ...muzzle(24), ...blush([9, 25], [22, 25], 1)));
      notes(23, 20);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    if (stage === 1) {
      parts.push(
        { mat: "fur", prims: both(ell(11.8, 29.3, 3.2, 1.2, -15)), back: true },
        { mat: "fur", prims: [...rig([lift], ell(16, 15.5, 6, 5.2)), ell(16, 23.8, 7.6, 5.6)], blend: 4, round: 4,
          paint: [
            { mat: "fur", level: 4, prims: [ell(16, 25.2, 4.4, 3.6)] },
            { mat: "pelt", prims: [ell(10.2, 21.6, 0.9), ell(21.8, 21, 0.9), ...rig([lift], ell(20.4, 12.2, 0.8)), ell(10.6, 25.8, 0.8), ell(22.6, 25.4, 0.8)] },
            { mat: "foam", level: 4, prims: rig([lift], ell(14.7, 18.2, 1.3, 1), ell(17.3, 18.2, 1.3, 1)) },
          ] },
        ...rig(paddle([10, 21.6]), { mat: "fur", prims: both(ell(8.8, 24, 1.6, 3, 40)), round: 2 }),
      );
      decals.push(...rig([lift], ...eyes([12, 14], [18, 14], look, "tall"), ...muzzle(17), ...blush([10, 17], [20, 17])));
      notes(23, 13);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: [lift], neck: [] };
    }
    parts.push(
      // The shed sealskin, worn as a hooded cloak; the hood rides the head.
      { mat: "pelt", prims: [...rig([lift], ell(16, 10.4, 8, 7.4)), poly([[9, 12], [23, 12], [27.4, 29.4], [4.6, 29.4]], 0.8)], blend: 2, round: 3,
        paint: [{ mat: "pelt", level: 2, prims: [ell(6.8, 24.5, 1.2), ell(25.2, 21.2, 1.1), ell(8.2, 18.2, 1), ell(24.6, 27, 1.2), ...rig([lift], ell(22.6, 7.6, 1.1), ell(10.2, 5.6, 1))] }] },
      { mat: "fur", prims: both(ell(11.6, 29.3, 3.4, 1.2, -15)), back: true },
      { mat: "fur", prims: [...rig([lift], ell(16, 12.4, 6, 5.2)), ell(16, 22.6, 7.2, 6.8)], blend: 4, round: 4,
        paint: [
          { mat: "fur", level: 4, prims: [ell(16, 24, 4.6, 4.8)] },
          { mat: "foam", level: 4, prims: rig([lift], ell(14.7, 15.2, 1.3, 1), ell(17.3, 15.2, 1.3, 1)) },
        ] },
      ...rig(paddle([10.2, 20.4]), { mat: "fur", prims: both(ell(9, 23, 1.7, 3.4, 35)), round: 2 }),
    );
    decals.push(
      ...rig([lift], ...eyes([12, 11], [18, 11], look, "round"), ...muzzle(14), ...blush([10, 14], [20, 14])),
      stamp(11, 17, ["c........c", ".c.c..c.c.", "....cc...."], { c: "coral:3" }),
    );
    notes(25, 11);
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── Tidehorn · epic ───────────────────────────────────────────────

export const narwhal: Species = {
  id: "narwhal",
  name: "Tidehorn",
  element: "tide",
  tier: "epic",
  stages: ["Nubwhal", "Hornling", "Tidehorn"],
  palette: { hide: "#8fb0dc", belly: "#cfe0f4", horn: "#fff0bc", splash: "#86e2f2" },
  shiny: { hide: "#f0a8c8", belly: "#fff0f4", horn: "#b8f2ff", splash: "#ffd88a" },
  lore: "Uses its horn as a bookmark and never loses its place. The horn glows brighter the deeper the story goes.",
  hint: "Points the way to the next chapter.",
  // It hangs in the water a pixel up and down on a slow swell, the tail
  // sweeping a beat behind with the wave running out to the fluke, the
  // flippers sculling. Its act points the way: it tips its horn up, a
  // glint climbs the spiral to the tip and twinkles there, and it levels
  // out again.
  motion: { idle: 4, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const point = a < 0 ? 0 : ease(0.06, 0.3)(a) * (1 - ease(0.66, 0.92)(a));
    const calm = pose === "sleep" ? 0.5 : 1;
    // Authored at adult size; younger stages are smaller, rounder copies.
    const k = [0.62, 0.8, 1][stage];
    const X = (x: number) => 15 + (x - 15) * k;
    const Y = (y: number) => 27 + (y - 27) * k;
    const E = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(X(x), Y(y), rx * k, ry * k, rot);
    const P = (pts: V[], r0: number, r1: number) => path(pts.map(([x, y]): V => [X(x), Y(y)]), r0 * k, r1 * k);
    /** The swell: down a pixel and back, slowly (the horn already
     *  touches the top); it sinks a pixel to point, so the tip stays in. */
    const hover: Move = { at: [16, 16], wave: (u) => Math.max(stepped(rise(1))(u - 0.1), Math.round(point)), shift: [0, 1] };
    /** The point: the whole whale tips nose-up about its middle. */
    const tilt: Move = { at: [X(14.5), Y(19.6)], wave: () => point, turn: 6 };
    const carry = [tilt, hover];
    /** The tail sweeps from its root, the wave running out to the fluke;
     *  as it points, the tail dips to balance. */
    const sweep: Move[] = [
      { at: [X(20), Y(17.5)], wave: (u) => (1 - point) * calm * Math.sin(Math.PI * 2 * (u - 0.25)), turn: 8, bend: 12 * k, lag: 0.3 },
      { at: [X(20), Y(17.5)], wave: () => point, turn: -6, bend: 12 * k, lag: 0 },
    ];
    /** Flippers scull, the far one a beat behind. */
    const scull = (at: V, phase: number): Move => ({ at, wave: sine(1, phase), turn: 10 * calm });
    // Whale tail: two lobes spreading from the tip, outer ends flicked up.
    const fluke = (x: number, y: number, s: number): Part => ({
      mat: "hide",
      prims: [E(x - 1.8 * s, y - 0.3 * s, 2.3 * s, 1 * s, 25), E(x + 1.8 * s, y - 0.3 * s, 2.3 * s, 1 * s, -25)],
      blend: 1.2,
    });
    // The horn: a tapering spike from the brow, banded with a spiral.
    const hornLen = [0.3, 0.75, 1][stage];
    const hx0 = X(11.6), hy0 = Y(12.8);
    const hx1 = hx0 + (3 - 11.6) * hornLen, hy1 = hy0 + (1.4 - 12.8) * hornLen;
    const bands: Prim[] = [];
    for (let t = 0.22; t < 0.95 && stage > 0; t += 0.17) {
      bands.push(ell(hx0 + (hx1 - hx0) * t, hy0 + (hy1 - hy0) * t, 2, 0.5, -30));
    }
    const spots = [[17.6, 14.2], [21.4, 14.6], [23.8, 11.8]] as V[];
    parts.push(
      ...rig([scull([X(20.5), Y(24.6)], 0.35), ...carry], { mat: "hide", prims: [E(22, 25.4, 2.8, 1.6, 30)], back: true }),
      ...rig(carry, { mat: "horn", prims: [cap(hx0, hy0, hx1, hy1, stage === 0 ? 1.3 : 1.8 * k + 0.2, 0.6)], glow: true,
        paint: [{ mat: "horn", level: 1, prims: bands }] }),
      ...rig(carry, { mat: "hide", prims: [E(14.5, 19.6, 9.6, 7.2), ...rig(sweep, P([[20, 17.5], [24.6, 13], [26.4, 8.4]], 5, 1.4))], blend: 3, round: 5,
        paint: [
          { mat: "belly", level: 4, prims: [E(13.4, 25.2, 6.4, 2.6)] },
          { mat: "hide", level: 4, prims: stage === 0 ? [] : spots.map(([x, y], i) => (i === 0 ? E(x, y, 0.9, 0.8) : rig(sweep, E(x, y, 0.9, 0.8))[0])) },
        ] }),
      ...rig([...sweep, ...carry], fluke(26.6, 6.8, 1.25)),
      ...rig([scull([X(7.6), Y(21.6)], 0.1), ...carry], { mat: "hide", prims: [E(5.6, 22.6, 3, 1.7, -30)], round: 2 }),
    );
    const ex = (x: number) => Math.round(X(x));
    const ey = (y: number) => Math.round(Y(y));
    decals.push(...rig(carry,
      ...eyes([ex(9.4) - 1, ey(17.4) - 1], [ex(15.4) - 1, ey(17.4) - 1], pose, stage === 2 ? "round" : "tall"),
      ...blush([ex(8) - 1, ey(20)], [ex(17) - 1, ey(20)]),
      stamp(ex(12.4) - 1, ey(20.6), ["k.k", ".k."], { k: "hide:1" }),
    ));
    /** Spray drops bob on the swell, each on its own beat. */
    const bob = (d: Decal, phase: number): Decal => rig([{ at: [d.x, d.y], wave: stepped(sine(1, phase)), shift: [0, -1] }], d)[0];
    if (stage === 1) decals.push(bob(drop(2, 25), 0.1), bob(drop(27, 22), 0.6));
    if (stage === 2) decals.push(bob(drop(1, 26), 0.1), bob(drop(28, 24), 0.6), bob(drop(22, 29), 0.35), ...rig(carry, ...twinkle(0, 0, t, 0.6, "horn:5")));
    // Pointing, a glint climbs the horn and twinkles at its tip (on the
    // adult, the sparkle that already hangs there).
    if (a >= 0) {
      const g = (a - 0.3) / 0.28;
      const along = (f: number): V => [Math.round(hx0 + (hx1 - hx0) * f - 0.5), Math.round(hy0 + (hy1 - hy0) * f - 0.5)];
      if (g > 0 && g < 1) {
        const [gx, gy] = along(0.15 + 0.75 * g);
        decals.push(...rig(carry, stamp(gx, gy, ["w"], { w: "horn:5" }, true)));
      }
      const [tx, ty] = along(1);
      if (stage < 2) decals.push(...rig(carry, ...twinkle(tx - 1, ty - 1, a, 0.58, "horn:5", 0.3)));
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 20 : 25, stage === 2 ? 0 : 2));
    return { parts, decals, head: carry, neck: carry };
  },
};

// ── Leviathan · legendary ─────────────────────────────────────────

export const leviathan: Species = {
  id: "leviathan",
  name: "Leviathan",
  element: "tide",
  tier: "legendary",
  stages: ["Coilet", "Tidecoil", "Leviathan"],
  palette: { scale: "#58bfcf", belly: "#f3e0ae", fin: "#b497f5", lum: "#ffc6f5", gold: "#ffd27a" },
  shiny: { scale: "#6a80d4", belly: "#c8d6ff", fin: "#ff8fb4", lum: "#fff38a", gold: "#f4f0ff" },
  lore: "Sleeps coiled around the deepest shelf in the sea's library. Every glowing scale is a story it has finished.",
  hint: "The tide turns its pages.",
  // A slow breath draws the neck up a pixel and the head rides it, its
  // crest spines drifting open and closed in a ripple, the tail tip and
  // its fin swaying a beat behind. Its act turns a page: a wave of light
  // runs along the coil, spot by spot from the tail, up the neck to the
  // head, which lifts with eyes closed and crest spread as it arrives,
  // then settles.
  motion: { idle: 4, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    /** The light's arrival at the head. */
    const crown = a < 0 ? 0 : ease(0.52, 0.64)(a) * (1 - ease(0.78, 0.95)(a));
    const look = crown > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    // Authored at adult size; younger stages are smaller copies whose head
    // is scaled up (hatchlings are mostly head).
    const k = [0.58, 0.8, 1][stage];
    const hs = [1.5, 1.12, 1][stage];
    const X = (x: number) => 16 + (x - 16) * k;
    const Y = (y: number) => 29 + (y - 29) * k;
    const P = (pts: V[], r0: number, r1: number) => path(pts.map(([x, y]): V => [X(x), Y(y)]), r0 * k, r1 * k);
    // Head space: scaled around the head's center.
    const HX = (x: number) => X(16) + (x - 16) * k * hs;
    const HY = (y: number) => Y(9) + (y - 9) * k * hs + (hs - 1) * 5;
    const H = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(HX(x), HY(y), rx * k * hs, ry * k * hs, rot);
    const HP = (pts: V[], r0: number, r1: number) =>
      path(pts.map(([x, y]): V => [HX(x), HY(y)]), r0 * k * hs, r1 * k * hs);
    const breath = stepped(rise(1));
    const up: Wave = (u) => Math.max(breath(u - 0.08), Math.round(crown));
    /** The head rises a pixel on the breath; the neck stretches to carry
     *  it, its base still in the coil. */
    const lift: Move = { at: [16, 16], wave: up, shift: [0, -1] };
    const stretch: Move = { at: [X(13), Y(27.4)], wave: up, grow: [0, 1 / (13.4 * k)] };
    /** Crest spines drift open and closed, the second set a beat behind;
     *  they spread as the light arrives. */
    const fan = (phase: number): Move[] => [
      { at: [HX(16), HY(8)], wave: sine(1, phase), turn: -5 * calm, pair: true },
      { at: [HX(16), HY(8)], wave: () => crown, turn: -7, pair: true },
      lift,
    ];
    /** The tail tip sways from where it leaves the coil, the fin following. */
    const sway: Move = { at: [X(27.4), Y(25.6)], wave: sine(1, 0.3), turn: 7 * calm, bend: 8 * k, lag: 0.3 };
    // The coil ring seen from the front: far half, then near half with the tail.
    const ring = (front: boolean): Part => ({
      mat: "scale",
      prims: [P(arc(16, 25.6, 11.4, 3.4, front ? 0 : 180, front ? 180 : 360, 14), 2.8, 2.8),
        ...(front ? rig([sway], P([[27.4, 25.6], [29.2, 22], [28.4, 18.6]], 2.8, 1)) : [])],
      back: !front, round: 3,
    });
    const neck: V[] = [[13, 27.4], [17.4, 23.4], [19, 18.4], [17.4, 14]];
    // Crest spines fanning from the head's sides, alternated between two
    // parts so each casts a thin line on its neighbour.
    const spines = stage === 0
      ? [[H(10.8, 5, 1.2, 2.2, -40)], [H(21.2, 5, 1.2, 2.2, 40)]]
      : [
          [H(9.2, 4.4, 1.4, 3.2, -45), H(22.8, 4.4, 1.4, 3.2, 45), H(8, 9, 1.2, 2.8, -95), H(24, 9, 1.2, 2.8, 95)],
          [H(8.2, 6.6, 1.3, 3, -70), H(23.8, 6.6, 1.3, 3, 70), H(16, 2.2, 1.5, 2.6), ...(stage === 2 ? [H(12.4, 2.8, 1.2, 2.4, -25), H(19.6, 2.8, 1.2, 2.4, 25)] : [])],
        ];
    // Bioluminescent spots along the coil and neck; mid-act a wave of light
    // swells them one by one, from the tail round to the neck.
    const lums: V[] = stage === 0 ? [[9, 27], [23, 27]] : stage === 1 ? [[7.4, 26.8], [12.6, 28.4], [19.4, 28.4], [24.6, 26.8]] : [[6, 26.6], [10.6, 28.2], [16, 28.8], [21.4, 28.2], [26, 26.6], [19.6, 20.6]];
    // The coil's spots light from the tail end round to the left; the light
    // then passes behind the coil and climbs the neck.
    const coil = lums.filter(([, y]) => y > 24).length;
    const glowAt = (i: number): Move => {
      const [x, y] = lums[i];
      const at = y < 24 ? 0.44 : 0.08 + (0.28 * lums.filter(([ox, oy]) => oy > 24 && ox > x).length) / Math.max(1, coil - 1);
      const w = pulse(at, 0.24);
      return { at: [X(x), Y(y)], wave: () => (a < 0 ? 0 : Math.round(w(a) * 2) / 2), grow: [0.55, 0.55] };
    };
    parts.push(
      ring(false),
      ...rig([sway], { mat: "fin", prims: [P([[27.4, 18.8], [30.6, 15.2]], 1.4, 0.6), ell(X(29.8), Y(17.8), 1.9 * k, 1.1 * k, -60)], back: true, blend: 1 }),
      ...rig(fan(0), { mat: "fin", prims: spines[0], back: true }),
      ...rig(fan(0.18), { mat: "fin", prims: spines[1], back: true }),
      ...rig([stretch], { mat: "scale", prims: [P(neck, 3, 2.7)], round: 3,
        paint: [{ mat: "belly", level: 4, prims: [P(neck.slice(1).map(([x, y]): V => [x - 1.4, y + 0.6]), 1.1, 1)] }] }),
      ...rig([lift], { mat: "scale", prims: [H(16, 8.4, 6.2, 4.6), H(16, 11.4, 4.2, 2.4)], blend: 2, round: 4 }),
      ...(stage === 0 ? [] : rig([lift], { mat: "gold", prims: [HP([[12.4, 5], [10.8, 2.4], [8.6, 1.2]], 1, 0.5), HP([[19.6, 5], [21.2, 2.4], [23.4, 1.2]], 1, 0.5)] } as Part)),
      ring(true),
      { mat: "lum", glow: true, line: false,
        prims: lums.map(([x, y], i) => {
          const spot = ell(X(x), Y(y), 1.2, 1);
          return y < 24 ? rig([glowAt(i), stretch], spot)[0] : rig([glowAt(i)], spot)[0];
        }) },
    );
    const hx = (x: number) => Math.round(HX(x));
    const hy = (y: number) => Math.round(HY(y));
    decals.push(...rig([lift],
      ...eyes([hx(12.8) - 1, hy(7.6) - 1], [hx(19.2) - 1, hy(7.6) - 1], look, stage === 2 ? "round" : "tall"),
      stamp(hx(14.6) - 1, hy(11.6), ["k..k"], { k: "scale:1" }),
    ));
    if (stage < 2) decals.push(...rig([lift], ...blush([hx(11.2) - 1, hy(10.2)], [hx(20.8) - 1, hy(10.2)])));
    if (stage === 2) {
      decals.push(
        ...twinkle(1, 13, t, 0.15),
        ...twinkle(pose === "sleep" ? 28 : 27, pose === "sleep" ? 9 : 3, t, 0.6),
        ...twinkle(2, 21, t, 0.4, "lum:5"),
      );
    }
    if (pose === "sleep") decals.push(zzz(27, 1));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

// ── Axolittle · common ────────────────────────────────────────────

export const axolittle: Species = {
  id: "axolittle",
  name: "Axolotl",
  element: "tide",
  tier: "common",
  stages: ["Axolittle", "Frillet", "Axolotl"],
  palette: { skin: "#f7b6cb", gill: "#ff5f93", belly: "#ffcfdb" },
  shiny: { skin: "#8f8ce0", gill: "#6ff0c4", belly: "#d8dcff" },
  lore: "Smiles at every sentence, even the sad ones. Regrows a dog-eared corner overnight.",
  hint: "Wears its feathers on its cheeks.",
  // A slow breath, the head rising a beat after the body; the feathery
  // gills ripple open and closed, upper and lower fronds a beat apart, and
  // the tail sways with the wave running out to its tip. Its act is a big
  // smile: eyes squeezed shut, the grin widening, the head lifting while
  // the gills fluff up twice.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const grin = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.66, 0.9)(a));
    const look = grin > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const breath = stepped(rise(1));
    const up: Wave = (u) => Math.max(breath(u - 0.08), Math.round(grin));
    /** Each frond of a gill pair ripples about its root (mirrored), and
     *  fluffs up twice in the grin. */
    const frond = (x0: number, y0: number, x1: number, y1: number, r: number, phase: number, carry: Move[], perk = 10): Prim[] =>
      rig([
        { at: [x0, y0], wave: sine(1, phase), turn: 6 * calm, pair: true },
        { at: [x0, y0], wave: () => grin * rise(4)(a), turn: perk, pair: true },
        ...carry,
      ], ...both(cap(x0, y0, x1, y1, r * 0.55, r)));
    /** The tail sways from its root, the wave running out to the tip. */
    const swish = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.35), turn: 7 * calm, bend: len, lag: 0.3 });
    /** The smile, wider in the grin. */
    const smile = (x: number, y: number, w: number): Decal =>
      grin > 0.4
        ? stamp(x - 1, y, ["k" + ".".repeat(w) + "k", "." + "k".repeat(w) + "."], { k: "gill:1" })
        : stamp(x, y, ["k" + ".".repeat(w - 2) + "k", "." + "k".repeat(w - 2) + "."], { k: "gill:1" });
    if (stage === 0) {
      // One round blob: it swells as it breathes, the gills riding along.
      const swell: Move = { at: [16, 29.5], wave: up, grow: [0.02, 0.08] };
      parts.push(
        { mat: "gill", prims: [...frond(10, 20, 6.8, 17.5, 1.3, 0, [swell]), ...frond(10, 22.5, 6.2, 22.5, 1.2, 0.15, [swell])], blend: 0.5 },
        ...rig([swish([19.5, 27.6], 4)], { mat: "skin", prims: [ell(21.5, 28, 3, 1.5, -20)], back: true }),
        ...rig([swell], { mat: "skin", prims: [ell(16, 23.5, 7.4, 5.8)], round: 8 }),
        { mat: "skin", prims: both(ell(12.5, 29, 1.7, 1.1)) },
      );
      decals.push(...rig([swell],
        ...eyes([11, 21], [19, 21], look, "tall"),
        ...blush([9, 24], [21, 24]),
        smile(14, 24, 4),
      ));
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    const lift: Move = { at: [16, 16], wave: up, shift: [0, -1] };
    if (stage === 1) {
      parts.push(
        ...rig([swish([19, 26], 10)], { mat: "skin", prims: [path([[19, 26], [24, 27.5], [27, 25], [27, 21.5]], 2, 1)],
          paint: [{ mat: "gill", prims: [path([[24, 26], [26.5, 24], [26.5, 21]], 0.7)] }], back: true }),
        { mat: "gill", prims: [...frond(9.5, 14.5, 5.8, 11.5, 1.4, 0, [lift]), ...frond(9, 18.5, 4.5, 18.5, 1.3, 0.2, [lift])], blend: 0.5 },
        { mat: "gill", prims: [...frond(9.5, 16.5, 5, 14.6, 1.3, 0.1, [lift])], blend: 0.5 },
        { mat: "skin", prims: [...rig([lift], ell(16, 17.5, 8, 5.8)), ell(16, 24.5, 5.4, 4.6)], blend: 3, round: 7,
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 25.5, 3.4, 3)] }] },
        { mat: "skin", prims: both(ell(11.5, 28.6, 2, 1.4)) },
        { mat: "skin", prims: both(ell(11, 24.5, 1.2, 1.8, 20)) },
      );
      decals.push(...rig([lift],
        ...eyes([10, 15], [20, 15], look, "tall"),
        ...blush([8, 18], [22, 18]),
        smile(13, 18, 6),
      ));
      if (pose === "sleep") decals.push(zzz(25, 3));
      return { parts, decals, head: [lift], neck: [] };
    }
    parts.push(
      ...rig([swish([19, 25], 14)], { mat: "skin", prims: [path([[19, 25], [25, 28], [29, 25], [29.5, 20], [27.5, 17]], 2.6, 1)],
        paint: [{ mat: "gill", prims: [path([[25, 26.5], [28, 24], [28.2, 19.5], [27, 17.5]], 0.8)] }], back: true }),
      { mat: "gill", prims: [...frond(9, 8, 4.6, 3.6, 1.6, 0, [lift], 0), ...frond(8, 14, 2.6, 14.2, 1.5, 0.2, [lift])], blend: 0.5 },
      { mat: "gill", prims: [...frond(8.4, 11, 3.2, 8.6, 1.5, 0.1, [lift])], blend: 0.5 },
      { mat: "skin", prims: both(ell(10.5, 28.8, 2.6, 1.5)), back: true },
      { mat: "skin", prims: [...rig([lift], ell(16, 12, 9.4, 6.4)), ell(16, 22, 6.4, 6)], blend: 3, round: 8,
        paint: [{ mat: "belly", level: 4, prims: [ell(16, 23.5, 4.2, 4)] }] },
      { mat: "skin", prims: both(ell(9.6, 23.5, 1.6, 2.4, 25)) },
    );
    decals.push(...rig([lift],
      ...eyes([9, 10], [21, 10], look, "round"),
      ...blush([8, 13], [22, 13]),
      smile(12, 13, 8),
    ));
    if (pose === "sleep") decals.push(zzz(14, 0));
    return { parts, decals, head: [lift], neck: [] };
  },
};

// ── Otterpop · common ─────────────────────────────────────────────

export const otterpop: Species = {
  id: "otterpop",
  name: "Driftotter",
  element: "tide",
  tier: "common",
  stages: ["Otterpop", "Floatter", "Driftotter"],
  palette: { fur: "#b98a64", face: "#f3e2c6", book: "#ef6f5e", water: "#6fcde6" },
  shiny: { fur: "#8fa2dc", face: "#fbf1ff", book: "#ffc85a", water: "#8ff0d0" },
  lore: "Reads floating on its back with the book propped on its belly. Holds paws with a friend so neither drifts off mid-chapter.",
  hint: "Its tummy is a table.",
  // It bobs on the swell: the body rides up a pixel and back, the head
  // following a beat later, its toes paddling lazily, the ripple round it
  // spreading as it settles. Its act turns the page: a paw lifts the
  // corner and the page swings over the spine and lands on the left.
  motion: { idle: 3.6, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    /** The page's swing over the spine, 0 → 1. */
    const turn = a < 0 ? 0 : ease(0.3, 0.62)(a);
    /** The right paw lifts the corner and follows it over. */
    const reach = a < 0 ? 0 : ease(0.16, 0.3)(a) * (1 - ease(0.5, 0.68)(a));
    const calm = pose === "sleep" ? 0.5 : 1;
    const bobW = stepped(rise(1));
    const float: Move = { at: [16, 16], wave: bobW, shift: [0, -1] };
    const floatHead: Move = { at: [16, 16], wave: (u) => bobW(u - 0.1), shift: [0, -1] };
    // Seen from above, floating belly-up: authored at adult size around the
    // waterline, the younger stages are smaller copies with rounder bodies.
    const k = [0.64, 0.8, 1][stage];
    const X = (x: number) => 16 + (x - 16) * k;
    const Y = (y: number) => 25 + (y - 25) * k;
    const E = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(X(x), Y(y), rx * k, ry * k, rot);
    /** The ripple spreads a little as the otter settles into the water. */
    const spread: Move = { at: [16, Y(24.4)], wave: (u) => 1 - bobW(u - 0.05), grow: [0, 0.12] };
    // Ripple ring around the body: far half behind, near half in front.
    const ring = (front: boolean): Part => ({
      mat: "water",
      prims: [path(arc(16, Y(24.4), 13.2 * k + 1, 3.2 * k + 0.4, front ? 0 : 180, front ? 180 : 360, 14), 0.8)],
      round: 4, back: !front, move: [spread],
    });
    // The open book: a cover part, white pages stamped crisp on top.
    const pages: Record<number, { y: number; rows: string[] }> = {
      0: { y: 23, rows: ["ww.ww", "wl.lw"] },
      1: { y: 19, rows: ["www.www", "wlw.wlw", "www.www"] },
      2: { y: 18, rows: ["wwww.wwww", "wllw.wllw", "wwww.wwww", "wlww.wwlw"] },
    };
    const pg = pages[stage];
    const pw = pg.rows[0].length;
    const px0 = 16 - (pw - 1) / 2 - 0.5;
    const cover: Part = {
      mat: "book",
      prims: [poly([[px0 - 0.4, pg.y - 0.3], [px0 + pw + 0.4, pg.y - 0.3], [px0 + pw + 0.4, pg.y + pg.rows.length + 0.3], [px0 - 0.4, pg.y + pg.rows.length + 0.3]], 0.4)],
      round: 2,
    };
    const head = stage === 0 ? ell(16, 18.6, 6, 5) : E(16, 11, 6.2, 5.2);
    const body = stage === 0 ? ell(16, 23, 6.4, 4.4) : E(16, 20.6, 8.6, 6);
    const face = stage === 0 ? [ell(16, 19, 4.6, 3.6)] : [E(16, 11.6, 5, 4.2), E(16, 16.2, 3.4, 1.8)];
    const muzzle = stage === 0 ? [ell(15, 20.8, 1.3, 1), ell(17, 20.8, 1.3, 1)] : [E(14.8, 14, 1.6, 1.1), E(17.2, 14, 1.6, 1.1)];
    /** Toes paddle lazily, mirrored, a beat apart from the bob. */
    const paddle: Move = { at: [X(13), Y(24.4)], wave: sine(1, 0.4), turn: 8 * calm, pair: true };
    const paw = (x: number, right: boolean): Prim => {
      const p = ell(x, pg.y + 1.2, 1.7 * k + 0.2, 1.5 * k + 0.2);
      return right ? rig([{ at: [x, pg.y], wave: () => reach, shift: [-1, -1] }], p)[0] : p;
    };
    parts.push(
      ring(false),
      ...rig([floatHead], { mat: "fur", prims: stage === 0 ? both(ell(11, 15, 1, 1)) : [E(10.4, 7.2, 1.6, 1.5), E(21.6, 7.2, 1.6, 1.5)], round: 3 }),
      { mat: "fur", prims: [...rig([floatHead], head), ...rig([float], body)], blend: 3, round: 9 * k,
        paint: [{ mat: "face", level: 4, prims: rig([floatHead], ...face) }, { mat: "face", level: 5, prims: rig([floatHead], ...muzzle) }] },
      ...rig([paddle, float], { mat: "fur", prims: [E(11.4, 25.4, 2.2, 1.7, 20), E(20.6, 25.4, 2.2, 1.7, -20)],
        paint: [{ mat: "face", prims: [E(11.2, 25, 1.1, 0.8, 20), E(20.8, 25, 1.1, 0.8, -20)] }] }),
      ...rig([float], cover),
      ...rig([float], { mat: "fur", prims: [paw(px0 - 0.6, false), paw(px0 + pw + 0.6, true)], round: 3 }),
      ring(true),
    );
    // The pages: mid-act the right-hand page swings over the spine, its
    // width foreshortening to nothing at the top of the swing, lifted a
    // pixel off the book, and lands on the left with its back to us.
    const h = (pw - 1) / 2;
    const bx = Math.round(px0);
    if (turn <= 0 || turn >= 1) {
      decals.push(...rig([float], stamp(bx, pg.y, pg.rows, { w: "white:4", l: "white:2" })));
    } else {
      const w = Math.round(h * Math.abs(Math.cos(Math.PI * turn)));
      const left = turn > 0.5;
      // The spread under the swinging page: the half it has left shows its
      // next page, the half it is landing on still shows the old one.
      decals.push(...rig([float], stamp(bx, pg.y, pg.rows, { w: "white:4", l: "white:2" })));
      if (w > 0) {
        const lift = turn > 0.2 && turn < 0.8 ? 1 : 0;
        const rows = pg.rows.map(() => "p".repeat(w));
        const x = left ? bx + h - w : bx + h + 1;
        decals.push(...rig([float], stamp(x, pg.y - lift, rows, { p: left ? "white:3" : "white:5" }, true)));
      }
    }
    if (stage === 0) {
      decals.push(...rig([floatHead],
        ...eyes([12, 16], [18, 16], pose, "tall"),
        ...blush([11, 19], [19, 19]),
        stamp(15, 19, ["kk"], { k: "fur:1" }),
      ));
    } else if (stage === 1) {
      decals.push(...rig([floatHead],
        ...eyes([12, 11], [18, 11], pose, "tall"),
        ...blush([11, 14], [19, 14]),
        stamp(15, 14, ["kk"], { k: "fur:1" }),
      ));
    } else {
      decals.push(...rig([floatHead],
        ...eyes([12, 9], [18, 9], pose, "round"),
        ...blush([10, 12], [20, 12]),
        stamp(15, 12, ["kk"], { k: "fur:1" }),
      ));
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: [floatHead], neck: [floatHead] };
  },
};

// ── Nautilus · rare ───────────────────────────────────────────────

/** Points along a spiral winding inward from radius r0 to r1. */
function spiral(cx: number, cy: number, r0: number, r1: number, a0: number, turns: number, n = 24): V[] {
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((a0 + 360 * turns * t) * Math.PI) / 180;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export const nautilus: Species = {
  id: "nautilus",
  name: "Nautilord",
  element: "tide",
  tier: "rare",
  stages: ["Curlet", "Nautilet", "Nautilord"],
  palette: { shell: "#f3e3c4", stripe: "#d8744a", skin: "#f0a88c", pearl: "#ecd6f2", gold: "#f5bf55" },
  shiny: { shell: "#cfe9ff", stripe: "#6a78e0", skin: "#9fe0a8", pearl: "#ffd6ea", gold: "#8ff0ec" },
  lore: "Adds a chamber to its shell for every book it finishes, and keeps the best lines sealed inside. Hold it to your ear to hear chapter one.",
  hint: "A library that coils inward.",
  // It hangs in the water on a slow swell, the shell rising a pixel and
  // the soft body following a beat later, its tentacles waving with the
  // wave running out to their curled tips, each a little behind the last;
  // the adult's core glows softly. Its act is a shy tuck: eyes closed, it
  // draws its face and tentacles into the shell, a bubble rises from the
  // opening, and it peeks back out.
  motion: { idle: 3.6, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const tuck = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.62, 0.88)(a));
    const look = tuck > 0.3 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const swell = stepped(rise(1));
    const hover: Move = { at: [16, 16], wave: swell, shift: [0, -1] };
    /** The soft body follows the shell a beat later, and draws in toward
     *  the shell's mouth in the tuck. */
    const follow: Move = { at: [16, 16], wave: (u) => swell(u - 0.1), shift: [0, -1] };
    const draw: Move = { at: [16, 16], wave: () => Math.round(tuck), shift: [1, 1] };
    const soft = [draw, follow];
    // A fringe of curling tentacles under the face. Alternate ones go in two
    // parts so each casts a thin line on its neighbour; shaded flat. Each
    // waves from its root, a beat behind its neighbour, and curls up short
    // in the tuck.
    const tentacles = (x0: number, x1: number, y: number, len: number, n: number, r: number): Part[] => {
      const sets: Prim[][] = [[], []];
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * i) / (n - 1);
        const side = i < (n - 1) / 2 ? -1 : i > (n - 1) / 2 ? 1 : 0;
        const curl = side === 0 ? (i % 2 ? 1 : -1) : side;
        sets[i % 2].push(...rig([
          { at: [x, y], wave: sine(1, 0.13 * i), turn: 8 * calm, bend: len, lag: 0.3 },
          { at: [x, y], wave: () => Math.round(tuck * 2) / 2, grow: [0, -0.4] },
          ...soft,
        ], path([[x, y], [x + side * 0.6, y + len * 0.6], [x + side * 0.6 + curl * 0.9, y + len], [x + side * 0.6 + curl * 1.8, y + len - 0.7]], r, r * 0.75)));
      }
      return sets.map((prims) => ({ mat: "skin", prims, blend: 0.5, round: 1.4 }));
    };
    /** Mid-tuck a bubble rises from the shell's mouth. */
    const bubbleUp = (x: number, y: number) => {
      const f = a < 0 ? -1 : (a - 0.3) / 0.4;
      if (f >= 0 && f < 1) decals.push(f < 0.15 || f > 0.85 ? stamp(x + 1, y - Math.round(6 * f) + 1, ["b"], { b: "pearl:5" }, true) : bubble(x, y - Math.round(6 * f), "pearl:5"));
    };
    if (stage === 0) {
      parts.push(
        ...rig([hover], { mat: "shell", prims: [ell(18.5, 20.5, 6.4, 6)],
          paint: [{ mat: "stripe", prims: [path(spiral(19.6, 20.2, 3.8, 0.6, 200, 1, 20), 0.55)] }] }),
        ...tentacles(10.5, 17, 25.5, 3, 4, 0.9),
        ...rig(soft, { mat: "skin", prims: [ell(13.8, 23.4, 4.8, 3.8)], round: 6,
          paint: [{ mat: "stripe", prims: [ell(13.8, 20, 5, 1.7)] }] }),
      );
      decals.push(...rig(soft,
        ...eyes([11, 22], [15, 22], look, "tall"),
        ...blush([10, 25], [16, 25], 1),
      ));
      bubbleUp(15, 15);
    } else if (stage === 1) {
      const stripes = [200, 228, 256, 284, 312, 340].map((a) => {
        const r = (a * Math.PI) / 180;
        return path([[19 + 8.6 * Math.cos(r), 16.5 + 8.2 * Math.sin(r)], [19 + 6.6 * Math.cos(r + 0.12), 16.5 + 6.3 * Math.sin(r + 0.12)]], 0.75, 0.4);
      });
      parts.push(
        ...rig([hover], { mat: "shell", prims: [ell(19, 16.5, 8.8, 8.4)],
          paint: [
            { mat: "stripe", prims: stripes },
            { mat: "stripe", prims: [path(spiral(20, 16.4, 4.6, 0.6, 180, 1.1, 28), 0.55)] },
          ] }),
        ...tentacles(8, 17, 24.5, 4, 5, 1),
        ...rig(soft, { mat: "skin", prims: [ell(12.6, 21.3, 5.6, 4.4)], round: 6,
          paint: [{ mat: "stripe", prims: [ell(12.6, 17.6, 6, 2)] }] }),
      );
      decals.push(...rig(soft,
        ...eyes([9, 20], [14, 20], look, "tall"),
        ...blush([8, 23], [15, 23], 1),
      ));
      bubbleUp(9, 11);
    } else {
      const ridges = [210, 245, 280, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return path([[19.5 + 11 * Math.cos(r), 12.5 + 10.4 * Math.sin(r)], [19.5 + 8.4 * Math.cos(r + 0.14), 12.5 + 8 * Math.sin(r + 0.14)]], 0.6, 0.4);
      });
      /** The core glows a little brighter now and then. */
      const core: Move = { at: [20.8, 12.2], wave: stepped(rise(1, 0.3)), grow: [0.25, 0.25] };
      parts.push(
        ...rig([hover], { mat: "pearl", prims: [ell(19.5, 12.5, 11, 10.4)], round: 9,
          paint: [
            { mat: "gold", prims: ridges },
            { mat: "gold", prims: [path(spiral(20.5, 12.3, 7.6, 2, 170, 1.05, 34), 0.75)] },
          ] }),
        ...rig([core, hover], { mat: "gold", prims: [ell(20.8, 12.2, 2)], glow: true, line: false }),
        ...tentacles(5.5, 17, 24.8, 4, 7, 0.95),
        ...rig(soft, { mat: "skin", prims: [ell(11.4, 20.3, 6.6, 5)], round: 7,
          paint: [{ mat: "stripe", prims: [ell(11.4, 16.2, 7, 2.3)] }] }),
      );
      decals.push(
        ...rig(soft, ...eyes([7, 19], [13, 19], look, "round"), ...blush([6, 22], [14, 22], 1)),
        ...rig([hover], stamp(14, 6, ["w.", ".w"], { w: "white:4" }), stamp(27, 18, ["w"], { w: "pearl:5" })),
      );
      bubbleUp(7, 9);
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(2, 4) : zzz(25, 3));
    return { parts, decals, head: soft, neck: soft };
  },
};

// ── Hippocamp · rare ──────────────────────────────────────────────

export const hippocamp: Species = {
  id: "hippocamp",
  name: "Hippocamp",
  element: "tide",
  tier: "rare",
  stages: ["Foamfoal", "Surfcolt", "Hippocamp"],
  palette: { hide: "#86d6c4", fin: "#ff96ae", belly: "#d4f3e2" },
  shiny: { hide: "#f2c46c", fin: "#86a8ff", belly: "#fff6dc" },
  lore: "Gallops the surf between lighthouses delivering overdue books. Never late: the tide waits for it.",
  hint: "Half a horse, all of it wet.",
  // A slow breath lifts the head a beat after the chest, the neck drawing
  // up with it; the fin mane ripples from the crown down the neck, the
  // raised foreleg paddles and the tail fluke fans. Its act is a prance in
  // the surf: the head tosses up with the mane streaming, and the raised
  // hoof paws the water twice before it settles.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const toss = a < 0 ? 0 : ease(0.08, 0.3)(a) * (1 - ease(0.66, 0.9)(a));
    const calm = pose === "sleep" ? 0.5 : 1;
    // Rearing pose, authored at adult size; younger stages are smaller copies
    // with a bigger head (foals are mostly head).
    const k = [0.6, 0.8, 1][stage];
    const X = (x: number) => 16 + (x - 16) * k;
    const Y = (y: number) => 28 + (y - 28) * k;
    const E = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(X(x), Y(y), rx * k, ry * k, rot);
    const P = (pts: V[], r0: number, r1: number) => path(pts.map(([x, y]): V => [X(x), Y(y)]), r0 * k, r1 * k);
    const hs = [1.4, 1.12, 1][stage];
    // Head space: ¾ view, muzzle reaching down-left.
    const HX = (x: number) => X(14) + (x - 14) * k * hs;
    const HY = (y: number) => Y(8) + (y - 8) * k * hs + (hs - 1) * 3;
    const H = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(HX(x), HY(y), rx * k * hs, ry * k * hs, rot);
    const HC = (ax: number, ay: number, bx: number, by: number, ra: number, rb: number) =>
      cap(HX(ax), HY(ay), HX(bx), HY(by), ra * k * hs, rb * k * hs);
    const breath = stepped(rise(1));
    const up: Wave = (u) => Math.max(breath(u - 0.08), Math.round(toss));
    /** The head rises a pixel; the neck stretches up to carry it. */
    const lift: Move = { at: [16, 16], wave: up, shift: [0, -1] };
    const neckTop = Y(9), neckBase = Y(13.5);
    const stretch: Move = { at: [X(15.8), neckBase], wave: up, grow: [0, 1 / (neckBase - neckTop + 1)] };
    /** The mane ripples from the crown, the wave running down the neck;
     *  in the toss it streams back. */
    const mane: Move[] = [
      { at: [HX(16), HY(3)], wave: sine(1, 0.2), turn: 6 * calm, bend: 12 * k, lag: 0.3 },
      { at: [HX(16), HY(3)], wave: () => toss, turn: 8, bend: 12 * k },
    ];
    /** The raised foreleg paddles from the shoulder; it paws twice in the
     *  prance. */
    const paddle: Move[] = [
      { at: [X(12.6), Y(16.5)], wave: sine(1, 0.45), turn: 6 * calm },
      { at: [X(12.6), Y(16.5)], wave: () => toss * rise(4)(a), turn: 14 },
    ];
    /** The tail fluke fans from the tail's tip. */
    const fan: Move = { at: [X(26), Y(19.4)], wave: sine(1, 0.6), turn: 8 * calm };
    // Flipper hoof: a small fan flaring from the leg's end.
    const hoof = (x: number, y: number, rot: number): Prim[] => [E(x, y, 2.3, 1.2, rot), E(x + 0.3, y - 0.5, 1.2, 1, rot)];
    const tail: V[] = [[16, 17], [18.4, 22], [21.5, 25.6], [25, 26.4], [27.6, 24.2], [27.6, 21], [26, 19.4]];
    const maneHead = [H(17.4, 4.6, 1.8, 2.6, 30), H(19, 8, 1.8, 2.6, 45)];
    parts.push(
      // Tail fluke, and fins along the tail's back.
      ...rig([fan], { mat: "fin", prims: [E(24.2, 17.6, 2.5, 1.2, -50), E(27.6, 16.8, 2.5, 1.2, 60)], blend: 1 }),
      { mat: "fin", prims: stage === 0 ? [] : [P([[20.5, 17.5], [23.5, 20.5], [25, 23.5]], 1.4, 0.7)], back: true },
      // Mane: a fin crest from the crown down the neck.
      { mat: "fin", prims: [...rig([...mane, lift], ...maneHead), ...rig(mane, P([[18.8, 11], [20, 14.5]], 1.8, 1))].slice(0, stage === 0 ? 2 : 3), blend: 1 },
      // Far foreleg, tucked.
      { mat: "hide", prims: [P([[15.5, 18.5], [13.6, 21], [14, 23.4]], 1.5, 1.2)], back: true },
      { mat: "fin", prims: hoof(14, 24.4, 0), back: true },
      // Neck, chest and the fish tail sweeping down and curling up.
      { mat: "hide", prims: [...rig([stretch], P([[16, 9], [15.8, 13]], 3, 3.6)), E(15.4, 16.4, 4.6, 4.4), P(tail, 3.6, 1)], blend: 2.5, round: 5,
        paint: [{ mat: "belly", level: 4, prims: [P([[15, 21], [17.6, 24.4], [21, 27.2]], 1.3, 0.7)] }] },
      // Near foreleg raised and bent.
      ...rig(paddle, { mat: "hide", prims: [P([[12.6, 16.5], [9.6, 18.6], [9.2, 21.6]], 1.8, 1.4)] }),
      ...rig(paddle, { mat: "fin", prims: hoof(9, 23, -10) }),
      // Head: skull and a long muzzle, pale nose.
      ...rig([lift], { mat: "hide", prims: [H(14.6, 6.4, 4.2, 3.8), HC(13.6, 8, 9.6, 11.6, 2.6, 2.3)], blend: 2, round: 5,
        paint: [{ mat: "belly", level: 4, prims: [H(9.4, 11.8, 2.4, 2, -40)] }] }),
      // The adult's ears already touch the top: as the head rises they
      // ease back into the mane instead of rising with it.
      ...rig(stage === 2 ? [lift, { ...lift, shift: [0, 1] }] : [lift], { mat: "hide", prims: [H(13.4, 2.4, 1, 1.9, -15), H(17, 2.8, 1, 1.9, 25)] }),
    );
    const hx = (x: number) => Math.round(HX(x));
    const hy = (y: number) => Math.round(HY(y));
    const style = stage === 2 ? "round" : "tall";
    decals.push(...rig([lift],
      ...eyes([hx(12.2) - 1, hy(6) - 1], [hx(16.4) - 1, hy(6) - 1], pose, style),
      stamp(hx(9.4), hy(11.2), ["k"], { k: "hide:1" }),
    ));
    if (stage < 2) decals.push(...rig([lift], ...blush([hx(12.2) - 1, hy(8.4)], [hx(16.6) - 1, hy(8.4)], 1)));
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: [lift], neck: [lift] };
  },
};

// ── Kraken · epic ─────────────────────────────────────────────────

/** A tentacle path that bends more and more toward its tip, so it ends in a
 *  curl. Heading in degrees (0 = right, 90 = down); `bend` is the total
 *  turn in degrees, positive = clockwise on screen. */
function curl(x: number, y: number, heading: number, len: number, bend: number, n = 14): V[] {
  const pts: V[] = [[x, y]];
  let h = heading;
  const step = len / n;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    h += (bend * 2 * t) / n;
    x += Math.cos((h * Math.PI) / 180) * step;
    y += Math.sin((h * Math.PI) / 180) * step;
    pts.push([x, y]);
  }
  return pts;
}

export const kraken: Species = {
  id: "kraken",
  name: "Kraken",
  element: "tide",
  tier: "epic",
  stages: ["Inklet", "Squidling", "Kraken"],
  palette: { skin: "#e8727f", sucker: "#ffd8c4", lum: "#8ff4ff", crest: "#9a7ce8" },
  shiny: { skin: "#5f82e6", sucker: "#dce6ff", lum: "#ffe070", crest: "#f07aa8" },
  lore: "Reads eight books at once, one per arm, and somehow follows every plot. Ink blots in the margins are how it takes notes.",
  hint: "Too many arms to hold just one book.",
  // The mantle swells on a slow breath while every arm ripples from its
  // root, the wave running out to the curled tips, each pair a beat behind
  // the last, so the arms never move together; the adult's fins drift.
  // Its act takes a note: eyes shut, the mantle squeezes and the arms draw
  // in, and a small ink blot puffs out and drifts away, fading.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const squeeze = a < 0 ? 0 : ease(0.1, 0.3)(a) * (1 - ease(0.5, 0.78)(a));
    const look = squeeze > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const breath = stepped(rise(1));
    type Arm = [number, number, number, number, number, number]; // x, y, heading, len, bend, r0
    // A set of mirrored arm pairs as one part; the curled tips are painted
    // in the pale sucker color (the underside showing as the arm rolls up).
    // Each pair ripples from its root, a beat behind the pair before, and
    // draws in toward the body in the squeeze.
    let nth = 0;
    const arms = (list: Arm[], back = false): Part => {
      const prims: Prim[] = [];
      const tips: Prim[] = [];
      for (const [x, y, h, len, bend, r0] of list) {
        const ms: Move[] = [
          { at: [x, y], wave: sine(1, 0.17 * nth++), turn: 7 * calm, bend: len * 0.8, lag: 0.3, pair: true },
          { at: [x, y], wave: () => Math.round(squeeze * 2) / 2, turn: -7, bend: len * 0.6, pair: true },
        ];
        for (const [ax, ah, ab] of [[x, h, bend], [32 - x, 180 - h, -bend]]) {
          const pts = curl(ax, y, ah, len, ab, 20);
          prims.push(rig(ms, path(pts, r0, 0.6))[0]);
          tips.push(rig(ms, path(pts.slice(13), Math.max(0.6, r0 * 0.45), 0.5))[0]);
        }
      }
      return { mat: "skin", prims, blend: 0.5, round: 2, back, paint: [{ mat: "sucker", level: 4, prims: tips }] };
    };
    /** The mantle swells about its base on the breath, and squeezes
     *  narrower and taller to puff the ink. */
    const mantle = (base: number, h: number): Move[] => [
      { at: [16, base], wave: (u) => (squeeze > 0.25 ? 0 : breath(u - 0.08)), grow: [0.02, 1 / h] },
      { at: [16, base], wave: () => Math.round(squeeze * 2) / 2, grow: [-0.08, 1 / h] },
    ];
    /** The ink blot: it puffs out mid-squeeze, then drifts off and fades. */
    const ink = (x: number, y: number) => {
      const f = a < 0 ? -1 : (a - 0.36) / 0.5;
      if (f < 0 || f >= 1) return;
      const rows = f < 0.1 || f > 0.92 ? ["k"] : f < 0.25 || f > 0.75 ? ["kk", "kk"] : [".k.", "kkk", ".k."];
      const o = rows.length === 3 ? 0 : rows.length === 2 ? 0 : 1;
      decals.push(stamp(x + o - Math.round(2 * f), y + o + Math.round(3 * f), rows, { k: "crest:1" }, true));
    };
    if (stage === 0) {
      const body = mantle(24, 10.4);
      parts.push(
        arms([[12.2, 21.4, 112, 6.4, 120, 1.25]], true),
        arms([[14.6, 22, 92, 5.6, 110, 1.25]]),
        ...rig(body, { mat: "skin", prims: [egg(16, 18.8, 5.8, 5.2, 0.2)], round: 7 }),
        ...rig(body, { mat: "lum", prims: [ell(16, 15.4, 1, 0.9)], glow: true, line: false }),
      );
      decals.push(...rig(body,
        ...eyes([12, 18], [18, 18], look, "tall"),
        ...blush([11, 21], [19, 21]),
        stamp(15, 21, ["kk"], { k: "crest:1" }),
      ));
      ink(5, 22);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: body, neck: body };
    } else if (stage === 1) {
      const body = mantle(21, 14);
      parts.push(
        arms([[11.2, 18.5, 175, 10, 240, 1.5]], true),
        arms([[13.2, 20.5, 125, 9, 210, 1.5], [15, 21, 97, 7, -160, 1.4]]),
        ...rig(body, { mat: "skin", prims: [egg(16, 14, 6.4, 7, 0.25)], round: 7,
          paint: [{ mat: "crest", prims: [ell(16, 7.4, 3.6, 2.2)] }] }),
        ...rig(body, { mat: "lum", prims: [ell(12.6, 11, 0.9), ell(19.4, 11, 0.9)], glow: true, line: false }),
      );
      decals.push(...rig(body,
        ...eyes([12, 14], [18, 14], look, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 18, ["kk"], { k: "crest:1" }),
      ));
      ink(3, 23);
      if (pose === "sleep") decals.push(zzz(25, 2));
      return { parts, decals, head: body, neck: body };
    }
    // The adult's crest already touches the top, so its mantle swells
    // downward from there.
    const body = mantle(1.4, 16.4);
    /** The fins drift open and closed, a beat behind the breath. */
    const fins: Move = { at: [16, 8], wave: sine(1, 0.3), turn: 6 * calm, pair: true };
    parts.push(
      // Side arms sweep out wide and curl up; front arms curl below.
      arms([[10.5, 16, 178, 15, 250, 1.9]], true),
      arms([[12.4, 18, 128, 13, 215, 1.9], [14.8, 18.5, 97, 10, -170, 1.8]]),
      // Mantle: a tall dome with fins and a crest.
      ...rig([fins, ...body], { mat: "crest", prims: [ell(9.8, 5.6, 1.6, 3, -35), ell(22.2, 5.6, 1.6, 3, 35)], back: true }),
      ...rig(body, { mat: "skin", prims: [egg(16, 9.6, 7.2, 8.2, 0.25)], round: 8,
        paint: [{ mat: "crest", prims: [ell(16, 2, 4.2, 2.6)] }] }),
      ...rig(body, { mat: "lum", prims: [ell(16, 5.4, 1.2), ell(11.8, 7.8, 0.9), ell(20.2, 7.8, 0.9)], glow: true, line: false }),
    );
    decals.push(
      ...rig(body, ...eyes([12, 11], [18, 11], look, "round"), stamp(15, 14, ["kk"], { k: "crest:1" }), ...blush([10, 13], [20, 13])),
      ...twinkle(27, 1, t, 0.45, "lum:5"),
    );
    ink(2, 21);
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals, head: body, neck: body };
  },
};

export const TIDE: Species[] = [bubblet, kappa, axolittle, otterpop, selkie, nautilus, hippocamp, narwhal, kraken, leviathan];
