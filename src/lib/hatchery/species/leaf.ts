import type { Pose, Species } from "../kit.ts";
import { awake, blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move } from "../motion.ts";
import { ease, pulse, rig, rise, sine, stepped } from "../motion.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, egg, ell, path, poly } from "../pixel.ts";

/** A leaf-shaped ear or blade from base (bx, by) to tip (tx, ty), widest a
 *  third of the way up. */
function leafBlade(bx: number, by: number, tx: number, ty: number, w: number): Prim[] {
  const mx = bx + (tx - bx) * 0.38;
  const my = by + (ty - by) * 0.38;
  return [cap(bx, by, mx, my, w * 0.6, w), cap(mx, my, tx, ty, w, 0.45)];
}

// ── motion helpers ──

/** The breath: the body steps between two poses on a slow rise. */
const breath = stepped(rise(1));

/** An act's envelope: eased in over [i0, i1] and out over [o0, o1], exactly
 *  0 outside the act (a < 0) and at both of its ends. */
const envelope = (a: number, i0: number, i1: number, o0: number, o1: number) =>
  a < 0 ? 0 : ease(i0, i1)(a) * (1 - ease(o0, o1)(a));

/** A damped sway over [from, from + len] of the act: `n` slow swings that die
 *  away, 0 elsewhere. */
const settle = (a: number, from: number, len: number, n = 1.5) => {
  const x = (a - from) / len;
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * 2 * n * x) * (1 - x) ** 2;
};

