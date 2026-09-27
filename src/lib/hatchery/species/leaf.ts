import type { Pose, Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
import type { Decal, Part, Prim } from "../pixel.ts";
import { both, cap, egg, ell, path, poly } from "../pixel.ts";

/** A leaf-shaped ear or blade from base (bx, by) to tip (tx, ty), widest a
 *  third of the way up. */
function leafBlade(bx: number, by: number, tx: number, ty: number, w: number): Prim[] {
  const mx = bx + (tx - bx) * 0.38;
  const my = by + (ty - by) * 0.38;
  return [cap(bx, by, mx, my, w * 0.6, w), cap(mx, my, tx, ty, w, 0.45)];
}

export const sproutling: Species = {
  id: "sproutling",
  name: "Sproutling",
  element: "leaf",
  tier: "common",
  stages: ["Sproutling", "Sprigling", "Bloomhare"],
  palette: { fur: "#ecd6a8", cream: "#fdf6e2", leaf: "#6cc24a", flower: "#ff9ec4" },
  shiny: { fur: "#f6d0de", cream: "#fff4f7", leaf: "#e8b04a", flower: "#8fd3ff" },
  lore: "A seed that decided it would rather be a rabbit. Nibbles margins; grows a leaf for every chapter it sits through.",
  hint: "Rustles when a page turns.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const rib = (bx: number, by: number, tx: number, ty: number) => ({
      mat: "leaf", prims: [cap(bx, by, bx + (tx - bx) * 0.8, by + (ty - by) * 0.8, 0.35)], level: 2,
    });
    if (stage === 0) {
      parts.push(
        { mat: "leaf", prims: [cap(16, 18.5, 16, 16, 0.6), ell(13.6, 15.4, 2.4, 1.2, -25), ell(18.4, 15.4, 2.4, 1.2, 25)] },
        { mat: "fur", prims: [egg(16, 24, 7, 6.2, 0.12)], paint: [{ mat: "cream", prims: [ell(16, 27.6, 3, 1.7)], level: 3 }] },
        { mat: "fur", prims: sym(ell(12.8, 29.6, 1.9, 1), 16), line: false },
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, [".k.".slice(0, 2)], { k: "fur:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "leaf", prims: leafBlade(13, 12.5, 10.6, 4.2, 2.2), paint: [rib(13, 12.5, 10.6, 4.2)] },
        { mat: "leaf", prims: leafBlade(19, 12.5, 21.4, 4.2, 2.2), paint: [rib(19, 12.5, 21.4, 4.2)] },
        { mat: "fur", prims: [ell(16, 17.4, 7.2, 5.8), egg(16, 25, 5.4, 4.8, 0.1), ...sym(ell(10, 19.6, 1.9, 1.5), 16)], blend: 2.5,
          paint: [{ mat: "cream", prims: [ell(16, 26, 3.2, 3)], level: 3 }] },
        { mat: "fur", prims: sym(ell(12.2, 29.4, 2.4, 1.2), 16) },
      );
      decals.push(...eyes([12, 16], [18, 16], pose, "tall"), ...blush([10, 19], [20, 19]), stamp(15, 19, ["kk"], { k: "fur:1" }));
    } else {
      parts.push(
        { mat: "leaf", prims: leafBlade(12.6, 9.5, 8.6, 0.8, 2.8), paint: [rib(12.6, 9.5, 8.6, 0.8)] },
        { mat: "leaf", prims: leafBlade(19.4, 9.5, 27.2, 5, 2.6), paint: [rib(19.4, 9.5, 27.2, 5)] },
        { mat: "fur", prims: [ell(16, 14.6, 7.6, 6), egg(16, 24.2, 7.2, 6, 0.22), ...sym(ell(9.4, 17.2, 2.3, 1.8, 15), 16)], blend: 4.5,
          paint: [{ mat: "cream", prims: [ell(16, 25.4, 4, 3.8), ell(16, 17.4, 2.6, 1.4)], level: 3 }] },
        { mat: "flower", prims: [ell(11.2, 7.6, 1.6), ell(13.6, 7.2, 1.5), ell(12.2, 5.6, 1.4)], blend: 0.6 },
        { mat: "fur", prims: sym(ell(11.2, 29.3, 3, 1.4), 16) },
      );
      decals.push(
        ...eyes([12, 13], [18, 13], pose, "tall"),
        ...blush([10, 16], [20, 16]),
        stamp(15, 16, ["kk", ".."], { k: "flower:2" }),
        stamp(12, 6, ["y"], { y: "#ffe27a" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 25 : 24, stage === 2 ? 12 : 4));
    return { parts, decals };
  },
};

const FLOOR = poly([[0, 26], [32, 26], [32, 32], [0, 32]]);

export const mossback: Species = {
  id: "mossback",
  name: "Mossback",
  element: "leaf",
  tier: "common",
  stages: ["Cloverpip", "Mosslet", "Mossback"],
  palette: { skin: "#b3d68c", shell: "#c49a6c", moss: "#6fb84a", cap: "#ef7564" },
  shiny: { skin: "#ead9a8", shell: "#9c7a64", moss: "#e8983c", cap: "#b38cf0" },
  lore: "Reads one page a day and never loses its place. Its shell grows a new patch of moss for every book finished.",
  hint: "Slow, green, and very patient.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "shell", prims: [ell(16, 22.5, 8, 6)] },
        { mat: "moss", prims: [ell(14.5, 14.9, 1.5, 1.3, 30), ell(17.5, 14.9, 1.5, 1.3, -30), ell(16, 12.6, 1.3, 1.5), cap(16, 15.5, 16, 17.5, 0.6)], blend: 0 },
        { mat: "skin", prims: [ell(16, 25, 5.2, 4.4)] },
        { mat: "skin", prims: both(ell(10.3, 28.9, 1.9, 1.3)) },
      );
      decals.push(...eyes([12, 23], [18, 23], pose, "tall"), ...blush([11, 26], [19, 26]), stamp(15, 27, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "shell", prims: [ell(16, 20, 10.5, 7.5)], cut: [FLOOR],
          paint: [{ mat: "moss", prims: [ell(11.5, 15, 3.6, 2.4), ell(19.5, 14, 3.2, 2.2), ell(23.5, 18, 1.8, 1.8)] }] },
        { mat: "shell", prims: [ell(16, 25.5, 10.5, 2)] },
        { mat: "white", prims: [cap(21, 13.5, 21, 11, 0.8)] },
        { mat: "cap", prims: [ell(21, 10.6, 2.2, 1.3)] },
        { mat: "skin", prims: [ell(16, 24, 5, 4.3)] },
        { mat: "skin", prims: both(ell(9, 28.6, 2.2, 1.6)) },
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([11, 25], [19, 25]), stamp(15, 26, ["kk"], { k: "eye:3" }));
    } else {
      parts.push(
        { mat: "shell", prims: [ell(16, 19, 13.5, 11)], cut: [poly([[0, 25], [32, 25], [32, 32], [0, 32]])],
          paint: [{ mat: "moss", prims: [ell(16, 10.5, 12.5, 5), ell(6.5, 14, 2.2, 3.2), ell(11, 15.5, 2.2, 2.6), ell(16.5, 14.5, 1.8, 2.8), ell(21.5, 15.5, 2.4, 2.6), ell(26, 13.5, 1.8, 3)] },
            { mat: "shell", prims: [ell(6.4, 20.4, 1.6, 1.3), ell(25.6, 20.4, 1.6, 1.3), ell(9.6, 19.6, 1.2, 1), ell(22.4, 19.6, 1.2, 1)], level: 4 }] },
        { mat: "shell", prims: [ell(16, 25, 13.2, 2.4)] },
        { mat: "white", prims: [cap(8, 11, 8, 7.5, 1), cap(11.5, 9.5, 11.5, 7.5, 0.8)] },
        { mat: "cap", prims: [ell(8, 6.8, 2.8, 2)], cut: [poly([[0, 7.4], [32, 7.4], [32, 32], [0, 32]])] },
        { mat: "cap", prims: [ell(11.5, 7.4, 1.9, 1.5)], cut: [poly([[0, 7.8], [32, 7.8], [32, 32], [0, 32]])] },
        { mat: "shell", prims: [path([[19.5, 9], [20.5, 6.5], [19, 4.5]], 1.1, 0.7), cap(20.3, 6.8, 22.5, 5.8, 0.6)] },
        { mat: "moss", prims: [ell(17.5, 3.4, 2.6, 1.6), ell(22.8, 4.6, 2.2, 1.4)] },
        { mat: "skin", prims: [ell(16, 23, 5.5, 4.6)] },
        { mat: "skin", prims: both(ell(8, 28.4, 2.8, 2)) },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "round"), ...blush([11, 24], [19, 24]), stamp(14, 24, ["k..k", ".kk."], { k: "eye:3" }),
        stamp(7, 5, ["w..", "..w"], { w: "white:4" }), stamp(11, 6, ["w"], { w: "white:4" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
  },
};

export const mandrake: Species = {
  id: "mandrake",
  name: "Mandragora",
  element: "leaf",
  tier: "rare",
  stages: ["Radishling", "Mandrake", "Mandragora"],
  palette: { root: "#e2b287", leaf: "#4fae63", flower: "#c38ef0" },
  shiny: { root: "#f2b8d4", leaf: "#6fd6c4", flower: "#ffd45c" },
  lore: "Screams when pulled from a book it hasn't finished. Otherwise just grumbles about the font size.",
  hint: "Something muttering under the soil.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const rib = (bx: number, by: number, tx: number, ty: number) => ({
      mat: "leaf", prims: [cap(bx, by, bx + (tx - bx) * 0.75, by + (ty - by) * 0.75, 0.35)], level: 4,
    });
    const blade = (bx: number, by: number, tx: number, ty: number, w: number, back = false): Part => ({
      mat: "leaf", prims: leafBlade(bx, by, tx, ty, w), back, paint: back ? [] : [rib(bx, by, tx, ty)],
    });
    const flower = (x: number, y: number, r: number): Part[] => [
      { mat: "flower", prims: [ell(x - r * 0.55, y, r * 0.7), ell(x + r * 0.55, y, r * 0.7), ell(x, y - r * 0.55, r * 0.7), ell(x, y + r * 0.55, r * 0.7)], blend: 0.4 },
    ];
    const grumpy = (lx: number, rx: number, y: number) => [
      stamp(lx, y, ["k.", ".k"], { k: "root:1" }), stamp(rx, y, [".k", "k."], { k: "root:1" }),
    ];
    if (stage === 0) {
      parts.push(
        blade(15, 18, 12.4, 12.6, 1.6),
        blade(17, 18, 19.6, 12.6, 1.6),
        { mat: "root", prims: [egg(16, 23, 6, 5.5, -0.25), path([[16, 27], [16.4, 29], [17.6, 30]], 1.1, 0.6)] },
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "tall"), ...blush([11, 24], [19, 24]), stamp(15, 25, ["kk"], { k: "root:1" }));
    } else if (stage === 1) {
      parts.push(
        blade(16, 12, 16, 4.2, 1.9, true),
        blade(14.5, 13, 9.6, 7.4, 1.8),
        blade(17.5, 13, 22.4, 7.4, 1.8),
        { mat: "root", prims: [egg(16, 19, 6.6, 6.2, -0.25), ...sym(path([[13.6, 23], [12.8, 26.5], [11.8, 29.5]], 1.6, 1)), ...sym(path([[10, 18.5], [8, 21], [7.6, 22.8]], 1.2, 0.9))], blend: 2, round: 4 },
      );
      decals.push(...eyes([12, 17], [18, 17], pose, "tall"), ...grumpy(12, 18, 15), ...blush([10, 20], [20, 20]), stamp(15, 21, ["kk"], { k: "root:1" }));
    } else {
      parts.push(
        blade(16, 9, 16, 0.6, 2.4, true),
        blade(13.5, 9.8, 4.4, 5, 2.1, true),
        blade(18.5, 9.8, 27.6, 5, 2.1, true),
        blade(15, 10, 9.6, 1.8, 2.3),
        blade(17, 10, 22.4, 1.8, 2.3),
        { mat: "root", prims: [
          egg(16, 16.5, 7.8, 7.4, -0.22),
          ...sym(path([[13.2, 21.5], [12.2, 25.5], [10.8, 29.5]], 2.1, 1.3)),
          ...sym(path([[9.4, 14.5], [6.4, 18.5], [5.2, 22.4]], 1.8, 1.1)),
          ...sym(cap(5.4, 22, 7, 23.6, 0.8, 0.6)),
          ...sym(cap(10.6, 29.4, 8.8, 29.8, 0.8, 0.6)),
        ], blend: 2.2, round: 4.5 },
        ...flower(10.2, 8.6, 1.9),
        ...flower(22, 8, 1.7),
      );
      decals.push(
        ...eyes([12, 15], [18, 15], pose, "tall"), ...grumpy(12, 18, 13),
        ...blush([10, 18], [20, 18]),
        stamp(14, 20, [".kk.", "k..k"], { k: "eye:3" }),
        stamp(10, 8, ["y"], { y: "#ffe27a" }), stamp(22, 8, ["y"], { y: "#ffe27a" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 4));
    return { parts, decals };
  },
};

