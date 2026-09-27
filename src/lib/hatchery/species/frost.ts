import type { Pose, Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
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
  if (pose !== "idle") {
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "ice", prims: [path([[14.4, 18.8], [13.6, 16.6], [14.4, 15.2]], 1, 0.5), path([[17.6, 18.8], [18.4, 16.6], [17.6, 15.2]], 1, 0.5)] },
        { mat: "fur", prims: both(ell(13.2, 29.2, 1.8, 1.1)), paint: [{ mat: "face", prims: both(ell(13.2, 29.8, 1.3, 0.5)) }] },
        { mat: "fur", prims: puffball(16, 23.8, 6.2, 1.5, 45, [45, 135]), blend: 1 },
      );
      decals.push(
        ...eyes([12, 22], [18, 22], pose, "tall"),
        ...blush([10, 25], [20, 25]),
        stamp(15, 25, ["kk"], { k: "eye:3" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "ice", prims: both(path([[12.8, 14.6], [11, 12.4], [11.2, 10]], 1.3, 0.5)) },
        { mat: "fur", prims: both(ell(12.4, 29.2, 2.3, 1.3)), paint: [{ mat: "face", prims: both(ell(12.4, 29.9, 1.8, 0.6)) }] },
        { mat: "fur", prims: puffball(16, 21.8, 7.8, 2, 45, [50, 130]), blend: 1 },
        { mat: "fur", prims: both(ell(8.2, 23.4, 1.9, 1.8)), paint: [{ mat: "face", prims: both(ell(8, 24.4, 1.3, 0.8)) }] },
      );
      decals.push(
        ...eyes([12, 19], [18, 19], pose, "tall"),
        ...blush([10, 22], [20, 22]),
        stamp(14, 22, ["kkkk", ".tt."], { k: "eye:3", t: "blush:2" }),
      );
    } else {
      parts.push(
        { mat: "ice", prims: both(path([[11.4, 10.4], [8.6, 8.2], [7.4, 5.2], [8.4, 2.6]], 1.8, 0.6)) },
        { mat: "fur", prims: both(ell(11.8, 29.2, 3, 1.5)), paint: [{ mat: "face", prims: both(ell(11.8, 29.9, 2.3, 0.7)) }] },
        { mat: "fur", prims: puffball(16, 18.8, 10.2, 2.4, 40, [50, 130]), blend: 1 },
        {
          mat: "fur",
          prims: both(path([[7.4, 20.4], [5.2, 22.6], [4.8, 24.4]], 2.3, 2.1)),
          paint: [{ mat: "face", prims: both(ell(4.8, 25.8, 1.4, 0.8)) }],
        },
      );
      decals.push(
        ...eyes([11, 16], [19, 16], pose, "tall"),
        ...blush([9, 20], [21, 20]),
        stamp(13, 20, ["kkkkkk", "kwttwk", ".kkkk."], { k: "eye:3", w: "white:4", t: "blush:2" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 2 : stage === 1 ? 7 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      // A plump grub: fat segments trailing right, a frost tuft on each.
      parts.push(
        { mat: "wing", prims: [cap(24.4, 25.4, 25.2, 23.2, 0.9, 0.45), cap(20.6, 23.6, 21, 21.2, 1, 0.45), cap(17, 22.8, 17.2, 20.4, 1, 0.45)] },
        { mat: "body", prims: [ell(24.4, 27.6, 2.6, 2.2)] },
        { mat: "body", prims: [ell(20.8, 26.8, 3, 2.9)] },
        { mat: "body", prims: [ell(17, 25.8, 3.4, 3.6)] },
        { mat: "body", prims: [path([[10.4, 20.4], [9.4, 18.2], [8.2, 17.6]], 0.7), path([[13.6, 20.4], [14.6, 18.2], [15.8, 17.6]], 0.7)] },
        { mat: "wing", prims: [ell(8, 17.4, 1.1), ell(16, 17.4, 1.1)], line: false },
        { mat: "body", prims: [ell(12, 24.6, 5.4, 5)] },
      );
      decals.push(...eyes([9, 22], [13, 22], pose, "tall"), ...blush([7, 25], [15, 25]), stamp(11, 26, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      // The cocoon: frost silk wrapped in bands, face peeking out, two
      // antenna curls already showing.
      parts.push(
        { mat: "body", prims: both(path([[14.8, 14.4], [13.8, 11.8], [12, 10.8]], 0.8)) },
        { mat: "wing", prims: both(ell(11.4, 10.8, 1.1)), line: false },
        { mat: "wing", prims: both(ell(9.8, 22, 1.4, 3, -22)) },
        {
          mat: "fluff",
          prims: [egg(16, 21.4, 6.4, 8.4, 0.3)],
          paint: [
            { mat: "body", prims: [ell(16, 18.2, 3.9, 2.8)] },
            { mat: "fluff", level: 2, prims: [cap(9.8, 22.6, 22.2, 24.6, 0.5), cap(10.4, 27.2, 21.6, 25.4, 0.5)] },
          ],
        },
      );
      if (pose === "idle") {
        const inks = { k: "eye:3", w: "white:4" };
        decals.push(stamp(13, 17, ["wk", "kk"], inks), stamp(17, 17, ["wk", "kk"], inks));
      } else {
        decals.push(stamp(13, 18, ["kk"], { k: "eye:3" }), stamp(17, 18, ["kk"], { k: "eye:3" }));
      }
      decals.push(...blush([12, 19], [19, 19], 1), stamp(15, 20, ["kk"], { k: "body:1" }));
    } else {
      parts.push(
        // Hindwings, then forewings: broad moth triangles with a frost
        // eyespot and a pale scalloped margin.
        {
          mat: "wing",
          prims: both(poly([[14.6, 18.6], [9.6, 19.4], [6.4, 22.4], [7.2, 26], [10.6, 26.6], [14.6, 22.4]], 0.9)),
          back: true,
        },
        {
          mat: "wing",
          prims: both(poly([[14.6, 12.4], [8.6, 7.4], [3, 5.6], [1.6, 9], [3.2, 14.6], [8.6, 17.6], [14.6, 17.4]], 0.7)),
          paint: [
            { mat: "fluff", level: 4, prims: both(path([[2.4, 7.6], [2.6, 11.8], [4.4, 15.2]], 0.6)) },
            { mat: "fluff", level: 4, prims: both(ell(7.6, 11.6, 1.5)) },
            { mat: "wing", level: 1, prims: both(ell(7.6, 11.6, 0.6)) },
          ],
        },
        // Feathered antennae.
        { mat: "body", prims: both(path([[14.8, 8.8], [13.8, 6], [12.2, 4]], 0.7)) },
        { mat: "wing", prims: both(ell(11.2, 3.6, 1.3, 2.6, 45)), paint: [{ mat: "fluff", level: 4, prims: both(cap(13, 5, 9.8, 2, 0.4)) }] },
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
        { mat: "body", prims: [ell(16, 11.6, 4.6, 4.1)] },
      );
      decals.push(...eyes([12, 10], [18, 10], pose, "tall"), ...blush([11, 13], [19, 13], 2));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "beak", prims: both(ell(13.4, 29.5, 1.8, 0.9)) },
        {
          mat: "down",
          prims: [ell(16, 23.4, 6.9, 6.2)],
          blend: 1.6,
          paint: [
            { mat: "back", prims: [ell(16, 17.4, 8, 4.4)] },
            { mat: "belly", level: 4, prims: [ell(16, 22.4, 5.4, 2.8), ...both(ell(13.4, 21.4, 2.4, 2))] },
          ],
        },
        { mat: "down", prims: both(ell(9.5, 25.2, 1.3, 2.4, 20)) },
        { mat: "down", prims: [ell(15.2, 17.4, 1.2, 1.1), ell(17.2, 16.9, 1.2, 1.2)], blend: 0.5 },
      );
      decals.push(
        ...eyes([12, 20], [18, 20], pose, "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(15, 23, ["bb"], { b: "beak:3" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "beak", prims: both(ell(13.2, 29.5, 2, 1)) },
        {
          mat: "back",
          prims: [egg(16, 22.6, 6.8, 7.2, 0.14), ell(16, 15.2, 5.4, 4.8)],
          blend: 3,
          paint: [
            { mat: "belly", level: 4, prims: [...both(ell(13.6, 15.8, 2.3, 2.4)), ell(16, 17.4, 2.8, 1.6), ell(16, 24.2, 4.6, 5.2)] },
            { mat: "down", prims: [ell(16, 29.8, 7.6, 3.2), ...both(ell(10.6, 27.2, 1.6, 1.3)), ell(14.3, 27.4, 1.4, 1.1), ell(17.7, 27.4, 1.4, 1.1) ] },
          ],
        },
        { mat: "back", prims: both(path([[9.8, 19.6], [8.2, 23], [8, 25.8]], 1.6, 1)) },
        { mat: "down", prims: [ell(15.4, 10.8, 1.1, 1), ell(17, 10.4, 1.1, 1.1)], blend: 0.5 },
        { mat: "scarf", prims: [ell(16, 19.6, 5, 1.4)] },
        { mat: "scarf", prims: [cap(18.8, 20.4, 19.6, 23.8, 1.1, 1)] },
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 17, ["bb"], { b: "beak:3" }),
      );
    } else {
      parts.push(
        { mat: "beak", prims: both(ell(12.8, 29.5, 2.4, 1.1)) },
        {
          mat: "back",
          prims: [egg(16, 20.8, 8, 8.8, 0.18), ell(16, 10, 6, 5.2)],
          blend: 4,
          paint: [
            { mat: "belly", level: 4, prims: [...both(ell(13.6, 10.8, 2.5, 2.6)), ell(16, 12.4, 2.8, 1.6), ell(16, 22.4, 5.6, 7)] },
          ],
        },
        { mat: "back", prims: both(path([[8.8, 16], [6.4, 20.4], [5.6, 24.4]], 2, 0.9)) },
        { mat: "scarf", prims: [ell(16, 15.2, 6.2, 1.9)], paint: [{ mat: "scarf", level: 2, prims: [cap(10.6, 16.3, 21.4, 16.3, 0.45)] }] },
        {
          mat: "scarf",
          prims: [path([[20.4, 15.6], [22.8, 17], [23.6, 19.6]], 1.3, 1.1), cap(19.2, 16.2, 20.2, 21.8, 1.4, 1.3)],
          blend: 0.6,
          paint: [{ mat: "belly", level: 4, prims: [cap(18.6, 19.6, 21.6, 19.6, 0.45), cap(22, 18.4, 25, 18.4, 0.45)] }],
        },
      );
      decals.push(
        ...eyes([12, 9], [18, 9], pose, "round"),
        ...blush([10, 12], [20, 12]),
        stamp(15, 12, ["bb", "dd"], { b: "beak:4", d: "beak:2" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 2 : stage === 1 ? 6 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Stoat head: a wide flat oval with a little snout, ears low on the sides. */
    const head = (cy: number, rx: number, ry: number): Part[] => [
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
    ];
    if (stage === 0) {
      parts.push(
        {
          mat: "fur",
          prims: [ell(16, 26.2, 5.8, 3.8)],
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 27, 3.2, 2.6)] }],
        },
        ...head(21.4, 4.9, 4.1),
        {
          mat: "fur",
          prims: [path([[21, 27], [20, 29.4], [15, 29.9], [10.4, 29.3]], 1.4, 1.7)],
          paint: [{ mat: "tip", prims: [ell(9.6, 29.2, 2.6, 2.2)] }],
        },
      );
      decals.push(
        ...eyes([12, 20], [18, 20], pose, "tall"),
        ...blush([10, 23], [20, 23], 1),
        stamp(15, 23, ["nn"], { n: "nose:3" }),
      );
    } else if (stage === 1) {
      parts.push(
        {
          mat: "fur",
          prims: [path([[19.5, 27.2], [23.8, 28], [26.2, 25.4], [26.2, 21]], 1.4, 1.8)],
          paint: [{ mat: "tip", prims: [ell(26.2, 20.2, 2.4, 3)] }],
        },
        {
          mat: "fur",
          prims: [ell(16, 25.8, 4.6, 3.8), path([[16, 25], [16, 20], [16, 17]], 3, 2.4)],
          blend: 2,
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 24.2, 2.4, 4.2)] }],
        },
        ...head(14.8, 5, 3.7),
        { mat: "fur", prims: both(ell(14.4, 21.2, 1.3, 1.1)), paint: [{ mat: "belly", level: 4, prims: [ell(16, 21, 4, 2)] }] },
        { mat: "fur", prims: both(ell(13.2, 29.3, 2, 1)) },
      );
      decals.push(
        ...eyes([12, 13], [18, 13], pose, "tall"),
        ...blush([10, 16], [21, 16], 1),
        stamp(15, 16, ["nn"], { n: "nose:3" }),
      );
    } else {
      parts.push(
        {
          mat: "fur",
          prims: [path([[19, 27.4], [24.4, 28.4], [27.8, 25.8], [28.4, 21.4], [27.2, 16.8]], 1.5, 2.2)],
          paint: [{ mat: "tip", prims: [ell(27, 15.6, 2.8, 4.4, 10)] }],
        },
        {
          mat: "fur",
          prims: [ell(16, 25.4, 5, 4.4), path([[16, 24], [16, 18], [16, 12]], 3.3, 2.4)],
          blend: 2,
          paint: [{ mat: "belly", level: 4, prims: [ell(16, 22.4, 2.6, 6.2)] }],
        },
        ...head(8.8, 5.2, 3.9),
        { mat: "fur", prims: both(ell(14.3, 17.8, 1.5, 1.2)), paint: [{ mat: "belly", level: 4, prims: [ell(16, 17.6, 4, 2)] }] },
        { mat: "fur", prims: both(ell(12.8, 29.3, 2.4, 1)) },
      );
      decals.push(
        ...eyes([12, 7], [18, 7], pose, "round"),
        ...blush([10, 10], [21, 10], 1),
        stamp(15, 10, ["nn"], { n: "nose:3" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 0 ? 23 : 22, stage === 2 ? 1 : stage === 1 ? 6 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A ¾ wolf head looking left: skull, long muzzle, pale cheeks, two
     *  tall ears (the far one a step darker). */
    const head = (x: number, y: number, s: number): Part[] => [
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
    ];
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[20.5, 27.5], [23.5, 25.5], [24.4, 22]], 1.8, 1.4)], paint: [{ mat: "cream", prims: [ell(24.4, 21.8, 1.9)] }] },
        {
          mat: "fur",
          prims: both(poly([[9.6, 19], [8.8, 11.4], [14.2, 16]], 0.7)),
          paint: [{ mat: "cream", prims: both(poly([[10.4, 17.4], [10, 13.8], [12.4, 16.2]], 0)) }],
        },
        { mat: "ice", prims: crest([[16, 16.4, -90, 2.6], [18, 16.8, -60, 2.2], [14, 16.8, -120, 2.2]], 1.1), glow: true },
        {
          mat: "fur",
          prims: [ell(16, 21, 6.8, 5.4), ell(16, 26.2, 5.2, 3.8), ...both(poly([[10, 20.5], [7.8, 24.4], [11.6, 24.2]], 0.4))],
          blend: 2.5,
          paint: [{ mat: "cream", level: 4, prims: [ell(16, 24.4, 3.6, 2.2), ...both(ell(12.4, 23.6, 2.2, 1.5)), ell(16, 28, 2.8, 2.2)] }],
        },
        { mat: "fur", prims: both(ell(13.3, 29.2, 1.9, 1.2)), paint: [{ mat: "cream", level: 4, prims: both(ell(13.3, 29.8, 1.6, 0.6)) }] },
      );
      decals.push(
        ...eyes([12, 19], [18, 19], pose, "tall"),
        ...blush([10, 23], [20, 23]),
        stamp(15, 22, ["kk", ".."], { k: "eye:3" }),
        stamp(14, 23, ["k..k"], { k: "fur:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        {
          mat: "fur",
          prims: [path([[20, 27.6], [24.6, 27.2], [26.6, 23.6], [26, 20.2]], 1.8, 2)],
          paint: [{ mat: "cream", level: 4, prims: [ell(26, 19.6, 2, 2.2)] }],
        },
        { mat: "ice", prims: crest([[15.4, 11.8, -60, 3.6], [17.6, 14, -38, 4], [19.4, 17, -18, 3.6]], 1.2), glow: true },
        { mat: "fur", prims: [cap(15.4, 21, 15.8, 28.8, 1.4, 1.3)], back: true, round: 1.2 },
        {
          mat: "fur",
          prims: [ell(19, 24.4, 4.8, 4.4), ell(14, 20, 3.8, 4.8)],
          blend: 3,
          paint: [{ mat: "cream", level: 4, prims: [ell(12.6, 20.8, 2.4, 3.6)] }],
        },
        { mat: "fur", prims: [cap(12.2, 22, 11.8, 28.6, 1.7, 1.5), ell(11.6, 29.2, 2.1, 1.1), ell(20.4, 29.2, 2.6, 1.1)], round: 1.4 },
        ...head(12.4, 13.2, 0.82),
      );
      decals.push(...eyes([8, 12], [12, 12], pose, "tall"), stamp(5, 15, ["kk"], { k: "eye:3" }));
    } else {
      parts.push(
        {
          mat: "fur",
          prims: [path([[21.6, 28], [26.4, 27.4], [28.8, 23.4], [28, 18.6]], 2.2, 2.6)],
          paint: [{ mat: "cream", level: 4, prims: [ell(28, 17.6, 2.6, 2.8)] }],
        },
        {
          mat: "ice",
          prims: crest([[15.8, 7.4, -70, 5], [18.4, 9.6, -48, 5.8], [20.6, 12.6, -30, 6], [22, 16, -12, 5.4], [22.6, 19.6, 6, 4.4]], 1.6),
          glow: true,
        },
        { mat: "fur", prims: [cap(16.4, 21, 16.8, 29, 1.8, 1.6), ell(17.2, 29.2, 2.2, 1.1)], back: true, round: 1.4 },
        {
          mat: "fur",
          prims: [ell(20.4, 23.6, 6, 5.6), ell(14.6, 18.6, 4.8, 6.4)],
          blend: 3,
          paint: [{ mat: "cream", level: 4, prims: [ell(12.8, 20.4, 2.8, 4.8)] }],
        },
        {
          mat: "cream",
          prims: [ell(13.6, 15.8, 4.4, 2.6), ell(10.4, 17.6, 1.6), ell(12.6, 19.4, 1.7), ell(15.2, 19.6, 1.6), ell(17.2, 17.8, 1.5)],
          blend: 1.2,
          round: 4,
          paint: [{ mat: "cream", level: 4, prims: [ell(13.6, 15.6, 4.4, 2.6), ell(11.4, 17.4, 1.4), ell(14, 18.6, 1.6), ell(16.4, 17.4, 1.2)] }],
        },
        { mat: "ice", prims: [cap(12.6, 19.8, 12.8, 22.8, 1.1, 0.45), cap(15.4, 20.2, 15.3, 23.2, 1.2, 0.45)], glow: true },
        { mat: "fur", prims: [cap(12.4, 21.4, 12, 28.6, 2.1, 1.9), ell(11.6, 29.2, 2.5, 1.2), ell(22.6, 29.2, 3.2, 1.2)], round: 1.6, paint: [{ mat: "cream", level: 4, prims: [ell(11.4, 29.8, 2.2, 0.6)] }] },
        ...head(12.6, 9.4, 1),
      );
      decals.push(...eyes([8, 8], [13, 8], pose, "tall"), stamp(6, 11, ["kk"], { k: "eye:3" }));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : stage === 1 ? 3 : 7));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Fur-framed head: skin face with a widow's peak, a curling cowlick
     *  and shaggy cheek tufts. */
    const head = (cy: number, rx: number, ry: number, fx: number, fy: number, lick: number, extra: Prim[] = []): Part[] => [
      {
        mat: "fur",
        prims: [path([[15.4, cy - ry + 1.6], [15, cy - ry - lick * 0.5], [16.4, cy - ry - lick], [18, cy - ry - lick * 0.8]], 1.5, 0.7)],
        back: true,
      },
      {
        mat: "fur",
        prims: [ell(16, cy, rx, ry), ...both(cap(16 - rx + 0.8, cy + 1, 16 - rx - 1, cy + 2.2, 1.2, 0.5)), ...extra],
        blend: 2,
        paint: [{ mat: "skin", prims: [ell(16, cy + 0.9, fx, fy)], cut: [poly([[14.6, cy + 0.9 - fy - 0.2], [17.4, cy + 0.9 - fy - 0.2], [16, cy + 0.9 - fy + 1.6]], 0)] }],
      },
    ];
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: both(ell(12.8, 29.3, 2.2, 1.1)), paint: [{ mat: "skin", prims: both(ell(12.8, 29.9, 1.6, 0.5)) }] },
        ...head(23.2, 6.8, 6, 4.8, 3.8, 3, [ell(16, 26, 6, 3.6)]),
        { mat: "fur", prims: both(path([[10.2, 25.2], [9.4, 27.2], [9.8, 28.2]], 1.6, 1.3)), paint: [{ mat: "skin", prims: both(ell(9.9, 28.6, 1.1, 0.6)) }] },
      );
      decals.push(
        ...eyes([12, 22], [18, 22], pose, "tall"),
        stamp(14, 26, ["kkkk", ".kk."], { k: "skin:1" }),
        ...blush([10, 25], [20, 25], 2),
      );
    } else if (stage === 1) {
      parts.push(
        {
          mat: "fur",
          prims: [ell(16, 23.6, 7.4, 5.8), ...both(cap(9.4, 26, 8.2, 27.6, 1.3, 0.6))],
          blend: 2,
          paint: [{ mat: "fur", level: 4, prims: [ell(16, 24.6, 3.6, 3.2)] }],
        },
        ...head(15.8, 6.2, 5.2, 4.4, 3.5, 3.4),
        {
          mat: "fur",
          prims: both(path([[9.8, 19.6], [7.6, 23.2], [7.2, 26.6]], 2.1, 2)).concat(both(cap(6.4, 22.4, 5, 23.8, 1.1, 0.5))),
          paint: [{ mat: "skin", prims: both(ell(7.2, 27.7, 1.8, 0.9)) }],
        },
        { mat: "fur", prims: both(ell(12.6, 29.2, 2.7, 1.3)), paint: [{ mat: "skin", prims: both(ell(12.6, 29.9, 2.1, 0.6)) }] },
      );
      decals.push(
        ...eyes([12, 15], [18, 15], pose, "tall"),
        stamp(14, 19, ["k..k", ".kk."], { k: "skin:1" }),
      );
    } else {
      parts.push(
        { mat: "fur", prims: both(cap(12.4, 25, 12.2, 28.4, 2.8, 2.6)), round: 1.8, back: true },
        {
          mat: "fur",
          prims: [egg(16, 19.8, 8.2, 7.6, -0.16), ...both(cap(10.2, 24.6, 9.4, 26.6, 1.3, 0.5)), cap(16, 26.4, 16, 28, 1.2, 0.5)],
          blend: 2.5,
          paint: [{ mat: "fur", level: 4, prims: [ell(16, 20.6, 4.2, 4.4)] }],
        },
        ...head(11, 6.6, 5.6, 5.2, 4.2, 3.4),
        {
          mat: "fur",
          prims: both(path([[8.4, 14.6], [5.2, 19.2], [4.4, 25]], 2.8, 2.5)).concat(both(cap(5.4, 15.4, 3.4, 16.4, 1.4, 0.5)), both(cap(3, 20.4, 1.4, 21.8, 1.2, 0.5))),
          paint: [{ mat: "skin", prims: both(ell(4.4, 26.6, 2.3, 1.2)) }],
        },
        { mat: "fur", prims: both(ell(11.8, 29.2, 3.3, 1.4)), paint: [{ mat: "skin", prims: both(ell(11.8, 29.9, 2.7, 0.6)) }] },
      );
      decals.push(
        ...eyes([12, 10], [18, 10], pose, "tall"),
        stamp(13, 14, ["kwkkwk", ".kkkk."], { k: "skin:1", w: "white:4" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : stage === 1 ? 5 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
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
    if (stage === 0) {
      parts.push(
        { mat: "wool", prims: both(ell(10.4, 21.4, 1.8, 2.4, 10)), back: true },
        legs([13, 19], 25, 1.9),
        {
          mat: "wool",
          prims: [ell(16, 22, 6.4, 5.8), ell(16, 25.4, 5.8, 3.2), cap(15.4, 16.8, 14.8, 15, 1, 0.5), cap(16.6, 16.6, 17.4, 14.8, 1, 0.5)],
          blend: 2,
          paint: [{ mat: "snow", level: 4, prims: [ell(14.8, 14.8, 1, 1), ell(17.4, 14.6, 1, 1)] }],
        },
        { mat: "tusk", prims: both(cap(13.6, 24.4, 12.6, 25.6, 0.8, 0.5)) },
        { mat: "wool", prims: [path([[16, 22.4], [16, 25.6], [17.2, 27.2]], 1.6, 1.1)], round: 1.6 },
      );
      decals.push(...eyes([12, 20], [18, 20], pose, "tall"), ...blush([10, 23], [20, 23]));
    } else if (stage === 1) {
      parts.push(
        { mat: "wool", prims: both(ell(10.2, 16, 2, 2.8, 8)), back: true },
        legs([12, 20], 24, 2.3),
        { mat: "wool", prims: [ell(16, 20.6, 9.4, 5.2), ell(16, 17.6, 7.6, 4), ...hem(8, 24, 23.6, 7, 3)], blend: 2 },
        {
          mat: "wool",
          prims: [ell(16, 15.4, 5.6, 5), ...both(cap(15, 10.8, 14.2, 8.8, 1, 0.5)), cap(16.4, 10.6, 17.4, 8.6, 1, 0.5)],
          blend: 2,
          paint: [{ mat: "snow", level: 4, prims: [ell(14, 8.4, 1.2, 1), ell(16, 7.9, 1, 1.2), ell(17.9, 8.2, 1.2, 1)] }],
        },
        { mat: "tusk", prims: both(path([[13.6, 19.4], [12.2, 22.2], [10, 22.6], [8.8, 21]], 1.1, 0.6)) },
        { mat: "wool", prims: [path([[16, 17], [16, 21.6], [16.4, 24.4], [18, 25.6]], 2, 1.2)], round: 1.6 },
      );
      decals.push(...eyes([12, 14], [18, 14], pose, "tall"), ...blush([10, 18], [20, 18]));
    } else {
      parts.push(
        { mat: "wool", prims: both(ell(8.8, 12.6, 2.4, 3.4, 8)), back: true },
        legs([10.6, 21.4], 24, 3),
        { mat: "wool", prims: [ell(16, 18.2, 12.2, 6.4), ell(16, 13.6, 9.8, 5.2), ...hem(5, 27, 22.4, 10, 4)], blend: 2.5 },
        {
          mat: "wool",
          prims: [ell(16, 10.4, 6.6, 5.8), ell(16, 6, 5, 3), ...both(cap(10.6, 13.6, 9.4, 15.6, 1.3, 0.5)), cap(15.4, 3.4, 14.4, 1.4, 1, 0.5), cap(16.6, 3.2, 17.8, 1.2, 1, 0.5)],
          blend: 3,
          paint: [{ mat: "snow", level: 4, prims: [ell(14, 1.2, 1.4, 1.2), ell(18.3, 1, 1.4, 1.2), ell(16, 3.2, 3, 0.7)] }],
        },
        { mat: "tusk", prims: [path([[13, 15.6], [10.4, 20.2], [6.6, 21.8], [3.6, 19.8], [2.8, 16.2], [4.2, 13.4]], 1.6, 0.6)] },
        { mat: "tusk", prims: [path([[19, 15.6], [21.6, 20.2], [25.4, 21.8], [28.4, 19.8], [29.2, 16.2], [27.8, 13.4]], 1.6, 0.6)] },
        { mat: "wool", prims: [path([[16, 13], [16, 20], [16.3, 24.4], [17.8, 26.6], [19.6, 26]], 2.5, 1.3)], round: 1.8 },
      );
      decals.push(...eyes([11, 9], [19, 9], pose, "tall"), ...blush([9, 13], [21, 13]));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : stage === 1 ? 5 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Breast chevrons as crisp little V stamps. */
    const chevrons = (list: [number, number][]): Decal[] => list.map(([x, y]) => stamp(x, y, ["k.k", ".k."], { k: "wing:2" }));
    if (stage === 0) {
      parts.push(
        { mat: "aurora", prims: [cap(16, 18, 16, 15, 1.2, 0.45)], glow: true },
        {
          mat: "feather",
          prims: [ell(16, 23.8, 6.8, 6.2), ell(14, 17.8, 1.4, 1.2), ell(18, 17.8, 1.4, 1.2)],
          blend: 2,
          paint: [{ mat: "feather", level: 4, prims: [...both(ell(12.6, 22, 2.8, 2.6)), ell(16, 26, 3.6, 2.6)] }],
        },
        { mat: "wing", prims: both(ell(9.6, 25, 1.5, 2.6, 15)) },
        { mat: "beak", prims: both(ell(14, 29.6, 1.1, 0.8)) },
      );
      decals.push(
        ...owlEyes([10, 20], [18, 20], pose),
        stamp(15, 23, ["bb", "dd"], { b: "beak:4", d: "beak:2" }),
        ...blush([9, 24], [21, 24]),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "aurora2", prims: both(cap(13.4, 14.5, 11.6, 10.4, 1.2, 0.45)), glow: true },
        { mat: "aurora", prims: [cap(16, 14, 16, 9, 1.4, 0.5)], glow: true },
        {
          mat: "feather",
          prims: [egg(16, 21.6, 7.6, 8.4, 0.12)],
          paint: [{ mat: "feather", level: 4, prims: [...both(ell(13, 18.4, 3.3, 3)), ell(16, 25, 4, 3.6)] }],
        },
        {
          mat: "wing",
          prims: both(ell(9.4, 23, 2.4, 5.2, 12)),
          paint: [{ mat: "aurora2", prims: both(ell(9.6, 27.4, 2, 1.4, 12)) }],
        },
        { mat: "beak", prims: both(ell(13.5, 29.6, 1.3, 0.9)) },
      );
      decals.push(...owlEyes([11, 17], [17, 17], pose), stamp(15, 20, ["bb", "dd"], { b: "beak:4", d: "beak:2" }), ...chevrons([[13, 24], [17, 24]]));
    } else {
      parts.push(
        { mat: "aurora", prims: shards(16, 13, [[-90, 3, 12.2, 2], [-143, 3, 9.6, 1.6], [-37, 3, 9.6, 1.6]]), glow: true },
        { mat: "aurora2", prims: shards(16, 13, [[-116, 3, 11.4, 1.8], [-64, 3, 11.4, 1.8], [-165, 4, 9, 1.4], [-15, 4, 9, 1.4]]), glow: true },
        {
          mat: "feather",
          prims: [egg(16, 19.6, 9.6, 10.4, 0.14)],
          paint: [
            { mat: "feather", level: 4, prims: [...both(ell(12.6, 15.4, 4.2, 3.8)), ell(16, 24, 5, 4.6)] },
          ],
        },
        {
          mat: "wing",
          prims: both(path([[8.4, 15.6], [6, 21], [6.8, 27.6]], 3, 1.6)),
          paint: [
            { mat: "wing", level: 4, prims: both(ell(6.6, 18.6, 1.4, 1.8, 20)) },
            { mat: "aurora2", prims: both(ell(6.8, 26.6, 2, 1.8)) },
          ],
        },
        { mat: "beak", prims: both(ell(13.2, 29.6, 1.6, 1)) },
      );
      decals.push(
        ...owlEyes([10, 13], [17, 13], pose, 5),
        stamp(15, 18, ["bb", "dd"], { b: "beak:4", d: "beak:2" }),
        ...chevrons([[11, 22], [18, 22], [14, 24], [11, 26], [18, 26]]),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 2 : 8));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
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
    const spines = (list: [number, number, number, number][], w = 1.3): Part => ({ mat: "crystal", prims: crest(list, w), glow: true });
    if (stage === 0) {
      const [b0, f0] = coil(16, 26.6, 6.8, 2, 2.1);
      parts.push(
        b0,
        spines([[19.6, 19.6, -30, 2.6], [21.4, 23.4, -20, 2.6], [23, 25.4, -40, 2.4]], 1.2),
        { mat: "horn", prims: [path([[16.8, 18], [18.8, 16.4], [20, 14.8]], 1.1, 0.5), path([[13.2, 17.6], [12.6, 15.8], [12.8, 14.6]], 1, 0.5)] },
        { mat: "scale", prims: [path([[17.4, 26], [19.4, 23.4], [18, 21]], 2.2, 2.2)] },
        head(15.4, 21, 0.95),
        f0,
        { mat: "scale", prims: [path([[21.6, 29], [24.8, 28.6], [26, 26.2]], 1.3, 0.5)] },
      );
      decals.push(...eyes([12, 20], [17, 20], pose, "tall"), ...blush([10, 23], [19, 23], 1));
    } else if (stage === 1) {
      const [b0, f0] = coil(16, 25.6, 8.6, 2.6, 2.3);
      parts.push(
        b0,
        spines([[21.2, 18.6, -35, 3.2], [21.4, 21.6, -15, 3], [24.2, 23.2, -40, 3], [7.8, 23.2, -140, 3]]),
        { mat: "horn", prims: [path([[15.4, 11.4], [17.8, 9.4], [19.4, 7.6]], 1.2, 0.5), path([[12.4, 11], [11.4, 9], [11.4, 7.4]], 1.1, 0.5)] },
        {
          mat: "scale",
          prims: [path([[17, 25], [19.8, 21], [18.8, 17.4], [15.6, 15]], 2.3, 2.2)],
          paint: [{ mat: "belly", level: 4, prims: [path([[16, 25], [18.4, 21], [17.4, 17.6]], 0.9, 0.9)] }],
        },
        head(14, 13.4, 1),
        f0,
        { mat: "scale", prims: [path([[23.6, 28.6], [27.2, 28.2], [28.4, 25.6]], 1.5, 0.5)] },
      );
      decals.push(...eyes([11, 12], [16, 12], pose, "tall"));
    } else {
      const [b0, f0] = coil(16, 25.4, 11, 3, 2.6);
      parts.push(
        b0,
        spines([
          [21.2, 7.8, -45, 4.2], [22.8, 12.4, -20, 4.6], [23.4, 17.4, 0, 4.4], [26.6, 23.2, -38, 4.4], [5.4, 23.2, -142, 4.4], [9.6, 22.4, -110, 3.4],
        ], 1.35),
        { mat: "horn", prims: [path([[15.8, 4.6], [18.2, 2.4], [19.6, 0.6]], 1.6, 0.5), path([[11.4, 4], [10, 2], [10.4, 0.6]], 1.3, 0.5)] },
        {
          mat: "scale",
          prims: [path([[17, 25.4], [21.6, 20.4], [21.4, 14.4], [18.6, 9.6]], 2.8, 2.6)],
          paint: [{ mat: "belly", level: 4, prims: [path([[16, 25.6], [19.8, 20.6], [19.6, 14.8], [17.4, 11]], 1.1, 1)] }],
        },
        head(14.6, 7.2, 1.15),
        f0,
        { mat: "scale", prims: [path([[25.4, 28.8], [29, 28.4], [30.4, 25.6], [29.6, 23]], 2, 0.5)] },
        { mat: "crystal", prims: [poly([[29.6, 23.6], [30.8, 21.6], [29.9, 19.2], [28.6, 21.4]], 0.1)], glow: true },
      );
      decals.push(...eyes([10, 6], [16, 6], pose, "round"), stamp(9, 10, ["k.k"], { k: "scale:1" }));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : stage === 1 ? 5 : 10));
    return { parts, decals };
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
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Gold cat eyes, 3×2 (3×3 with a heavy upper lid on the adult). */
    const catEyes = (l: [number, number], r: [number, number], lined = false): Decal[] => {
      const inks = { w: "white:4", g: "iris:3", k: "eye:3" };
      const dy = lined ? 1 : 0;
      if (pose !== "idle") return [stamp(l[0], l[1] + 1 + dy, ["kkk"], inks), stamp(r[0], r[1] + 1 + dy, ["kkk"], inks)];
      const rows = lined ? ["kkk", "wkg", "gkg"] : ["wkg", "gkg"];
      return [stamp(l[0], l[1], rows, inks), stamp(r[0], r[1], rows, inks)];
    };
    const face = (nx: number, ny: number): Decal[] => [
      stamp(nx, ny, ["nn"], { n: "nose:3" }),
      stamp(nx - 1, ny + 1, [".kk.", "k..k"], { k: "fur:1" }),
    ];
    /** Round tiger ears with pink insides. */
    const ears = (x: number, y: number, r: number): Part => ({
      mat: "fur",
      prims: both(ell(x, y, r, r * 0.95)),
      paint: [{ mat: "nose", prims: both(ell(x + 0.1, y + 0.3, r * 0.5, r * 0.5)) }],
    });
    /** Striped tail curling up on the right. */
    const tail = (pts: [number, number][], r0: number, r1: number, bands: [number, number, number, number][]): Part => ({
      mat: "fur",
      prims: [path(pts, r0, r1)],
      paint: [{ mat: "stripe", level: 3, prims: bands.map(([ax, ay, bx, by]) => cap(ax, ay, bx, by, 0.75)) }],
    });
    if (stage === 0) {
      parts.push(
        tail([[20.5, 27.6], [23.8, 26.4], [25, 23]], 1.6, 1.3, [[22.6, 25.2, 23.6, 28], [23.6, 23.8, 26.4, 24.2]]),
        { mat: "crystal", prims: [cap(16, 16.4, 16, 13.2, 1.2, 0.45)], glow: true },
        ears(10.6, 16.4, 2.1),
        {
          mat: "fur",
          prims: [ell(16, 21, 7, 5.6), ...both(poly([[9.5, 20], [7.6, 23.6], [11, 24.6]], 0.5)), ell(16, 26.6, 5, 3.6)],
          blend: 2.5,
          paint: [
            { mat: "stripe", level: 3, prims: [cap(16, 15.4, 16, 17.2, 0.8), ...both(path([[7.6, 22.2], [10.4, 22.6]], 0.8, 0.5)), ...both(path([[10.4, 25.4], [11.8, 27.6]], 0.8, 0.5))] },
            { mat: "fur", level: 5, prims: both(ell(14.8, 23.6, 1.8, 1.4)) },
          ],
        },
        { mat: "fur", prims: both(ell(13.2, 29.2, 1.9, 1.3)) },
      );
      decals.push(...eyes([12, 19], [18, 19], pose, "tall"), ...blush([10, 23], [20, 23]), ...face(15, 22));
    } else if (stage === 1) {
      parts.push(
        tail([[21, 28], [25, 26.8], [26.4, 23], [25.2, 19.8]], 1.6, 1.2, [[23, 26, 23.6, 28.8], [25, 24, 27.8, 24.2], [24.4, 21, 27, 20.6]]),
        {
          mat: "fur",
          prims: both(ell(11, 26.6, 3, 3.3)),
          back: true,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[7.8, 25.2], [10, 26.2]], 0.8, 0.45)) }],
        },
        { mat: "fur", prims: [ell(16, 23.6, 4.8, 5.2)] },
        ears(10.8, 10.8, 2.2),
        { mat: "crystal", prims: [cap(16, 11, 16, 6.6, 1.4, 0.45), ...both(cap(14, 11.2, 13.2, 8.6, 1, 0.45))], glow: true },
        {
          mat: "fur",
          prims: [ell(16, 15.6, 6.4, 5), ...both(poly([[10.2, 15], [7.8, 18.6], [11.4, 19.2]], 0.5))],
          blend: 2,
          paint: [
            { mat: "stripe", level: 3, prims: [...both(path([[13.4, 11], [14, 12.8]], 0.8, 0.5)), ...both(path([[7.6, 17.2], [10.6, 17.4]], 0.8, 0.45))] },
            { mat: "fur", level: 5, prims: both(ell(14.8, 18.4, 1.7, 1.3)) },
          ],
        },
        {
          mat: "fur",
          prims: both(cap(13.6, 23, 13.4, 28.6, 1.6)).concat(both(ell(13.4, 29.2, 2, 1.2))),
          round: 1.5,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[11.8, 25.4], [13.6, 25.8]], 0.8, 0.45)) }],
        },
      );
      decals.push(...catEyes([12, 14], [17, 14]), ...face(15, 17));
    } else {
      parts.push(
        { mat: "aura", prims: both(path([[10.4, 8], [6.4, 7.4], [3.4, 9.6], [2, 13.6], [1.4, 18.4]], 1.8, 0.5)), glow: true },
        { mat: "crystal", prims: both(path([[9.6, 12], [6.4, 12.6], [4.6, 15.6], [3.8, 19.6], [3.2, 24]], 1.8, 0.5)), glow: true },
        tail([[22.5, 28], [27, 26.5], [28.5, 22.5], [27.5, 18.5]], 1.9, 1.4, [[24.4, 26, 25.2, 29], [26.6, 23.4, 30, 23.8], [26, 20.4, 29.4, 19.6]]),
        {
          mat: "fur",
          prims: both(ell(9.6, 25.8, 3.9, 4.2)),
          back: true,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[5.6, 23.6], [8, 24.4], [9, 26.2]], 0.85, 0.45)) }],
        },
        { mat: "fur", prims: [ell(16, 22, 6, 6.6)], paint: [{ mat: "fur", level: 4, prims: [ell(16, 23, 3.4, 5)] }] },
        ears(10, 6.4, 2.5),
        {
          mat: "fur",
          prims: [ell(16, 11.8, 7.2, 5.6), ...both(poly([[9.5, 11], [6, 15.8], [11, 16.6]], 0.6))],
          blend: 2,
          paint: [
            {
              mat: "stripe",
              prims: [
                ...both(path([[6.4, 14.2], [10, 14.4]], 0.9, 0.45)),
              ],
            },
            { mat: "fur", level: 5, prims: both(ell(14.7, 14.6, 2, 1.5)) },
          ],
        },
        {
          mat: "fur",
          prims: both(cap(13.4, 21, 12.8, 28.4, 1.9, 2)).concat(both(ell(12.6, 29.1, 2.5, 1.3))),
          round: 1.8,
          paint: [{ mat: "stripe", level: 3, prims: both(path([[10.6, 24], [12.8, 24.6]], 0.8, 0.45)) }],
        },
        { mat: "crystal", prims: [poly([[16, 17.6], [17.6, 19.6], [16, 22], [14.4, 19.6]], 0.2)], glow: true },
        { mat: "crystal", prims: [cap(16, 7, 16, 1.6, 1.7, 0.45), ...both(cap(13.4, 7.2, 12, 3.4, 1.2, 0.45))], glow: true },
      );
      decals.push(
        ...catEyes([12, 10], [17, 10]),
        ...face(15, 13),
        sparkle(1, 1, "#e6fbff"),
        ...(pose === "sleep" ? [] : [sparkle(27, 3, "#e6fbff")]),
        stamp(29, 30, ["s"], { s: "#fff4c2" }, true),
        stamp(2, 29, ["s"], { s: "#e6fbff" }, true),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 2 ? 1 : 6));
    return { parts, decals };
  },
};

export const FROST: Species[] = [snowpuff, frostmoth, pengwin, ermine, fenrir, yeti, mammoth, aurorowl, icewyrm, byakko];