/** Every part and decal rides these moves too (a hop, a lean). */
function carry(ms: Move[], parts: Part[], decals: Decal[]) {
  if (!ms.length) return;
  rig(ms, ...parts);
  rig(ms, ...decals);
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
  // The leaf ears sway on a breeze, a ripple running out to their tips,
  // over a soft breath with the head riding a beat behind. Its act is a
  // little bunny hop: a crouch, a soft two-pixel hop with the ears
  // trailing, and a landing that sets the leaves rustling.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const calm = pose === "sleep" ? 0.4 : 1;
    const up = a < 0 ? 0 : pulse(0.24, 0.38)(a);
    const crouch = a < 0 ? 0 : Math.round(pulse(0.1, 0.17)(a) + pulse(0.57, 0.17)(a));
    const look = up > 0.6 ? "blink" : pose;
    const rib = (bx: number, by: number, tx: number, ty: number) => ({
      mat: "leaf", prims: [cap(bx, by, bx + (tx - bx) * 0.8, by + (ty - by) * 0.8, 0.35)], level: 2,
    });
    /** An ear sways on the breeze; in the hop it trails outward and then
     *  rustles as it lands. `out` is the outward turn's sign. */
    const ear = (base: V, len: number, out: number, phase: number): Move[] => [
      { at: base, wave: sine(1, phase), turn: -6 * out * calm, bend: len, lag: 0.3 },
      { at: base, wave: () => (a < 0 ? 0 : pulse(0.3, 0.36)(a) + 0.8 * settle(a, 0.6, 0.38)), turn: -8 * out, bend: len },
    ];
    // The hop carries everything; the crouch squashes all but the feet.
    const hop: Move[] = a < 0 ? [] : [{ at: [16, 30], wave: () => up, shift: [0, -2] }];
    const squash: Move[] = a < 0 ? [] : [{ at: [16, 30], wave: () => crouch, grow: [0.04, -0.06] }];
    let head: Move[];
    if (stage === 0) {
      // One blob: it swells as a whole, the sprout and the face riding it.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.08] };
      const face: Move = { at: [16, 30], wave: breath, shift: [0, -1] };
      head = [face, ...squash];
      parts.push(
        ...rig([...ear([16, 18.5], 5, 1, 0), swell, ...squash], { mat: "leaf", prims: [cap(16, 18.5, 16, 16, 0.6), ell(13.6, 15.4, 2.4, 1.2, -25), ell(18.4, 15.4, 2.4, 1.2, 25)] }),
        ...rig([swell, ...squash], { mat: "fur", prims: [egg(16, 24, 7, 6.2, 0.12)], paint: [{ mat: "cream", prims: [ell(16, 27.6, 3, 1.7)], level: 3 }] }),
        { mat: "fur", prims: sym(ell(12.8, 29.6, 1.9, 1), 16), line: false },
      );
      decals.push(...rig(head, ...eyes([12, 22], [18, 22], look, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, [".k.".slice(0, 2)], { k: "fur:1" })));
    } else {
      const chest: Move = { at: [16, 30], wave: breath, grow: [0.02, stage === 1 ? 0.1 : 0.08] };
      const lift: Move = { at: [16, 16], wave: (u) => breath(u - 0.08), shift: [0, -1] };
      head = [lift, ...squash];
      if (stage === 1) {
        parts.push(
          ...rig([...ear([13, 12.5], 9, 1, 0), ...head], { mat: "leaf", prims: leafBlade(13, 12.5, 10.6, 4.2, 2.2), paint: [rib(13, 12.5, 10.6, 4.2)] }),
          ...rig([...ear([19, 12.5], 9, -1, 0.5), ...head], { mat: "leaf", prims: leafBlade(19, 12.5, 21.4, 4.2, 2.2), paint: [rib(19, 12.5, 21.4, 4.2)] }),
          ...rig(squash, { mat: "fur", prims: [...rig([lift], ell(16, 17.4, 7.2, 5.8)), ...rig([chest], egg(16, 25, 5.4, 4.8, 0.1)), ...rig([lift], ...sym(ell(10, 19.6, 1.9, 1.5), 16))], blend: 2.5,
            paint: [{ mat: "cream", prims: rig([chest], ell(16, 26, 3.2, 3)), level: 3 }] }),
          { mat: "fur", prims: sym(ell(12.2, 29.4, 2.4, 1.2), 16) },
        );
        decals.push(...rig(head, ...eyes([12, 16], [18, 16], look, "tall"), ...blush([10, 19], [20, 19]), stamp(15, 19, ["kk"], { k: "fur:1" })));
      } else {
        parts.push(
          ...rig([...ear([12.6, 9.5], 10, 1, 0), ...head], { mat: "leaf", prims: leafBlade(12.6, 9.5, 8.6, 0.8, 2.8), paint: [rib(12.6, 9.5, 8.6, 0.8)] }),
          ...rig([...ear([19.4, 9.5], 9, -1, 0.5), ...head], { mat: "leaf", prims: leafBlade(19.4, 9.5, 27.2, 5, 2.6), paint: [rib(19.4, 9.5, 27.2, 5)] }),
          ...rig(squash, { mat: "fur", prims: [...rig([lift], ell(16, 14.6, 7.6, 6)), ...rig([chest], egg(16, 24.2, 7.2, 6, 0.22)), ...rig([lift], ...sym(ell(9.4, 17.2, 2.3, 1.8, 15), 16))], blend: 4.5,
            paint: [{ mat: "cream", prims: [...rig([chest], ell(16, 25.4, 4, 3.8)), ...rig([lift], ell(16, 17.4, 2.6, 1.4))], level: 3 }] }),
          ...rig(head, { mat: "flower", prims: [ell(11.2, 7.6, 1.6), ell(13.6, 7.2, 1.5), ell(12.2, 5.6, 1.4)], blend: 0.6 }),
          { mat: "fur", prims: sym(ell(11.2, 29.3, 3, 1.4), 16) },
        );
        decals.push(...rig(head,
          ...eyes([12, 13], [18, 13], look, "tall"),
          ...blush([10, 16], [20, 16]),
          stamp(15, 16, ["kk", ".."], { k: "flower:2" }),
          stamp(12, 6, ["y"], { y: "#ffe27a" }),
        ));
      }
    }
    carry(hop, parts, decals);
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 25 : 24, stage === 2 ? 12 : 4));
    return { parts, decals, head: [...head, ...hop], neck: [...head, ...hop] };
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
  // A slow, deep breath lifts the shell and everything growing on it, the
  // head following a beat later; the mushroom and the sapling on its back
  // nod in the air. Its act is a long, contented stretch: the neck eases
  // out of the shell with eyes closed, the mushrooms breathe out a few
  // drifting spores, and it settles back in.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const stretch = envelope(a, 0.06, 0.4, 0.62, 0.94);
    const look = stretch > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    /** The head rides the breath a beat late, and the stretch holds it up
     *  two pixels. */
    const head: Move[] = [{ at: [16, 24], wave: (u) => Math.max(breath(u - 0.12), Math.round(2 * stretch)), shift: [0, -1] }];
    /** Whatever grows on top of the shell rises with it. */
    const top: Move = { at: [16, 10], wave: breath, shift: [0, -1] };
    /** A few spores drift up from a mushroom cap while it stretches. */
    const spores = (x: number, y: number, h: number, seed: number, n = 3) => {
      for (let k = 0; a >= 0 && k < n; k++) {
        const f = (a - 0.32 - 0.1 * k - 0.04 * seed) / 0.34;
        if (f < 0 || f >= 1) continue;
        const sx = Math.round(x + (k - 1) * 1.2 + Math.sin(f * 5 + k * 2) * 0.7);
        decals.push(stamp(sx, Math.round(y - 1 - f * h), ["s"], { s: f < 0.6 ? "moss:5" : "moss:4" }, true));
      }
    };
    if (stage === 0) {
      const shell: Move = { at: [16, 28.5], wave: breath, grow: [0.015, 0.07] };
      const nod: Move[] = [
        { at: [16, 17.5], wave: sine(1, 0.15), turn: 6 * calm },
        { at: [16, 17.5], wave: () => settle(a, 0.3, 0.6, 1), turn: 9 },
      ];
      parts.push(
        ...rig([shell], { mat: "shell", prims: [ell(16, 22.5, 8, 6)] }),
        ...rig([...nod, top], { mat: "moss", prims: [ell(14.5, 14.9, 1.5, 1.3, 30), ell(17.5, 14.9, 1.5, 1.3, -30), ell(16, 12.6, 1.3, 1.5), cap(16, 15.5, 16, 17.5, 0.6)], blend: 0 }),
        ...rig(head, { mat: "skin", prims: [ell(16, 25, 5.2, 4.4)] }),
        { mat: "skin", prims: both(ell(10.3, 28.9, 1.9, 1.3)) },
      );
      decals.push(...rig(head, ...eyes([12, 23], [18, 23], look, "tall"), ...blush([11, 26], [19, 26]), stamp(15, 27, ["kk"], { k: "eye:3" })));
    } else if (stage === 1) {
      const shell: Move = { at: [16, 26], wave: breath, grow: [0.015, 0.067] };
      const nod: Move = { at: [21, 13.5], wave: sine(1, 0.3), turn: 10 * calm };
      parts.push(
        ...rig([shell], { mat: "shell", prims: [ell(16, 20, 10.5, 7.5)], cut: [FLOOR],
          paint: [{ mat: "moss", prims: [ell(11.5, 15, 3.6, 2.4), ell(19.5, 14, 3.2, 2.2), ell(23.5, 18, 1.8, 1.8)] }] }),
        { mat: "shell", prims: [ell(16, 25.5, 10.5, 2)] },
        ...rig([nod, top], { mat: "white", prims: [cap(21, 13.5, 21, 11, 0.8)] }, { mat: "cap", prims: [ell(21, 10.6, 2.2, 1.3)] }),
        ...rig(head, { mat: "skin", prims: [ell(16, 24, 5, 4.3)] }),
        { mat: "skin", prims: both(ell(9, 28.6, 2.2, 1.6)) },
      );
      decals.push(...rig(head, ...eyes([12, 22], [18, 22], look, "tall"), ...blush([11, 25], [19, 25]), stamp(15, 26, ["kk"], { k: "eye:3" })));
      spores(21, 8 - breath(a), 5, 0);
    } else {
      const shell: Move = { at: [16, 25], wave: breath, grow: [0.012, 0.07] };
      const sway: Move = { at: [19.5, 9], wave: sine(1, 0.2), turn: 7 * calm, bend: 6, lag: 0.3 };
      parts.push(
        ...rig([shell], { mat: "shell", prims: [ell(16, 19, 13.5, 11)], cut: [poly([[0, 25], [32, 25], [32, 32], [0, 32]])],
          paint: [{ mat: "moss", prims: [ell(16, 10.5, 12.5, 5), ell(6.5, 14, 2.2, 3.2), ell(11, 15.5, 2.2, 2.6), ell(16.5, 14.5, 1.8, 2.8), ell(21.5, 15.5, 2.4, 2.6), ell(26, 13.5, 1.8, 3)] },
            { mat: "shell", prims: [ell(6.4, 20.4, 1.6, 1.3), ell(25.6, 20.4, 1.6, 1.3), ell(9.6, 19.6, 1.2, 1), ell(22.4, 19.6, 1.2, 1)], level: 4 }] }),
        { mat: "shell", prims: [ell(16, 25, 13.2, 2.4)] },
        ...rig([top],
          { mat: "white", prims: [cap(8, 11, 8, 7.5, 1), cap(11.5, 9.5, 11.5, 7.5, 0.8)] },
          { mat: "cap", prims: [ell(8, 6.8, 2.8, 2)], cut: [poly([[0, 7.4], [32, 7.4], [32, 32], [0, 32]])] },
          { mat: "cap", prims: [ell(11.5, 7.4, 1.9, 1.5)], cut: [poly([[0, 7.8], [32, 7.8], [32, 32], [0, 32]])] },
        ),
        ...rig([sway, top],
          { mat: "shell", prims: [path([[19.5, 9], [20.5, 6.5], [19, 4.5]], 1.1, 0.7), cap(20.3, 6.8, 22.5, 5.8, 0.6)] },
          { mat: "moss", prims: [ell(17.5, 3.4, 2.6, 1.6), ell(22.8, 4.6, 2.2, 1.4)] },
        ),
        ...rig(head, { mat: "skin", prims: [ell(16, 23, 5.5, 4.6)] }),
        { mat: "skin", prims: both(ell(8, 28.4, 2.8, 2)) },
      );
      decals.push(
        ...rig(head, ...eyes([12, 21], [18, 21], look, "round"), ...blush([11, 24], [19, 24]), stamp(14, 24, ["k..k", ".kk."], { k: "eye:3" })),
        ...rig([top], stamp(7, 5, ["w..", "..w"], { w: "white:4" }), stamp(11, 6, ["w"], { w: "white:4" })),
      );
      spores(8, 5 - breath(a), 4, 0, 2);
      spores(11.5, 6 - breath(a), 3, 1, 2);
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals, head, neck: head };
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
  // The leaves stir unevenly over a slow breath, the root body rising and
  // the leaves following a beat later. Its act is a grumble: brows down
  // and eyes squeezed shut, it rocks side to side on its roots muttering,
  // the leaves bristling a beat behind, then it settles with a huff.
  motion: { idle: 3.6, sleep: 5.2, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const grumble = envelope(a, 0.04, 0.24, 0.7, 0.96);
    /** Two slow rocks, side to side, under the grumble's envelope. */
    const rockAt = (x: number) => (x < 0 ? 0 : envelope(x, 0.04, 0.24, 0.7, 0.96) * Math.sin(Math.PI * 4 * (x - 0.1)));
    const look = grumble > 0.5 ? "blink" : pose;
    const mutter = grumble > 0.4 && Math.abs(Math.sin(Math.PI * 4 * (a - 0.1))) > 0.5;
    const frown = grumble > 0.3 ? 1 : 0;
    const calm = pose === "sleep" ? 0.4 : 1;
    const rock: Move[] = a < 0 ? [] : [{ at: [16, 30], wave: () => rockAt(a), turn: [4, 3, 2.5][stage] }];
    /** The body rises on the breath; the leaves follow a beat later. */
    const lift: Move = { at: [16, 16], wave: breath, shift: [0, -1] };
    const follow: Move = { at: [16, 10], wave: (u) => breath(u - 0.1), shift: [0, -1] };
    const rib = (bx: number, by: number, tx: number, ty: number) => ({
      mat: "leaf", prims: [cap(bx, by, bx + (tx - bx) * 0.75, by + (ty - by) * 0.75, 0.35)], level: 4,
    });
    /** Each leaf stirs on its own, a ripple running out to its tip, and
     *  lags the rocking a beat. */
    const stir = (bx: number, by: number, tx: number, ty: number, phase: number): Move[] => {
      const len = Math.hypot(tx - bx, ty - by);
      return [
        { at: [bx, by], wave: sine(1, phase), turn: 5 * calm, bend: len, lag: 0.3 },
        { at: [bx, by], wave: () => rockAt(a - 0.07), turn: -4, bend: len },
        follow,
      ];
    };
    const blade = (bx: number, by: number, tx: number, ty: number, w: number, back = false, phase = 0): Part =>
      rig(stir(bx, by, tx, ty, phase), {
        mat: "leaf", prims: leafBlade(bx, by, tx, ty, w), back, paint: back ? [] : [rib(bx, by, tx, ty)],
      })[0];
    const flower = (x: number, y: number, r: number, ms: Move[]): Part[] => rig(ms,
      { mat: "flower", prims: [ell(x - r * 0.55, y, r * 0.7), ell(x + r * 0.55, y, r * 0.7), ell(x, y - r * 0.55, r * 0.7), ell(x, y + r * 0.55, r * 0.7)], blend: 0.4 },
    );
    const grumpy = (lx: number, rx: number, y: number) => [
      stamp(lx, y + frown, ["k.", ".k"], { k: "root:1" }), stamp(rx, y + frown, [".k", "k."], { k: "root:1" }),
    ];
    if (stage === 0) {
      parts.push(
        blade(15, 18, 12.4, 12.6, 1.6, false, 0),
        blade(17, 18, 19.6, 12.6, 1.6, false, 0.35),
        { mat: "root", prims: [...rig([lift], egg(16, 23, 6, 5.5, -0.25)), path([[16, 27], [16.4, 29], [17.6, 30]], 1.1, 0.6)] },
      );
      decals.push(...rig([lift], ...eyes([12, 21], [18, 21], look, "tall"), ...blush([11, 24], [19, 24]), stamp(15, 25, mutter ? ["kk", "kk"] : ["kk"], { k: "root:1" })));
    } else if (stage === 1) {
      parts.push(
        blade(16, 12, 16, 4.2, 1.9, true, 0.6),
        blade(14.5, 13, 9.6, 7.4, 1.8, false, 0),
        blade(17.5, 13, 22.4, 7.4, 1.8, false, 0.35),
        { mat: "root", prims: [...rig([lift], egg(16, 19, 6.6, 6.2, -0.25)), ...sym(path([[13.6, 23], [12.8, 26.5], [11.8, 29.5]], 1.6, 1)), ...rig([lift], ...sym(path([[10, 18.5], [8, 21], [7.6, 22.8]], 1.2, 0.9)))], blend: 2, round: 4 },
      );
      decals.push(...rig([lift], ...eyes([12, 17], [18, 17], look, "tall"), ...grumpy(12, 18, 15), ...blush([10, 20], [20, 20]), stamp(15, 21, mutter ? ["kk", "kk"] : ["kk"], { k: "root:1" })));
    } else {
      const backL = stir(13.5, 9.8, 4.4, 5, 0.2);
      const backR = stir(18.5, 9.8, 27.6, 5, 0.75);
      parts.push(
        blade(16, 9, 16, 0.6, 2.4, true, 0.5),
        ...rig(backL, { mat: "leaf", prims: leafBlade(13.5, 9.8, 4.4, 5, 2.1), back: true, paint: [] }),
        ...rig(backR, { mat: "leaf", prims: leafBlade(18.5, 9.8, 27.6, 5, 2.1), back: true, paint: [] }),
        blade(15, 10, 9.6, 1.8, 2.3, false, 0),
        blade(17, 10, 22.4, 1.8, 2.3, false, 0.4),
        { mat: "root", prims: [
          ...rig([lift], egg(16, 16.5, 7.8, 7.4, -0.22)),
          ...sym(path([[13.2, 21.5], [12.2, 25.5], [10.8, 29.5]], 2.1, 1.3)),
          ...rig([lift], ...sym(path([[9.4, 14.5], [6.4, 18.5], [5.2, 22.4]], 1.8, 1.1))),
          ...rig([lift], ...sym(cap(5.4, 22, 7, 23.6, 0.8, 0.6))),
          ...sym(cap(10.6, 29.4, 8.8, 29.8, 0.8, 0.6)),
        ], blend: 2.2, round: 4.5 },
        ...flower(10.2, 8.6, 1.9, backL),
        ...flower(22, 8, 1.7, backR),
      );
      decals.push(
        ...rig([lift], ...eyes([12, 15], [18, 15], look, "tall"), ...grumpy(12, 18, 13),
          ...blush([10, 18], [20, 18]),
          stamp(14, 20, mutter ? [".kk.", "k..k", ".kk."] : [".kk.", "k..k"], { k: "eye:3" })),
        ...rig(backL, stamp(10, 8, ["y"], { y: "#ffe27a" })), ...rig(backR, stamp(22, 8, ["y"], { y: "#ffe27a" })),
      );
    }
    carry(rock, parts, decals);
    if (pose === "sleep") decals.push(zzz(25, 4));
    return { parts, decals, head: [lift, ...rock], neck: [lift, ...rock] };
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
  // A slow breath through the barrel, the head following a beat later; one
  // ear swivels now and then, the tail gives a soft flick, and the adult's
  // fireflies drift in small loops. Its act is a graceful bow to sniff the
  // flowers: the head dips with eyes closed, its blossoms glint, and a
  // firefly rises from the grass and drifts away.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const bow = envelope(a, 0.06, 0.34, 0.66, 0.94);
    const look = bow > 0.45 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const chest: Move = { at: [20, 27], wave: breath, grow: [0.015, 0.1] };
    /** The head rides the breath a beat late; the bow dips it about the
     *  base of the neck. */
    const head = (neck: V, turn: number): Move[] => [
      { at: neck, wave: (u) => breath(u - 0.1), shift: [0, -1] },
      { at: neck, wave: () => bow, turn: -turn, shift: [0, 1] },
    ];
    /** The near ear sways; the far one swivels back once a loop. */
    const earL = (bx: number, by: number): Move => ({ at: [bx, by], wave: sine(1, 0.1), turn: 6 * calm, bend: 5, lag: 0.3 });
    const earR = (bx: number, by: number): Move => ({ at: [bx, by], wave: pulse(0.55, 0.3), turn: -12 * calm, bend: 5 });
    const flick = (x: number, y: number): Move => ({ at: [x, y], wave: pulse(0.2, 0.22), shift: [0, -1] });
    /** A firefly rises from the grass by the muzzle and drifts away. */
    const firefly = (x: number, y: number, h: number) => {
      const f = (a - 0.22) / 0.7;
      if (a < 0 || f <= 0 || f >= 1) return;
      const fx = Math.round(x - f * 3 + Math.sin(f * Math.PI * 3) * 1.2);
      const fy = Math.round(y - f * h);
      decals.push(stamp(fx, fy, ["g"], { g: f < 0.12 || f > 0.88 ? "glow:2" : "glow:4" }, true));
    };
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
    const spots = (pts: [number, number][], ms: Move[] = []) => ({ mat: "cream", prims: rig(ms, ...pts.map(([x, y]) => ell(x, y, 0.75))), level: 4 });
    const glint = (x: number, y: number, ms: Move[]) => {
      if (a >= 0) decals.push(...rig(ms, ...twinkle(x, y, a, 0.36, "#fff4c2", 0.22), ...twinkle(x, y, a, 0.5, "#fff4c2", 0.2)));
    };
    let hm: Move[];
    if (stage === 0) {
      hm = head([14, 24], 5);
      const chest0: Move = { at: [19, 29.8], wave: breath, grow: [0.015, 0.15] };
      parts.push(
        ...rig([chest0], { mat: "fur", prims: [ell(19, 26.4, 6.6, 3.4), ...rig([flick(24.8, 24.6)], ell(24.8, 24.6, 1.2, 1))], blend: 1.5, paint: [spots([[18.5, 24.6], [21.5, 24.4], [23.6, 26]])] }),
        { mat: "fur", prims: [ell(13.4, 29, 2.2, 1), ell(17.6, 29.2, 2.2, 1)], paint: [{ mat: "fur", prims: [ell(16, 29, 16, 3)], level: 3 }] },
        ...rig([earL(10, 17.2), ...hm], ear(10, 17.2, 5.6, 15.6, 1.4)),
        ...rig([earR(17, 17.2), ...hm], ear(17, 17.2, 21.2, 15.8, 1.4)),
        ...rig(hm,
          { mat: "leaf", prims: [ell(11.4, 13.8, 1, 1.3, -15), ell(15.6, 13.8, 1, 1.3, 15)] },
          { mat: "blossom", prims: [ell(11.2, 12.6, 0.8), ell(15.8, 12.6, 0.8)], line: false },
          { mat: "fur", prims: [egg(13.5, 19, 5.2, 4.6, -0.2), ell(12.8, 22, 2.4, 1.7)], blend: 1.5,
            paint: [{ mat: "cream", prims: [ell(12.8, 22.4, 2, 1.3)], level: 3 }] },
        ),
      );
      decals.push(...rig(hm, ...eyes([9, 18], [15, 18], look, "tall"), ...blush([9, 21], [16, 21]), stamp(12, 22, ["kk"], { k: "eye:3" })));
      glint(14, 11, hm);
      firefly(9, 28, 12);
    } else if (stage === 1) {
      hm = head([14, 22], 6);
      parts.push(
        leg(16.6, 24, 1, true),
        leg(25.2, 23.5, 1, true),
        { mat: "fur", prims: [...rig([chest], ell(19.8, 22.6, 6.4, 3.4)), ...rig(hm, cap(14, 22, 12.8, 16.5, 2.8, 2.2)), ...rig([flick(26, 20.8), chest], ell(26, 20.8, 1.2, 1))], blend: 2,
          paint: [{ mat: "cream", prims: rig(hm, ell(13.2, 20.6, 1.8, 2)), level: 3 }, spots([[18.4, 20.8], [21.6, 20.4], [24, 21.8], [20, 23]], [chest])] },
        leg(14.2, 24.5, 1.1, false),
        leg(23.4, 24, 1.1, false),
        ...rig(hm,
          { mat: "antler", prims: [path([[10.8, 11.2], [9.6, 8.2], [8.2, 6.2]], 0.9, 0.7), cap(9.7, 8.6, 11.2, 6.6, 0.7), path([[14.8, 11.2], [15.8, 8.2], [17.2, 6.2]], 0.9, 0.7), cap(15.7, 8.6, 14.2, 6.6, 0.7)] },
          { mat: "leaf", prims: [ell(7.6, 5.4, 1.5, 0.9, -50), ell(17.8, 5.4, 1.5, 0.9, 50)] },
          { mat: "blossom", prims: [ell(11.4, 6.2, 0.9), ell(14, 6.2, 0.9)], line: false },
        ),
        ...rig([earL(9.2, 13), ...hm], ear(9.2, 13, 4.8, 11.8, 1.4)),
        ...rig([earR(16.6, 13), ...hm], ear(16.6, 13, 21, 12, 1.4)),
        ...rig(hm, { mat: "fur", prims: [egg(12.8, 14.4, 4.6, 4.2, -0.2), ell(12.2, 17.2, 2.2, 1.6)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(12.2, 17.6, 1.9, 1.2)], level: 3 }] }),
      );
      decals.push(...rig(hm, ...eyes([9, 13], [14, 13], look, "tall"), ...blush([9, 16], [15, 16]), stamp(11, 17, ["kk"], { k: "eye:3" })));
      glint(10, 4, hm);
      glint(13, 4, hm);
      firefly(9, 27, 14);
    } else {
      hm = head([14.6, 20], 6);
      const chest2: Move = { at: [20, 24.8], wave: breath, grow: [0.015, 0.125] };
      /** A firefly loops a pixel around its spot. */
      const drift = (c: V, p: number): Move[] => [{ at: c, wave: sine(1, p), shift: [1, 0] }, { at: c, wave: sine(1, p + 0.25), shift: [0, -1] }];
      const tail = flick(27.4, 18.4);
      parts.push(
        leg(16.8, 23, 1.15, true),
        leg(26.4, 22.4, 1.15, true),
        { mat: "fur", prims: [...rig([chest2], ell(20, 20.8, 7.6, 4)), ...rig(hm, cap(14.6, 20, 12.8, 13.5, 3.2, 2.6)), ...rig([tail, chest2], ell(27.4, 18.4, 1.4, 1.1))], blend: 2,
          paint: [{ mat: "cream", prims: [...rig(hm, ell(13.8, 18.8, 1.8, 2.2)), ...rig([tail, chest2], ell(27.8, 18.6, 0.9, 0.8))], level: 3 }, spots([[19, 18.6], [22.4, 18.2], [25, 19.4], [21, 21], [17.6, 20.8]], [chest2])] },
        leg(14.4, 23.5, 1.3, false),
        leg(24.4, 23, 1.3, false),
        ...rig(hm,
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
        ),
        ...rig([earL(8.6, 10.4), ...hm], ear(8.6, 10.4, 3.8, 9.4, 1.5)),
        ...rig([earR(17, 10.4), ...hm], ear(17, 10.4, 21.8, 9.6, 1.5)),
        ...rig(hm, { mat: "fur", prims: [egg(12.8, 11.8, 5.1, 4.4, -0.2), ell(12.2, 15, 2.5, 1.8)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(12.2, 15.4, 2.1, 1.3)], level: 3 }] }),
        ...rig(drift([29, 12.5], 0), { mat: "glow", prims: [ell(29, 12.5, 1)], glow: true, line: false }),
        ...rig(drift([3.5, 17], 0.45), { mat: "glow", prims: [ell(3.5, 17, 0.8)], glow: true, line: false }),
        ...rig(hm, { mat: "glow", prims: [ell(12.8, 7.6, 0.9, 1.1)], glow: true }),
      );
      decals.push(
        ...rig(hm, ...eyes([9, 11], [14, 11], look, "round"), stamp(11, 15, ["kk"], { k: "eye:3" }),
          stamp(2, 3, ["y"], { y: "#ffe27a" }), stamp(23, 3, ["y"], { y: "#ffe27a" })),
      );
      glint(4, 0, hm);
      glint(19, 0, hm);
      firefly(8, 27, 15);
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 5 : 6));
    return { parts, decals, head: hm, neck: hm };
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
  // A deep, slow breath, the head rising a beat after the chest; the leafy
  // wings and the tail sway with a ripple running out to their tips, the
  // canopy's front puffs rustle and the sparkles twinkle in turn. Its act
  // is the forest breathing in: a long inhale with eyes closed and the
  // wings lifting wide, the fruit glinting as it ripens, then a slow
  // exhale.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const inhale = envelope(a, 0.05, 0.4, 0.62, 0.95);
    const held = Math.round(inhale);
    const look = inhale > 0.45 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    /** Glints over the held breath, one after another. */
    const glints = (pts: [number, number][]) => {
      if (a >= 0) pts.forEach(([x, y], k) => decals.push(...twinkle(x, y, a, 0.32 + 0.09 * k, "#fff4c2", 0.2)));
    };
    const tailSway = (root: V, len: number): Move[] => [
      { at: root, wave: sine(1, 0.3), turn: 6 * calm, bend: len, lag: 0.3 },
      { at: root, wave: () => inhale, turn: -6, bend: len },
    ];
    let head: Move[];
    if (stage === 0) {
      // One blob: it swells as a whole, the sprout and the face riding it.
      const swell: Move = { at: [16, 29.6], wave: (u) => Math.max(breath(u), held), grow: [0.02, 0.08] };
      head = [{ at: [16, 29.6], wave: (u) => Math.max(breath(u), held), shift: [0, -1] }];
      /** On the exhale the sprout gives a slow nod. */
      const nod: Move = { at: [16, 18.5], wave: () => settle(a, 0.55, 0.42, 1), turn: 10, bend: 4 };
      const sprig: Move = { at: [16, 18.5], wave: sine(1, 0.15), turn: 6 * calm, bend: 4, lag: 0.3 };
      parts.push(
        ...rig(tailSway([20, 28.5], 6), { mat: "scale", prims: [path([[20, 28.5], [24, 28.5], [25.5, 26.3]], 1.4, 0.7)], back: true }),
        ...rig([sprig, nod, ...head], { mat: "canopy", prims: [cap(16, 18.5, 16, 15.5, 0.6), ell(14.2, 14.8, 1.8, 1, -25), ell(17.8, 14.2, 1.8, 1, 25)] }),
        ...rig([swell], { mat: "scale", prims: [egg(16, 24, 6, 5.6, 0.22)],
          paint: [{ mat: "bark", prims: [ell(16, 17.8, 6.5, 3)] }, { mat: "belly", prims: [ell(16, 27.8, 3, 1.9)] }] }),
        { mat: "scale", prims: both(ell(12, 29.2, 1.8, 1.2)) },
      );
      decals.push(...rig(head, ...eyes([12, 22], [18, 22], look, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, ["kk"], { k: "scale:1" })));
      glints([[15, 12]]);
    } else if (stage === 1) {
      const chest: Move = { at: [16, 28.5], wave: (u) => Math.max(breath(u), held), grow: [0.02, 0.07] };
      const back: Move = { at: [16, 18], wave: (u) => Math.max(breath(u), held), shift: [0, -1] };
      head = [{ at: [16, 15.5], wave: (u) => Math.max(breath(u - 0.1), held), shift: [0, -1] }];
      const tree: Move = { at: [19, 18], wave: sine(1, 0.2), turn: 5 * calm, bend: 12, lag: 0.3 };
      const wings: Move[] = [
        { at: [11.4, 20.4], wave: sine(1, 0.4), turn: 6 * calm, bend: 5, lag: 0.25, pair: true },
        { at: [11.4, 20.4], wave: () => inhale, turn: 16, pair: true },
      ];
      parts.push(
        ...rig(tailSway([20, 27.5], 8), { mat: "scale", prims: [path([[20, 27.5], [25, 28], [27, 25]], 1.6, 0.7)], back: true }),
        ...rig([...wings, back], { mat: "scale", prims: both(ell(9, 19, 3, 1.8, -35)), back: true }),
        ...rig([tree, back],
          { mat: "bark", prims: [path([[19, 18], [20.5, 12], [22, 8.5]], 1.2, 0.8)] },
          { mat: "canopy", prims: [ell(22.5, 7, 3.6, 2.8), ell(19.5, 8, 2.2, 1.9)] },
        ),
        { mat: "scale", prims: [...rig([chest], ell(16, 23.5, 6, 5)), ...rig(head, ell(16, 15.5, 5, 4.2))], blend: 3,
          paint: [{ mat: "belly", prims: rig([chest], ell(16, 24.5, 3.5, 3.6)) }] },
        ...rig(head, { mat: "bark", prims: both(cap(12.8, 12.4, 11.3, 9.5, 0.9, 0.6)) }),
        { mat: "scale", prims: both(ell(12, 28.5, 2, 1.6)) },
      );
      decals.push(...rig(head, ...eyes([12, 14], [18, 14], look, "tall"), ...blush([10, 17], [20, 17]), stamp(15, 18, ["kk"], { k: "scale:1" })));
      glints([[21, 4], [18, 6]]);
    } else {
      const chest: Move = { at: [16, 29.5], wave: (u) => Math.max(breath(u), held), grow: [0.015, 0.06] };
      head = [{ at: [16, 16], wave: (u) => Math.max(breath(u - 0.1), held), shift: [0, -1] }];
      /** The wings sway from the shoulders, the lower pair a beat behind,
       *  and lift wide on the inhale. */
      const wing = (phase: number, lift: number): Move[] => [
        { at: [10.6, 19], wave: sine(1, phase), turn: 5 * calm, bend: 8, lag: 0.3, pair: true },
        { at: [10.6, 19], wave: () => inhale, turn: lift, pair: true },
      ];
      /** The canopy's front puffs rustle a pixel aside, each in its turn. */
      const rustle = (phase: number): Move => ({ at: [16, 5], wave: sine(1, phase), shift: [calm, 0] });
      const puffL = rustle(0);
      const tail = tailSway([21, 27.5], 10);
      parts.push(
        ...rig(tail, { mat: "scale", prims: [path([[21, 27.5], [26.6, 27.6], [29.2, 24.6], [28.6, 21.6]], 1.9, 0.8)], back: true }),
        ...rig(tail, { mat: "canopy", prims: leafBlade(28.6, 21.8, 29.6, 17.4, 1.3) }),
        // leafy wings fanned from the shoulders
        ...rig(wing(0.1, 12), { mat: "canopy", prims: [...leafBlade(10.6, 18.4, 2.4, 15.4, 2.1), ...leafBlade(21.4, 18.4, 29.6, 15.4, 2.1)] }),
        ...rig(wing(0.25, 9), { mat: "canopy", prims: [...leafBlade(10.4, 20, 2.6, 21.6, 1.8), ...leafBlade(21.6, 20, 29.4, 21.6, 1.8)] }),
        // the tree on its back: one canopy mass with rounder puffs in front;
        // the head overlaps its lower edge
        { mat: "canopy", prims: [ell(16, 6.6, 12.6, 5.2), ell(4.4, 10, 3, 2.6), ell(27.6, 10, 3, 2.6)], blend: 2 },
        ...rig([puffL], { mat: "canopy", prims: [ell(8.2, 5, 4.2, 2.9)] }),
        ...rig([rustle(0.5)], { mat: "canopy", prims: [ell(23.8, 5, 4.2, 2.9)] }),
        { mat: "canopy", prims: [ell(16, 3.8, 5.8, 3.2)] },
        { mat: "fruit", prims: [ell(3.8, 10.4, 1.2), ell(28.2, 10.4, 1.2), ell(19.8, 2.6, 1.2), ...rig([puffL], ell(9.6, 4.4, 1.1)), ell(24.6, 8.4, 1.1), ell(7.4, 9, 1)], glow: true, blend: 0, line: false },
        { mat: "scale", prims: [...rig([chest], ell(16, 24.6, 7.6, 4.9)), ...rig(head, ell(16, 15.8, 6, 4.6), ell(16, 20, 3.8, 2))], blend: 3,
          paint: [{ mat: "belly", prims: [...rig([chest], ell(16, 25.2, 4.3, 3.8)), ...rig(head, ell(16, 20.6, 2.6, 1.3), ell(16, 18.4, 2.8, 1.2))], level: 3 }] },
        ...rig(head, { mat: "bark", prims: [...sym(path([[12.4, 12.2], [11.2, 9.8], [11.8, 8]], 1, 0.6)), ...sym(cap(11.3, 10, 9.4, 9.2, 0.6, 0.5))] }),
        { mat: "scale", prims: sym(cap(10.6, 25.6, 10.2, 29.4, 2.1, 1.9)) },
        { mat: "bark", prims: sym(path([[8.6, 29.6], [6.6, 30], [5.2, 29.2]], 0.75, 0.5)), line: false },
      );
      decals.push(
        ...rig(head, ...eyes([12, 15], [18, 15], look, "round"), stamp(14, 18, ["k..k"], { k: "scale:1" })),
        ...twinkle(0, 14, t, 0.1), ...twinkle(29, 0, t, 0.42), ...twinkle(0, 0, t, 0.72),
      );
      glints([[2, 9], [18, 1], [23, 7], [27, 9]]);
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 1 : 24, stage === 2 ? 22 : 8));
    return { parts, decals, head, neck: head };
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
  // The bushy tail sways with a slow ripple running up to its curl, over a
  // soft breath with the head riding a beat behind; the leaf on its cap
  // flutters. Its act is a polite tip of its acorn cap: the cap lifts and
  // tilts, eyes closed in a smile, the tail swishing happily, then the
  // cap settles back on.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const tip = envelope(a, 0.1, 0.36, 0.6, 0.88);
    const look = tip > 0.5 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    // Acorn cap: a dome with a pale scaly rim, cut flat underneath. Animated,
    // the cut is kept local to the cap so the cap tilts a pixel at a time.
    const acornCap = (cx: number, cy: number, rx: number, ry: number, cutY: number): Part => {
      const [x0, x1] = t === undefined ? [0, 32] : [cx - rx - 2, cx + rx + 2];
      return {
        mat: "cap", prims: [ell(cx, cy, rx, ry)], cut: [poly([[x0, cutY], [x1, cutY], [x1, t === undefined ? 32 : cy + ry + 2], [x0, t === undefined ? 32 : cy + ry + 2]])],
        paint: [{ mat: "cap", prims: [poly([[x0, cutY - 1.2], [x1, cutY - 1.2], [x1, cutY], [x0, cutY]])], level: 4 }],
      };
    };
    const capDots = (x: number, y: number, rows: string[]) => stamp(x, y, rows, { d: "cap:2" });
    /** The cap lifts two pixels and tilts, then settles back on. */
    const lift = (cx: number, cutY: number): Move => ({ at: [cx, cutY], wave: () => tip, shift: [0, -2], turn: -8 });
    /** The tail sways from its root, a ripple running out to the curl; in
     *  the act it swishes a little more. */
    const swish = (root: V, len: number, turn: number, act = turn): Move[] => [
      { at: root, wave: sine(1, 0.2), turn: turn * calm, bend: len, lag: 0.3 },
      { at: root, wave: () => settle(a, 0.3, 0.62, 1.5), turn: act, bend: len },
    ];
    const flutter = (x: number, y: number): Move => ({ at: [x, y], wave: sine(1, 0.6), turn: 12 * calm });
    let head: Move[];
    if (stage === 0) {
      // One acorn-shaped blob: it swells as a whole, the cap and face riding it.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.08] };
      head = [{ at: [16, 30], wave: breath, shift: [0, -1] }];
      const hat = [lift(16, 20.8), ...head];
      parts.push(
        ...rig(swish([19, 28.4], 9, 6), { mat: "fur", prims: [path([[19, 28.4], [23.8, 27.4], [25, 23], [23.6, 19.6]], 2.6, 2.2)] }),
        ...rig([swell], { mat: "fur", prims: [ell(16, 24, 6.6, 6)], paint: [{ mat: "cream", prims: [ell(16, 26.8, 3.2, 2.3)], level: 4 }] }),
        { mat: "fur", prims: sym(ell(12.8, 29.4, 1.9, 1.1), 16) },
        ...rig(hat, acornCap(16, 20.6, 6.6, 4.8, 20.8), { mat: "cap", prims: [cap(16, 16, 16.7, 14.2, 0.7)] }),
      );
      decals.push(...rig(hat, capDots(13, 17, ["d...d", "..d.."])), ...rig(head, ...eyes([12, 22], [18, 22], look, "tall"), ...blush([10, 25], [20, 25]), stamp(15, 25, ["kk"], { k: "fur:1" })));
    } else if (stage === 1) {
      const chest: Move = { at: [15, 30], wave: breath, grow: [0.02, 0.1] };
      head = [{ at: [15, 17], wave: (u) => breath(u - 0.08), shift: [0, -1] }];
      const hat = [lift(15, 14.4), ...head];
      parts.push(
        ...rig(swish([18, 27.5], 18, 5), { mat: "fur", prims: [path([[18, 27.5], [23.5, 26], [25.5, 21], [24.8, 15.5], [22.5, 12.5], [20.3, 13.2]], 2.8, 2.2)] }),
        { mat: "fur", prims: [...rig(head, ell(15, 17.5, 6.2, 5.2)), ...rig([chest], egg(15, 24.5, 5.4, 5.2, 0.15))], blend: 3,
          paint: [{ mat: "cream", prims: [...rig([chest], ell(15, 25.5, 3, 3.4)), ...rig(head, ell(15, 19.8, 3, 1.6))], level: 4 }] },
        ...rig(head, { mat: "fur", prims: sym(cap(10.3, 13.8, 9.3, 10.8, 1.3, 0.5), 15) }),
        ...rig(hat, acornCap(15, 14.2, 6.6, 4.4, 14.4), { mat: "cap", prims: [cap(15, 10.5, 15.8, 8.8, 0.7)] }),
        ...rig([flutter(16, 9), ...hat], { mat: "leaf", prims: [ell(17.6, 8.8, 1.8, 0.9, -20)], line: false }),
        ...rig([chest], { mat: "fur", prims: sym(ell(13.7, 23.2, 1.5, 1.3), 15) }),
        { mat: "fur", prims: sym(ell(11.6, 29.3, 2.2, 1.2), 15) },
      );
      decals.push(...rig(hat, capDots(12, 11, ["d...d", "..d.."])), ...rig(head, ...eyes([11, 16], [17, 16], look, "tall"), ...blush([9, 19], [19, 19]), stamp(14, 19, ["kk"], { k: "fur:1" })));
    } else {
      const chest: Move = { at: [13, 30], wave: breath, grow: [0.02, 0.08] };
      head = [{ at: [13, 15], wave: (u) => breath(u - 0.08), shift: [0, -1] }];
      const hat = [lift(13, 11.8), ...head];
      parts.push(
        ...rig(swish([16, 28.5], 24, 3, 2.5), { mat: "fur", prims: [path([[16, 28.5], [23, 28], [27.8, 23], [28.6, 15.5], [26.5, 8.5], [22, 5], [17.5, 6.2], [17, 10], [20.5, 11.8]], 3.8, 2.3)],
          paint: [{ mat: "cream", prims: [path([[25, 26.5], [28.4, 21], [29.3, 14], [27.5, 7.5]], 1.2, 0.9)], level: 4 }] }),
        { mat: "fur", prims: [...rig(head, ell(13, 15, 6.6, 5.6)), ...rig([chest], egg(13, 23.8, 6.2, 6, 0.15))], blend: 3,
          paint: [{ mat: "cream", prims: [...rig([chest], ell(13, 25, 3.6, 4)), ...rig(head, ell(13, 17.8, 3.4, 1.8))], level: 4 }] },
        ...rig(head, { mat: "fur", prims: sym(cap(8, 11.5, 6.8, 7.8, 1.5, 0.5), 13) }),
        ...rig(hat, acornCap(13, 11.6, 7, 4.8, 11.8), { mat: "cap", prims: [cap(13, 7.4, 14, 5.4, 0.8)] }),
        ...rig([flutter(14.4, 5.6), ...hat], { mat: "leaf", prims: [ell(16.3, 5.3, 2.2, 1, -25)], line: false }),
        ...rig([chest],
          { mat: "fur", prims: sym(ell(10.2, 24.4, 1.6, 1.5), 13) },
          { mat: "leaf", prims: [egg(13, 24.5, 2.4, 2.6, -0.25)] },
          { mat: "cap", prims: [ell(13, 22.2, 2.8, 1.4), cap(13, 21, 13.4, 19.8, 0.55)] },
        ),
        { mat: "fur", prims: sym(ell(9.2, 29.2, 2.6, 1.3), 13) },
      );
      decals.push(...rig(hat, capDots(10, 8, ["d...d", "..d.."])), ...rig(head, ...eyes([9, 14], [15, 14], look, "tall"), ...blush([7, 17], [17, 17]), stamp(12, 17, ["k.k", ".k."], { k: "fur:1" })));
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 2 : 24, stage === 2 ? 2 : 6));
    return { parts, decals, head, neck: head };
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
  // The leaf umbrella sways a little in its hand and the throat pulses
  // softly. Its act is two soft croaks — a pale sac swelling under its
  // chin, eyes closed — and then the dew drop slips off the leaf's tip.
  motion: { idle: 3.2, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const croak = a < 0 ? 0 : Math.max(pulse(0.06, 0.26)(a), pulse(0.36, 0.26)(a));
    const look = a >= 0.04 && a <= 0.64 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    /** The leaf sways from the hand holding it. */
    const sway = (hand: V): Move => ({ at: hand, wave: sine(1, 0.2), turn: 2.5 * calm });
    /** The throat pulses: two quick swells, then a rest. */
    const throat = (c: V): Move => ({ at: c, wave: stepped((u) => pulse(0, 0.25)(u) + pulse(0.3, 0.25)(u)), grow: [0.08, 0.14 * calm] });
    /** The croak's pale sac, swelling under the chin. */
    const sac = (x: number, y: number, rx: number, ry: number) => {
      if (croak < 0.15) return;
      const sac = ell(x, y, rx * croak, ry * croak);
      // A pale ball with a sheen and a soft shade under it, no seam: skin
      // stretching, not a patch stuck on.
      parts.push({ mat: "belly", line: false, prims: [sac], paint: [
        { mat: "belly", level: 4, prims: [sac] },
        { mat: "belly", level: 2, prims: [sac], cut: [ell(x, y - 1, rx * croak, ry * croak)] },
        { mat: "belly", level: 5, prims: [ell(x - rx * croak * 0.3, y - ry * croak * 0.35, rx * croak * 0.35, ry * croak * 0.3)] },
      ] });
    };
    /** The dew drop on the leaf's tip slips off near the act's end, and a
     *  new one beads there a moment later. */
    const dew = (x: number, y: number, ms: Move[]) => {
      const f = a < 0 ? -1 : (a - 0.66) / 0.16;
      if (f >= 0 && f < 1) decals.push(stamp(x, Math.round(y + 1 + f * f * 8), ["d"], { d: "dew:4" }, true));
      else if (!(f >= 1 && a < 0.9)) decals.push(...rig(ms, stamp(x, y, ["d", "d"], { d: "dew:4" }, true)));
    };
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
      const leaf = [sway([21.4, 25.2])];
      parts.push(
        ...rig(leaf, { mat: "leaf", prims: [cap(21.5, 25, 21.5, 17.5, 0.6)] }, brolly(21.5, 18, 4.4, 3, 3)),
        { mat: "skin", prims: [ell(16, 25.3, 6.8, 4.8), ...sym(ell(13, 21.3, 2.4, 2.2), 16)], blend: 2, round: 3,
          paint: [{ mat: "belly", prims: rig([throat([16, 27.6])], ell(16, 27.6, 4, 1.9)), level: 4 }] },
        { mat: "skin", prims: [ell(21.3, 25.2, 1.3, 1.2)] },
      );
      sac(16, 27, 2.6, 1.6);
      decals.push(...eyes([12, 20], [18, 20], look, "tall"), ...blush([10, 24], [20, 24]), stamp(14, 25, ["k..k", ".kk."], { k: "skin:1" }));
    } else if (stage === 1) {
      const leaf = [sway([22.8, 23.5])];
      parts.push(
        ...rig(leaf, { mat: "leaf", prims: [cap(23, 23, 23, 11, 0.7)] }, brolly(20, 11.5, 8, 5, 4)),
        { mat: "skin", prims: [ell(16, 23.5, 7.5, 5.5), ...sym(ell(12.8, 18.2, 2.6, 2.4), 16), ...sym(ell(9.6, 27, 3, 2.4), 16)], blend: 2.5, round: 3.5,
          paint: [{ mat: "belly", prims: rig([throat([16, 26])], ell(16, 26, 4.6, 3)), level: 4 }] },
        { mat: "skin", prims: [cap(20, 25.5, 22.8, 23.5, 1.3, 1.2)] },
        { mat: "skin", prims: sym(ell(10.8, 29.4, 2.6, 1), 16), line: false },
      );
      sac(16, 24.6, 3.2, 2);
      decals.push(...eyes([12, 17], [18, 17], look, "tall"), ...blush([10, 21], [20, 21]), stamp(13, 22, ["k....k", ".kkkk."], { k: "skin:1" }));
    } else {
      const leaf = [sway([24.3, 21.6])];
      parts.push(
        ...rig(leaf, { mat: "leaf", prims: [path([[24.8, 22], [25, 12], [24, 9]], 0.85, 0.7)] }, brolly(16, 9.2, 14, 7.8, 6)),
        { mat: "skin", prims: [ell(16, 22, 10, 7.2), ...sym(ell(11.8, 15.2, 3.2, 3), 16), ...sym(ell(7.4, 26.3, 3.6, 3.2), 16)], blend: 3, round: 4,
          paint: [{ mat: "belly", prims: rig([throat([16, 25])], ell(16, 25, 6, 4)), level: 4 }] },
        { mat: "skin", prims: [cap(20.5, 24.5, 24.3, 21.6, 1.7, 1.6)] },
        { mat: "skin", prims: sym(ell(10.2, 29.5, 3.2, 1), 16), line: false },
      );
      sac(16, 22.6, 3.8, 2.4);
      decals.push(
        ...eyes([11, 14], [19, 14], look, "round"), ...blush([8, 19], [22, 19]),
        stamp(12, 19, ["k......k", ".kkkkkk."], { k: "skin:1" }),
      );
      dew(30, 12, leaf);
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
  // The quill layers breathe in turn, front to back, and the roses ride
  // them with a ripple running across the bouquet; the face follows a beat
  // later. Its act is a slow, proud bloom: eyes closed, the quills fluff
  // out a pixel and every rose swells open, then a single petal drifts
  // down as it all settles.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const bloom = envelope(a, 0.08, 0.36, 0.62, 0.9);
    // The quills fluff first and the roses open after; they close in turn.
    const fluff = bloom > 0.3 ? 1 : 0;
    const open = bloom > 0.7 ? 1 : 0;
    const look = bloom > 0.45 ? "blink" : pose;
    /** Each quill layer swells on the breath, the ones further back a beat
     *  later; in the act they all fluff out about the body's middle. */
    const layer = (cy: number, ry: number, lag: number): Move[] => [
      { at: [16, cy], wave: () => fluff, grow: [0.07, 0.07] },
      { at: [16, cy + ry], wave: (u) => breath(u - lag), grow: [0.015, 1 / (2 * ry)] },
    ];
    // A rose: a round bloom with a dark spiral, on a pair of sepal leaves.
    // It rides the quills, the breath reaching it a beat later the further
    // right it sits, and swells open in the act.
    const rose = (x: number, y: number, r: number, bud: boolean, ms: Move[]) => {
      const ride: Move[] = [
        { at: [x, y], wave: () => open, grow: [0.22, 0.22] },
        ...ms,
        { at: [x, y], wave: (u) => breath(u - 0.06 - x / 160), shift: [0, -1] },
      ];
      parts.push(
        ...rig(ride,
          { mat: "stem", prims: [ell(x - r * 0.7, y + r * 0.55, r * 0.7, r * 0.4, -30), ell(x + r * 0.7, y + r * 0.55, r * 0.7, r * 0.4, 30)], blend: 0.5 },
          { mat: "rose", prims: [bud ? egg(x, y - 0.2, r * 0.8, r, 0.35) : ell(x, y, r)] },
        ),
      );
      if (!bud) decals.push(...rig(ride, stamp(Math.round(x - 1.5), Math.round(y - 1.5), ["dd.", "d.l", ".dd"], { d: "rose:1", l: "rose:4" })));
    };
    /** As it settles, one petal drifts down from a rose, swaying. */
    const petal = (x: number, y: number, h: number) => {
      const f = (a - 0.5) / 0.42;
      if (a < 0 || f <= 0 || f >= 1) return;
      decals.push(stamp(Math.round(x + Math.sin(f * Math.PI * 2.5) * 1.6), Math.round(y + f * h), ["p"], { p: f > 0.85 ? "rose:2" : "rose:3" }, true));
    };
    const ring = (from: number, to: number, n: number) => Array.from({ length: n }, (_, k) => from + ((to - from) * k) / (n - 1));
    let face: Move[];
    if (stage === 0) {
      const body = layer(24, 5.6, 0);
      face = [{ at: [16, 24], wave: (u) => breath(u - 0.08), shift: [0, -1] }];
      parts.push(
        ...rig(body, { mat: "stem", prims: [ell(16, 24, 7, 5.6), ...spikes(16, 24, 7, 5.6, ring(-180, 0, 8), 1.8, 1.4)], blend: 0.8 }),
      );
      rose(16, 17.3, 1.5, true, [body[0]]);
      parts.push(
        ...rig(face, { mat: "face", prims: [poly([[11.5, 22.6], [20.5, 22.6], [18.2, 26.4], [16, 27.6], [13.8, 26.4]], 1.4)], round: 3,
          cut: [poly([[13.6, 20], [18.4, 20], [16, 23.6]], 0.3)] }),
        { mat: "face", prims: sym(ell(13, 29.6, 1.5, 0.9), 16) },
      );
      decals.push(...rig(face, ...eyes([12, 23], [18, 23], look, "tall"), ...blush([11, 26], [19, 26]), stamp(15, 27, ["kk"], { k: "nose:3" })));
      petal(15, 18, 9);
    } else if (stage === 1) {
      const back = layer(21.5, 7, 0.08);
      const front = layer(22.5, 5.8, 0);
      face = [{ at: [16, 22], wave: (u) => breath(u - 0.1), shift: [0, -1] }];
      parts.push(
        ...rig(back, { mat: "stem", prims: [ell(16, 21.5, 9, 7), ...spikes(16, 21.5, 9, 7, ring(-190, 10, 10), 2.8, 1.6)], blend: 0.6, back: true }),
        ...rig(front, { mat: "stem", prims: [ell(16, 22.5, 7.4, 5.8), ...spikes(16, 22.5, 7.4, 5.8, ring(-160, -20, 6), 2.2, 1.5)], blend: 0.6 }),
      );
      rose(12, 13.6, 1.7, true, [back[0]]);
      rose(20.5, 13, 2, false, [back[0]]);
      parts.push(
        ...rig(face, { mat: "face", prims: [poly([[10.8, 20.6], [21.2, 20.6], [18.6, 25], [16, 26.8], [13.4, 25]], 1.6)], round: 3.5,
          cut: [poly([[13.2, 18], [18.8, 18], [16, 22.2]], 0.3)] }),
        { mat: "face", prims: sym(ell(12.2, 29.4, 2, 1.1), 16) },
      );
      decals.push(...rig(face, ...eyes([12, 21], [18, 21], look, "tall"), ...blush([10, 24], [20, 24]), stamp(15, 26, ["kk"], { k: "nose:3" })));
      petal(21, 15, 11);
    } else {
      const back = layer(19.5, 9.5, 0.12);
      const mid = layer(20.5, 7.6, 0.06);
      const front = layer(21, 5.5, 0);
      face = [{ at: [16, 21], wave: (u) => breath(u - 0.1), shift: [0, -1] }];
      parts.push(
        ...rig(back, { mat: "stem", prims: [ell(16, 19.5, 12, 9.5), ...spikes(16, 19.5, 12, 9.5, ring(-195, 15, 12), 3.4, 1.9)], blend: 0.6, back: true }),
        ...rig(mid, { mat: "stem", prims: [ell(16, 20.5, 9.6, 7.6), ...spikes(16, 20.5, 9.6, 7.6, ring(-170, -10, 9), 2.8, 1.8)], blend: 0.6 }),
        ...rig(front, { mat: "stem", prims: [ell(16, 21, 7, 5.5), ...spikes(16, 21, 7, 5.5, ring(-150, -30, 5), 2.2, 1.6)], blend: 0.6 }),
      );
      rose(9, 10.6, 2.5, false, [back[0]]);
      rose(16.4, 6.8, 2.7, false, [back[0]]);
      rose(23.4, 10.2, 2.4, false, [back[0]]);
      rose(4.6, 17.5, 1.8, true, [back[0]]);
      rose(27.4, 17, 2, false, [back[0]]);
      parts.push(
        ...rig(face, { mat: "face", prims: [poly([[9.8, 19.6], [22.2, 19.6], [19.2, 24.4], [16, 26.4], [12.8, 24.4]], 1.8)], round: 4,
          cut: [poly([[12.8, 16.5], [19.2, 16.5], [16, 21.2]], 0.3)] }),
        { mat: "face", prims: sym(ell(11.6, 29.4, 2.4, 1.2), 16) },
      );
      decals.push(
        ...rig(face, ...eyes([12, 20], [18, 20], look, "tall"), ...blush([10, 23], [20, 23]),
          stamp(15, 25, ["kk"], { k: "nose:3" })),
      );
      petal(24, 12, 13);
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 1 : 3));
    return { parts, decals, head: face, neck: face };
  },
};