export const bloomstag: Species = {
  id: "bloomstag",
  name: "Bloomstag",
  element: "leaf",
  tier: "epic",
  stages: ["Budfawn", "Leafling", "Bloomstag"],
  palette: { fur: "#d8995c", cream: "#f7e4c6", antler: "#b88a62", leaf: "#7cc45a", blossom: "#ffb0cc", glow: "#f4f58a" },
  shiny: { fur: "#8a92dc", cream: "#eef0ff", antler: "#8c7aa8", leaf: "#8fe0c8", blossom: "#ffe07a", glow: "#b8f0ff" },
  lore: "Wherever it naps, wildflowers press themselves between the pages. Fireflies follow it like footnotes.",
  hint: "Antlers that bloom in spring.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // ¾ view: head toward the viewer, barrel body running back to the right.
    // Legs are painted flat (one ramp step) so thin legs read as legs, not as
    // lit/unlit stripes; far legs end higher (further back) and darker.
    const leg = (x: number, top: number, r: number, far: boolean): Part => {
      const foot = far ? 28.4 : 29.5;
      return {
        mat: "fur", prims: [cap(x, top, x - 0.3, foot, r, r * 0.8)], back: far,
        paint: [
          { mat: "fur", prims: [poly([[0, 0], [32, 0], [32, 32], [0, 32]])], level: far ? 2 : 3 },
          { mat: "antler", prims: [poly([[0, foot - 0.9], [32, foot - 0.9], [32, 32], [0, 32]])], level: far ? 1 : 2 },
        ],
      };
    };
    const ear = (bx: number, by: number, tx: number, ty: number, w: number): Part => ({
      mat: "fur", prims: leafBlade(bx, by, tx, ty, w),
      paint: [{ mat: "blossom", prims: [cap(bx + (tx - bx) * 0.3, by + (ty - by) * 0.3, bx + (tx - bx) * 0.7, by + (ty - by) * 0.7, 0.45)], level: 3 }],
    });
    const spots = (pts: [number, number][]) => ({ mat: "cream", prims: pts.map(([x, y]) => ell(x, y, 0.75)), level: 4 });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [ell(19, 26.4, 6.6, 3.4), ell(24.8, 24.6, 1.2, 1)], blend: 1.5, paint: [spots([[18.5, 24.6], [21.5, 24.4], [23.6, 26]])] },
        { mat: "fur", prims: [ell(13.4, 29, 2.2, 1), ell(17.6, 29.2, 2.2, 1)], paint: [{ mat: "fur", prims: [ell(16, 29, 16, 3)], level: 3 }] },
        ear(10, 17.2, 5.6, 15.6, 1.4),
        ear(17, 17.2, 21.2, 15.8, 1.4),
        { mat: "leaf", prims: [ell(11.4, 13.8, 1, 1.3, -15), ell(15.6, 13.8, 1, 1.3, 15)] },
        { mat: "blossom", prims: [ell(11.2, 12.6, 0.8), ell(15.8, 12.6, 0.8)], line: false },
        { mat: "fur", prims: [egg(13.5, 19, 5.2, 4.6, -0.2), ell(12.8, 22, 2.4, 1.7)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(12.8, 22.4, 2, 1.3)], level: 3 }] },
      );
      decals.push(...eyes([9, 18], [15, 18], pose, "tall"), ...blush([9, 21], [16, 21]), stamp(12, 22, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        leg(16.6, 24, 1, true),
        leg(25.2, 23.5, 1, true),
        { mat: "fur", prims: [ell(19.8, 22.6, 6.4, 3.4), cap(14, 22, 12.8, 16.5, 2.8, 2.2), ell(26, 20.8, 1.2, 1)], blend: 2,
          paint: [{ mat: "cream", prims: [ell(13.2, 20.6, 1.8, 2)], level: 3 }, spots([[18.4, 20.8], [21.6, 20.4], [24, 21.8], [20, 23]])] },
        leg(14.2, 24.5, 1.1, false),
        leg(23.4, 24, 1.1, false),
        { mat: "antler", prims: [path([[10.8, 11.2], [9.6, 8.2], [8.2, 6.2]], 0.9, 0.7), cap(9.7, 8.6, 11.2, 6.6, 0.7), path([[14.8, 11.2], [15.8, 8.2], [17.2, 6.2]], 0.9, 0.7), cap(15.7, 8.6, 14.2, 6.6, 0.7)] },
        { mat: "leaf", prims: [ell(7.6, 5.4, 1.5, 0.9, -50), ell(17.8, 5.4, 1.5, 0.9, 50)] },
        { mat: "blossom", prims: [ell(11.4, 6.2, 0.9), ell(14, 6.2, 0.9)], line: false },
        ear(9.2, 13, 4.8, 11.8, 1.4),
        ear(16.6, 13, 21, 12, 1.4),
        { mat: "fur", prims: [egg(12.8, 14.4, 4.6, 4.2, -0.2), ell(12.2, 17.2, 2.2, 1.6)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(12.2, 17.6, 1.9, 1.2)], level: 3 }] },
      );
      decals.push(...eyes([9, 13], [14, 13], pose, "tall"), ...blush([9, 16], [15, 16]), stamp(11, 17, ["kk"], { k: "eye:3" }));
    } else {
      parts.push(
        leg(16.8, 23, 1.15, true),
        leg(26.4, 22.4, 1.15, true),
        { mat: "fur", prims: [ell(20, 20.8, 7.6, 4), cap(14.6, 20, 12.8, 13.5, 3.2, 2.6), ell(27.4, 18.4, 1.4, 1.1)], blend: 2,
          paint: [{ mat: "cream", prims: [ell(13.8, 18.8, 1.8, 2.2), ell(27.8, 18.6, 0.9, 0.8)], level: 3 }, spots([[19, 18.6], [22.4, 18.2], [25, 19.4], [21, 21], [17.6, 20.8]])] },
        leg(14.4, 23.5, 1.3, false),
        leg(24.4, 23, 1.3, false),
        { mat: "antler", prims: [
          path([[10.6, 8.2], [8.8, 5.2], [5.6, 3.6], [2.6, 3.8]], 1.1, 0.7),
          cap(8.9, 5.6, 8.4, 1.8, 0.8, 0.55),
          cap(5.9, 3.8, 4.8, 1.2, 0.7, 0.5),
          path([[15, 8.2], [16.8, 5.2], [20, 3.6], [23, 3.8]], 1.1, 0.7),
          cap(16.7, 5.6, 17.2, 1.8, 0.8, 0.55),
          cap(19.7, 3.8, 20.8, 1.2, 0.7, 0.5),
        ] },
        { mat: "leaf", prims: [ell(3.4, 5.8, 1.6, 0.9, 25), ell(22.2, 5.8, 1.6, 0.9, -25)] },
        { mat: "blossom", prims: [ell(2.4, 3.4, 1.4), ell(8.4, 1.8, 1.4), ell(4.8, 1.4, 1.2), ell(6.9, 4.4, 1.1), ell(23.2, 3.4, 1.4), ell(17.2, 1.8, 1.4), ell(20.8, 1.4, 1.2), ell(18.7, 4.4, 1.1)] },
        ear(8.6, 10.4, 3.8, 9.4, 1.5),
        ear(17, 10.4, 21.8, 9.6, 1.5),
        { mat: "fur", prims: [egg(12.8, 11.8, 5.1, 4.4, -0.2), ell(12.2, 15, 2.5, 1.8)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(12.2, 15.4, 2.1, 1.3)], level: 3 }] },
        { mat: "glow", prims: [ell(29, 12.5, 1)], glow: true, line: false },
        { mat: "glow", prims: [ell(3.5, 17, 0.8)], glow: true, line: false },
        { mat: "glow", prims: [ell(12.8, 7.6, 0.9, 1.1)], glow: true },
      );
      decals.push(
        ...eyes([9, 11], [14, 11], pose, "round"), stamp(11, 15, ["kk"], { k: "eye:3" }),
        stamp(2, 3, ["y"], { y: "#ffe27a" }), stamp(23, 3, ["y"], { y: "#ffe27a" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 5 : 6));
    return { parts, decals };
  },
};

