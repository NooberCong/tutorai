import type { Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
import type { Decal, Part, Prim } from "../pixel.ts";
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const tuft = (x: number, y: number, s: number): Part =>
      ({ mat: "moss", blend: 1.5, prims: [ell(x - 1.2 * s, y, 2.2 * s, 1.1 * s), ell(x + 1.2 * s, y - 0.3 * s, 1.8 * s, 1 * s), cap(x + 0.6 * s, y - 0.6 * s, x + 1.4 * s, y - 2.6 * s, 0.6, 0.5)] });
    if (stage === 0) {
      parts.push(
        { mat: "rock", prims: [ell(16, 24.8, 7.4, 5), ell(15, 23.4, 5.4, 4.4)], blend: 3 },
        tuft(15.6, 19.6, 0.9),
      );
      decals.push(
        ...eyes([12, 22], [18, 22], pose, "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(15, 26, ["kk"], { k: "rock:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "rock", prims: [ell(16, 27, 8, 3.2)] },
        crystals("gem", [[21.4, 25.6, 2.4, 4.2, 0.5]]),
        { mat: "rock", prims: [ell(16, 19.4, 6.6, 5.6), ell(15, 18, 5, 4.2)], blend: 3 },
        { mat: "rock", prims: both(ell(8.6, 23.6, 1.9, 1.8)) },
        tuft(15.4, 13.8, 1.1),
      );
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 22, ["kk"], { k: "rock:1" }),
      );
    } else {
      parts.push(
        { mat: "rock", back: true, prims: both(ell(11, 29.2, 3.2, 1.6)) },
        crystals("gem", [[22.8, 18.2, 4, 10.5, 0.8], [26, 19.4, 3, 7, 1.6], [19.8, 17.8, 2.6, 5.5, -0.6]]),
        { mat: "rock", prims: [ell(16, 22.6, 9.6, 6.8), ell(15, 21, 7, 5)], blend: 3,
          paint: [{ mat: "moss", prims: [ell(9.4, 18.2, 2.6, 1.3), ell(11.4, 17.2, 1.6, 1)] }] },
        { mat: "rock", prims: [ell(16, 13, 7, 5.6), ell(15, 11.8, 5.4, 4.4)], blend: 3 },
        tuft(15.4, 7.8, 1.3),
        { mat: "rock", prims: both(ell(6, 23.4, 3.2, 3.6)) },
      );
      decals.push(
        ...eyes([12, 12], [18, 12], pose, "tall"),
        ...blush([10, 15], [20, 15]),
        stamp(14, 16, ["k..k", ".kk."], { k: "rock:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 3 : 24, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A band ring over the shell — reads as an armadillo's ∩ arches. */
    const band = (cy: number, rx: number, ry: number) =>
      ({ mat: "shell", level: 1, prims: [ell(16, cy, rx, ry)], cut: [ell(16, cy, rx - 1.1, ry - 1.1)] });
    if (stage === 0) {
      parts.push(
        { mat: "skin", back: true, prims: [path([[21, 27.6], [24, 27.8], [25.4, 25.8]], 1, 0.7)] },
        { mat: "shell", prims: [ell(16, 23.4, 7.8, 6.6)],
          paint: [band(31, 9.6, 10.6), band(31, 10.4, 13.2)] },
        { mat: "skin", prims: [ell(16, 26.4, 4.4, 3.2), ...both(ell(12.4, 23.2, 1, 1.7, -30))], blend: 1 },
      );
      decals.push(
        ...eyes([13, 24], [17, 24], pose, "tall"),
        stamp(15, 27, ["nn"], { n: "skin:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "skin", back: true, prims: [path([[23, 26.5], [26.5, 27.5], [28, 25.5]], 1.2, 0.7)] },
        { mat: "shell", prims: [ell(16, 20.8, 9.8, 7.2)],
          paint: [band(27, 6.6, 9.4), band(27, 8.8, 11.4)] },
        { mat: "skin", prims: both(cap(13.4, 18.5, 11.2, 14.6, 1.4, 1)) },
        { mat: "skin", prims: [ell(16, 22.6, 5, 4.2), ell(16, 26.4, 2, 1.9)], blend: 2 },
        { mat: "skin", prims: both(ell(11, 28.8, 2.2, 1.4)) },
      );
      decals.push(
        ...eyes([13, 21], [17, 21], pose, "tall"),
        ...blush([11, 24], [20, 24], 1),
        stamp(15, 27, ["nn"], { n: "skin:1" }),
      );
    } else {
      const crack: [number, number][] = [[7.6, 16], [9.6, 12.8], [11.6, 13.8], [13.6, 11], [16.4, 12.2], [18.6, 10.4], [20.6, 12.6], [22.6, 11.8], [24.6, 15.8], [21.4, 17.2], [18.4, 16], [15.8, 17.4], [13, 16.2], [10.4, 17.4]];
      parts.push(
        { mat: "skin", back: true, prims: [path([[25, 26.5], [28.5, 27.8], [30, 25.8]], 1.4, 0.7)] },
        { mat: "shell", prims: [ell(16, 19.5, 12, 8.6)],
          paint: [
            band(28, 11.4, 14.6), band(28, 8.6, 11.8),
            { mat: "shell", level: 5, prims: [poly(crack, 0.9)] },
            { mat: "gem", level: 1, prims: [poly(crack)] },
          ] },
        crystals("gem", [[13, 15.4, 2.4, 4.4, -0.7], [16.2, 15.2, 3, 7.6, -0.1], [19.2, 14.8, 2.4, 5.4, 0.6]]),
        { mat: "skin", prims: both(cap(13.2, 20.5, 10, 17.8, 1.5, 1)) },
        { mat: "skin", prims: [ell(16, 23.6, 5.2, 4.3), ell(16, 27.2, 2.1, 1.9)], blend: 2 },
        { mat: "skin", prims: both(ell(9.4, 28.8, 2.8, 1.5)) },
      );
      decals.push(
        ...eyes([13, 22], [17, 22], pose, "tall"),
        ...blush([11, 25], [20, 25], 1),
        stamp(15, 28, ["nn"], { n: "skin:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(24, 4));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const tail = (pts: [number, number][], r0: number, r1: number, tip: Prim): Part =>
      ({ mat: "stone", prims: [path(pts, r0, r1), tip], back: true });
    if (stage === 0) {
      parts.push(
        tail([[20, 28], [24, 28], [25.5, 25]], 1, 0.7, poly([[24, 24.5], [25.5, 21.5], [27.5, 24]], 0.4)),
        { mat: "wing", prims: both(ell(9.4, 19.5, 2.6, 1.6, -35)), back: true },
        { mat: "stone", prims: [ell(16, 23.2, 6.8, 6), ...both(poly([[10.5, 20], [7.5, 16.5], [12.5, 18.5]], 0.4)), ...both(ell(13, 29, 1.8, 1.2))], blend: 1.2 },
        { mat: "horn", prims: both(ell(13.4, 17.4, 1, 1.1)) },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(14, 25, ["k..k", ".kk.", ".w.."], { k: "stone:1", w: "white:4" }),
      );
    } else if (stage === 1) {
      parts.push(
        tail([[20, 28], [25, 28.5], [27, 25]], 1.2, 0.8, poly([[25.5, 24.5], [27.2, 21], [29, 24.2]], 0.4)),
        { mat: "wing", back: true, prims: both(poly([[11, 19], [4.5, 10.5], [2.8, 16.5], [4.8, 16], [5.6, 19.8], [7.8, 19], [9.6, 22]], 0.4)) },
        { mat: "stone", blend: 3, prims: [ell(16, 17.5, 7, 6), ell(16, 25, 5.5, 4.5), ...both(poly([[10, 16], [6.5, 12.5], [11.5, 13.5]], 0.4)), ...both(ell(12.8, 28.8, 2, 1.3))] },
        { mat: "horn", prims: both(cap(13, 12.4, 12, 10, 1.2, 0.7)) },
        { mat: "stone", prims: both(ell(11.6, 24.5, 1.6, 1.8)) },
      );
      decals.push(
        ...eyes([12, 16], [18, 16], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(14, 20, ["k..k", ".kk.", ".w.."], { k: "stone:1", w: "white:4" }),
      );
    } else {
      parts.push(
        { mat: "wing", back: true, prims: both(poly([[11.5, 15.5], [4, 3.5], [1.2, 11], [2.5, 16.5], [4.5, 15], [5.5, 19.5], [8, 18], [10, 21]], 0.4)) },
        tail([[21, 28.6], [26, 29], [28.8, 26.5], [28.6, 22.5], [27.2, 20.8]], 1.5, 0.8, poly([[25, 21.5], [26.5, 17.5], [29.5, 20]], 0.4)),
        { mat: "stone", blend: 2.5, round: 4, prims: [
          ell(16, 23.8, 7.4, 5.6), ...both(ell(9.8, 26.4, 4, 3.6)), ...both(ell(8.4, 29, 2.8, 1.3)),
        ] },
        { mat: "stone", blend: 1.5, prims: [ell(16, 15, 7.6, 5.8), ...both(poly([[10, 14.5], [4.2, 11.2], [10.2, 11]], 0.4))] },
        { mat: "horn", prims: both(path([[12.4, 10.6], [10.2, 7.6], [9.9, 4.6], [11.4, 3]], 1.4, 0.6)) },
        { mat: "stone", prims: both(ell(13.2, 28.2, 2.2, 1.7)) },
      );
      decals.push(
        ...eyes([12, 13], [18, 13], pose, "tall"),
        ...blush([10, 16], [20, 16]),
        stamp(13, 17, ["k....k", ".kkkk.", ".w..w."], { k: "stone:1", w: "white:4" }),
        stamp(11, 29, ["k.k", "..."], { k: "stone:1" }),
        stamp(18, 29, ["k.k"], { k: "stone:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "scale", back: true, prims: [path([[20, 28], [25, 28.5], [27.5, 25.5]], 1.6, 0.6)] },
        { mat: "crown", prims: [ell(13.2, 16.4, 1, 1.3), ell(16, 15.5, 1.1, 1.5), ell(18.8, 16.4, 1, 1.3)], blend: 0 },
        { mat: "scale", blend: 3, prims: [ell(16, 20.8, 7, 4.8), ell(16, 26.2, 5, 3.6), ...both(ell(12, 29.2, 2, 1.2))],
          paint: [{ mat: "belly", prims: [ell(16, 27, 3, 2.6)] }] },
      );
      decals.push(
        ...eyes([12, 19], [18, 19], pose, "tall"),
        ...blush([10, 22], [20, 22]),
        stamp(15, 23, ["kk"], { k: "scale:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "scale", back: true, prims: [path([[20, 27.5], [26, 28.5], [28.5, 25], [27.5, 22]], 2, 0.7)] },
        { mat: "crown", prims: [poly([[11.5, 13], [11.2, 8.5], [13.6, 10.8], [16, 7.5], [18.4, 10.8], [20.8, 8.5], [20.5, 13]], 0.4)] },
        { mat: "scale", blend: 3, prims: [ell(16, 16.8, 7.2, 5), ell(16, 24, 5.4, 5), ...both(ell(12.2, 28.8, 2.4, 1.4))],
          paint: [{ mat: "belly", prims: [ell(16, 25, 3.4, 3.6)] }] },
        { mat: "scale", prims: both(cap(11.5, 21.5, 11.8, 24.5, 1.2, 1.2)) },
      );
      decals.push(
        ...eyes([12, 15], [18, 15], pose, "tall"),
        ...blush([10, 18], [20, 18]),
        stamp(15, 19, ["kk"], { k: "scale:1" }),
        stamp(15, 10, ["g"], { g: "gem:4" }),
      );
    } else {
      parts.push(
        { mat: "scale", back: true, prims: [path([[21, 27.5], [27, 28.4], [29.6, 24.5], [29, 20], [26.8, 18.4]], 2.6, 0.9)] },
        { mat: "crown", back: true, prims: both(poly([[10.5, 12], [4.4, 7.4], [5.8, 10.8], [2.4, 12.2], [5.8, 14], [4, 17], [10.5, 16]], 0.4)) },
        { mat: "scale", blend: 2.5, round: 5, prims: [ell(16, 23.6, 7, 5.8), ...both(ell(10.8, 27, 3.4, 2.8)), ...both(ell(10.2, 29.2, 2.8, 1.2))],
          paint: [
            { mat: "belly", prims: [ell(16, 24.4, 4.4, 4.8)] },
            { mat: "belly", level: 2, prims: [cap(12.6, 26.6, 19.4, 26.6, 0.4)] },
          ] },
        { mat: "scale", prims: [ell(16, 13.8, 8.2, 5.6), ell(16, 16, 6, 3.6)], blend: 2 },
        { mat: "crown", prims: [poly([[10.5, 10], [10, 4.8], [12.4, 7], [14, 3.2], [16, 6], [18, 3.2], [19.6, 7], [22, 4.8], [21.5, 10]], 0.4)] },
        { mat: "gem", glow: true, prims: [ell(16, 8.2, 1.2, 1.2)] },
        { mat: "scale", round: 2.5, prims: both(cap(10.4, 19.8, 13, 24.4, 1.7, 1.5)) },
        { mat: "gem", glow: true, prims: [ell(16, 22.4, 2.6, 2.4)] },
      );
      decals.push(
        ...eyes([12, 12], [18, 12], pose, "round"),
        ...blush([10, 14], [20, 14]),
        stamp(13, 15, ["k....k", ".kkkk."], { k: "scale:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "serpent", back: true, prims: [path([[21, 26], [24.5, 25.5], [25.5, 22.5]], 1.3, 0.9)] },
        { mat: "rock", prims: [poly([[14, 19], [16, 15.6], [18, 19]], 0.5)] },
        { mat: "shell", prims: [ell(16, 22.5, 8, 5.4)],
          paint: [{ mat: "rim", prims: [hexa(16, 20.6, 2.2, 0.75), hexa(11.8, 22.4, 1.6, 0.75), hexa(20.2, 22.4, 1.6, 0.75)] }] },
        { mat: "skin", prims: [ell(16, 25.2, 4.8, 3.9), ...both(ell(10.8, 28.6, 2.2, 1.5))] },
      );
      decals.push(
        ...eyes([13, 23], [17, 23], pose, "tall"),
        ...blush([11, 26], [19, 26], 1),
        stamp(15, 27, ["kk"], { k: "skin:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "serpent", back: true, prims: [path([[22, 24], [26.5, 23.5], [28, 19], [26.5, 15.5]], 1.6, 1.2)] },
        { mat: "serpent", prims: [ell(26, 13.5, 2.6, 2)] },
        { mat: "rock", prims: [poly([[11.5, 15.5], [16, 8.5], [20.5, 15.5]], 0.5)],
          paint: [{ mat: "snow", prims: [poly([[14.4, 11.4], [16, 8.2], [17.6, 11.4]], 0.3)] }] },
        { mat: "shell", prims: [ell(16, 20, 10.4, 6.6)],
          paint: [{ mat: "rim", prims: [
            hexa(16, 17.8, 2.4, 0.75), hexa(11, 19.3, 2.2, 0.75), hexa(21, 19.3, 2.2, 0.75), hexa(7.2, 21.2, 1.4, 0.75), hexa(24.8, 21.2, 1.4, 0.75),
          ] }] },
        { mat: "skin", prims: both(ell(9.5, 27.2, 2.6, 2.2)) },
        { mat: "skin", prims: [ell(16, 25, 4.4, 3.8)] },
      );
      decals.push(
        ...eyes([13, 23], [17, 23], pose, "tall"),
        ...blush([11, 26], [19, 26], 1),
        stamp(15, 27, ["kk"], { k: "skin:1" }),
        stamp(25, 13, ["k.k"], { k: "eye:3" }),
      );
    } else {
      parts.push(
        { mat: "serpent", back: true, prims: [path([[24, 21], [28.6, 19.4], [29.6, 14.5], [27, 11.5], [27.4, 8.2]], 2.1, 1.5)] },
        { mat: "serpent", prims: [ell(26.2, 6.4, 2.8, 2.2), ell(24, 7, 1.6, 1.3)], blend: 1.5 },
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
        { mat: "skin", prims: both(ell(7.4, 27.8, 3.2, 2.6)) },
        { mat: "skin", prims: [ell(16, 25.8, 5.6, 4.4)] },
      );
      decals.push(
        ...eyes([12, 24], [18, 24], pose, "tall"),
        ...blush([11, 27], [20, 27], 1),
        stamp(15, 28, ["kk"], { k: "skin:1" }),
        stamp(24, 5, ["k..k"], { k: "eye:3" }),
        sparkle(2, 8), sparkle(21, 0), sparkle(1, 15, "#bff6ff"),
      );
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(6, 1) : zzz(24, 4));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "paw", back: true, prims: both(ell(12.5, 29.4, 1.8, 1.1)) },
        { mat: "fur", prims: [ell(16, 24, 7.4, 5.8), ell(16, 21.5, 5.5, 4.5)], blend: 3 },
        { mat: "paw", line: false, prims: [ell(16, 25.8, 2.4, 1.7)] },
        { mat: "gem", glow: true, prims: [diamond(16, 24.6, 1.6, 1.4)] },
        { mat: "paw", prims: both(ell(9.6, 26.8, 2.2, 1.6, -25)) },
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 24], [20, 24]));
    } else if (stage === 1) {
      parts.push(
        { mat: "paw", back: true, prims: both(ell(12, 29.4, 2.2, 1.2)) },
        { mat: "fur", prims: [ell(16, 21.5, 7.8, 6.8), ell(16, 25.5, 8.6, 4.2)], blend: 4, round: 5 },
        { mat: "paw", line: false, prims: [ell(16, 23.2, 2.8, 2)] },
        { mat: "gem", glow: true, prims: [diamond(16, 21.6, 2, 1.8)] },
        { mat: "paw", prims: both(ell(7.4, 24, 3, 2.3, -30)) },
      );
      decals.push(
        ...eyes([12, 17], [18, 17], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        stamp(15, 25, ["kk"], { k: "fur:1" }),
      );
    } else {
      parts.push(
        { mat: "paw", back: true, prims: both(ell(11, 29.3, 3, 1.4)) },
        { mat: "fur", prims: [ell(16, 19.5, 10, 8.5), ell(16, 25, 11, 5.2), ell(16, 15, 7.5, 4.5)], blend: 4, round: 6 },
        { mat: "paw", line: false, prims: [ell(16, 21.6, 3.4, 2.5)] },
        { mat: "gem", glow: true, prims: [diamond(16, 19.4, 2.7, 2.4)] },
        { mat: "paw", blend: 1.2, prims: [
          ...both(ell(6, 22, 3.8, 3.4)),
          ...both(cap(3.6, 20.4, 1.2, 19, 1, 0.6)), ...both(cap(3.2, 22.4, 0.8, 22.6, 1, 0.6)),
          ...both(cap(3.6, 24.4, 1.6, 26, 1, 0.6)), ...both(cap(5.8, 25, 5.2, 27.8, 1, 0.6)),
        ], paint: [{ mat: "white", level: 3, prims: [
          ...both(ell(1.5, 19.2, 0.9)), ...both(ell(1, 22.6, 0.9)), ...both(ell(1.8, 25.8, 0.9)), ...both(ell(5.2, 27.6, 0.9)),
        ] }] },
      );
      decals.push(
        ...eyes([11, 14], [19, 14], pose, "tall"),
        ...blush([9, 18], [21, 18]),
        stamp(14, 24, ["k..k", ".kk."], { k: "fur:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(24, 4));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Plate seams: meridian rings around the dome's center. */
    const seams = (cx: number, cy: number, ry: number, rxs: number[]) =>
      rxs.map((rx) => ({ mat: "plate", level: 1, prims: [ell(cx, cy, rx, ry)], cut: [ell(cx, cy, rx - 0.9, ry)] }));
    if (stage === 0) {
      parts.push(
        { mat: "plate", prims: [ell(19, 24.5, 6.4, 5)], cut: [below(28.6)], paint: seams(19, 24.5, 6, [2.4, 4.6]) },
        { mat: "skin", line: false, prims: [ell(15, 28.6, 5, 0.9), ell(21.5, 28.6, 3, 0.9)] },
        { mat: "skin", prims: [path([[11, 21], [9.5, 18.5], [8, 18.2]], 0.7, 0.6)] },
        { mat: "skin", prims: [ell(12.5, 24.8, 5, 4)] },
        { mat: "plate", prims: [ell(12.8, 21.4, 4.6, 1.9)] },
      );
      decals.push(...eyes([10, 23], [14, 23], pose, "tall"), stamp(12, 27, ["kk"], { k: "skin:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "skin", line: false, prims: [ell(18.5, 28.6, 8, 1)] },
        { mat: "plate", prims: [ell(19, 23, 9, 6.2)], cut: [below(28.4)], paint: seams(19, 23, 7.2, [3, 6, 8.8]) },
        { mat: "crystal", glow: true, prims: [shard(19, 17.8, 2.4, 3)] },
        { mat: "skin", prims: [path([[8, 21], [5.5, 17], [3.5, 16.5]], 0.8, 0.6), path([[11.5, 20.5], [12.5, 16.5], [14.5, 15.5]], 0.8, 0.6)] },
        { mat: "skin", prims: [ell(9.8, 24.6, 5.2, 4.2)] },
        { mat: "plate", prims: [ell(10, 21, 5, 2)] },
      );
      decals.push(...eyes([7, 23], [11, 23], pose, "tall"), stamp(9, 27, ["k..k", ".kk."], { k: "skin:1" }));
    } else {
      parts.push(
        { mat: "skin", line: false, prims: [ell(19, 28.8, 11, 1.1)] },
        { mat: "plate", prims: [ell(18.5, 21.5, 12, 8)], cut: [below(28.4)],
          paint: seams(18.5, 21.5, 9, [3, 6.2, 9.4, 12]) },
        { mat: "crystal", glow: true, prims: [
          shard(12.2, 16.6, 2.2, 3, -0.4), shard(15.5, 14.4, 2.4, 3.6, -0.2), shard(21.5, 14.4, 2.4, 3.6, 0.2),
          shard(24.9, 16.6, 2.2, 3, 0.4), shard(27.8, 19.6, 1.8, 2.4, 0.5),
        ] },
        { mat: "skin", prims: [path([[6, 19.5], [3.5, 14.5], [1.5, 13.5]], 0.9, 0.6), path([[10.5, 19], [11.5, 14], [13.8, 12.5]], 0.9, 0.6)] },
        { mat: "skin", prims: [ell(8.5, 24.2, 5.6, 4.4)] },
        { mat: "plate", prims: [ell(8.8, 20, 5.8, 2.3)] },
      );
      decals.push(
        ...eyes([5, 22], [10, 22], pose, "tall"),
        ...blush([3, 25], [12, 25], 1),
        stamp(7, 26, ["k..k", ".kk."], { k: "skin:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(24, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // ¾ view facing left: the snout horn is the whole read.
    if (stage === 0) {
      parts.push(
        { mat: "hide", back: true, prims: [ell(21.5, 29.2, 1.7, 1.2)] },
        { mat: "hide", prims: [ell(19.5, 25.8, 5.5, 3.8), ell(17, 29, 1.8, 1.3), ell(23.5, 28.8, 1.6, 1.2)], blend: 2 },
        { mat: "hide", prims: [ell(17.6, 18.8, 1, 1.7, 25), ell(14.4, 18.4, 1, 1.7, -15)] },
        { mat: "hide", prims: [ell(14.2, 23.5, 6, 5), ell(10.6, 26, 3.6, 2.8)], blend: 3 },
        crystals("crystal", [[9.8, 24.8, 2.4, 3.6, -0.4]]),
      );
      decals.push(
        ...eyes([12, 21], [16, 21], pose, "tall"),
        ...blush([11, 25], [18, 25], 1),
        stamp(8, 26, ["k"], { k: "hide:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "hide", back: true, prims: [ell(20.5, 29, 1.8, 1.3), ell(26.8, 28.8, 1.7, 1.3)] },
        { mat: "hide", prims: [ell(20, 23.2, 7.8, 5.2), ell(16.5, 27.8, 2.3, 2.2), ell(24, 27.8, 2.3, 2.2), path([[27.5, 22], [28.8, 24.5]], 0.7, 0.6)], blend: 2 },
        { mat: "hide", prims: [ell(15.6, 15.4, 1.1, 2, 25), ell(12.4, 15.2, 1.2, 2.1, -15)] },
        { mat: "hide", prims: [ell(12, 21, 5.4, 4.6), ell(8.2, 23.8, 3.6, 2.9)], blend: 3 },
        crystals("crystal", [[7.2, 22.2, 3.4, 7.6, -0.8]]),
      );
      decals.push(
        ...eyes([10, 19], [14, 19], pose, "tall"),
        ...blush([9, 23], [16, 23], 1),
        stamp(5, 24, ["k"], { k: "hide:1" }),
      );
    } else {
      parts.push(
        { mat: "hide", back: true, prims: [ell(19.5, 28.6, 2.4, 1.8), ell(28, 28.3, 2.2, 1.8)] },
        { mat: "hide", prims: [ell(19.5, 20.5, 10, 7.5), ell(15, 27, 3, 3), ell(25, 27, 3, 3), path([[29, 18.5], [30.4, 22]], 0.8, 0.6)], blend: 2 },
        { mat: "hide", prims: [ell(15.2, 12, 1.3, 2, 25), ell(11.8, 11.8, 1.4, 2.1, -15)] },
        crystals("geode", [[10.2, 13.8, 2.4, 3.8, 0.2]]),
        { mat: "hide", prims: [ell(11, 18, 6.6, 5.6), ell(5.6, 21.8, 4.4, 3.6)], blend: 3 },
        crystals("geode", [[2, 19.6, 2.4, 7, -0.9], [6.6, 19.4, 2.4, 8.4, 1]]),
        crystals("crystal", [[4.2, 19.2, 3.8, 15, -0.5]]),
      );
      decals.push(
        ...eyes([9, 16], [14, 16], pose, "round"),
        ...blush([8, 19], [15, 19], 1),
        stamp(2, 22, ["k"], { k: "hide:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "skin", back: true, prims: both(ell(12.5, 29.4, 1.9, 1.1)) },
        { mat: "skin", prims: both(poly([[10.2, 21.2], [7.6, 18.2], [10.4, 23.4]], 0.5)) },
        { mat: "skin", prims: [ell(16, 24, 7.2, 5.8)] },
        { mat: "moss", prims: [ell(16, 18.8, 4, 1.6), ell(14, 19.8, 1.6, 1.3), ell(18.5, 19.6, 1.4, 1.2)], blend: 1.5 },
        { mat: "nose", prims: [ell(16, 24.8, 2.2, 1.8)] },
        { mat: "skin", prims: both(ell(9.5, 26.5, 1.8, 1.6)) },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 24], [20, 24]),
        stamp(14, 27, ["k..k", ".kk."], { k: "skin:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "skin", back: true, prims: both(ell(12.4, 29.3, 2.3, 1.3)) },
        { mat: "skin", prims: both(poly([[9.5, 17.5], [4.8, 15], [9, 20]], 0.5)) },
        { mat: "skin", prims: [ell(16, 20.5, 6.8, 7), ell(16, 25.5, 7.2, 4.2)], blend: 4 },
        { mat: "moss", prims: [ell(16, 13.6, 6.4, 2.6), ell(10.6, 15.6, 1.5, 2.1), ell(21.4, 15.4, 1.5, 1.9), ell(13.6, 15.9, 1.3, 1.5), ell(18.6, 15.9, 1.2, 1.3), ell(14.5, 11.2, 1.8, 1.2)], blend: 1.5 },
        { mat: "nose", prims: [ell(16, 20.4, 2.6, 2.3)] },
        { mat: "skin", prims: [...both(path([[9.6, 18.5], [7.6, 22], [7.2, 25]], 1.3, 1.6)), ...both(ell(7.2, 26, 1.9, 1.8))] },
      );
      decals.push(
        ...eyes([11, 17], [19, 17], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(13, 24, ["k....k", ".kwkk."], { k: "skin:1", w: "white:4" }),
      );
    } else {
      parts.push(
        { mat: "skin", back: true, prims: both(ell(11, 29.3, 3, 1.5)) },
        { mat: "skin", prims: both(poly([[8.5, 11.5], [2.8, 8.2], [8, 15]], 0.6)) },
        { mat: "skin", prims: [ell(16, 18.5, 9, 9), ell(16, 24.5, 9.6, 5.5)], blend: 5 },
        { mat: "moss", blend: 1.5, prims: [
          ell(16, 9.6, 9, 3.8), ell(12, 6.4, 2.2, 1.4), ell(19.2, 6.2, 2.6, 1.5),
          ell(7.9, 12.6, 1.8, 2.8), ell(11.6, 13.4, 1.6, 2), ell(15.8, 12.8, 1.4, 1.4), ell(20.2, 13.6, 1.7, 2.2), ell(24.1, 12.3, 1.8, 3),
        ] },
        { mat: "flower", prims: [ell(21, 7.2, 1.6)] },
        { mat: "nose", prims: [ell(16, 18, 3.3, 3)] },
        { mat: "skin", prims: [...both(path([[8.2, 15.5], [5.2, 20], [4.4, 24.5]], 1.8, 2.2)), ...both(ell(4.4, 26, 2.6, 2.4))] },
      );
      decals.push(
        ...eyes([10, 15], [20, 15], pose, "round"),
        ...blush([8, 19], [22, 19]),
        stamp(12, 22, ["k......k", ".kkwkkk."], { k: "skin:1", w: "white:4" }),
        stamp(20, 6, ["y"], { y: "#ffe27a" }),
      );
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(27, 0) : zzz(25, 2));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        crystals("shard", [[18.2, 21.2, 2.4, 3]]),
        { mat: "hide", prims: [path([[20, 26], [23.5, 26.5], [25.5, 24.5]], 1.6, 0.7)] },
        { mat: "hide", prims: [ell(17, 25, 6, 4.4), ell(13.5, 29, 1.8, 1.2), ell(19.5, 29, 1.8, 1.2)], blend: 2 },
        crystals("crystal", [[15.8, 21.6, 2.6, 3.2, -0.3], [20.6, 22.4, 2.2, 2.6, 0.3]]),
        { mat: "hide", prims: [ell(12, 23.5, 5.4, 4.8)], paint: [{ mat: "belly", level: 4, prims: [ell(11, 27, 3.5, 1.8)] }] },
      );
      decals.push(...eyes([9, 22], [13, 22], pose, "tall"), ...blush([8, 25], [15, 25], 1));
    } else if (stage === 1) {
      parts.push(
        crystals("shard", [[15.8, 19.2, 3, 5, -0.3], [21.2, 19.2, 3, 5, 0.4]]),
        { mat: "hide", prims: [path([[22, 24], [25.5, 23], [28, 20]], 2, 0.8)] },
        crystals("crystal", [[28, 21, 2, 3.4, 0.6]]),
        { mat: "hide", back: true, prims: [ell(14, 28.8, 1.8, 1.4), ell(22, 28.8, 1.8, 1.4)] },
        { mat: "hide", prims: [ell(18, 23.5, 7.5, 5), ell(13, 28, 2.2, 2), ell(20.5, 28, 2.2, 2)], blend: 2,
          paint: [{ mat: "belly", level: 4, prims: [ell(17, 27.6, 5.5, 1.6)] }] },
        crystals("crystal", [[12.8, 20.2, 3, 4.6, -0.6], [18.5, 18.9, 3.4, 6.6], [23.8, 20.4, 2.6, 4.2, 0.6]]),
        { mat: "hide", prims: [ell(9, 23, 4.6, 4), ell(7.2, 25, 3, 2.2)], blend: 2 },
      );
      decals.push(...eyes([6, 21], [10, 21], pose, "tall"), ...blush([5, 24], [11, 24], 1));
    } else {
      parts.push(
        crystals("shard", [[14.2, 15.8, 4, 8.5, -0.6], [20.8, 15.6, 4, 8.8, 0.6]]),
        { mat: "hide", prims: [path([[24, 21], [28, 19], [30.4, 15.5]], 2.6, 1)] },
        crystals("crystal", [[30, 16.8, 2.2, 4.6, 0.6], [27.6, 18.6, 2, 3.8, -0.2]]),
        { mat: "hide", back: true, prims: [ell(13, 28.5, 2, 1.8), ell(23, 28.5, 2, 1.8)] },
        { mat: "hide", prims: [ell(17.5, 21, 9.5, 6.5), ell(11.5, 27.5, 2.6, 2.6), ell(21.5, 27.5, 2.6, 2.6)], blend: 2,
          paint: [{ mat: "belly", level: 4, prims: [ell(16.5, 26.2, 7, 2)] }] },
        crystals("crystal", [[10.6, 18, 4, 7.4, -1.2], [17.4, 15.4, 4.6, 11.5, -0.2], [24.4, 17.2, 3.8, 7.8, 1]]),
        { mat: "hide", prims: [ell(7, 20.2, 5.6, 4.8), ell(4.6, 23, 3.6, 2.6)], blend: 2 },
      );
      decals.push(
        ...eyes([4, 18], [9, 18], pose, "round"),
        ...blush([3, 21], [10, 21], 1),
        stamp(3, 24, ["kk"], { k: "hide:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 2 : 24, 3));
    return { parts, decals };
  },
};

export const STONE: Species[] = [
  pebblit, geodillo, gemmole, rollypolly,
  gargoyle, rhinolith, mosstroll,
  basilisk, stegolith,
  genbu,
];
