import type { Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
import type { Decal, Paint, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, path, poly } from "../pixel.ts";

/** Axis-aligned rounded rectangle. */
const rect = (x0: number, y0: number, x1: number, y1: number, round = 0): Prim =>
  poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], round);

/** Horizontal bands (for paint): one every `step` px from y0 to y1, `h` tall. */
const bands = (y0: number, y1: number, step: number, h: number, x0 = 0, x1 = 32): Prim[] => {
  const out: Prim[] = [];
  for (let y = y0; y < y1; y += step) out.push(rect(x0, y, x1, y + h));
  return out;
};

// ── Inkling: an ink drop that grew wings ──

export const inkling: Species = {
  id: "inkling",
  name: "Quilldrake",
  element: "arcane",
  tier: "common",
  stages: ["Inkling", "Blotwing", "Quilldrake"],
  palette: { ink: "#6a6ee0", splash: "#5ff0dc", nib: "#f2c65a" },
  shiny: { ink: "#d9587a", splash: "#ffe07a", nib: "#e8eef8" },
  lore: "Born from the first drop of a well-loved pen. It follows highlighters around, lapping up the bright bits.",
  hint: "Smells faintly of fresh highlighter.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A quill feather from root to tip: a slim leaf with a bright shaft. */
    const quill = (root: V, tip: V, w: number, back = true): Part => {
      const mx = (root[0] + tip[0]) / 2;
      const my = (root[1] + tip[1]) / 2;
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1]) / 2;
      const rot = (Math.atan2(tip[0] - root[0], -(tip[1] - root[1])) * 180) / Math.PI;
      return {
        mat: "ink", back, prims: [ell(mx, my, w, len, rot)],
        paint: [{ mat: "splash", prims: [path([[mx, my], [mx + (tip[0] - mx) * 0.75, my + (tip[1] - my) * 0.75]], 0.5)], level: 2 }],
      };
    };
    /** Pen-nib tail tip pointing up, centered at x, base y. */
    const nib = (x: number, y: number, h: number): Part => ({
      mat: "nib", prims: [poly([[x - 1.2, y], [x + 1.2, y], [x + 1.1, y - h * 0.45], [x, y - h], [x - 1.1, y - h * 0.45]], 0.3)],
    });
    if (stage === 0) {
      parts.push(
        { mat: "ink", prims: [cap(16, 24, 17.2, 15, 5.8, 0.9), ell(16, 28.4, 7.4, 1.5)], blend: 2.4,
          paint: [{ mat: "splash", prims: [ell(13.6, 18.6, 0.9, 1.4, -20)], level: 4 }] },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 24], [20, 24]),
        stamp(15, 25, ["k.k", ".k."], { k: "ink:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        quill([11.6, 20.4], [4.6, 13], 2.3),
        quill([20.4, 20.4], [27.4, 13], 2.3),
        { mat: "ink", prims: [path([[19, 27.6], [24.4, 28], [26.8, 25.4]], 2, 1.1)], back: true },
        nib(26.9, 25.2, 4.4),
        { mat: "ink", blend: 3, prims: [cap(16, 22.4, 17.4, 9.8, 6.8, 0.9), ell(16, 25.6, 6.4, 4), ...both(ell(12.6, 28.6, 2.2, 1.4))],
          paint: [{ mat: "splash", prims: [ell(13.4, 15.4, 0.9, 1.6, -20)], level: 4 }] },
      );
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 22, ["k.k", ".k."], { k: "ink:1" }),
        stamp(26, 22, ["k"], { k: "nib:1" }),
      );
    } else {
      parts.push(
        quill([11.4, 19.4], [2.4, 10.4], 2.4),
        quill([20.6, 19.4], [29.6, 10.4], 2.4),
        quill([11.6, 17.4], [4.4, 3.2], 3.2),
        quill([20.4, 17.4], [27.6, 3.2], 3.2),
        { mat: "ink", prims: [path([[20, 27.6], [25.6, 28.4], [28.4, 25.4], [28.2, 22.4]], 2.4, 1.2)], back: true },
        nib(28.2, 22.6, 6.4),
        {
          mat: "ink", blend: 3,
          prims: [ell(16, 22.2, 6.8, 6.4), cap(16, 17, 17.8, 3.4, 6.4, 0.9), path([[17.8, 3.8], [19.6, 2.6]], 0.8), ...both(ell(12, 28.4, 2.8, 1.8))],
          paint: [{ mat: "splash", prims: [ell(13.6, 9.8, 1, 1.8, -20)], level: 4 }],
        },
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        ...blush([10, 17], [20, 17]),
        stamp(15, 18, ["k.k", ".k."], { k: "ink:0" }),
        stamp(28, 18, ["k", "k"], { k: "nib:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(24, stage === 0 ? 8 : 2));
    return { parts, decals };
  },
};

// ── Tomepup: a book that wants to be read to ──

export const tomepup: Species = {
  id: "tomepup",
  name: "Grimhound",
  element: "arcane",
  tier: "common",
  stages: ["Tomepup", "Tomepaw", "Grimhound"],
  palette: { fur: "#e6b47a", cover: "#c9563e", page: "#f4ead0", tongue: "#ff7d9a" },
  shiny: { fur: "#dcd4ec", cover: "#3f7fd0", page: "#eef0ff", tongue: "#ffc84a" },
  lore: "A puppy that fell asleep under an open book and decided the book was its ears now. Ask it a question and its bookmark wags.",
  hint: "Fetches questions, not sticks.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const G = "#f2c65a";
    /** The open book laid face-down over the head: two cover slabs in an
     *  inverted V from the spine at (16, top), flaring past the head as
     *  floppy ears, with the page block showing beneath each cover. */
    const bookEars = (top: number, reach: number, drop: number, t: number) => {
      const knee: V = [16 - reach * 0.78, top + (drop - top) * 0.8];
      const tip: V = [16 - reach, drop + t * 0.9];
      parts.push(
        { mat: "page", prims: both(path([[16, top + t * 0.5], [knee[0] + 0.6, knee[1] + t * 0.5], [tip[0] + 0.9, tip[1] + 0.4]], t * 0.5)),
          paint: [{ mat: "page", prims: [rect(0, 0, 32, 32)], level: 4 }] },
        { mat: "cover", prims: both(path([[16, top], knee, tip], t * 0.5)), blend: 1 },
      );
    };
    /** The bookmark tail, wagging up to the right, with a notched end. */
    const tail = (pts: V[], r: number): Part => {
      const e = pts[pts.length - 1];
      return { mat: "tongue", prims: [path(pts, r)], cut: [poly([[e[0] - r * 1.4, e[1] - 0.4], [e[0] + r * 1.4, e[1] - 1.6], [e[0], e[1] + r * 1.6]].map(([x, y]) => [x, y - r]) as V[])], back: true };
    };
    if (stage === 0) {
      parts.push(
        tail([[19.6, 26.6], [23.6, 24.6], [24.8, 21]], 1),
        {
          mat: "fur", blend: 3,
          prims: [ell(16, 20, 6.2, 5.2), ell(16, 26, 4.6, 3.6), ...both(ell(13.4, 28.6, 1.8, 1.2))],
          paint: [{ mat: "fur", prims: [ell(16, 22.8, 2.8, 1.8)], level: 4 }],
        },
      );
      bookEars(13.2, 9.4, 19.6, 2.6);
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 21, ["kk"], { k: "eye:3" }),
        stamp(15, 23, ["tt"], { t: "tongue:3" }),
      );
    } else if (stage === 1) {
      parts.push(
        tail([[20.6, 24], [25.2, 21], [26.4, 16.6]], 1.1),
        {
          mat: "fur", blend: 2.6,
          prims: [ell(16, 23.4, 5.6, 4.8), ...both(ell(11, 26.8, 2.6, 2.6))],
          paint: [{ mat: "fur", prims: [ell(16, 22, 2.6, 2.8)], level: 4 }],
        },
        { mat: "fur", prims: both(cap(14.2, 24.6, 14.2, 29, 1.7, 1.7)), round: 1.6, line: false },
        {
          mat: "fur", blend: 2,
          prims: [ell(16, 13.6, 6.4, 5.4), ell(16, 17, 3.4, 2.4)],
          paint: [{ mat: "fur", prims: [ell(16, 17.2, 3, 1.9)], level: 4 }],
        },
        { mat: "cover", prims: [path([[11.4, 19.8], [16, 20.8], [20.6, 19.8]], 0.9)] },
      );
      bookEars(7, 10.6, 14.6, 2.8);
      decals.push(
        ...eyes([12, 12], [18, 12], pose, "tall"),
        ...blush([10, 15], [20, 15]),
        stamp(15, 15, ["kk"], { k: "eye:3" }),
        stamp(14, 17, ["k..k", ".tt."], { k: "fur:1", t: "tongue:3" }),
        stamp(15, 20, ["gg"], { g: G }), stamp(16, 27, ["k", "k"], { k: "fur:1" }),
      );
    } else {
      parts.push(
        tail([[21.4, 24.4], [26.2, 20.6], [27.6, 15.6]], 1.3),
        {
          mat: "fur", blend: 2.6,
          prims: [ell(16, 22.6, 6.6, 6), ...both(ell(10.2, 26.6, 3.4, 3))],
          paint: [{ mat: "fur", prims: [ell(16, 21.4, 3, 3.4)], level: 4 }],
        },
        { mat: "fur", prims: both(cap(13.8, 23, 13.8, 29.2, 2, 2)), round: 1.6, line: false },
        {
          mat: "fur", blend: 2,
          prims: [ell(16, 11.4, 6.8, 5.6), ell(16, 15.2, 3.8, 2.8)],
          paint: [{ mat: "fur", prims: [ell(16, 15.6, 3.4, 2.2)], level: 4 }],
        },
        { mat: "cover", prims: [path([[10.6, 18.6], [16, 19.8], [21.4, 18.6]], 1.1)] },
      );
      bookEars(4, 13, 14.4, 3.4);
      decals.push(
        ...eyes([12, 10], [18, 10], pose, "round"),
        stamp(15, 13, ["kk"], { k: "eye:3" }),
        stamp(14, 15, ["k..k", ".tt.", ".tt."], { k: "fur:1", t: "tongue:3" }),
        stamp(15, 18, ["gg", "gg"], { g: G }),
        stamp(15, 3, ["gg"], { g: G }), stamp(16, 26, ["k", "k", "k"], { k: "fur:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 0 ? 8 : 1));
    return { parts, decals };
  },
};

// ── Babelfox: every tail a word it has learned ──

export const babelfox: Species = {
  id: "babelfox",
  name: "Babelfox",
  element: "arcane",
  tier: "rare",
  stages: ["Glyphkit", "Runefox", "Babelfox"],
  palette: { fur: "#b98be8", cream: "#f7e6ff", glyph: "#7ef0ff", sock: "#6b58b0" },
  shiny: { fur: "#f2a65c", cream: "#fff5e6", glyph: "#ff8ad8", sock: "#8a4a3a" },
  lore: "Speaks every language badly and loves them all. Each word you look up lights a glyph on one of its tails.",
  hint: "Knows a word for this in every tongue.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A brush tail: slim root, bushy middle, pointed tip lit by a glyph. */
    const tail = (base: V, mid: V, tip: V, r: number): Part => ({
      mat: "fur", back: true, blend: 1.5,
      prims: [cap(base[0], base[1], mid[0], mid[1], 1.2, r), cap(mid[0], mid[1], tip[0], tip[1], r, 0.7)],
      paint: [{ mat: "glyph", prims: [ell(tip[0] + (mid[0] - tip[0]) * 0.22, tip[1] + (mid[1] - tip[1]) * 0.22, r * 0.95, r * 0.95)], level: 4 }],
    });
    const cream = (prims: Prim[]): Paint => ({ mat: "cream", prims, level: 4 });
    /** Sitting fox: head (cx, hy), body below, legs merged into one mass so
     *  nothing stripes; socks and bib are paints. */
    const fox = (hy: number, hr: number, by: number, br: number, earH: number, legTop: number) => {
      parts.push(
        {
          mat: "fur", blend: 2.2,
          prims: [ell(16, by, br * 0.8, br), ...both(ell(16 - br * 0.66, 29.4 - br * 0.44, br * 0.46, br * 0.44)), ...both(cap(14.3, legTop, 14.3, 29.2, 1.6, 1.6))],
          paint: [cream([ell(16, by - br * 0.34, br * 0.36, br * 0.46)]), { mat: "sock", prims: [rect(0, 27.8, 32, 32)] }],
        },
        {
          mat: "fur",
          prims: both(poly([[16 - hr * 0.92, hy - hr * 0.1], [16 - hr * 0.96, hy - hr * 0.76 - earH], [16 - hr * 0.26, hy - hr * 0.62]], 0.6)),
          paint: [{ mat: "sock", prims: both(ell(16 - hr * 0.95, hy - hr * 0.76 - earH + 1.2, 1.4, 1.9)) }],
        },
        {
          mat: "fur", blend: 1.6,
          prims: [ell(16, hy, hr, hr * 0.76), ...both(ell(16 - hr * 0.8, hy + hr * 0.4, hr * 0.34, hr * 0.24))],
        },
      );
    };
    if (stage === 0) {
      parts.push(tail([19.4, 27.2], [24.8, 25.4], [26.6, 18.4], 2.4));
      fox(19.6, 6.4, 25.8, 3.8, 3.6, 25.4);
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 22, ["kk"], { k: "eye:3" }),
        stamp(15, 15, ["g", "g"], { g: "glyph:4" }),
      );
    } else if (stage === 1) {
      parts.push(
        tail([18.4, 24], [24.8, 18.4], [26.6, 9.8], 2.4),
        tail([19.4, 26.4], [26.2, 25.4], [29.2, 18.4], 2.6),
      );
      fox(14, 6.2, 23.2, 4.8, 4.2, 22.4);
      decals.push(
        ...eyes([12, 12], [18, 12], pose, "tall"),
        ...blush([10, 15], [20, 15]),
        stamp(15, 16, ["kk"], { k: "eye:3" }),
        stamp(15, 9, ["g", "g"], { g: "glyph:4" }),
        stamp(26, 12, ["kk", ".k"], { k: "glyph:1" }), stamp(28, 20, [".k", "kk"], { k: "glyph:1" }),
      );
    } else {
      parts.push(
        tail([13.4, 23], [4.8, 17.6], [4.6, 6.4], 3.4),
        tail([18.6, 22], [25.6, 14.6], [25.2, 3.4], 3.3),
        tail([19.4, 26.4], [26.4, 25.8], [29.8, 17.6], 2.7),
      );
      fox(12, 6.4, 22, 6, 4.6, 20.6);
      decals.push(
        ...eyes([12, 10], [18, 10], pose, "round"),
        stamp(15, 13, ["kk"], { k: "eye:3" }),
        stamp(14, 14, ["k..k", ".kk."], { k: "fur:1" }),
        stamp(15, 7, ["g", "g"], { g: "glyph:4" }),
        stamp(4, 8, ["kk", "k."], { k: "glyph:1" }), stamp(25, 5, ["kk", ".k"], { k: "glyph:1" }),
        stamp(28, 19, [".k", "kk"], { k: "glyph:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(stage === 2 ? 27 : 24, stage === 0 ? 6 : stage === 1 ? 1 : 9));
    return { parts, decals };
  },
};

// ── Sphinx: asks the riddles now ──

export const sphinx: Species = {
  id: "sphinx",
  name: "Sphinx",
  element: "arcane",
  tier: "epic",
  stages: ["Riddlecub", "Sphinxling", "Sphinx"],
  palette: { fur: "#e6b872", gold: "#f3cf5c", lapis: "#4e72dc", wing: "#f5e8cc", gem: "#5ff0c8" },
  shiny: { fur: "#f4efe6", gold: "#f2a3a0", lapis: "#2aa89c", wing: "#bdefe4", gem: "#ff7ad0" },
  lore: "Answers every riddle with a harder one. It only purrs for readers who ace their quizzes.",
  hint: "What walks on a perfect score?",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** The striped nemes headdress: a hood over the brow flaring into two
     *  lappets that fall beside the face. `face` is the face's center y. */
    const nemes = (top: number, w: number, face: number, bottom: number): Part => ({
      mat: "lapis", blend: 1.6,
      prims: [
        poly([[16 - w * 0.62, top], [16 + w * 0.62, top], [16 + w, face], [16 - w, face]], 1),
        ...both(poly([[16 - w - 0.2, face - 1], [16 - w + 3.4, face - 1], [16 - w + 3.2, bottom], [16 - w + 0.6, bottom]], 0.7)),
      ],
      paint: [
        { mat: "gold", prims: [rect(0, top + 2.2, 32, top + 3.4)] },
        { mat: "gold", prims: bands(face + 0.4, bottom - 0.4, 2.6, 1.3) },
        { mat: "gold", prims: both(path([[16 - w * 0.36, top + 0.4], [16 - w * 0.7, face - 0.4]], 0.55)) },
      ],
    });
    const uraeus = (y: number, r: number): Part => ({ mat: "gem", prims: [ell(16, y, r, r * 1.15)], glow: true });
    /** Broad usekh collar across the chest. */
    const collar = (y: number, w: number): Part => ({
      mat: "gold", prims: [ell(16, y, w, 2.2)], cut: [ell(16, y - 2, w - 1.6, 1.8)],
      paint: [{ mat: "lapis", prims: [ell(16, y + 0.4, w, 0.8)] }],
    });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[20, 28.4], [24.4, 27.8], [25.4, 24.2]], 1, 0.9), ell(25.4, 23.2, 1.3)], back: true },
        { mat: "fur", blend: 2, prims: [ell(16, 26.2, 5.6, 3.6), ...both(ell(13, 28.6, 2, 1.3))] },
        nemes(13.2, 7.2, 19.4, 25.6),
        { mat: "fur", prims: [ell(16, 20, 4.8, 4.2)] },
        uraeus(14.6, 1),
      );
      decals.push(
        ...eyes([12, 18], [18, 18], pose, "tall"),
        ...blush([11, 21], [19, 21]),
        stamp(15, 21, ["kk"], { k: "blush:2" }),
        stamp(14, 22, ["k..k", ".kk."], { k: "fur:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: [path([[21, 28.5], [26, 28], [27.2, 23]], 1.1, 1), ell(27, 22, 1.5)], back: true },
        {
          mat: "wing", back: true, prims: both(poly([[12.4, 19], [4.4, 10.4], [3.6, 16.6], [7.4, 21]], 0.8)),
          paint: [{ mat: "gold", prims: both(poly([[12.4, 19], [4.4, 10.4], [6, 10.4], [12.8, 16.6]])) }],
        },
        { mat: "fur", blend: 2, prims: [ell(16, 24.4, 6, 5), ...both(ell(11.8, 27.4, 2.6, 2.4))] },
        { mat: "fur", prims: both(cap(14.2, 24.4, 14.2, 29.2, 1.7, 1.7)), round: 1.6, line: false },
        nemes(8.4, 7.6, 15, 22.6),
        { mat: "fur", prims: [ell(16, 15.6, 5, 4.4)] },
        uraeus(10, 1.1),
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        ...blush([11, 17], [19, 17]),
        stamp(15, 17, ["kk"], { k: "blush:2" }),
        stamp(14, 18, ["k..k", ".kk."], { k: "fur:1" }),
        stamp(16, 29, ["k"], { k: "fur:1" }),
      );
    } else {
      parts.push(
        { mat: "fur", prims: [path([[22, 26.4], [28, 25.6], [29.6, 20]], 1.1, 1), ell(29.4, 19, 1.6)], back: true },
        {
          mat: "wing", back: true,
          prims: both(poly([[12.6, 17], [2.6, 1.8], [0.8, 8], [1.4, 15.4], [5, 20.4], [11, 22]], 0.6)),
          cut: both(ell(1.6, 18.6, 1.4, 2.2)).concat(both(ell(5.6, 22.4, 1.8, 1.6))),
          paint: [
            { mat: "gold", prims: both(poly([[12.6, 17], [2.6, 1.8], [5, 1.8], [13, 13.4]])) },
            { mat: "lapis", prims: both(path([[3.4, 3.6], [8.2, 10], [12.8, 15]], 0.5)) },
          ],
        },
        { mat: "fur", blend: 3, prims: [ell(16, 25.4, 9.4, 3.6), ell(16, 21.4, 6, 5)] },
        { mat: "fur", prims: both(ell(11.2, 28.4, 3.2, 1.8)), round: 4 },
        collar(18.8, 5.8),
        nemes(3.6, 8.4, 11.6, 19),
        { mat: "fur", prims: [ell(16, 12.4, 5.6, 4.6)] },
        uraeus(5.2, 1.3),
      );
      decals.push(
        ...eyes([12, 10], [18, 10], pose, "tall"),
        ...blush([11, 13], [19, 13]),
        stamp(15, 13, ["kk"], { k: "blush:2" }),
        stamp(14, 14, ["k..k", ".kk."], { k: "fur:1" }),
        stamp(9, 29, ["k.k"], { k: "fur:1" }), stamp(20, 29, ["k.k"], { k: "fur:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 0 ? 8 : 1));
    return { parts, decals };
  },
};

// ── Unicorn: the last page of the collection ──

export const unicorn: Species = {
  id: "unicorn",
  name: "Aetherhorn",
  element: "arcane",
  tier: "legendary",
  stages: ["Glimmerfoal", "Starling Unicorn", "Aetherhorn"],
  palette: {
    coat: "#f6f0ff",
    hoof: "#b8a4dc",
    rose: "#ff9ccc",
    lilac: "#b49cff",
    sky: "#8fe2ff",
    horn: "#ffc94a",
  },
  shiny: { coat: "#3e3a6e", hoof: "#1f1c40", rose: "#ffd36e", lilac: "#ff8a6e", sky: "#7affc8", horn: "#bfefff" },
  lore: "Said to appear only when someone finishes a book they'd given up on. Its horn is the last full stop of every story.",
  hint: "Comes at the very end.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "coat", prims: [cap(21, 25, 22, 29.4, 1.1), cap(15.5, 25, 15, 29.4, 1.1)], back: true },
        { mat: "rose", prims: [path([[23, 23], [25.8, 24.5], [26, 27.5]], 1.3, 1)], back: true },
        { mat: "coat", prims: [ell(19, 24.4, 5, 3.6), cap(18.4, 25, 18.6, 29.4, 1.2), cap(23.2, 25, 23.8, 29.4, 1.2)], blend: 1.5, round: 2.4,
          paint: [{ mat: "hoof", prims: [rect(0, 28.6, 32, 31)] }] },
        { mat: "coat", prims: [ell(13.6, 18.6, 6, 5.2), ell(11.4, 22.2, 3.6, 2.8), ...both(poly([[9, 15], [8.6, 11], [11.6, 13.6]], 0.5), 27.2)], blend: 2, round: 2.6,
          paint: [{ mat: "rose", prims: [ell(10.4, 23.4, 2.4, 1.3)], level: 4 }] },
        { mat: "rose", prims: [ell(16.5, 14.4, 2.6, 1.8, 20), ell(19, 17, 1.6, 2)], blend: 2, paint: [{ mat: "lilac", prims: [rect(17.8, 15.6, 32, 32)] }] },
        { mat: "horn", prims: [cap(13.4, 14, 13.2, 11.6, 1.3, 0.8)], glow: true },
      );
      decals.push(
        ...eyes([10, 17], [15, 17], pose, "tall"),
        ...blush([9, 20], [16, 20]),
        stamp(9, 23, ["k"], { k: "rose:1" }),
      );
    } else if (stage === 1) {
      parts.push(
        { mat: "coat", prims: [cap(22, 22, 23, 29.4, 1.2), cap(13.5, 22, 13, 29.4, 1.2)], back: true },
        { mat: "rose", prims: [path([[25, 19], [28, 21], [28.4, 26.5]], 1.8, 1)], back: true, paint: [{ mat: "sky", prims: [rect(0, 23, 32, 32)] }] },
        { mat: "coat", prims: [ell(19, 20.6, 6.4, 4), cap(16, 22, 16.2, 29.4, 1.3), cap(24.6, 22, 25.2, 29.4, 1.3)], blend: 1.5, round: 2.4,
          paint: [{ mat: "hoof", prims: [rect(0, 28.4, 32, 31)] }] },
        { mat: "coat", prims: [ell(11.8, 12.6, 5.6, 5), ell(9.4, 16.2, 3.4, 2.6), cap(13, 15, 16, 19, 3, 3.2),
          ...both(poly([[7.6, 9], [7.2, 4.6], [10.4, 7.4]], 0.5), 24)], blend: 2, round: 2.6,
          paint: [{ mat: "rose", prims: [ell(8.4, 17.4, 2.4, 1.3)], level: 4 }] },
        { mat: "rose", prims: [path([[13, 7.4], [16.5, 9], [18, 13], [17.6, 18]], 2.2, 1.4)], blend: 2,
          paint: [{ mat: "lilac", prims: [rect(0, 11, 32, 15)] }, { mat: "sky", prims: [rect(0, 15, 32, 32)] }] },
        { mat: "horn", prims: [cap(11.2, 8, 10, 3, 1.3, 0.6)], glow: true },
      );
      decals.push(
        ...eyes([8, 11], [13, 11], pose, "tall"),
        ...blush([7, 14], [14, 14]),
        stamp(7, 17, ["k"], { k: "rose:1" }),
      );
    } else {
      const mane = (prims: Prim[], y1: number, y2: number): Part => ({
        mat: "rose", prims, glow: true, blend: 2,
        paint: [{ mat: "lilac", prims: [rect(0, y1, 32, y2)] }, { mat: "sky", prims: [rect(0, y2, 32, 32)] }],
      });
      parts.push(
        { mat: "coat", prims: [cap(13.2, 21, 12.6, 29.4, 1.4), cap(23.4, 21, 24, 29.4, 1.4)], back: true,
          paint: [{ mat: "hoof", prims: [rect(0, 28.2, 32, 32)] }] },
        mane([path([[26.4, 15.5], [29.4, 17.5], [28.8, 22.5], [29.8, 28.6]], 2.6, 1.1), path([[26.4, 16.5], [27.6, 21], [26.8, 26]], 1.6, 0.9)], 19.5, 24),
        { mat: "coat", prims: [ell(19.6, 18.6, 7.6, 4.8), cap(16.2, 20.5, 16, 29.4, 1.6), cap(25.2, 20.5, 25.8, 29.4, 1.6)], blend: 1.5, round: 2.6,
          paint: [{ mat: "hoof", prims: [rect(0, 28.2, 32, 32)] }] },
        { mat: "coat", prims: [ell(10.2, 10.2, 4.8, 4.3), ell(7.6, 13.4, 3.1, 2.4), cap(12, 12.5, 15.6, 17, 2.8, 3.8),
          ...both(poly([[6.8, 7], [6.4, 3.2], [9.2, 5.4]], 0.5), 20.4)], blend: 2, round: 2.6,
          paint: [{ mat: "rose", prims: [ell(6.8, 14.6, 2.3, 1.2)], level: 4 }] },
        mane([path([[11.2, 5.4], [15.2, 6.4], [17.4, 9.8], [18.2, 14], [21, 16.6]], 2.6, 1.6), path([[14, 8], [15.4, 12], [14.8, 15.6]], 1.6, 1)], 8.6, 12),
        { mat: "horn", prims: [cap(9.8, 6.4, 5.4, 0.6, 1.6, 0.5)], glow: true },
      );
      decals.push(
        ...eyes([7, 9], [12, 9], pose, "round"),
        stamp(5, 14, ["k"], { k: "rose:1" }),
        stamp(6, 2, ["h"], { h: "horn:2" }),
        stamp(7, 4, ["h"], { h: "horn:2" }),
        stamp(8, 5, ["h"], { h: "horn:2" }),
        ...blush([6, 12], [12, 12], 1),
        sparkle(1, 17), sparkle(25, 3), sparkle(19, 25, "#bff4ff"),
        stamp(3, 3, ["s"], { s: "#fff4c2" }, true), stamp(30, 11, ["s"], { s: "#bff4ff" }, true),
      );
    }
    if (pose === "sleep") decals.push(zzz(25, 2));
    return { parts, decals };
  },
};