export const yggdrake: Species = {
  id: "yggdrake",
  name: "Yggdrake",
  element: "leaf",
  tier: "legendary",
  stages: ["Seedwyrm", "Saplingwyrm", "Yggdrake"],
  palette: { scale: "#79c79a", belly: "#f2e3b0", bark: "#a4744d", canopy: "#57b04c", fruit: "#ffcf40" },
  shiny: { scale: "#a99be8", belly: "#fbe6f0", canopy: "#ff9ec2", fruit: "#9ff4ff" },
  lore: "Carries a whole forest on its back and every story ever told in its rings. Its fruit ripens only for readers who finish what they start.",
  hint: "A forest that breathes.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "scale", prims: [path([[20, 28.5], [24, 28.5], [25.5, 26.3]], 1.4, 0.7)], back: true },
        { mat: "canopy", prims: [cap(16, 18.5, 16, 15.5, 0.6), ell(14.2, 14.8, 1.8, 1, -25), ell(17.8, 14.2, 1.8, 1, 25)] },
        { mat: "scale", prims: [egg(16, 24, 6, 5.6, 0.22)],
          paint: [{ mat: "bark", prims: [ell(16, 17.8, 6.5, 3)] }, { mat: "belly", prims: [ell(16, 27.8, 3, 1.9)] }] },
        { mat: "scale", prims: both(ell(12, 29.2, 1.8, 1.2)) },
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, ["kk"], { k: "scale:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "scale", prims: [path([[20, 27.5], [25, 28], [27, 25]], 1.6, 0.7)], back: true },
        { mat: "scale", prims: both(ell(9, 19, 3, 1.8, -35)), back: true },
        { mat: "bark", prims: [path([[19, 18], [20.5, 12], [22, 8.5]], 1.2, 0.8)] },
        { mat: "canopy", prims: [ell(22.5, 7, 3.6, 2.8), ell(19.5, 8, 2.2, 1.9)] },
        { mat: "scale", prims: [ell(16, 23.5, 6, 5), ell(16, 15.5, 5, 4.2)], blend: 3,
          paint: [{ mat: "belly", prims: [ell(16, 24.5, 3.5, 3.6)] }] },
        { mat: "bark", prims: both(cap(12.8, 12.4, 11.3, 9.5, 0.9, 0.6)) },
        { mat: "scale", prims: both(ell(12, 28.5, 2, 1.6)) },
      );
      decals.push(...eyes([12, 14], [18, 14], pose, "tall"), ...blush([10, 17], [20, 17]), stamp(15, 18, ["kk"], { k: "scale:1" }));
    } else {
      parts.push(
        { mat: "scale", prims: [path([[21, 27.5], [26.6, 27.6], [29.2, 24.6], [28.6, 21.6]], 1.9, 0.8)], back: true },
        { mat: "canopy", prims: leafBlade(28.6, 21.8, 29.6, 17.4, 1.3) },
        // leafy wings fanned from the shoulders
        { mat: "canopy", prims: [...leafBlade(10.6, 18.4, 2.4, 15.4, 2.1), ...leafBlade(21.4, 18.4, 29.6, 15.4, 2.1)] },
        { mat: "canopy", prims: [...leafBlade(10.4, 20, 2.6, 21.6, 1.8), ...leafBlade(21.6, 20, 29.4, 21.6, 1.8)] },
        // the tree on its back: one canopy mass with rounder puffs in front;
        // the head overlaps its lower edge
        { mat: "canopy", prims: [ell(16, 6.6, 12.6, 5.2), ell(4.4, 10, 3, 2.6), ell(27.6, 10, 3, 2.6)], blend: 2 },
        { mat: "canopy", prims: [ell(8.2, 5, 4.2, 2.9)] },
        { mat: "canopy", prims: [ell(23.8, 5, 4.2, 2.9)] },
        { mat: "canopy", prims: [ell(16, 3.8, 5.8, 3.2)] },
        { mat: "fruit", prims: [ell(3.8, 10.4, 1.2), ell(28.2, 10.4, 1.2), ell(19.8, 2.6, 1.2), ell(9.6, 4.4, 1.1), ell(24.6, 8.4, 1.1), ell(7.4, 9, 1)], glow: true, blend: 0, line: false },
        { mat: "scale", prims: [ell(16, 24.6, 7.6, 4.9), ell(16, 15.8, 6, 4.6), ell(16, 20, 3.8, 2)], blend: 3,
          paint: [{ mat: "belly", prims: [ell(16, 25.2, 4.3, 3.8), ell(16, 20.6, 2.6, 1.3), ell(16, 18.4, 2.8, 1.2)], level: 3 }] },
        { mat: "bark", prims: [...sym(path([[12.4, 12.2], [11.2, 9.8], [11.8, 8]], 1, 0.6)), ...sym(cap(11.3, 10, 9.4, 9.2, 0.6, 0.5))] },
        { mat: "scale", prims: sym(cap(10.6, 25.6, 10.2, 29.4, 2.1, 1.9)) },
        { mat: "bark", prims: sym(path([[8.6, 29.6], [6.6, 30], [5.2, 29.2]], 0.75, 0.5)), line: false },
      );
      decals.push(
        ...eyes([12, 15], [18, 15], pose, "round"), stamp(14, 18, ["k..k"], { k: "scale:1" }),
        sparkle(0, 14), sparkle(29, 0), sparkle(0, 0),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 1 : 24, stage === 2 ? 22 : 8));
    return { parts, decals };
  },
};