// ── Kodama · rare ──

/** Kodama faces are hollow: dark holes, no highlight. */
function hollowEyes(l: [number, number], r: [number, number], pose: Pose, h = 3): Decal[] {
  const inks = { k: "eye:3" };
  if (!awake(pose)) return [stamp(l[0], l[1] + h - 1, ["kk"], inks), stamp(r[0], r[1] + h - 1, ["kk"], inks)];
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
  // A quiet breath, the head bobbing on it a beat late; the leaves it
  // carries flutter and its spirit lights drift in slow loops. Its act is
  // the rattle: the head rocks gently side to side, a soft tick showing on
  // each side as it tips, and the lights circle a little wider, then it
  // goes still.
  motion: { idle: 3.6, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const env = envelope(a, 0.06, 0.24, 0.68, 0.92);
    const rattle = env * Math.sin(Math.PI * 5 * (a - 0.06));
    const calm = pose === "sleep" ? 0.4 : 1;
    /** A spirit light loops a pixel around its spot, wider in the act. */
    const drift = (c: V, p: number): Move[] => [
      { at: c, wave: (u) => sine(1, p)(u) * (1 + env), shift: [calm, 0] },
      { at: c, wave: (u) => sine(1, p + 0.25)(u) * (1 + env), shift: [0, -calm] },
    ];
    const light = (x: number, y: number, r: number, p: number): Part[] =>
      rig(drift([x, y], p), { mat: "glow", prims: [ell(x, y, r)], glow: true, line: false });
    /** The ticks of the rattle, on the side the head tips toward. */
    const ticks = (lx: number, rx: number, y: number) => {
      if (rattle < -0.5) decals.push(stamp(lx, y, [".r", "r.", ".r"], { r: "body:2" }, true));
      if (rattle > 0.5) decals.push(stamp(rx, y, ["r.", ".r", "r."], { r: "body:2" }, true));
    };
    const flutter = (x: number, y: number, p: number): Move => ({ at: [x, y], wave: sine(1, p), turn: 10 * calm });
    let head: Move[];
    if (stage === 0) {
      // One round spirit: it swells as a whole and rocks on its feet.
      const swell: Move = { at: [16, 28.6], wave: breath, grow: [0.02, 0.09] };
      head = [{ at: [16, 28.6], wave: breath, shift: [0, -1] }, { at: [16, 28.6], wave: () => rattle, turn: 5 }];
      parts.push(
        { mat: "body", prims: sym(cap(13.8, 26, 13.4, 29.4, 1.3, 1.1), 16), back: true },
        ...rig([swell, head[1]], { mat: "body", prims: [ell(16, 22, 7.4, 5.2), ell(16, 26, 4, 2.6)], blend: 3 }),
        ...light(24.5, 16, 1, 0),
      );
      decals.push(...rig(head, ...hollowEyes([12, 21], [18, 21], pose, 2), ...blush([10, 23], [20, 23]), stamp(15, 24, ["k"], { k: "eye:3" })));
      ticks(5, 25, 21);
    } else if (stage === 1) {
      const chest: Move = { at: [16, 25], wave: breath, grow: [0.03, 0.1] };
      head = [{ at: [16, 18.5], wave: (u) => breath(u - 0.08), shift: [0, -1] }, { at: [16, 18.5], wave: () => rattle, turn: 6 }];
      const twig: Move = { at: [21.8, 21.5], wave: sine(1, 0.3), turn: 4 * calm, bend: 6, lag: 0.3 };
      parts.push(
        { mat: "body", prims: sym(cap(14.3, 23, 13.3, 29.4, 1.1, 1), 16), back: true },
        ...rig([twig], { mat: "leaf", prims: [path([[21.8, 21.5], [23, 18.5], [24.2, 16.6]], 0.6, 0.5)] }),
        ...rig([flutter(24, 16.6, 0), twig], { mat: "leaf", prims: [ell(23.4, 16, 1.8, 1, 35)] }),
        ...rig([flutter(24.2, 16.6, 0.4), twig], { mat: "leaf", prims: [ell(26, 16, 2, 1.1, -25)] }),
        { mat: "body", prims: [...rig(head, ell(16, 13.5, 7.4, 5.6)), ...rig([chest], cap(16, 18, 16, 24.5, 2.2, 2.8))], blend: 2 },
        { mat: "body", prims: [path([[18, 19.5], [20.5, 21.5], [21.8, 20.4]], 0.9, 0.8)] },
        ...rig([chest], { mat: "body", prims: [path([[14, 19.5], [11.5, 21.5], [10.5, 23.5]], 0.9, 0.8)] }),
        ...light(6, 9, 1, 0.3),
      );
      decals.push(...rig(head, ...hollowEyes([12, 12], [18, 12], pose), ...blush([10, 15], [20, 15]), stamp(15, 16, ["k", "k"], { k: "eye:3" })));
      ticks(5, 25, 12);
    } else {
      const chest: Move = { at: [16, 22], wave: breath, grow: [0.03, 0.09] };
      // The tilted head rattles a pixel side to side (turning it would chip
      // its outline).
      head = [{ at: [16, 13.5], wave: (u) => breath(u - 0.08), shift: [0, -1] }, { at: [16, 13.5], wave: () => rattle, shift: [1, 0] }];
      parts.push(
        { mat: "leaf", prims: [path([[25, 29.5], [24.6, 22], [25.4, 12.5]], 0.85, 0.6), cap(25, 17, 27.2, 15, 0.5)] },
        ...rig([flutter(24.6, 12.6, 0)], { mat: "leaf", prims: [ell(23, 12, 2.4, 1.3, 30), ell(28, 14.2, 1.8, 1, -35)] }),
        ...rig([flutter(25.6, 12, 0.45)], { mat: "leaf", prims: [ell(26.4, 9.6, 1.6, 2.6, 15)] }),
        { mat: "body", prims: sym(cap(14.5, 21, 13.8, 29.5, 1.2, 1.1), 16), back: true },
        ...rig([chest], { mat: "body", prims: [cap(16, 12, 16, 22, 1.8, 2.8)], blend: 1 }),
        { mat: "body", prims: [path([[17.8, 16], [21, 18], [24, 17.5]], 1, 0.9)] },
        ...rig([chest], { mat: "body", prims: [path([[14, 16], [11, 19], [10, 22]], 1, 0.9)] }),
        ...rig(head, { mat: "body", prims: [ell(15.6, 8.4, 7.6, 5.8, -12)] }),
        ...light(4.5, 14, 1, 0),
        ...light(28.5, 23, 0.9, 0.5),
      );
      decals.push(
        ...rig(head, ...hollowEyes([11, 7], [17, 6], pose), stamp(14, 11, ["k", "k"], { k: "eye:3" })),
        // the rattle: motion ticks either side of the tilted head
        ...(env < 0.15 || rattle < -0.5 ? [stamp(5, 5, [".r", "r.", ".r"], { r: "body:2" }, true)] : []),
      );
      if (rattle > 0.5) decals.push(stamp(25, 3, ["r.", ".r", "r."], { r: "body:2" }, true));
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 2 : 24, stage === 2 ? 20 : 3));
    return { parts, decals, head, neck: head };
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
  // A big, slow breath through the belly and the mossy mantle, the head
  // rising a beat later with its berry crown. Its act is a little doze
  // between chapters: the head lolls and sinks with eyes closed, a small
  // "z" drifts up, a new flower opens on its moss while it naps, and it
  // wakes back up as the flower folds away.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const doze = envelope(a, 0.08, 0.38, 0.66, 0.92);
    const look = doze > 0.4 ? "blink" : pose;
    const flower = (x: number, y: number) =>
      stamp(x - 1, y - 1, [".p.", "pcp", ".p."], { p: "petal:4", c: "#ffe27a" });
    /** While it dozes a new flower buds on the moss, opens, and folds away
     *  as it wakes. */
    const sprout = (x: number, y: number, ms: Move[]) => {
      if (a < 0.3 || a > 0.86) return;
      decals.push(...rig(ms, a < 0.42 || a > 0.76 ? stamp(x, y, ["p"], { p: "petal:3" }) : flower(x, y)));
    };
    /** A small "z" drifts up beside the head while it dozes. */
    const doze_z = (x: number, y: number) => {
      const f = (a - 0.3) / 0.42;
      if (a < 0 || f <= 0 || f >= 1) return;
      decals.push(stamp(x + Math.round(f * 1.5), y - Math.round(f * 3), ["zzz", "..z", ".z.", "zzz"], { z: f < 0.15 || f > 0.85 ? "#7d9488" : "#cfe3d6" }, true));
    };
    const berries = (pts: [number, number, number][]): Part => ({
      mat: "berry", prims: pts.map(([x, y, r]) => ell(x, y, r)), glow: true, blend: 0,
    });
    /** The head rides the breath a beat late; dozing, it sinks a pixel and
     *  lolls to one side about the neck. */
    const headOn = (neck: V, turn: number): Move[] => [
      { at: neck, wave: (u) => breath(u - 0.1), shift: [0, -1] },
      { at: neck, wave: () => doze, shift: [0, 1], turn },
    ];
    let head: Move[];
    if (stage === 0) {
      // One round cub: it swells as a whole, the face and crown riding it.
      const swell: Move = { at: [16, 29.6], wave: breath, grow: [0.02, 0.08] };
      head = [{ at: [16, 29.6], wave: breath, shift: [0, -1] }, { at: [16, 29.6], wave: () => doze, shift: [0, 1] }];
      parts.push(
        ...rig(head, { mat: "fur", prims: sym(ell(11.3, 17.9, 1.9), 16), paint: [{ mat: "muzzle", prims: sym(ell(11.3, 18.1, 0.9), 16), level: 4 }] }),
        ...rig([swell, head[1]], { mat: "fur", prims: [ell(16, 23.4, 7, 6.2)],
          paint: [{ mat: "muzzle", prims: [ell(16, 25, 2.5, 1.7)], level: 4 }] }),
        ...rig(head,
          { mat: "moss", prims: [ell(14.2, 16.9, 1.8, 0.9, 25), ell(17.8, 16.9, 1.8, 0.9, -25)], blend: 0.5 },
          berries([[16, 16.2, 1.2]]),
        ),
        { mat: "fur", prims: sym(ell(12.6, 29.3, 2, 1.1), 16) },
      );
      decals.push(...rig(head, ...eyes([12, 21], [18, 21], look, "tall"), ...blush([10, 24], [20, 24]), stamp(15, 24, ["kk"], { k: "eye:3" })));
      doze_z(23, 15);
    } else if (stage === 1) {
      const chest: Move = { at: [16, 29.8], wave: breath, grow: [0.02, 0.1] };
      head = headOn([16, 21], 5);
      parts.push(
        ...rig(head, { mat: "fur", prims: sym(ell(10.8, 11, 2.3), 16), paint: [{ mat: "muzzle", prims: sym(ell(10.8, 11.2, 1.1), 16), level: 4 }] }),
        { mat: "fur", prims: [...rig(head, ell(16, 16, 7.8, 6)), ...rig([chest], egg(16, 24.8, 5.6, 5, 0.12))], blend: 3,
          paint: [{ mat: "muzzle", prims: [...rig(head, ell(16, 18.6, 2.8, 1.9)), ...rig([chest], ell(16, 25.8, 3.2, 2.8))], level: 4 }] },
        ...rig(head,
          { mat: "moss", prims: [path([[10.5, 12.2], [13, 10.6], [16, 10.2], [19, 10.6], [21.5, 12.2]], 0.9, 0.9), ell(13, 9.6, 1.4, 0.8, -30), ell(19, 9.6, 1.4, 0.8, 30)], blend: 0.8 },
          berries([[16, 9.2, 1.3], [11.4, 10.4, 1], [20.6, 10.4, 1]]),
        ),
        ...rig([chest], { mat: "moss", prims: [ell(21.8, 20.4, 2.8, 1.8, -35), ell(23, 22.4, 1.5, 1.5)], blend: 1 }),
        ...rig([chest], { mat: "fur", prims: sym(ell(11.4, 24.2, 1.7, 2.2), 16) }),
        { mat: "fur", prims: sym(ell(12.2, 29.2, 2.5, 1.3), 16) },
      );
      decals.push(
        ...rig(head, ...eyes([12, 14], [18, 14], look, "tall"), ...blush([9, 17], [21, 17]), stamp(15, 17, ["kk"], { k: "eye:3" })),
        ...rig([chest], flower(22, 20)),
      );
      sprout(23, 23, [chest]);
      doze_z(24, 9);
    } else {
      const chest: Move = { at: [16, 30], wave: breath, grow: [0.015, 0.07] };
      /** The mossy mantle on the shoulders rises with the chest. */
      const mantle: Move = { at: [16, 18], wave: breath, shift: [0, -1] };
      head = headOn([16, 18], 4);
      parts.push(
        ...rig([mantle], { mat: "moss", prims: [...sym(ell(5.2, 15.8, 3.4, 3), 16), ...sym(ell(8.2, 13.2, 2.6, 2.4), 16)], blend: 1.2, back: true }),
        ...rig(head, { mat: "fur", prims: sym(ell(8.8, 6.8, 2.8), 16), paint: [{ mat: "muzzle", prims: sym(ell(8.8, 7, 1.4), 16), level: 4 }] }),
        { mat: "fur", prims: [...rig([chest], ell(16, 23, 12, 7.2)), ...rig(head, ell(16, 12.8, 8.2, 6.4))], blend: 4,
          paint: [{ mat: "muzzle", prims: rig(head, ell(16, 16, 3.6, 2.5)), level: 4 }, { mat: "muzzle", prims: rig([chest], ell(16, 25.2, 4.6, 3.8)), level: 4 }] },
        // moss mantle over the shoulders, dripping in lumps down the flanks
        ...rig([mantle], { mat: "moss", prims: [
          ...sym(path([[11, 17.6], [7, 17.6], [4.5, 20]], 2.4, 2), 16),
          ...sym(ell(4.2, 22.6, 2.2, 2.4), 16), ...sym(ell(7.2, 20.8, 1.8, 2), 16),
        ], blend: 1.6 }),
        ...rig(head, { mat: "moss", prims: [path([[9.4, 8.6], [12.4, 6.6], [16, 6], [19.6, 6.6], [22.6, 8.6]], 1, 1), ell(12.6, 5.4, 1.6, 0.9, -30), ell(19.4, 5.4, 1.6, 0.9, 30)], blend: 0.8 }),
        { mat: "berry", glow: true, blend: 0, prims: [
          ...rig(head, ell(16, 4.6, 1.5), ell(10.4, 6.2, 1.2), ell(21.6, 6.2, 1.2)),
          ...rig([mantle], ell(5.2, 19.2, 1), ell(26.8, 19.2, 1)),
        ] },
        ...rig([chest], { mat: "fur", prims: sym(ell(9.6, 24.2, 2.2, 2.8), 16) }),
        { mat: "fur", prims: sym(ell(10.2, 29.1, 3.2, 1.6), 16), paint: [{ mat: "muzzle", prims: sym(ell(10.2, 29.4, 1.8, 0.8), 16), level: 4 }] },
      );
      decals.push(
        ...rig(head, ...eyes([12, 12], [18, 12], look, "round"), stamp(15, 15, ["kk", ".."], { k: "eye:3" })),
        ...rig([mantle], flower(8, 18), flower(24, 18), flower(3, 23)),
      );
      sprout(28, 22, [mantle]);
      doze_z(25, 6);
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 2 ? 1 : 4));
    return { parts, decals, head, neck: head };
  },
};

export const LEAF: Species[] = [sproutling, mossback, nutkin, dewfrog, mandrake, thornhog, kodama, bloomstag, bramblebear, yggdrake];
