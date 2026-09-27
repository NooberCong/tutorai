import type { Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
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
      parts.push(
        { mat: "tent", prims: [thin(14, 22, 26.5, 0.6), thin(18, 22, 26.5, -0.6)], round: 1.2 },
        bell(16, 18.6, 6.6, 5.8, 22.4, 5, 1.3),
      );
      decals.push(
        stamp(12, 14, ["ww", "w."], { w: "white:4" }),
        ...eyes([12, 17], [18, 17], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(15, 20, ["kk"], { k: "tent:1" }),
        bubble(24, 11, "jelly:4"),
        bubble(6, 9, "jelly:4"),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "jelly", prims: [thin(10.5, 18, 26, 0.7), thin(21.5, 18, 26, -0.7)], back: true, round: 1.2 },
        { mat: "tent", prims: [ribbon(13.6, 18, 27.5, 0.9, 1.5), ribbon(18.4, 18, 27.5, 0.9, 1.5)], blend: 0.4, round: 1.8 },
        bell(16, 13.6, 8.4, 7.2, 18.6, 6, 1.5),
        { mat: "glow", prims: [ell(16, 8.6, 2.4, 1.6)], glow: true, line: false },
      );
      decals.push(
        stamp(10, 9, ["ww", "w."], { w: "white:4" }),
        ...eyes([12, 13], [18, 13], pose, "tall"),
        ...blush([10, 16], [20, 16]),
        stamp(15, 16, ["kk"], { k: "tent:1" }),
        bubble(4, 5, "jelly:4"),
      );
    } else {
      parts.push(
        { mat: "jelly", prims: [thin(6.5, 15, 27, 0.8), thin(10, 16, 29, -0.8), thin(22, 16, 29, 0.8), thin(25.5, 15, 27, -0.8)], back: true, round: 1.2 },
        { mat: "tent", prims: [ribbon(12.8, 15, 30, 1.1, 1.8), ribbon(19.2, 15, 30, 1.1, 1.8)], blend: 0.4, round: 2 },
        bell(16, 10.4, 11.4, 8.6, 15.6, 8, 1.7),
        { mat: "glow", prims: [ell(16, 5.4, 3.4, 2.2)], glow: true, line: false },
      );
      decals.push(
        stamp(7, 6, ["ww", "w."], { w: "white:4" }),
        ...eyes([12, 10], [18, 10], pose, "tall"),
        ...blush([9, 13], [21, 13]),
        stamp(15, 13, ["kk"], { k: "tent:1" }),
        bubble(2, 2, "jelly:4"),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 0));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // The head-dish: a pale rim holding water, ringed by a bowl-cut fringe.
    const crown = (cy: number, rx: number, ry: number): Part[] => [
      { mat: "cuke", prims: [ell(16, cy + 0.5, rx + 1.1, ry + 0.8)], round: 3 },
      { mat: "dish", prims: [ell(16, cy, rx, ry)], round: 3,
        paint: [{ mat: "water", prims: [ell(16, cy + ry * 0.25, rx - 1, ry * 0.6)] }] },
    ];
    if (stage === 0) {
      parts.push(
        { mat: "skin", prims: both(ell(12.2, 29, 1.9, 1.2, -15)), back: true },
        { mat: "skin", prims: [ell(16, 23, 7.2, 6)], round: 4 },
        ...crown(17.8, 3.2, 1.2),
        { mat: "beak", prims: [ell(16, 25.6, 1.8, 1)], round: 2 },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 24], [20, 24]),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "shell", prims: [ell(16, 20.4, 9.4, 7.4)], round: 4,
          paint: [{ mat: "shell", level: 4, prims: [ell(16, 20.4, 9.4, 7.4)], cut: [ell(16, 21, 8.2, 6.4)] }] },
        { mat: "skin", prims: both(ell(12.5, 29.2, 2.4, 1.4)), back: true },
        { mat: "skin", prims: [ell(16, 15.6, 7.6, 6), ell(16, 24, 5.4, 4.8)], blend: 2, round: 4,
          paint: [{ mat: "beak", prims: [ell(16, 24.8, 3.4, 3.4)] }] },
        { mat: "skin", prims: both(ell(9.8, 23.5, 1.4, 2.2, 20)), round: 2 },
        ...crown(10.4, 3.6, 1.3),
        { mat: "beak", prims: [ell(16, 19, 2.2, 1.1)], round: 2 },
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 24, ["kk", "..", "kk"], { k: "beak:2" }),
      );
    } else {
      parts.push(
        { mat: "shell", prims: [ell(16, 21.4, 10, 7)], round: 4,
          paint: [{ mat: "shell", level: 4, prims: [ell(16, 21.4, 10, 7)], cut: [ell(16, 22, 8.6, 5.8)] }] },
        { mat: "skin", prims: both(ell(12, 29.2, 2.8, 1.5)), back: true },
        { mat: "skin", prims: [ell(16, 11.6, 8.6, 6.6), ell(16, 23, 6.2, 5.8)], blend: 2, round: 4,
          paint: [{ mat: "beak", prims: [ell(16, 23.8, 3.8, 4.4)] }] },
        { mat: "skin", prims: [ell(9.4, 22.5, 1.6, 2.5, 20)], round: 2 },
        { mat: "cuke", prims: [cap(20.5, 26.5, 25.6, 16.6, 1.8, 1.6)],
          paint: [{ mat: "dish", level: 4, prims: [ell(25.7, 16.4, 1.4, 1.2)] }] },
        { mat: "skin", prims: [ell(22.2, 22.4, 1.8, 1.7)], round: 2 },
        ...crown(5.4, 4.2, 1.5),
        { mat: "beak", prims: [ell(16, 15.6, 2.6, 1.3)], round: 2 },
      );
      decals.push(
        ...eyes([12, 10], [18, 10], pose, "tall"),
        ...blush([10, 13], [20, 13]),
        stamp(14, 22, ["kkkk", "....", "kkkk"], { k: "beak:2" }),
        stamp(24, 20, ["g", ".", "g"], { g: "cuke:4" }),
        drop(21, 0, "water:4"),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Seal face: a dark button nose over two small whisker puffs (painted).
    const muzzle = (y: number): Decal[] => [
      stamp(15, y, ["kk"], { k: "eye:3" }),
    ];
    if (stage === 0) {
      // Fluffy white pup.
      const fluff = arc(16, 23.5, 6.6, 5.6, 200, 340, 6).map(([x, y]) => ell(x, y, 1.5));
      parts.push(
        { mat: "foam", prims: both(ell(12.5, 29.2, 2.4, 1.1, -12)), back: true },
        { mat: "foam", prims: [ell(16, 24, 7.2, 5.8), ...fluff], blend: 1.2, round: 4,
          paint: [{ mat: "foam", level: 5, prims: [ell(14.6, 25.4, 1.5, 1.1), ell(17.4, 25.4, 1.5, 1.1)] }] },
        { mat: "foam", prims: both(ell(9.6, 26.3, 1.3, 2, 40)), round: 2 },
      );
      decals.push(...eyes([11, 21], [18, 21], pose, "big"), ...muzzle(24), ...blush([9, 25], [22, 25], 1));
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: both(ell(11.8, 29.3, 3.2, 1.2, -15)), back: true },
        { mat: "fur", prims: [ell(16, 15.5, 6, 5.2), ell(16, 23.8, 7.6, 5.6)], blend: 4, round: 4,
          paint: [
            { mat: "fur", level: 4, prims: [ell(16, 25.2, 4.4, 3.6)] },
            { mat: "pelt", prims: [ell(10.2, 21.6, 0.9), ell(21.8, 21, 0.9), ell(20.4, 12.2, 0.8), ell(10.6, 25.8, 0.8), ell(22.6, 25.4, 0.8)] },
            { mat: "foam", level: 4, prims: [ell(14.7, 18.2, 1.3, 1), ell(17.3, 18.2, 1.3, 1)] },
          ] },
        { mat: "fur", prims: both(ell(8.8, 24, 1.6, 3, 40)), round: 2 },
      );
      decals.push(...eyes([12, 14], [18, 14], pose, "tall"), ...muzzle(17), ...blush([10, 17], [20, 17]));
    } else {
      parts.push(
        // The shed sealskin, worn as a hooded cloak.
        { mat: "pelt", prims: [ell(16, 10.4, 8, 7.4), poly([[9, 12], [23, 12], [27.4, 29.4], [4.6, 29.4]], 0.8)], blend: 2, round: 3,
          paint: [{ mat: "pelt", level: 2, prims: [ell(6.8, 24.5, 1.2), ell(25.2, 21.2, 1.1), ell(8.2, 18.2, 1), ell(24.6, 27, 1.2), ell(22.6, 7.6, 1.1), ell(10.2, 5.6, 1)] }] },
        { mat: "fur", prims: both(ell(11.6, 29.3, 3.4, 1.2, -15)), back: true },
        { mat: "fur", prims: [ell(16, 12.4, 6, 5.2), ell(16, 22.6, 7.2, 6.8)], blend: 4, round: 4,
          paint: [
            { mat: "fur", level: 4, prims: [ell(16, 24, 4.6, 4.8)] },
            { mat: "foam", level: 4, prims: [ell(14.7, 15.2, 1.3, 1), ell(17.3, 15.2, 1.3, 1)] },
          ] },
        { mat: "fur", prims: both(ell(9, 23, 1.7, 3.4, 35)), round: 2 },
      );
      decals.push(
        ...eyes([12, 11], [18, 11], pose, "round"),
        ...muzzle(14),
        ...blush([10, 14], [20, 14]),
        stamp(11, 17, ["c........c", ".c.c..c.c.", "....cc...."], { c: "coral:3" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Authored at adult size; younger stages are smaller, rounder copies.
    const k = [0.62, 0.8, 1][stage];
    const X = (x: number) => 15 + (x - 15) * k;
    const Y = (y: number) => 27 + (y - 27) * k;
    const E = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(X(x), Y(y), rx * k, ry * k, rot);
    const P = (pts: V[], r0: number, r1: number) => path(pts.map(([x, y]): V => [X(x), Y(y)]), r0 * k, r1 * k);
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
      { mat: "hide", prims: [E(22, 25.4, 2.8, 1.6, 30)], back: true },
      { mat: "horn", prims: [cap(hx0, hy0, hx1, hy1, stage === 0 ? 1.3 : 1.8 * k + 0.2, 0.6)], glow: true,
        paint: [{ mat: "horn", level: 1, prims: bands }] },
      { mat: "hide", prims: [E(14.5, 19.6, 9.6, 7.2), P([[20, 17.5], [24.6, 13], [26.4, 8.4]], 5, 1.4)], blend: 3, round: 5,
        paint: [
          { mat: "belly", level: 4, prims: [E(13.4, 25.2, 6.4, 2.6)] },
          { mat: "hide", level: 4, prims: stage === 0 ? [] : spots.map(([x, y]) => E(x, y, 0.9, 0.8)) },
        ] },
      fluke(26.6, 6.8, 1.25),
      { mat: "hide", prims: [E(5.6, 22.6, 3, 1.7, -30)], round: 2 },
    );
    const ex = (x: number) => Math.round(X(x));
    const ey = (y: number) => Math.round(Y(y));
    decals.push(
      ...eyes([ex(9.4) - 1, ey(17.4) - 1], [ex(15.4) - 1, ey(17.4) - 1], pose, stage === 2 ? "round" : "tall"),
      ...blush([ex(8) - 1, ey(20)], [ex(17) - 1, ey(20)]),
      stamp(ex(12.4) - 1, ey(20.6), ["k.k", ".k."], { k: "hide:1" }),
    );
    if (stage === 1) decals.push(drop(2, 25), drop(27, 22));
    if (stage === 2) decals.push(drop(1, 26), drop(28, 24), drop(22, 29), sparkle(0, 0, "horn:5"));
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 20 : 25, stage === 2 ? 0 : 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
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
    // The coil ring seen from the front: far half, then near half with the tail.
    const ring = (front: boolean): Part => ({
      mat: "scale",
      prims: [P(arc(16, 25.6, 11.4, 3.4, front ? 0 : 180, front ? 180 : 360, 14), 2.8, 2.8),
        ...(front ? [P([[27.4, 25.6], [29.2, 22], [28.4, 18.6]], 2.8, 1)] : [])],
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
    parts.push(
      ring(false),
      { mat: "fin", prims: [P([[27.4, 18.8], [30.6, 15.2]], 1.4, 0.6), ell(X(29.8), Y(17.8), 1.9 * k, 1.1 * k, -60)], back: true, blend: 1 },
      { mat: "fin", prims: spines[0], back: true },
      { mat: "fin", prims: spines[1], back: true },
      { mat: "scale", prims: [P(neck, 3, 2.7)], round: 3,
        paint: [{ mat: "belly", level: 4, prims: [P(neck.slice(1).map(([x, y]): V => [x - 1.4, y + 0.6]), 1.1, 1)] }] },
      { mat: "scale", prims: [H(16, 8.4, 6.2, 4.6), H(16, 11.4, 4.2, 2.4)], blend: 2, round: 4 },
      ...(stage === 0 ? [] : [{ mat: "gold", prims: [HP([[12.4, 5], [10.8, 2.4], [8.6, 1.2]], 1, 0.5), HP([[19.6, 5], [21.2, 2.4], [23.4, 1.2]], 1, 0.5)] } as Part]),
      ring(true),
      // Bioluminescent spots along the coil and neck.
      { mat: "lum", glow: true, line: false,
        prims: (stage === 0 ? [[9, 27], [23, 27]] : stage === 1 ? [[7.4, 26.8], [12.6, 28.4], [19.4, 28.4], [24.6, 26.8]] : [[6, 26.6], [10.6, 28.2], [16, 28.8], [21.4, 28.2], [26, 26.6], [19.6, 20.6]])
          .map(([x, y]) => ell(X(x), Y(y), 1.2, 1)) },
    );
    const hx = (x: number) => Math.round(HX(x));
    const hy = (y: number) => Math.round(HY(y));
    decals.push(
      ...eyes([hx(12.8) - 1, hy(7.6) - 1], [hx(19.2) - 1, hy(7.6) - 1], pose, stage === 2 ? "round" : "tall"),
      stamp(hx(14.6) - 1, hy(11.6), ["k..k"], { k: "scale:1" }),
    );
    if (stage < 2) decals.push(...blush([hx(11.2) - 1, hy(10.2)], [hx(20.8) - 1, hy(10.2)]));
    if (stage === 2) decals.push(sparkle(1, 13), sparkle(pose === "sleep" ? 28 : 27, pose === "sleep" ? 9 : 3), sparkle(2, 21, "lum:5"));
    if (pose === "sleep") decals.push(zzz(27, 1));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // One frond: a stalk flaring into a club, fanned out from the head's side.
    const frond = (x0: number, y0: number, x1: number, y1: number, r: number): Prim[] =>
      both(cap(x0, y0, x1, y1, r * 0.55, r));
    if (stage === 0) {
      parts.push(
        { mat: "gill", prims: [...frond(10, 20, 6.8, 17.5, 1.3), ...frond(10, 22.5, 6.2, 22.5, 1.2)], blend: 0.5 },
        { mat: "skin", prims: [ell(21.5, 28, 3, 1.5, -20)], back: true },
        { mat: "skin", prims: [ell(16, 23.5, 7.4, 5.8)], round: 8 },
        { mat: "skin", prims: both(ell(12.5, 29, 1.7, 1.1)) },
      );
      decals.push(
        ...eyes([11, 21], [19, 21], pose, "tall"),
        ...blush([9, 24], [21, 24]),
        stamp(14, 24, ["k..k", ".kk."], { k: "gill:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "skin", prims: [path([[19, 26], [24, 27.5], [27, 25], [27, 21.5]], 2, 1)],
          paint: [{ mat: "gill", prims: [path([[24, 26], [26.5, 24], [26.5, 21]], 0.7)] }], back: true },
        { mat: "gill", prims: [...frond(9.5, 14.5, 5.8, 11.5, 1.4), ...frond(9, 18.5, 4.5, 18.5, 1.3)], blend: 0.5 },
        { mat: "gill", prims: [...frond(9.5, 16.5, 5, 14.6, 1.3)], blend: 0.5 },
        { mat: "skin", prims: [ell(16, 17.5, 8, 5.8), ell(16, 24.5, 5.4, 4.6)], blend: 3, round: 7,
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 25.5, 3.4, 3)] }] },
        { mat: "skin", prims: both(ell(11.5, 28.6, 2, 1.4)) },
        { mat: "skin", prims: both(ell(11, 24.5, 1.2, 1.8, 20)) },
      );
      decals.push(
        ...eyes([10, 15], [20, 15], pose, "tall"),
        ...blush([8, 18], [22, 18]),
        stamp(13, 18, ["k....k", ".kkkk."], { k: "gill:1" }),
      );
    } else {
      parts.push(
        { mat: "skin", prims: [path([[19, 25], [25, 28], [29, 25], [29.5, 20], [27.5, 17]], 2.6, 1)],
          paint: [{ mat: "gill", prims: [path([[25, 26.5], [28, 24], [28.2, 19.5], [27, 17.5]], 0.8)] }], back: true },
        { mat: "gill", prims: [...frond(9, 8, 4.6, 3.6, 1.6), ...frond(8, 14, 2.6, 14.2, 1.5)], blend: 0.5 },
        { mat: "gill", prims: [...frond(8.4, 11, 3.2, 8.6, 1.5)], blend: 0.5 },
        { mat: "skin", prims: both(ell(10.5, 28.8, 2.6, 1.5)), back: true },
        { mat: "skin", prims: [ell(16, 12, 9.4, 6.4), ell(16, 22, 6.4, 6)], blend: 3, round: 8,
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 23.5, 4.2, 4)] }] },
        { mat: "skin", prims: both(ell(9.6, 23.5, 1.6, 2.4, 25)) },
      );
      decals.push(
        ...eyes([9, 10], [21, 10], pose, "round"),
        ...blush([8, 13], [22, 13]),
        stamp(12, 13, ["k......k", ".kkkkkk."], { k: "gill:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 14 : 25, stage === 2 ? 0 : 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Seen from above, floating belly-up: authored at adult size around the
    // waterline, the younger stages are smaller copies with rounder bodies.
    const k = [0.64, 0.8, 1][stage];
    const X = (x: number) => 16 + (x - 16) * k;
    const Y = (y: number) => 25 + (y - 25) * k;
    const E = (x: number, y: number, rx: number, ry: number, rot = 0) => ell(X(x), Y(y), rx * k, ry * k, rot);
    // Ripple ring around the body: far half behind, near half in front.
    const ring = (front: boolean): Part => ({
      mat: "water",
      prims: [path(arc(16, Y(24.4), 13.2 * k + 1, 3.2 * k + 0.4, front ? 0 : 180, front ? 180 : 360, 14), 0.8)],
      round: 4, back: !front,
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
    parts.push(
      ring(false),
      { mat: "fur", prims: stage === 0 ? both(ell(11, 15, 1, 1)) : [E(10.4, 7.2, 1.6, 1.5), E(21.6, 7.2, 1.6, 1.5)], round: 3 },
      { mat: "fur", prims: [head, body], blend: 3, round: 9 * k,
        paint: [{ mat: "face", level: 4, prims: face }, { mat: "face", level: 5, prims: muzzle }] },
      { mat: "fur", prims: [E(11.4, 25.4, 2.2, 1.7, 20), E(20.6, 25.4, 2.2, 1.7, -20)],
        paint: [{ mat: "face", prims: [E(11.2, 25, 1.1, 0.8, 20), E(20.8, 25, 1.1, 0.8, -20)] }] },
      cover,
      { mat: "fur", prims: [ell(px0 - 0.6, pg.y + 1.2, 1.7 * k + 0.2, 1.5 * k + 0.2), ell(px0 + pw + 0.6, pg.y + 1.2, 1.7 * k + 0.2, 1.5 * k + 0.2)], round: 3 },
      ring(true),
    );
    decals.push(stamp(Math.round(px0), pg.y, pg.rows, { w: "white:4", l: "white:2" }));
    if (stage === 0) {
      decals.push(
        ...eyes([12, 16], [18, 16], pose, "tall"),
        ...blush([11, 19], [19, 19]),
        stamp(15, 19, ["kk"], { k: "fur:1" }),
      );
    } else if (stage === 1) {
      decals.push(
        ...eyes([12, 11], [18, 11], pose, "tall"),
        ...blush([11, 14], [19, 14]),
        stamp(15, 14, ["kk"], { k: "fur:1" }),
      );
    } else {
      decals.push(
        ...eyes([12, 9], [18, 9], pose, "round"),
        ...blush([10, 12], [20, 12]),
        stamp(15, 12, ["kk"], { k: "fur:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // A fringe of curling tentacles under the face. Alternate ones go in two
    // parts so each casts a thin line on its neighbour; shaded flat.
    const tentacles = (x0: number, x1: number, y: number, len: number, n: number, r: number): Part[] => {
      const sets: Prim[][] = [[], []];
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * i) / (n - 1);
        const side = i < (n - 1) / 2 ? -1 : i > (n - 1) / 2 ? 1 : 0;
        const curl = side === 0 ? (i % 2 ? 1 : -1) : side;
        sets[i % 2].push(path([[x, y], [x + side * 0.6, y + len * 0.6], [x + side * 0.6 + curl * 0.9, y + len], [x + side * 0.6 + curl * 1.8, y + len - 0.7]], r, r * 0.75));
      }
      return sets.map((prims) => ({ mat: "skin", prims, blend: 0.5, round: 1.4 }));
    };
    if (stage === 0) {
      parts.push(
        { mat: "shell", prims: [ell(18.5, 20.5, 6.4, 6)],
          paint: [{ mat: "stripe", prims: [path(spiral(19.6, 20.2, 3.8, 0.6, 200, 1, 20), 0.55)] }] },
        ...tentacles(10.5, 17, 25.5, 3, 4, 0.9),
        { mat: "skin", prims: [ell(13.8, 23.4, 4.8, 3.8)], round: 6,
          paint: [{ mat: "stripe", prims: [ell(13.8, 20, 5, 1.7)] }] },
      );
      decals.push(
        ...eyes([11, 22], [15, 22], pose, "tall"),
        ...blush([10, 25], [16, 25], 1),
      );
    } else if (stage === 1) {
      const stripes = [200, 228, 256, 284, 312, 340].map((a) => {
        const r = (a * Math.PI) / 180;
        return path([[19 + 8.6 * Math.cos(r), 16.5 + 8.2 * Math.sin(r)], [19 + 6.6 * Math.cos(r + 0.12), 16.5 + 6.3 * Math.sin(r + 0.12)]], 0.75, 0.4);
      });
      parts.push(
        { mat: "shell", prims: [ell(19, 16.5, 8.8, 8.4)],
          paint: [
            { mat: "stripe", prims: stripes },
            { mat: "stripe", prims: [path(spiral(20, 16.4, 4.6, 0.6, 180, 1.1, 28), 0.55)] },
          ] },
        ...tentacles(8, 17, 24.5, 4, 5, 1),
        { mat: "skin", prims: [ell(12.6, 21.3, 5.6, 4.4)], round: 6,
          paint: [{ mat: "stripe", prims: [ell(12.6, 17.6, 6, 2)] }] },
      );
      decals.push(
        ...eyes([9, 20], [14, 20], pose, "tall"),
        ...blush([8, 23], [15, 23], 1),
      );
    } else {
      const ridges = [210, 245, 280, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return path([[19.5 + 11 * Math.cos(r), 12.5 + 10.4 * Math.sin(r)], [19.5 + 8.4 * Math.cos(r + 0.14), 12.5 + 8 * Math.sin(r + 0.14)]], 0.6, 0.4);
      });
      parts.push(
        { mat: "pearl", prims: [ell(19.5, 12.5, 11, 10.4)], round: 9,
          paint: [
            { mat: "gold", prims: ridges },
            { mat: "gold", prims: [path(spiral(20.5, 12.3, 7.6, 2, 170, 1.05, 34), 0.75)] },
          ] },
        { mat: "gold", prims: [ell(20.8, 12.2, 2)], glow: true, line: false },
        ...tentacles(5.5, 17, 24.8, 4, 7, 0.95),
        { mat: "skin", prims: [ell(11.4, 20.3, 6.6, 5)], round: 7,
          paint: [{ mat: "stripe", prims: [ell(11.4, 16.2, 7, 2.3)] }] },
      );
      decals.push(
        ...eyes([7, 19], [13, 19], pose, "round"),
        ...blush([6, 22], [14, 22], 1),
        stamp(14, 6, ["w.", ".w"], { w: "white:4" }),
        stamp(27, 18, ["w"], { w: "pearl:5" }),
      );
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(2, 4) : zzz(25, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
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
    // Flipper hoof: a small fan flaring from the leg's end.
    const hoof = (x: number, y: number, rot: number): Prim[] => [E(x, y, 2.3, 1.2, rot), E(x + 0.3, y - 0.5, 1.2, 1, rot)];
    const tail: V[] = [[16, 17], [18.4, 22], [21.5, 25.6], [25, 26.4], [27.6, 24.2], [27.6, 21], [26, 19.4]];
    parts.push(
      // Tail fluke, and fins along the tail's back.
      { mat: "fin", prims: [E(24.2, 17.6, 2.5, 1.2, -50), E(27.6, 16.8, 2.5, 1.2, 60)], blend: 1 },
      { mat: "fin", prims: stage === 0 ? [] : [P([[20.5, 17.5], [23.5, 20.5], [25, 23.5]], 1.4, 0.7)], back: true },
      // Mane: a fin crest from the crown down the neck.
      { mat: "fin", prims: [H(17.4, 4.6, 1.8, 2.6, 30), H(19, 8, 1.8, 2.6, 45), P([[18.8, 11], [20, 14.5]], 1.8, 1)].slice(0, stage === 0 ? 2 : 3), blend: 1 },
      // Far foreleg, tucked.
      { mat: "hide", prims: [P([[15.5, 18.5], [13.6, 21], [14, 23.4]], 1.5, 1.2)], back: true },
      { mat: "fin", prims: hoof(14, 24.4, 0), back: true },
      // Neck, chest and the fish tail sweeping down and curling up.
      { mat: "hide", prims: [P([[16, 9], [15.8, 13]], 3, 3.6), E(15.4, 16.4, 4.6, 4.4), P(tail, 3.6, 1)], blend: 2.5, round: 5,
        paint: [{ mat: "belly", level: 4, prims: [P([[15, 21], [17.6, 24.4], [21, 27.2]], 1.3, 0.7)] }] },
      // Near foreleg raised and bent.
      { mat: "hide", prims: [P([[12.6, 16.5], [9.6, 18.6], [9.2, 21.6]], 1.8, 1.4)] },
      { mat: "fin", prims: hoof(9, 23, -10) },
      // Head: skull and a long muzzle, pale nose.
      { mat: "hide", prims: [H(14.6, 6.4, 4.2, 3.8), HC(13.6, 8, 9.6, 11.6, 2.6, 2.3)], blend: 2, round: 5,
        paint: [{ mat: "belly", level: 4, prims: [H(9.4, 11.8, 2.4, 2, -40)] }] },
      { mat: "hide", prims: [H(13.4, 2.4, 1, 1.9, -15), H(17, 2.8, 1, 1.9, 25)] },
    );
    const hx = (x: number) => Math.round(HX(x));
    const hy = (y: number) => Math.round(HY(y));
    const style = stage === 2 ? "round" : "tall";
    decals.push(
      ...eyes([hx(12.2) - 1, hy(6) - 1], [hx(16.4) - 1, hy(6) - 1], pose, style),
      stamp(hx(9.4), hy(11.2), ["k"], { k: "hide:1" }),
    );
    if (stage < 2) decals.push(...blush([hx(12.2) - 1, hy(8.4)], [hx(16.6) - 1, hy(8.4)], 1));
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    type Arm = [number, number, number, number, number, number]; // x, y, heading, len, bend, r0
    // A set of mirrored arm pairs as one part; the curled tips are painted
    // in the pale sucker color (the underside showing as the arm rolls up).
    const arms = (list: Arm[], back = false): Part => {
      const prims: Prim[] = [];
      const tips: Prim[] = [];
      for (const [x, y, h, len, bend, r0] of list) {
        for (const [ax, ah, ab] of [[x, h, bend], [32 - x, 180 - h, -bend]]) {
          const pts = curl(ax, y, ah, len, ab, 20);
          prims.push(path(pts, r0, 0.6));
          tips.push(path(pts.slice(13), Math.max(0.6, r0 * 0.45), 0.5));
        }
      }
      return { mat: "skin", prims, blend: 0.5, round: 2, back, paint: [{ mat: "sucker", level: 4, prims: tips }] };
    };
    if (stage === 0) {
      parts.push(
        arms([[12.2, 21.4, 112, 6.4, 120, 1.25]], true),
        arms([[14.6, 22, 92, 5.6, 110, 1.25]]),
        { mat: "skin", prims: [egg(16, 18.8, 5.8, 5.2, 0.2)], round: 7 },
        { mat: "lum", prims: [ell(16, 15.4, 1, 0.9)], glow: true, line: false },
      );
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([11, 21], [19, 21]),
        stamp(15, 21, ["kk"], { k: "crest:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        arms([[11.2, 18.5, 175, 10, 240, 1.5]], true),
        arms([[13.2, 20.5, 125, 9, 210, 1.5], [15, 21, 97, 7, -160, 1.4]]),
        { mat: "skin", prims: [egg(16, 14, 6.4, 7, 0.25)], round: 7,
          paint: [{ mat: "crest", prims: [ell(16, 7.4, 3.6, 2.2)] }] },
        { mat: "lum", prims: [ell(12.6, 11, 0.9), ell(19.4, 11, 0.9)], glow: true, line: false },
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 18, ["kk"], { k: "crest:1" }),
      );
    } else {
      parts.push(
        // Side arms sweep out wide and curl up; front arms curl below.
        arms([[10.5, 16, 178, 15, 250, 1.9]], true),
        arms([[12.4, 18, 128, 13, 215, 1.9], [14.8, 18.5, 97, 10, -170, 1.8]]),
        // Mantle: a tall dome with fins and a crest.
        { mat: "crest", prims: [ell(9.8, 5.6, 1.6, 3, -35), ell(22.2, 5.6, 1.6, 3, 35)], back: true },
        { mat: "skin", prims: [egg(16, 9.6, 7.2, 8.2, 0.25)], round: 8,
          paint: [{ mat: "crest", prims: [ell(16, 2, 4.2, 2.6)] }] },
        { mat: "lum", prims: [ell(16, 5.4, 1.2), ell(11.8, 7.8, 0.9), ell(20.2, 7.8, 0.9)], glow: true, line: false },
      );
      decals.push(
        ...eyes([12, 11], [18, 11], pose, "round"),
        stamp(15, 14, ["kk"], { k: "crest:1" }),
        ...blush([10, 13], [20, 13]),
        sparkle(27, 1, "lum:5"),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
  },
};

export const TIDE: Species[] = [bubblet, kappa, axolittle, otterpop, selkie, nautilus, hippocamp, narwhal, kraken, leviathan];