// ── local helpers ──

/** A primitive and its mirror across the vertical line x = cx. */
const sym = (p: Prim, cx = 16): Prim[] => both(p, cx * 2);

/** A ring of triangular spikes standing on an ellipse's rim: one per angle
 *  (0° = right, −90° = up), each `len` long with a base `hw` either side. */
function spikes(cx: number, cy: number, rx: number, ry: number, degs: number[], len: number, hw: number): Prim[] {
  return degs.map((deg) => {
    const a = (deg * Math.PI) / 180;
    const bx = cx + Math.cos(a) * rx * 0.85;
    const by = cy + Math.sin(a) * ry * 0.85;
    const nx = Math.cos(a) * (rx / Math.max(rx, ry));
    const ny = Math.sin(a) * (ry / Math.max(rx, ry));
    const nl = Math.hypot(nx, ny);
    const [ux, uy] = [nx / nl, ny / nl];
    const L = len + Math.min(rx, ry) * 0.15;
    return poly([[bx - uy * hw, by + ux * hw], [bx + ux * L, by + uy * L], [bx + uy * hw, by - ux * hw]], 0.25);
  });
}

/** Point on a ray from (cx, cy). */
function at(cx: number, cy: number, deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

// ── Nutkin · common ──

export const nutkin: Species = {
  id: "nutkin",
  name: "Nutkin",
  element: "leaf",
  tier: "common",
  stages: ["Acornlet", "Capkit", "Nutkin"],
  palette: { fur: "#e07f45", cream: "#f8e7c6", cap: "#a8804a", leaf: "#8cc84e" },
  shiny: { fur: "#9d92d6", cream: "#f3eeff", cap: "#d8b25a", leaf: "#ff9ec4" },
  lore: "Buries its favourite bookmarks and forgets where. Every spring a few of them sprout into oaks.",
  hint: "Wears its lunch as a hat.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Acorn cap: a dome with a pale scaly rim, cut flat underneath.
    const acornCap = (cx: number, cy: number, rx: number, ry: number, cutY: number): Part => ({
      mat: "cap", prims: [ell(cx, cy, rx, ry)], cut: [poly([[0, cutY], [32, cutY], [32, 32], [0, 32]])],
      paint: [{ mat: "cap", prims: [poly([[0, cutY - 1.2], [32, cutY - 1.2], [32, cutY], [0, cutY]])], level: 4 }],
    });
    const capDots = (x: number, y: number, rows: string[]) => stamp(x, y, rows, { d: "cap:2" });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[19, 28.4], [23.8, 27.4], [25, 23], [23.6, 19.6]], 2.6, 2.2)] },
        { mat: "fur", prims: [ell(16, 24, 6.6, 6)], paint: [{ mat: "cream", prims: [ell(16, 26.8, 3.2, 2.3)], level: 4 }] },
        { mat: "fur", prims: sym(ell(12.8, 29.4, 1.9, 1.1), 16) },
        acornCap(16, 20.6, 6.6, 4.8, 20.8),
        { mat: "cap", prims: [cap(16, 16, 16.7, 14.2, 0.7)] },
      );
      decals.push(capDots(13, 17, ["d...d", "..d.."]),...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, ["kk"], { k: "fur:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: [path([[18, 27.5], [23.5, 26], [25.5, 21], [24.8, 15.5], [22.5, 12.5], [20.3, 13.2]], 2.8, 2.2)] },
        { mat: "fur", prims: [ell(15, 17.5, 6.2, 5.2), egg(15, 24.5, 5.4, 5.2, 0.15)], blend: 3,
          paint: [{ mat: "cream", prims: [ell(15, 25.5, 3, 3.4), ell(15, 19.8, 3, 1.6)], level: 4 }] },
        { mat: "fur", prims: sym(cap(10.3, 13.8, 9.3, 10.8, 1.3, 0.5), 15) },
        acornCap(15, 14.2, 6.6, 4.4, 14.4),
        { mat: "cap", prims: [cap(15, 10.5, 15.8, 8.8, 0.7)] },
        { mat: "leaf", prims: [ell(17.6, 8.8, 1.8, 0.9, -20)], line: false },
        { mat: "fur", prims: sym(ell(13.7, 23.2, 1.5, 1.3), 15) },
        { mat: "fur", prims: sym(ell(11.6, 29.3, 2.2, 1.2), 15) },
      );
      decals.push(capDots(12, 11, ["d...d", "..d.."]), ...eyes([11, 16], [17, 16], pose, "tall"), ...blush([9, 19], [19, 19]), stamp(14, 19, ["kk"], { k: "fur:1" }));
    } else {
      parts.push(
        { mat: "fur", prims: [path([[16, 28.5], [23, 28], [27.8, 23], [28.6, 15.5], [26.5, 8.5], [22, 5], [17.5, 6.2], [17, 10], [20.5, 11.8]], 3.8, 2.3)],
          paint: [{ mat: "cream", prims: [path([[25, 26.5], [28.4, 21], [29.3, 14], [27.5, 7.5]], 1.2, 0.9)], level: 4 }] },
        { mat: "fur", prims: [ell(13, 15, 6.6, 5.6), egg(13, 23.8, 6.2, 6, 0.15)], blend: 3,
          paint: [{ mat: "cream", prims: [ell(13, 25, 3.6, 4), ell(13, 17.8, 3.4, 1.8)], level: 4 }] },
        { mat: "fur", prims: sym(cap(8, 11.5, 6.8, 7.8, 1.5, 0.5), 13) },
        acornCap(13, 11.6, 7, 4.8, 11.8),
        { mat: "cap", prims: [cap(13, 7.4, 14, 5.4, 0.8)] },
        { mat: "leaf", prims: [ell(16.3, 5.3, 2.2, 1, -25)], line: false },
        { mat: "fur", prims: sym(ell(10.2, 24.4, 1.6, 1.5), 13) },
        { mat: "leaf", prims: [egg(13, 24.5, 2.4, 2.6, -0.25)] },
        { mat: "cap", prims: [ell(13, 22.2, 2.8, 1.4), cap(13, 21, 13.4, 19.8, 0.55)] },
        { mat: "fur", prims: sym(ell(9.2, 29.2, 2.6, 1.3), 13) },
      );
      decals.push(capDots(10, 8, ["d...d", "..d.."]), ...eyes([9, 14], [15, 14], pose, "tall"), ...blush([7, 17], [17, 17]), stamp(12, 17, ["k.k", ".k."], { k: "fur:1" }));
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 2 : 24, stage === 2 ? 2 : 6));
    return { parts, decals };
  },
};