// ── Bookworm: a caterpillar that reads its way out ──

export const bookworm: Species = {
  id: "bookworm",
  name: "Scholarpillar",
  element: "arcane",
  tier: "common",
  stages: ["Bookmite", "Pagecrawler", "Scholarpillar"],
  palette: { worm: "#86c95a", belly: "#d8eb8a", cover: "#6c5bc4", page: "#f3ead2", rim: "#ffd35a", ribbon: "#e8506a" },
  shiny: { worm: "#e98ac0", belly: "#ffd0e4", cover: "#2f8f7a", page: "#fff4e0", rim: "#eef4ff", ribbon: "#5fb8ff" },
  lore: "Eats only the footnotes, which is why it knows everything. Its glasses are purely for show.",
  hint: "Reads from the inside out.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Round spectacles framing a pair of `round` eyes at (x+1, y+1). */
    const glasses = (x: number, y: number) =>
      stamp(x, y, [".gg....gg.", "g..gggg..g", "g..g..g..g", ".gg....gg."], { g: "rim:5" });
    const seg = (x: number, y: number, r: number): Part => ({ mat: "worm", prims: [ell(x, y, r, r * 0.9)] });
    /** Thin feelers with round belly-colored tips, splayed wide so they
     *  never read as ears. */
    const antennae = (cx: number, y: number, s: number): Part[] => [
      { mat: "worm", line: false, prims: both(path([[cx - 1.6, y + 5 * s], [cx - 2.6 * s, y + 2.4 * s], [cx - 4.4 * s, y + 0.6]], 0.6), cx * 2) },
      { mat: "belly", line: false, prims: both(ell(cx - 4.9 * s, y, 1.1, 1.1), cx * 2) },
    ];
    /** An open book lying flat: cover slab with two page fans. */
    const openBook = (x0: number, x1: number, y: number) => {
      parts.push({ mat: "cover", prims: [poly([[x0 - 0.4, y + 0.6], [16, y + 2], [32 - x0 + 0.4, y + 0.6], [32 - x0 + 0.8, 29.6], [x0 - 0.8, 29.6]], 0.6)] });
      void x1;
    };
    const pages = (x0: number, y: number) => {
      parts.push(
        { mat: "page", prims: [poly([[x0, y], [x0 + 5.4, y - 1.6], [15.6, y + 1], [15.6, y + 3.8], [x0, y + 3.4]], 0.4)] },
        { mat: "page", prims: [poly([[32 - x0, y], [26.6 - x0, y - 1.6], [16.4, y + 1], [16.4, y + 3.8], [32 - x0, y + 3.4]], 0.4)] },
      );
    };
    if (stage === 0) {
      parts.push(
        { mat: "cover", prims: [poly([[8.4, 22.6], [23.6, 20.6], [24, 22.6], [8.8, 24.4]], 0.6)], back: true },
        { mat: "worm", prims: [cap(19.6, 25, 21.6, 22.4, 2.2, 1.8)], back: true },
        ...antennae(16, 10.2, 0.9),
        { mat: "worm", prims: [ell(16, 18.6, 6, 5.4), cap(16, 22, 16, 25, 3.6)], blend: 2 },
        { mat: "page", prims: [rect(8.2, 23.8, 23.8, 27.2, 0.3)] },
        { mat: "cover", prims: [rect(7.4, 26.6, 24.6, 29.4, 0.6)] },
      );
      decals.push(
        glasses(11, 16),
        ...eyes([12, 17], [18, 17], pose, "round"),
        ...blush([10, 21], [20, 21]),
        stamp(15, 21, ["kk"], { k: "worm:1" }),
        stamp(9, 25, ["pppppp.pppppp"], { p: "page:2" }),
      );
    } else if (stage === 1) {
      openBook(4.6, 27.4, 24.6);
      parts.push(
        seg(17.8, 23.4, 3.2),
        seg(20.8, 19.6, 3.4),
        seg(19.4, 15.6, 3.4),
        ...antennae(14.4, 4.2, 1),
        { mat: "worm", prims: [ell(14.4, 12.6, 6.2, 5.6)] },
      );
      pages(4.6, 24.8);
      decals.push(
        glasses(9, 11),
        ...eyes([10, 12], [16, 12], pose, "round"),
        ...blush([8, 15], [18, 15]),
        stamp(13, 16, ["kk"], { k: "worm:1" }),
        stamp(18, 21, ["k"], { k: "worm:1" }), stamp(16, 18, ["k"], { k: "worm:1" }),
      );
    } else {
      openBook(2.4, 29.6, 24);
      parts.push(
        seg(19.4, 23, 3.4),
        seg(23.2, 20, 3.6),
        seg(23.6, 15.6, 3.8),
        seg(20.8, 11.8, 3.8),
        ...antennae(13.4, 3.4, 1),
        { mat: "worm", prims: [ell(13.4, 11.4, 6.6, 6)] },
        { mat: "cover", prims: [poly([[6.2, 5.4], [13.4, 2.2], [20.8, 5.4], [13.4, 8.4]], 0.3)] },
        { mat: "cover", prims: [ell(13.4, 7.6, 4.4, 1.4)], line: false },
      );
      pages(2.4, 24.2);
      parts.push({ mat: "ribbon", prims: [poly([[9.2, 25], [11.8, 25], [11.8, 31], [10.5, 29.8], [9.2, 31]], 0)] });
      decals.push(
        glasses(8, 10),
        ...eyes([9, 11], [15, 11], pose, "round"),
        ...blush([7, 14], [17, 14]),
        stamp(11, 14, ["k..k", ".kk."], { k: "worm:1" }),
        stamp(6, 5, ["r", "r", "r", "r"], { r: "rim:4" }),
        stamp(17, 20, ["k"], { k: "worm:1" }), stamp(20, 23, ["k"], { k: "worm:1" }), stamp(19, 16, ["k"], { k: "worm:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 0 ? 8 : 1));
    return { parts, decals };
  },
};

// ── Paperbird: an origami crane that unfolded itself ──

/** A flat-shaded facet: origami planes are lit per face, not domed. */
const facet = (mat: string, pts: V[], level: number): Paint => ({ mat, prims: [poly(pts)], level });

export const paperbird: Species = {
  id: "paperbird",
  name: "Origaminx",
  element: "arcane",
  tier: "common",
  stages: ["Foldling", "Creasewing", "Origaminx"],
  palette: { paper: "#eceef6", ink: "#4a58b0", crest: "#ff6b6b" },
  shiny: { paper: "#f2cc66", ink: "#9a3a4a", crest: "#5fe0d0" },
  lore: "Folded from a page someone loved too much to throw away. You can still read a sentence on its wing, if it holds still.",
  hint: "Once flat, now it flies.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A flat folded plane a-b-c, creased from `a` to the middle of b-c:
     *  the two halves take levels la / lb, so it reads as folded paper. */
    const plane = (a: V, b: V, c: V, la: number, lb: number, extra: Partial<Part> = {}): Part => {
      const m: V = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      return {
        mat: "paper", round: 40, prims: [poly([a, b, c], 0.4)],
        paint: [facet("paper", [a, b, m], la), facet("paper", [a, m, c], lb)],
        ...extra,
      };
    };
    /** Body: a kite folded down its middle (left lit, right shaded). */
    const body = (cx: number, top: number, mid: number, bot: number, hw: number): Part => ({
      mat: "paper", round: 40, line: false, prims: [poly([[cx, top], [cx + hw, mid], [cx, bot], [cx - hw, mid]], 0.5)],
      paint: [
        facet("paper", [[0, 0], [cx, 0], [cx, mid], [0, mid]], 4),
        facet("paper", [[cx, 0], [32, 0], [32, mid], [cx, mid]], 3),
        facet("paper", [[0, mid], [cx, mid], [cx, 32], [0, 32]], 3),
        facet("paper", [[cx, mid], [32, mid], [32, 32], [cx, 32]], 2),
      ],
    });
    /** Head: a rounded folded diamond turned to the viewer. */
    const head = (cx: number, cy: number, hw: number, hh: number): Part => ({
      mat: "paper", round: 40, prims: [poly([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], 1.2)],
      paint: [facet("paper", [[0, 0], [32, 0], [32, cy], [0, cy]], 4), facet("paper", [[0, cy], [32, cy], [32, 32], [0, 32]], 3)],
    });
    const crest = (x: number, y: number, r: number): Part => ({ mat: "crest", prims: [ell(x, y, r, r * 0.8)], line: false });
    if (stage === 0) {
      parts.push(
        plane([18, 20], [26.6, 15.4], [22.6, 23.6], 3, 2),
        body(17, 16.4, 22.6, 28.4, 6.8),
        plane([17.4, 19.6], [20.6, 11.8], [22.4, 18.4], 5, 3),
        head(11.4, 15.8, 5.6, 5.4),
        { mat: "paper", prims: [poly([[6.4, 17.2], [4.4, 20.4], [8.2, 18.6]], 0.3)], round: 40, line: false, paint: [facet("paper", [[0, 0], [32, 0], [32, 32], [0, 32]], 2)] },
        crest(11.4, 10.8, 1.3),
      );
      decals.push(...eyes([8, 14], [12, 14], pose, "tall"), ...blush([7, 17], [14, 17], 1));
    } else if (stage === 1) {
      parts.push(
        plane([15.4, 18.6], [12.4, 6.4], [18.4, 16.6], 3, 2, { back: true }),
        plane([19.4, 20.4], [28.6, 11.4], [21.8, 23.4], 4, 2),
        body(17, 16.4, 21.8, 27.6, 6),
        plane([13.6, 20.8], [8.4, 14.6], [15.4, 19.2], 3, 3, { line: false }),
        plane([17.4, 19.4], [23.2, 4.6], [25, 13.8], 5, 3),
        head(9.4, 12, 5.2, 4.8),
        { mat: "paper", prims: [poly([[4.8, 13.2], [2.6, 16.6], [6.6, 14.8]], 0.3)], round: 40, line: false, paint: [facet("paper", [[0, 0], [32, 0], [32, 32], [0, 32]], 2)] },
        crest(9.4, 7.4, 1.3),
      );
      decals.push(
        ...eyes([6, 10], [10, 10], pose, "tall"), ...blush([5, 13], [12, 13], 1),
        stamp(20, 11, ["kk.k"], { k: "ink:3" }), stamp(20, 13, ["k.kk"], { k: "ink:3" }),
      );
    } else {
      parts.push(
        plane([15, 17.4], [10.6, 2.6], [18.4, 14.6], 3, 2, { back: true }),
        plane([20, 20.4], [31, 7.6], [22.6, 23.6], 4, 2),
        body(17, 15.4, 21.2, 28, 6.4),
        plane([13.6, 20.6], [7, 11.6], [15.6, 18.6], 3, 3, { line: false }),
        plane([17.4, 18.6], [23.4, 1.2], [27.6, 11.2], 5, 3),
        head(8.2, 9.4, 5, 4.4),
        { mat: "paper", prims: [poly([[3.8, 10.8], [1, 15.4], [5.6, 12.4]], 0.3)], round: 40, line: false, paint: [facet("paper", [[0, 0], [32, 0], [32, 32], [0, 32]], 2)] },
        crest(8.2, 5.2, 1.4),
      );
      decals.push(
        ...eyes([5, 8], [9, 8], pose, "round"),
        stamp(20, 8, ["kk.k"], { k: "ink:3" }), stamp(20, 10, ["k.kk"], { k: "ink:3" }),
        stamp(21, 12, ["kk.k"], { k: "ink:3" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 0 ? 6 : 18));
    return { parts, decals };
  },
};

// ── Mimic: a grimoire with a grin ──

export const mimic: Species = {
  id: "mimic",
  name: "Grinmoire",
  element: "arcane",
  tier: "rare",
  stages: ["Snapbook", "Chomptome", "Grinmoire"],
  palette: { cover: "#8f62c9", gold: "#f0c050", page: "#e8d6ae", tongue: "#ff6f8e", maw: "#4a2a5e" },
  shiny: { cover: "#3fae8e", gold: "#e3eaf6", page: "#f0e0c0", tongue: "#ffae40", maw: "#1f4a4a" },
  lore: "Pretends to be a dusty old textbook until you open it, then licks your face. The tongue doubles as a bookmark.",
  hint: "Don't judge it by its cover. It will judge you back.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A book opened like a jaw. Lower block x0..x1 from `jaw` to `bottom`;
     *  the lid tilts up to the right (top-left y tl, top-right y tr, its
     *  lower edge at bl → br). Page edges face the viewer as cream bands;
     *  teeth hang off them into a dark maw. */
    const book = (x0: number, x1: number, tl: number, tr: number, bl: number, br: number, jaw: number, bottom: number,
      teeth: number[], tongue: V[], tw: number) => {
      const lidAt = (x: number) => bl + ((br - bl) * (x - x0)) / (x1 - x0);
      const tip = tongue[tongue.length - 1];
      const fork = ell(tip[0], tip[1] + tw * 0.7, tw * 0.45, tw * 0.9);
      const spine = x0 + 2.2;
      parts.push(
        { mat: "maw", prims: [poly([[x0 + 0.6, bl - 1], [x1 - 0.6, br - 1], [x1 - 0.6, jaw + 1], [x0 + 0.6, jaw + 1]], 0.2)] },
        {
          mat: "cover", prims: [rect(x0, jaw, x1, bottom, 1)],
          paint: [
            { mat: "page", prims: [rect(spine + 0.6, jaw - 1, x1 - 0.9, bottom - 2.2)] },
            { mat: "page", prims: bands(jaw + 1.6, bottom - 2.4, 2, 1, spine + 0.6, x1 - 0.9), level: 2 },
          ],
        },
        {
          mat: "cover", prims: [poly([[x0 + 0.3, tl], [x1 - 0.3, tr], [x1, br], [x0, bl]], 1)],
          paint: [{ mat: "page", prims: [poly([[spine + 0.6, lidAt(spine) - 1.8], [x1 - 0.9, br - 1.8], [x1 - 0.9, br + 1], [spine + 0.6, lidAt(spine) + 1]])] }],
        },
        { mat: "tongue", prims: [path(tongue, tw, tw * 0.9)], cut: [fork] },
      );
      decals.push(stamp(Math.round(tongue[1][0]), Math.round(tongue[1][1]), ["t", "t"], { t: "tongue:2" }));
      for (const x of teeth) {
        decals.push(stamp(Math.round(x) - 1, Math.round(lidAt(x) + 0.6), ["ww", "w."], { w: "white:4" }));
        decals.push(stamp(Math.round(x) + 1, Math.round(jaw) - 2, [".w", "ww"], { w: "white:4" }));
      }
      // Spine ribs on the left edge.
      decals.push(stamp(Math.round(x0) + 1, Math.round(jaw) + 2, ["g", ".", "g"], { g: "gold:4" }));
    };
    if (stage === 0) {
      book(8.6, 23.4, 15.2, 13.8, 20.2, 19, 23.6, 29.4, [11.4, 19.6], [[16.6, 22], [17.6, 25], [17.6, 27.6]], 1.3);
      decals.push(...eyes([12, 15], [18, 14], pose, "tall"));
    } else if (stage === 1) {
      parts.push({ mat: "cover", prims: both(ell(10, 29, 2, 1.3)), back: true });
      book(6.4, 25.6, 9.6, 7.4, 16.4, 14.6, 21, 28.4, [9.2, 14, 22.8], [[17, 19.6], [19.6, 23.4], [20, 27.6]], 1.6);
      decals.push(
        ...eyes([10, 9], [18, 8], pose, "tall"),
        stamp(7, 9, ["gg", "g."], { g: "gold:4" }), stamp(24, 7, ["gg", ".g"], { g: "gold:4" }),
      );
    } else {
      parts.push({ mat: "cover", prims: both(ell(8.4, 29.2, 2.4, 1.5)), back: true });
      book(3.4, 28.6, 4.2, 1.4, 13.4, 10.8, 19.6, 28.6, [6.4, 11.2, 20.8, 25.6], [[17, 18.6], [21, 22.4], [22.6, 27], [22, 30.4]], 1.9);
      parts.push({ mat: "gold", prims: [rect(8.6, 22.6, 11.6, 27, 0.6)], paint: [{ mat: "gold", prims: [ell(10.1, 24.6, 0.6, 0.9)], level: 1 }] });
      decals.push(
        ...eyes([9, 5], [18, 4], pose, "tall"),
        stamp(8, 3, ["kk.", "..k"], { k: "cover:1" }), stamp(18, 2, [".kk", "k.."], { k: "cover:1" }),
        stamp(4, 4, ["gg", "g."], { g: "gold:4" }), stamp(26, 2, ["gg", ".g"], { g: "gold:4" }),
        stamp(3, 26, ["g.", "gg"], { g: "gold:4" }), stamp(27, 26, [".g", "gg"], { g: "gold:4" }),
      );
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 0 ? 8 : 1));
    return { parts, decals };
  },
};

// ── Rune golem: stones that remember a spell ──

export const runegolem: Species = {
  id: "runegolem",
  name: "Runewarden",
  element: "arcane",
  tier: "rare",
  stages: ["Runepebble", "Runeblock", "Runewarden"],
  palette: { stone: "#d6b588", rune: "#48f0e4", moss: "#6cbc4e" },
  shiny: { stone: "#8a9bcc", rune: "#ffb238", moss: "#e4d468" },
  lore: "Carved from a library's cornerstone, it still guards the quiet. Its runes glow brighter the longer you study.",
  hint: "Heavy with words no one says aloud.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const R = (x: number, y: number, rows: string[]) => stamp(x, y, rows, { r: "rune:4" });
    /** A carved block: flat face, bevelled edges. */
    const blk = (prims: Prim[], extra: Partial<Part> = {}): Part => ({ mat: "stone", prims, round: 2.2, ...extra });
    /** A hewn stone: a box with uneven chamfers, so it reads carved, not machined. */
    const hewn = (x0: number, y0: number, x1: number, y1: number, r: number): Prim => {
      const w = x1 - x0;
      const h = y1 - y0;
      const c = Math.min(w, h);
      return poly([
        [x0 + c * 0.15, y0], [x1 - c * 0.3, y0], [x1, y0 + c * 0.25], [x1, y1 - c * 0.1],
        [x1 - c * 0.2, y1], [x0 + c * 0.25, y1], [x0, y1 - c * 0.25], [x0, y0 + h * 0.2],
      ], r);
    };
    const crack = (x: number, y: number, rows: string[]) => stamp(x, y, rows, { k: "stone:1" });
    /** Magic holding the floating pieces together. */
    const joint = (x: number, y: number, r = 1): Part => ({ mat: "rune", prims: [ell(x, y, r, r)], glow: true, line: false });
    const moss = (x: number, y: number, rx: number) => ({ mat: "moss", prims: [ell(x, y, rx, 1.5)] });
    const core = (cx: number, cy: number, s: number): Part => ({
      mat: "rune", prims: [poly([[cx, cy - 2 * s], [cx + 1.6 * s, cy], [cx, cy + 2 * s], [cx - 1.6 * s, cy]], 0.2)], glow: true,
    });
    // Rounded blocks inflate by their `round`; coordinates below are the
    // inner boxes, sized so every floating piece keeps a 1px air gap.
    /** A two-leaf moss sprout growing from the top of a block. */
    const sprout = (x: number, y: number, s: number): Part => ({
      mat: "moss", line: false,
      prims: [cap(x, y + 1.6 * s, x, y, 0.6), ell(x - 1.5 * s, y - 0.4 * s, 1.5 * s, 0.9 * s, -25), ell(x + 1.5 * s, y - 0.6 * s, 1.5 * s, 0.9 * s, 25)],
    });
    const mouth = (x: number, y: number) => stamp(x, y, ["k.k", ".k."], { k: "stone:1" });
    if (stage === 0) {
      parts.push(
        blk(both(hewn(12, 27, 13.4, 28.6, 1)), { back: true }),
        blk(both(ell(5, 23.6, 1.2, 1.5))),
        blk([hewn(12, 19, 20, 25, 2.6)], { paint: [moss(14, 16.8, 4.2), moss(20.6, 18.4, 1.6)] }),
        sprout(15, 14.4, 0.9),
        joint(7.5, 23.6, 0.7), joint(24.5, 23.6, 0.7),
      );
      decals.push(...eyes([12, 19], [18, 19], pose, "tall"), ...blush([10, 22], [20, 22]), mouth(15, 22));
    } else if (stage === 1) {
      parts.push(
        blk(both(hewn(11.8, 25.2, 13.8, 28.4, 1.2)), { back: true }),
        blk([poly([[11.2, 17], [20.8, 17], [19, 24], [13, 24]], 1.4)], { paint: [moss(10.4, 16, 2.4)] }),
        blk([hewn(12, 7.6, 20, 12.4, 2)], { paint: [moss(14, 5.8, 4.4), moss(21, 7.4, 1.4)] }),
        blk(both(hewn(4.4, 16.4, 6, 22.2, 1.4)), { paint: [moss(5.2, 15, 2.2)] }),
        sprout(14.2, 3.4, 1),
        joint(8.5, 17, 0.8), joint(23.5, 17, 0.8),
        core(16, 20.4, 1),
      );
      decals.push(...eyes([12, 9], [18, 9], pose, "tall"), ...blush([10, 12], [20, 12]), mouth(15, 12),
        R(4, 18, ["r.", ".r", "r."]), R(26, 18, [".r", "r.", ".r"]));
    } else {
      parts.push(
        blk(both(hewn(11.6, 24.2, 13.8, 28.6, 1.2)), { back: true }),
        blk([poly([[11.2, 12], [20.8, 12], [18.6, 21.2], [13.4, 21.2]], 1.4)], { paint: [moss(10.2, 11, 2.6), moss(21.6, 11, 1.8)] }),
        blk([hewn(13.6, 3.8, 18.4, 7.8, 1.6)], { paint: [moss(15, 2.2, 3.6)] }),
        blk(both(hewn(3.4, 11, 5.6, 13.6, 1.4)), { paint: [moss(4.4, 9.4, 2.8)] }),
        blk(both(hewn(2.8, 19, 6.6, 24, 1.6))),
        sprout(14, 0.9, 0.85),
        joint(8.5, 12.5, 0.8), joint(23.5, 12.5, 0.8),
        joint(4.5, 16.5, 0.8), joint(27.5, 16.5, 0.8),
        joint(16, 9.9, 0.8),
        core(16, 15.4, 1.3),
      );
      decals.push(...eyes([13, 5], [17, 5], pose, "round"), mouth(15, 7),
        R(3, 20, ["rr.", "..r", "rr."]), R(26, 20, [".rr", "r..", ".rr"]),
        R(14, 19, ["r..r", ".rr."]),
        crack(19, 13, ["k", "k"]), crack(22, 26, ["k", "k"]));
    }
    if (pose === "sleep") decals.push(zzz(25, stage === 0 ? 8 : 1));
    return { parts, decals };
  },
};

// ── Djinn: a wish curled up in a lamp ──

export const djinn: Species = {
  id: "djinn",
  name: "Djinnamon",
  element: "arcane",
  tier: "epic",
  stages: ["Lampwisp", "Smokeling", "Djinnamon"],
  palette: { smoke: "#7ea8ff", brass: "#e3a940", cloth: "#b36ae0", gem: "#ff5fa8" },
  shiny: { smoke: "#72e0b0", brass: "#cfd8ea", cloth: "#ff7ab0", gem: "#ffd65a" },
  lore: "Grants three wishes, but only for more time to read. Rub the lamp gently; it's usually napping in chapter twelve.",
  hint: "Rub gently. It's reading.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** An oil lamp: body centered (cx, cy), spout rising to the right (its
     *  tip returned), handle loop on the left, domed lid, foot. */
    const lamp = (cx: number, cy: number, s: number): V => {
      const tip: V = [cx + 7.6 * s, cy - 3.2 * s];
      parts.push(
        {
          mat: "brass", back: true,
          prims: [path([[cx - 4.6 * s, cy - 1 * s], [cx - 7.2 * s, cy - 1.8 * s], [cx - 7.6 * s, cy + 0.4 * s], [cx - 4.6 * s, cy + 1.2 * s]], 0.8, 0.8)],
        },
        {
          mat: "brass", blend: 1.2,
          prims: [
            ell(cx, cy, 5 * s, 2.4 * s),
            path([[cx + 3.4 * s, cy + 0.4 * s], [cx + 6 * s, cy - 1 * s], tip], 1.5 * s, 0.8),
            ell(cx, cy - 2.2 * s, 2.2 * s, 1.1 * s),
            rect(cx - 2.4 * s, cy + 1.6 * s, cx + 2.4 * s, cy + 3.2 * s, 0.4),
          ],
          paint: [{ mat: "brass", prims: [rect(0, cy + 2.2 * s, 32, cy + 2.2 * s + 0.9)], level: 2 }],
        },
      );
      return tip;
    };
    if (stage === 0) {
      const tip = lamp(12.4, 26, 0.9);
      parts.splice(0, 0, { mat: "smoke", prims: [path([tip, [tip[0] + 1.6, tip[1] - 2.4], [18.6, 19.4]], 0.9, 2.4), ell(18, 16.8, 5.2, 4.4)], blend: 2.6 });
      parts.push({ mat: "gem", prims: [ell(12.4, 23.8, 0.9, 0.9)], glow: true });
      decals.push(...eyes([15, 15], [20, 15], pose, "tall"), ...blush([13, 18], [22, 18], 1), stamp(17, 18, ["k.k", ".k."], { k: "smoke:1" }));
    } else if (stage === 1) {
      const tip = lamp(10.6, 26.4, 1);
      parts.splice(0, 0,
        { mat: "smoke", prims: [path([tip, [20.6, 20.8], [18.4, 18.6]], 0.9, 2.8), ell(17, 16.4, 4.6, 3.4)], blend: 3 },
        { mat: "smoke", prims: [ell(17, 9.6, 5.4, 4.8)] },
      );
      parts.push(
        { mat: "smoke", prims: both(path([[12.8, 14.8], [10.2, 13], [10.4, 10.6]], 1.2, 1.1), 34) },
        { mat: "cloth", prims: [ell(17, 5.6, 5, 2.2), ell(17, 3.4, 1.3, 1.3)], blend: 1.5 },
        { mat: "gem", prims: [ell(17, 6, 1, 1.1)], glow: true },
        { mat: "gem", prims: [ell(10.6, 24.2, 0.9, 0.9)], glow: true },
      );
      decals.push(...eyes([14, 9], [19, 9], pose, "tall"), ...blush([12, 12], [21, 12], 1), stamp(16, 12, ["k.k", ".k."], { k: "smoke:1" }),
        stamp(11, 10, ["g"], { g: "brass:4" }), stamp(22, 10, ["g"], { g: "brass:4" }));
    } else {
      const tip = lamp(9.6, 26.6, 1.1);
      parts.splice(0, 0,
        { mat: "smoke", prims: [path([tip, [23.8, 21.8], [22, 19.6], [17.4, 18.6]], 0.9, 3)], blend: 3 },
        {
          mat: "smoke", blend: 2,
          prims: [poly([[11, 12.6], [21, 12.6], [18.6, 19], [13.4, 19]], 1.4), ...both(ell(9.8, 13.2, 2.6, 2.2))],
          paint: [{ mat: "cloth", prims: [rect(0, 18.2, 32, 20.6)] }],
        },
        { mat: "smoke", prims: both(path([[8.6, 13.6], [5.2, 16.4], [9.6, 18.8], [12.4, 18.8]], 1.6, 1.3)) },
      );
      parts.push(
        { mat: "smoke", prims: [ell(16, 8, 5.2, 4.5)] },
        { mat: "smoke", prims: both(poly([[11.4, 7.8], [8.6, 6], [11.2, 9.8]], 0.4)), line: false },
        { mat: "cloth", prims: [ell(16, 3.8, 5.6, 2.4), ell(16, 1.4, 1.3, 1.1)], blend: 1.4 },
        { mat: "brass", prims: both(ell(6.2, 16.4, 1.1, 1.3)) },
        { mat: "gem", prims: [ell(16, 4.2, 1.1, 1.2)], glow: true },
        { mat: "gem", prims: [ell(9.6, 23.4, 1, 1)], glow: true },
      );
      decals.push(...eyes([13, 7], [18, 7], pose, "round"), stamp(15, 10, ["k..k", ".kk."], { k: "smoke:1" }),
        stamp(10, 10, ["g", "g"], { g: "brass:4" }), stamp(21, 10, ["g", "g"], { g: "brass:4" }),
        stamp(14, 13, ["g..g", ".gg."], { g: "brass:4" }), stamp(15, 15, ["c"], { c: "gem:3" }),
        sparkle(26, 4, "#ffe7a0"), sparkle(2, 13, "#ffe7a0"));
    }
    if (pose === "sleep") decals.push(zzz(25, 1));
    return { parts, decals };
  },
};

export const ARCANE: Species[] = [inkling, tomepup, bookworm, paperbird, babelfox, mimic, runegolem, sphinx, djinn, unicorn];