// ── Dewfrog · common ──

export const dewfrog: Species = {
  id: "dewfrog",
  name: "Dewfrog",
  element: "leaf",
  tier: "common",
  stages: ["Dewdrop", "Puddlehop", "Dewfrog"],
  palette: { skin: "#a8d85e", belly: "#f4f1c6", leaf: "#3aa870", dew: "#8fe4ff" },
  shiny: { skin: "#f29ab8", belly: "#fff0f4", leaf: "#e0823c", dew: "#ffe27a" },
  lore: "Never goes out without its leaf, in case of rain or spoilers. Reads puddle-side and croaks at every cliffhanger.",
  hint: "Brings its own shade to the pond.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Leaf umbrella: a half-dome with scalloped ribs underneath, pale veins
    // fanning from the stalk, and a drip-tip on one side.
    const brolly = (cx: number, cy: number, rx: number, ry: number, ribs: number): Part => {
      const scallops: Prim[] = [];
      for (let k = 0; k < ribs; k++) {
        const x = cx - rx + ((k + 0.5) * 2 * rx) / ribs;
        scallops.push(ell(x, cy + 0.9, rx / ribs - 0.15, 1.3));
      }
      const veins: Prim[] = [];
      for (const deg of ribs > 4 ? [-148, -90, -32] : [-90]) {
        const [x, y] = at(cx, cy + 0.2, deg, 1);
        veins.push(cap(x, y, ...at(cx, cy + 0.2, deg, Math.min(rx, ry * 1.6) * 0.85), 0.4, 0.3));
      }
      return {
        mat: "leaf",
        prims: [ell(cx, cy, rx, ry), cap(cx + rx - 0.8, cy - 0.2, cx + rx + 0.9, cy + 1.6, 0.9, 0.45)],
        cut: [poly([[0, cy + 0.4], [cx + rx - 1.2, cy + 0.4], [cx + rx - 1.2, 32], [0, 32]]), ...scallops],
        paint: [{ mat: "leaf", prims: veins, level: 4 }],
      };
    };
    if (stage === 0) {
      parts.push(
        { mat: "leaf", prims: [cap(21.5, 25, 21.5, 17.5, 0.6)] },
        brolly(21.5, 18, 4.4, 3, 3),
        { mat: "skin", prims: [ell(16, 25.3, 6.8, 4.8), ...sym(ell(13, 21.3, 2.4, 2.2), 16)], blend: 2, round: 3,
          paint: [{ mat: "belly", prims: [ell(16, 27.6, 4, 1.9)], level: 4 }] },
        { mat: "skin", prims: [ell(21.3, 25.2, 1.3, 1.2)] },
      );
      decals.push(...eyes([12, 20], [18, 20], pose, "tall"), ...blush([10, 24], [20, 24]), stamp(14, 25, ["k..k", ".kk."], { k: "skin:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "leaf", prims: [cap(23, 23, 23, 11, 0.7)] },
        brolly(20, 11.5, 8, 5, 4),
        { mat: "skin", prims: [ell(16, 23.5, 7.5, 5.5), ...sym(ell(12.8, 18.2, 2.6, 2.4), 16), ...sym(ell(9.6, 27, 3, 2.4), 16)], blend: 2.5, round: 3.5,
          paint: [{ mat: "belly", prims: [ell(16, 26, 4.6, 3)], level: 4 }] },
        { mat: "skin", prims: [cap(20, 25.5, 22.8, 23.5, 1.3, 1.2)] },
        { mat: "skin", prims: sym(ell(10.8, 29.4, 2.6, 1), 16), line: false },
      );
      decals.push(...eyes([12, 17], [18, 17], pose, "tall"), ...blush([10, 21], [20, 21]), stamp(13, 22, ["k....k", ".kkkk."], { k: "skin:1" }));
    } else {
      parts.push(
        { mat: "leaf", prims: [path([[24.8, 22], [25, 12], [24, 9]], 0.85, 0.7)] },
        brolly(16, 9.2, 14, 7.8, 6),
        { mat: "skin", prims: [ell(16, 22, 10, 7.2), ...sym(ell(11.8, 15.2, 3.2, 3), 16), ...sym(ell(7.4, 26.3, 3.6, 3.2), 16)], blend: 3, round: 4,
          paint: [{ mat: "belly", prims: [ell(16, 25, 6, 4)], level: 4 }] },
        { mat: "skin", prims: [cap(20.5, 24.5, 24.3, 21.6, 1.7, 1.6)] },
        { mat: "skin", prims: sym(ell(10.2, 29.5, 3.2, 1), 16), line: false },
      );
      decals.push(
        ...eyes([11, 14], [19, 14], pose, "round"), ...blush([8, 19], [22, 19]),
        stamp(12, 19, ["k......k", ".kkkkkk."], { k: "skin:1" }),
        stamp(30, 12, ["d", "d"], { d: "dew:4" }, true),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 26 : 25, stage === 2 ? 17 : 3));
    return { parts, decals };
  },
};

// ── Thornhog · rare ──

export const thornhog: Species = {
  id: "thornhog",
  name: "Rosethorn",
  element: "leaf",
  tier: "rare",
  stages: ["Thornlet", "Thornhog", "Rosethorn"],
  palette: { face: "#efd6ae", stem: "#5aa04a", rose: "#f0506e", nose: "#4a3140" },
  shiny: { face: "#f4e6d2", stem: "#6f7fd0", rose: "#f5f0ff", nose: "#3a2a50" },
  lore: "Curls into a bouquet when startled, which startles the reader more. Blooms a rose for every book it has been read to sleep with.",
  hint: "Every rose has one.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // A rose: a round bloom with a dark spiral, on a pair of sepal leaves.
    const rose = (x: number, y: number, r: number, bud = false) => {
      parts.push(
        { mat: "stem", prims: [ell(x - r * 0.7, y + r * 0.55, r * 0.7, r * 0.4, -30), ell(x + r * 0.7, y + r * 0.55, r * 0.7, r * 0.4, 30)], blend: 0.5 },
        { mat: "rose", prims: [bud ? egg(x, y - 0.2, r * 0.8, r, 0.35) : ell(x, y, r)] },
      );
      if (!bud) decals.push(stamp(Math.round(x - 1.5), Math.round(y - 1.5), ["dd.", "d.l", ".dd"], { d: "rose:1", l: "rose:4" }));
    };
    const ring = (from: number, to: number, n: number) => Array.from({ length: n }, (_, k) => from + ((to - from) * k) / (n - 1));
    if (stage === 0) {
      parts.push(
        { mat: "stem", prims: [ell(16, 24, 7, 5.6), ...spikes(16, 24, 7, 5.6, ring(-180, 0, 8), 1.8, 1.4)], blend: 0.8 },
      );
      rose(16, 17.3, 1.5, true);
      parts.push(
        { mat: "face", prims: [poly([[11.5, 22.6], [20.5, 22.6], [18.2, 26.4], [16, 27.6], [13.8, 26.4]], 1.4)], round: 3,
          cut: [poly([[13.6, 20], [18.4, 20], [16, 23.6]], 0.3)] },
        { mat: "face", prims: sym(ell(13, 29.6, 1.5, 0.9), 16) },
      );
      decals.push(...eyes([12, 23], [18, 23], pose, "tall"), ...blush([11, 26], [19, 26]), stamp(15, 27, ["kk"], { k: "nose:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "stem", prims: [ell(16, 21.5, 9, 7), ...spikes(16, 21.5, 9, 7, ring(-190, 10, 10), 2.8, 1.6)], blend: 0.6, back: true },
        { mat: "stem", prims: [ell(16, 22.5, 7.4, 5.8), ...spikes(16, 22.5, 7.4, 5.8, ring(-160, -20, 6), 2.2, 1.5)], blend: 0.6 },
      );
      rose(12, 13.6, 1.7, true);
      rose(20.5, 13, 2);
      parts.push(
        { mat: "face", prims: [poly([[10.8, 20.6], [21.2, 20.6], [18.6, 25], [16, 26.8], [13.4, 25]], 1.6)], round: 3.5,
          cut: [poly([[13.2, 18], [18.8, 18], [16, 22.2]], 0.3)] },
        { mat: "face", prims: sym(ell(12.2, 29.4, 2, 1.1), 16) },
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 24], [20, 24]), stamp(15, 26, ["kk"], { k: "nose:3" }));
    } else {
      parts.push(
        { mat: "stem", prims: [ell(16, 19.5, 12, 9.5), ...spikes(16, 19.5, 12, 9.5, ring(-195, 15, 12), 3.4, 1.9)], blend: 0.6, back: true },
        { mat: "stem", prims: [ell(16, 20.5, 9.6, 7.6), ...spikes(16, 20.5, 9.6, 7.6, ring(-170, -10, 9), 2.8, 1.8)], blend: 0.6 },
        { mat: "stem", prims: [ell(16, 21, 7, 5.5), ...spikes(16, 21, 7, 5.5, ring(-150, -30, 5), 2.2, 1.6)], blend: 0.6 },
      );
      rose(9, 10.6, 2.5);
      rose(16.4, 6.8, 2.7);
      rose(23.4, 10.2, 2.4);
      rose(4.6, 17.5, 1.8, true);
      rose(27.4, 17, 2);
      parts.push(
        { mat: "face", prims: [poly([[9.8, 19.6], [22.2, 19.6], [19.2, 24.4], [16, 26.4], [12.8, 24.4]], 1.8)], round: 4,
          cut: [poly([[12.8, 16.5], [19.2, 16.5], [16, 21.2]], 0.3)] },
        { mat: "face", prims: sym(ell(11.6, 29.4, 2.4, 1.2), 16) },
      );
      decals.push(
        ...eyes([12, 20], [18, 20], pose, "tall"), ...blush([10, 23], [20, 23]),
        stamp(15, 25, ["kk"], { k: "nose:3" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 1 : 3));
    return { parts, decals };
  },
};

// ── Kodama · rare ──

/** Kodama faces are hollow: dark holes, no highlight. */
function hollowEyes(l: [number, number], r: [number, number], pose: Pose, h = 3): Decal[] {
  const inks = { k: "eye:3" };
  if (pose !== "idle") return [stamp(l[0], l[1] + h - 1, ["kk"], inks), stamp(r[0], r[1] + h - 1, ["kk"], inks)];
  const rows = Array.from({ length: h }, () => "kk");
  return [stamp(l[0], l[1], rows, inks), stamp(r[0], r[1], rows, inks)];
}

export const kodama: Species = {
  id: "kodama",
  name: "Kodama",
  element: "leaf",
  tier: "rare",
  stages: ["Kodamote", "Kodamling", "Kodama"],
  palette: { body: "#e4f0dc", leaf: "#6cc24a", glow: "#d4ff8a", eye: "#24302a" },
  shiny: { body: "#c6d0ff", leaf: "#ff9ec4", glow: "#ffe27a", eye: "#1e2040" },
  lore: "Lives in the oldest shelf in the library and rattles its head when someone dog-ears a page. If one follows you home, the forest approves of your reading.",
  hint: "A rattle in the old wood.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "body", prims: sym(cap(13.8, 26, 13.4, 29.4, 1.3, 1.1), 16), back: true },
        { mat: "body", prims: [ell(16, 22, 7.4, 5.2), ell(16, 26, 4, 2.6)], blend: 3 },
        { mat: "glow", prims: [ell(24.5, 16, 1)], glow: true, line: false },
      );
      decals.push(...hollowEyes([12, 21], [18, 21], pose, 2), ...blush([10, 23], [20, 23]), stamp(15, 24, ["k"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "body", prims: sym(cap(14.3, 23, 13.3, 29.4, 1.1, 1), 16), back: true },
        { mat: "leaf", prims: [path([[21.8, 21.5], [23, 18.5], [24.2, 16.6]], 0.6, 0.5)] },
        { mat: "leaf", prims: [ell(23.4, 16, 1.8, 1, 35)] },
        { mat: "leaf", prims: [ell(26, 16, 2, 1.1, -25)] },
        { mat: "body", prims: [ell(16, 13.5, 7.4, 5.6), cap(16, 18, 16, 24.5, 2.2, 2.8)], blend: 2 },
        { mat: "body", prims: [path([[18, 19.5], [20.5, 21.5], [21.8, 20.4]], 0.9, 0.8)] },
        { mat: "body", prims: [path([[14, 19.5], [11.5, 21.5], [10.5, 23.5]], 0.9, 0.8)] },
        { mat: "glow", prims: [ell(6, 9, 1)], glow: true, line: false },
      );
      decals.push(...hollowEyes([12, 12], [18, 12], pose), ...blush([10, 15], [20, 15]), stamp(15, 16, ["k", "k"], { k: "eye:3" }));
    } else {
      parts.push(
        { mat: "leaf", prims: [path([[25, 29.5], [24.6, 22], [25.4, 12.5]], 0.85, 0.6), cap(25, 17, 27.2, 15, 0.5)] },
        { mat: "leaf", prims: [ell(23, 12, 2.4, 1.3, 30), ell(28, 14.2, 1.8, 1, -35)] },
        { mat: "leaf", prims: [ell(26.4, 9.6, 1.6, 2.6, 15)] },
        { mat: "body", prims: sym(cap(14.5, 21, 13.8, 29.5, 1.2, 1.1), 16), back: true },
        { mat: "body", prims: [cap(16, 12, 16, 22, 1.8, 2.8)], blend: 1 },
        { mat: "body", prims: [path([[17.8, 16], [21, 18], [24, 17.5]], 1, 0.9)] },
        { mat: "body", prims: [path([[14, 16], [11, 19], [10, 22]], 1, 0.9)] },
        { mat: "body", prims: [ell(15.6, 8.4, 7.6, 5.8, -12)] },
        { mat: "glow", prims: [ell(4.5, 14, 1)], glow: true, line: false },
        { mat: "glow", prims: [ell(28.5, 23, 0.9)], glow: true, line: false },
      );
      decals.push(
        ...hollowEyes([11, 7], [17, 6], pose), stamp(14, 11, ["k", "k"], { k: "eye:3" }),
        // the rattle: motion ticks either side of the tilted head
        stamp(5, 5, [".r", "r.", ".r"], { r: "body:2" }, true),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 2 : 24, stage === 2 ? 20 : 3));
    return { parts, decals };
  },
};

// ── Bramblebear · epic ──

export const bramblebear: Species = {
  id: "bramblebear",
  name: "Bramblebear",
  element: "leaf",
  tier: "epic",
  stages: ["Brambub", "Berrycub", "Bramblebear"],
  palette: { fur: "#b27a4c", muzzle: "#f2ddb4", moss: "#6cb04a", berry: "#ff4f86", petal: "#fff3f7" },
  shiny: { fur: "#6270b4", muzzle: "#e2e8ff", moss: "#8fe0c8", berry: "#ffd45c", petal: "#ffe0f0" },
  lore: "Naps so long between chapters that moss grows on its shoulders. Shares its berries with anyone who reads aloud.",
  hint: "Crowned in thorns, sweet underneath.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const flower = (x: number, y: number) =>
      stamp(x - 1, y - 1, [".p.", "pcp", ".p."], { p: "petal:4", c: "#ffe27a" });
    const berries = (pts: [number, number, number][]): Part => ({
      mat: "berry", prims: pts.map(([x, y, r]) => ell(x, y, r)), glow: true, blend: 0,
    });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: sym(ell(11.3, 17.9, 1.9), 16), paint: [{ mat: "muzzle", prims: sym(ell(11.3, 18.1, 0.9), 16), level: 4 }] },
        { mat: "fur", prims: [ell(16, 23.4, 7, 6.2)],
          paint: [{ mat: "muzzle", prims: [ell(16, 25, 2.5, 1.7)], level: 4 }] },
        { mat: "moss", prims: [ell(14.2, 16.9, 1.8, 0.9, 25), ell(17.8, 16.9, 1.8, 0.9, -25)], blend: 0.5 },
        berries([[16, 16.2, 1.2]]),
        { mat: "fur", prims: sym(ell(12.6, 29.3, 2, 1.1), 16) },
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 24], [20, 24]), stamp(15, 24, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: sym(ell(10.8, 11, 2.3), 16), paint: [{ mat: "muzzle", prims: sym(ell(10.8, 11.2, 1.1), 16), level: 4 }] },
        { mat: "fur", prims: [ell(16, 16, 7.8, 6), egg(16, 24.8, 5.6, 5, 0.12)], blend: 3,
          paint: [{ mat: "muzzle", prims: [ell(16, 18.6, 2.8, 1.9), ell(16, 25.8, 3.2, 2.8)], level: 4 }] },
        { mat: "moss", prims: [path([[10.5, 12.2], [13, 10.6], [16, 10.2], [19, 10.6], [21.5, 12.2]], 0.9, 0.9), ell(13, 9.6, 1.4, 0.8, -30), ell(19, 9.6, 1.4, 0.8, 30)], blend: 0.8 },
        berries([[16, 9.2, 1.3], [11.4, 10.4, 1], [20.6, 10.4, 1]]),
        { mat: "moss", prims: [ell(21.8, 20.4, 2.8, 1.8, -35), ell(23, 22.4, 1.5, 1.5)], blend: 1 },
        { mat: "fur", prims: sym(ell(11.4, 24.2, 1.7, 2.2), 16) },
        { mat: "fur", prims: sym(ell(12.2, 29.2, 2.5, 1.3), 16) },
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"), ...blush([9, 17], [21, 17]), stamp(15, 17, ["kk"], { k: "eye:3" }),
        flower(22, 20),
      );
    } else {
      parts.push(
        { mat: "moss", prims: [...sym(ell(5.2, 15.8, 3.4, 3), 16), ...sym(ell(8.2, 13.2, 2.6, 2.4), 16)], blend: 1.2, back: true },
        { mat: "fur", prims: sym(ell(8.8, 6.8, 2.8), 16), paint: [{ mat: "muzzle", prims: sym(ell(8.8, 7, 1.4), 16), level: 4 }] },
        { mat: "fur", prims: [ell(16, 23, 12, 7.2), ell(16, 12.8, 8.2, 6.4)], blend: 4,
          paint: [{ mat: "muzzle", prims: [ell(16, 16, 3.6, 2.5)], level: 4 }, { mat: "muzzle", prims: [ell(16, 25.2, 4.6, 3.8)], level: 4 }] },
        // moss mantle over the shoulders, dripping in lumps down the flanks
        { mat: "moss", prims: [
          ...sym(path([[11, 17.6], [7, 17.6], [4.5, 20]], 2.4, 2), 16),
          ...sym(ell(4.2, 22.6, 2.2, 2.4), 16), ...sym(ell(7.2, 20.8, 1.8, 2), 16),
        ], blend: 1.6 },
        { mat: "moss", prims: [path([[9.4, 8.6], [12.4, 6.6], [16, 6], [19.6, 6.6], [22.6, 8.6]], 1, 1), ell(12.6, 5.4, 1.6, 0.9, -30), ell(19.4, 5.4, 1.6, 0.9, 30)], blend: 0.8 },
        berries([[16, 4.6, 1.5], [10.4, 6.2, 1.2], [21.6, 6.2, 1.2], [5.2, 19.2, 1], [26.8, 19.2, 1]]),
        { mat: "fur", prims: sym(ell(9.6, 24.2, 2.2, 2.8), 16) },
        { mat: "fur", prims: sym(ell(10.2, 29.1, 3.2, 1.6), 16), paint: [{ mat: "muzzle", prims: sym(ell(10.2, 29.4, 1.8, 0.8), 16), level: 4 }] },
      );
      decals.push(
        ...eyes([12, 12], [18, 12], pose, "round"),
        stamp(15, 15, ["kk", ".."], { k: "eye:3" }),
        flower(8, 18), flower(24, 18), flower(3, 23),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 1 : 4));
    return { parts, decals };
  },
};

export const LEAF: Species[] = [sproutling, mossback, nutkin, dewfrog, mandrake, thornhog, kodama, bloomstag, bramblebear, yggdrake];
