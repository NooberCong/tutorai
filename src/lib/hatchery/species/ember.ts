import type { Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, path, poly } from "../pixel.ts";

// ── flame helpers ──
// Fire reads as fire when it is tapered tongues with a hot core, never blobs:
// every flame is a rounded base narrowing through a slight S-bend to a
// one-pixel tip, and flame parts use a low blend so neighbouring tongues stay
// separate. Parts are `glow: true` with a small `round`, so the core lights up
// to the ramp's shine (yellow-white) while the edges stay orange.

/** One flame tongue from base (x, y) rising `h` px, its tip leaning `lean` px. */
const tongue = (x: number, y: number, h: number, w: number, lean = 0): Prim =>
  path([[x, y], [x - lean * 0.12, y - h * 0.4], [x + lean * 0.45, y - h * 0.72], [x + lean, y - h]], w, 0.45);

/** A small fire: a rounded base, a tall central tongue and two side licks. */
const fire = (x: number, y: number, h: number, w: number, lean = 0): Prim[] => [
  ell(x, y - w * 0.25, w * 1.05, w * 0.85),
  tongue(x, y - w * 0.3, h - w * 0.3, w * 0.8, lean),
  tongue(x - w * 0.62, y - w * 0.5, h * 0.55, w * 0.5, lean - h * 0.2),
  tongue(x + w * 0.62, y - w * 0.5, h * 0.68, w * 0.5, lean + h * 0.2),
];

/** A tongue shooting from (cx, cy) outward at `deg` (0 = right, -90 = up),
 *  starting `r0` px out and `len` px long, its tip curling up by `curl`. */
const ray = (cx: number, cy: number, deg: number, r0: number, len: number, w: number, curl = 1.5): Prim => {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const at = (t: number, lift: number): V => [cx + dx * (r0 + len * t), cy + dy * (r0 + len * t) - lift];
  return path([at(0, 0), at(0.5, curl * 0.3), at(1, curl)], w, 0.45);
};

const flame = (prims: Prim[], extra: Partial<Part> = {}): Part => ({
  mat: "flame", prims, glow: true, round: 1.5, blend: 0.4, ...extra,
});

/** A glowing one-pixel spot (ember freckles, scale glints). */
const glint = (x: number, y: number, ink = "flame:5"): Decal => stamp(x, y, ["g"], { g: ink });

// ── Kindlemouse ──

export const kindlemouse: Species = {
  id: "kindlemouse",
  name: "Kindlemouse",
  element: "ember",
  tier: "common",
  stages: ["Kindlemouse", "Kindlepip", "Kindlemouse"],
  palette: { fur: "#d2bfb4", cream: "#fbeee0", ear: "#ffabb2", flame: "#ff9838" },
  shiny: { fur: "#eceff8", cream: "#ffffff", ear: "#b9d4ff", flame: "#5fc4ff" },
  lore: "Curls up in lamp-lit libraries and lends its tail as a reading light. Has never once singed a page, and is very proud of that.",
  hint: "A candle that squeaks.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Head + pear body + feet as one mass (no leg stripes), cream tummy. */
    const body = (hy: number, hr: V, by: number, br: V, feet: number, tum: V): Part => ({
      mat: "fur", prims: [ell(16, hy, hr[0], hr[1]), ell(16, by, br[0], br[1]), ...both(ell(16 - feet, 29.4, 1.9, 1.1))], blend: 2,
      paint: [{ mat: "cream", prims: [ell(16, by + 0.6, tum[0], tum[1])], level: 4 }],
    });
    const ears = (x: number, y: number, r: number): Part => ({
      mat: "fur", prims: both(ell(x, y, r)), paint: [{ mat: "ear", prims: both(ell(x + 0.2, y + 0.3, r * 0.6)) }],
    });
    const nose = (y: number) => stamp(15, y, ["nn"], { n: "ear:2" });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[20, 28.5], [24.5, 28.8], [26.5, 26.5], [26.5, 24]], 1, 0.8)], back: true },
        flame(fire(26.5, 24, 5, 1.4, 0.4)),
        ears(10.8, 18.6, 2.6),
        { mat: "fur", prims: [ell(16, 24.2, 6.6, 5.9)], paint: [{ mat: "cream", prims: [ell(16, 29, 3.4, 1.8)], level: 4 }] },
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), nose(25));
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: [path([[21, 28.5], [25.5, 28.8], [27.8, 25.5], [27.3, 22]], 1.1, 0.8)], back: true },
        flame(fire(27.3, 22, 7.5, 1.8, 0.2)),
        ears(9.6, 13.6, 3.7),
        body(19, [7, 6], 25.4, [6.2, 4.2], 3.2, [3, 2.8]),
      );
      decals.push(...eyes([12, 18], [18, 18], pose, "tall"), ...blush([10, 21], [20, 21]), nose(21));
    } else {
      parts.push(
        { mat: "fur", prims: [path([[21.5, 29], [26.5, 28.8], [28.8, 25.5], [28.2, 22.5]], 1.4, 0.9)], back: true },
        flame([
          ell(28, 21.6, 2.6, 2.3),
          path([[28, 22], [28.4, 18], [27.2, 14], [27.6, 10.5], [29, 8]], 2.5, 0.45),
          tongue(26, 21, 6.5, 1.1, -2.2), tongue(30, 21, 7.5, 1, 1),
        ]),
        ears(9.2, 9.8, 4.4),
        body(15.4, [7.8, 6.4], 25, [7, 4.8], 3.8, [3.8, 3.2]),
      );
      decals.push(
        ...eyes([12, 14], [18, 14], pose, "tall"),
        stamp(9, 18, ["fg"], { f: "flame:4", g: "flame:5" }),
        stamp(21, 18, ["gf"], { f: "flame:4", g: "flame:5" }),
        nose(17),
        stamp(14, 18, ["k..k", ".kk."], { k: "fur:1" }),
      );
    }
    if (pose === "sleep") decals.push(zzz([21, 23, 14][stage], [11, 5, 0][stage]));
    return { parts, decals };
  },
};

// ── Cinderling ──

export const cinderling: Species = {
  id: "cinderling",
  name: "Cindermander",
  element: "ember",
  tier: "common",
  stages: ["Cinderling", "Cindernewt", "Cindermander"],
  palette: { skin: "#a882b2", flame: "#ff8a3a" },
  shiny: { skin: "#5fb89a", flame: "#9cf25a" },
  lore: "Naps in the warm spot where a laptop used to be. Its spots glow brighter at plot twists.",
  hint: "Coal that blinks back.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const smile = (x: number, y: number) => stamp(x, y, ["k..k", ".kk."], { k: "skin:1" });
    // Legs live in the body's own part so they read as one soft mass with no
    // dark seams.
    if (stage === 0) {
      parts.push(
        { mat: "skin", prims: [path([[20, 27], [25, 28.4], [27.8, 26.6], [28.4, 24]], 1.9, 0.8)], back: true },
        flame([tongue(14.4, 18.6, 3.8, 1.1, 1.4)]),
        { mat: "skin", prims: [ell(14.4, 23.8, 6.8, 5.6), ell(19.6, 26.6, 4.4, 2.8), ell(10.6, 29.2, 1.8, 1), ell(18.8, 29.3, 1.7, 1)], blend: 2.5 },
      );
      decals.push(
        ...eyes([10, 21], [16, 21], pose, "tall"),
        ...blush([8, 24], [18, 24]),
        smile(12, 24),
        glint(20, 24), glint(23, 26),
      );
    } else if (stage === 1) {
      parts.push(
        flame([tongue(18.4, 21.8, 3.6, 1.1, 1.4), tongue(24.6, 22.8, 3.2, 1, 1.4)]),
        flame([tongue(21.4, 22, 4.6, 1.2, 1.8)]),
        { mat: "skin", prims: [path([[24, 26], [28, 26], [29.6, 22.8], [28.4, 20.4]], 2, 0.8)], back: true },
        { mat: "skin", prims: [cap(24, 26.5, 24.6, 29.4, 1.5, 1.3)], back: true },
        { mat: "skin", prims: [ell(13.6, 21.6, 6.6, 5), ell(19.5, 25.6, 7, 3.8), cap(10.2, 25, 9.6, 29.2, 1.8, 1.5), cap(18, 26, 18, 29.2, 1.7, 1.5)], blend: 2.2 },
      );
      decals.push(
        ...eyes([9, 19], [15, 19], pose, "tall"),
        ...blush([7, 22], [17, 22]),
        smile(11, 22),
        glint(22, 25), glint(25, 26),
      );
    } else {
      parts.push(
        flame([
          tongue(8.6, 15.6, 4.2, 1.2, 1.4), tongue(14, 15.6, 4.8, 1.2, 2.2),
          tongue(21.5, 19.9, 4.6, 1.2, 1.8),
        ]),
        flame([tongue(11.2, 15, 6.8, 1.4, 2), tongue(18, 20, 3.8, 1.1, 1.6), tongue(25, 20.8, 3.4, 1, 1.6)]),
        { mat: "skin", prims: [path([[25, 25], [29, 23.2], [30, 19], [28, 15.5]], 2.3, 0.8)], back: true },
        { mat: "skin", prims: [cap(25.5, 27, 27, 29, 1.6, 1.4), ell(27.4, 29.4, 1.8, 1)], back: true },
        { mat: "skin", prims: [ell(11.5, 20.8, 6.8, 5), ell(19, 25.3, 8.5, 4.1),
          cap(8.4, 25, 7.6, 28.8, 2, 1.6), ell(7, 29.3, 2, 1.1), cap(21, 26.5, 21.6, 28.8, 1.9, 1.6), ell(22.2, 29.3, 2, 1.1)], blend: 2 },
      );
      decals.push(
        ...eyes([7, 18], [14, 18], pose, "round"),
        stamp(9, 22, ["k....k", ".kkkk."], { k: "skin:1" }),
        glint(18, 23), glint(21, 22), glint(24, 23), glint(27, 22), glint(22, 25), glint(25, 26),
        glint(5, 21, "flame:4"), glint(16, 21, "flame:4"),
      );
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 24][stage], [13, 11, 6][stage]));
    return { parts, decals };
  },
};

// ── Hearthhound ──

export const hearthhound: Species = {
  id: "hearthhound",
  name: "Hearthhound",
  element: "ember",
  tier: "rare",
  stages: ["Hearthpup", "Hearthling", "Hearthhound"],
  palette: { fur: "#eca35c", cream: "#fdd9a6", flame: "#ff7a3a", obsidian: "#6b5a86" },
  shiny: { fur: "#8d8aa6", cream: "#e3dcf6", flame: "#c77dff", obsidian: "#2f3a55" },
  lore: "Guards the fireplace and whoever is reading beside it. Fetches bookmarks, returns them slightly toasted.",
  hint: "Its wagging warms the room.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Nose, grin, and a little panting tongue.
    const face = (x: number, y: number) =>
      stamp(x, y, [".nn.", "k..k", ".tt."], { n: "eye:3", k: "fur:1", t: "blush:3" });
    // Ears grow up with the dog: floppy on the pup, half-perked on the
    // youngster, tall and pointed on the adult with a flame burning inside
    // each — the silhouette's signature, alongside the torch of a tail.
    /** Sitting body: head, chest, front legs as one mass; cream muzzle,
     *  chest and paws; a shadow seam between the legs instead of a part line. */
    const sitter = (hy: number, hr: V, by: number, br: V, lx: number, ly: number, lr: number): Part => ({
      mat: "fur", prims: [ell(16, hy, hr[0], hr[1]), ell(16, by, br[0], br[1]), ...both(cap(16 - lx, by, 16 - lx, ly, lr, lr))], blend: 3,
      paint: [
        { mat: "cream", prims: [ell(16, hy + hr[1] * 0.55, hr[0] * 0.5, hr[1] * 0.42), ell(16, by - 0.4, br[0] * 0.5, br[1] * 0.62)], level: 4 },
        { mat: "cream", prims: both(ell(16 - lx, ly + lr * 0.4, lr, 0.9)), level: 4 },
        { mat: "fur", prims: [cap(16, by + br[1] * 0.35, 16, ly + lr, 0.5)], level: 1 },
      ],
    });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[20, 27], [23, 26.2], [24.2, 24]], 1.3, 0.9)], back: true },
        flame([ell(24.4, 23.4, 1.1, 1.3)], { line: false }),
        { mat: "fur", prims: [ell(16, 21.4, 6.6, 5.8), ell(16, 26.8, 5.2, 3.4), ...both(ell(13.4, 29.2, 1.8, 1.1))], blend: 3,
          paint: [{ mat: "cream", prims: [ell(16, 24.6, 3.2, 2.1), ell(16, 28.4, 2.6, 1.6)], level: 4 }] },
        { mat: "fur", prims: both(cap(10.8, 17, 8.4, 21.4, 2, 1.6)) },
        flame(both(ell(8.2, 22.2, 1.2, 1.1)), { line: false }),
      );
      decals.push(...eyes([12, 19], [18, 19], pose, "tall"), ...blush([10, 23], [20, 23]), face(14, 22));
    } else if (stage === 1) {
      parts.push(
        flame(fire(24.6, 25, 7.4, 1.5, 2)),
        { mat: "fur", prims: both(ell(10.8, 27, 2.6, 2.6)), back: true },
        { mat: "fur", prims: both(poly([[9.4, 13.8], [7.4, 8.6], [13.4, 10.8]], 1)) },
        flame(both(tongue(9.8, 12.6, 5, 1.1, -1.4)), { line: false }),
        sitter(15, [6.8, 5.8], 24, [5.6, 5], 3, 28.4, 1.6),
      );
      decals.push(...eyes([12, 13], [18, 13], pose, "tall"), ...blush([10, 17], [20, 17]), face(14, 16));
    } else {
      parts.push(
        flame([path([[22.5, 26.5], [26, 24.5], [27.4, 20], [28.6, 13.5]], 2.2, 0.45), tongue(25.5, 25, 6, 1, 3)]),
        flame([tongue(24, 26.5, 4.4, 1, 3.6)]),
        { mat: "fur", prims: both(ell(10, 26.6, 3, 3.2)), back: true },
        { mat: "fur", prims: both(poly([[9.2, 10.6], [9, 4.6], [14, 7.4]], 1)) },
        flame(both(tongue(10.6, 9.6, 7.6, 1.3, -1)), { line: false }),
        sitter(11.8, [6.8, 5.6], 22, [6.4, 6.2], 3.2, 28.2, 1.9),
        { mat: "obsidian", prims: [path([[10.8, 17.8], [16, 19.2], [21.2, 17.8]], 1.1)] },
        flame([ell(16, 21, 1.2, 1.4)], { line: false }),
      );
      decals.push(...eyes([12, 10], [18, 10], pose, "round"), face(14, 13));
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 24][stage], [11, 4, 1][stage]));
    return { parts, decals };
  },
};

// ── Qilin ──

/** Mirror points around a head centered at x = cx (heads off the midline). */
const mx = (cx: number, pts: V[]): V[] => pts.map(([x, y]) => [2 * cx - x, y]);

export const qilin: Species = {
  id: "qilin",
  name: "Qilin",
  element: "ember",
  tier: "epic",
  stages: ["Qilinfawn", "Qilinling", "Qilin"],
  palette: { hide: "#6cc7ae", cream: "#fde3b0", gold: "#f2c14e", flame: "#ff8a3d" },
  shiny: { hide: "#eeeaf6", cream: "#ffe3f0", gold: "#b99cff", flame: "#ff6fae" },
  lore: "Walks so gently it never bends a blade of grass or crinkles a page. Appears only to readers who finish what they start.",
  hint: "Hoofprints that smoulder, then bloom.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Leaf ears: drooping on the fawn, perked up-and-out on the grown qilin.
    const ears = (hx: number, y: number, d: number, rx: number, tilt = 28): Part => ({
      mat: "hide", prims: [ell(hx - d, y, rx, 1.3, tilt), ell(hx + d, y, rx, 1.3, -tilt)],
      paint: [{ mat: "cream", prims: [ell(hx - d - 0.2, y + 0.1, rx * 0.55, 0.5, tilt), ell(hx + d + 0.2, y + 0.1, rx * 0.55, 0.5, -tilt)] }],
    });
    /** Flame licks flaring up behind a hoof (drawn before the legs). */
    const licks = (x: number, h: number): Prim[] => [
      tongue(x - 1.1, 29.6, h * 0.8, 0.9, -1.3), tongue(x + 1.1, 29.6, h, 0.9, 1.3),
    ];
    /** The glowing hoof itself (drawn after the legs). */
    const hoof = (x: number): Prim => ell(x, 29.4, 1.35, 0.95);
    if (stage === 0) {
      const hx = 13;
      parts.push(
        flame([tongue(24, 24.5, 3.6, 1, 1.6)]),
        { mat: "hide", prims: [ell(19.5, 24.8, 5, 3.2), cap(16, 26, 16, 29.2, 1.5, 1.3), cap(22.2, 26, 22.4, 29.2, 1.5, 1.3)], blend: 1.5,
          paint: [
            { mat: "cream", prims: [ell(18.5, 23, 0.7), ell(21, 22.6, 0.7), ell(23, 23.6, 0.7)] },
            { mat: "flame", prims: [ell(16, 29.6, 1.6, 0.8), ell(22.4, 29.6, 1.6, 0.8)], level: 4 },
          ] },
        ears(hx, 17.2, 5.6, 2.3),
        { mat: "hide", prims: [ell(hx, 18.8, 5.6, 5)], paint: [{ mat: "cream", prims: [ell(hx, 21.9, 2.4, 1.5)], level: 4 }] },
        { mat: "gold", prims: [cap(hx, 14.4, hx, 12.3, 1.3, 0.8)] },
      );
      decals.push(
        ...eyes([hx - 4, 17], [hx + 2, 17], pose, "tall"),
        ...blush([hx - 6, 20], [hx + 4, 20]),
        stamp(hx - 1, 21, ["kk"], { k: "hide:1" }),
      );
    } else if (stage === 1) {
      const hx = 12;
      parts.push(
        flame(fire(25.5, 21, 7, 1.5, 2)),
        { mat: "hide", prims: [cap(15.5, 23, 15.5, 29, 1.35, 1.15), cap(23, 23, 23, 29, 1.35, 1.15)], back: true, round: 3 },
        { mat: "hide", prims: [ell(19, 21.5, 6.8, 3.8), cap(17, 19, 13, 14, 2.4, 2.2)], blend: 2,
          paint: [
            { mat: "gold", prims: [ell(19, 19, 0.7), ell(21.5, 19.2, 0.7), ell(24, 19.8, 0.7), ell(20.2, 20.8, 0.7), ell(22.8, 21, 0.7)] },
          ] },
        flame([...licks(13.5, 3.6), ...licks(21.5, 3.6)]),
        { mat: "hide", prims: [cap(13.5, 23, 13.5, 29, 1.45, 1.25), cap(21.5, 23, 21.5, 29, 1.45, 1.25)], round: 3 },
        flame([hoof(13.5), hoof(21.5)]),
        ears(hx, 11.6, 5.4, 2.5),
        { mat: "gold", prims: [cap(hx - 2, 9, hx - 2.8, 6.2, 1, 0.7), cap(hx + 2, 9, hx + 2.8, 6.2, 1, 0.7)] },
        { mat: "hide", prims: [ell(hx, 13, 5.2, 4.6)], paint: [{ mat: "cream", prims: [ell(hx, 15.9, 2.4, 1.5)], level: 4 }] },
      );
      decals.push(
        ...eyes([hx - 4, 12], [hx + 2, 12], pose, "tall"),
        ...blush([hx - 5, 15], [hx + 3, 15]),
        stamp(hx - 1, 16, ["kk"], { k: "hide:1" }),
      );
    } else {
      const hx = 11;
      const antler: V[] = [[hx - 2, 6.5], [hx - 3.2, 3.6], [hx - 4.4, 1.2]];
      const tine: V[] = [[hx - 3.3, 3.9], [hx - 6.2, 3]];
      parts.push(
        flame([path([[26, 18.5], [28.6, 15.5], [28.2, 11.5], [30, 7]], 2, 0.45), tongue(27, 18, 6, 1.1, 3)]),
        { mat: "hide", prims: [cap(16, 22, 16, 29.2, 1.45, 1.25), cap(26, 22, 26, 29.2, 1.45, 1.25)], back: true, round: 3 },
        flame([
          ray(15.4, 9.6, -55, 0, 7, 1.7, 1.8), ray(17.8, 12.4, -50, 0, 6.5, 1.7, 1.8), ray(20.4, 15, -45, 0, 5.5, 1.5, 1.8),
        ]),
        { mat: "hide", prims: [ell(20.5, 19.8, 7.6, 4.4), cap(16.5, 17.5, hx + 1, 11.5, 3, 2.5)], blend: 2.5,
          paint: [
            { mat: "gold", prims: [
              ell(19.5, 17.4, 0.7), ell(22.1, 17.3, 0.7), ell(24.7, 17.7, 0.7),
              ell(20.8, 19.3, 0.7), ell(23.4, 19.4, 0.7), ell(26, 19.8, 0.7), ell(22.1, 21.3, 0.7), ell(24.7, 21.4, 0.7),
            ] },
          ] },
        flame([...licks(14, 4.6), ...licks(24, 4.6)]),
        { mat: "hide", prims: [cap(14, 22, 14, 29.2, 1.55, 1.3), cap(24, 22, 24, 29.2, 1.55, 1.3)], round: 3 },
        flame([hoof(14), hoof(24)]),
        { mat: "gold", prims: [path(antler, 1, 0.7), path(tine, 0.8, 0.6), path(mx(hx, antler), 1, 0.7), path(mx(hx, tine), 0.8, 0.6)] },
        ears(hx, 7.6, 5, 2.5, -30),
        { mat: "hide", prims: [ell(hx, 10.5, 5.4, 4.7)], paint: [{ mat: "cream", prims: [ell(hx, 13.7, 2.5, 1.5)], level: 4 }] },
      );
      decals.push(
        ...eyes([hx - 4, 9], [hx + 2, 9], pose, "round"),
        stamp(hx - 1, 13, ["kk"], { k: "hide:1" }),
        glint(hx, 7, "gold:5"),
      );
    }
    if (pose === "sleep") decals.push(zzz(24, 3));
    return { parts, decals };
  },
};

// ── Phoenix ──

export const phoenix: Species = {
  id: "phoenix",
  name: "Phoenix",
  element: "ember",
  tier: "legendary",
  stages: ["Phoenix Chick", "Phoenix Fledgling", "Phoenix"],
  palette: { plume: "#ff6d4d", cream: "#ffdca0", gold: "#ffcc4d", flame: "#ff8a2e", rose: "#e5487a" },
  shiny: { plume: "#5b7cf0", cream: "#dff0ff", gold: "#9ff3ff", flame: "#6ee0ff", rose: "#8a5cf0" },
  lore: "Every thousand years it bursts into flame and starts the book over — and somehow still remembers where it left off.",
  hint: "Ashes, then a heartbeat.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const beak = (x: number, y: number) => stamp(x, y, ["ll", "dd"], { l: "gold:4", d: "gold:2" });
    if (stage === 0) {
      parts.push(
        flame(fire(16, 18.8, 5.5, 1.5, 0.3)),
        { mat: "plume", prims: [ell(16, 23.8, 6.6, 6), ell(10.2, 22.4, 1.5), ell(21.8, 22.4, 1.5)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(16, 27.4, 3.8, 2.4)], level: 4 }] },
        { mat: "plume", prims: both(ell(9.9, 25, 1.5, 2.5, 20)) },
        { mat: "gold", prims: both(ell(13.6, 29.8, 1.4, 0.9)) },
      );
      decals.push(
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 24], [20, 24]),
        beak(15, 24),
      );
    } else if (stage === 1) {
      parts.push(
        flame([tongue(14.5, 27.5, 4.5, 1.2, -4), tongue(17.5, 27.5, 4.5, 1.2, 4)]),
        flame(fire(16, 12.8, 7, 1.9, 0.4)),
        flame(both(tongue(6.2, 16.2, 6, 1.5, -2.6))),
        { mat: "plume", prims: both(path([[11, 19], [7.8, 18.6], [6.2, 16]], 2.4, 1.5)),
          paint: [{ mat: "rose", prims: both(ell(6.8, 16.8, 1.8, 1.8)) }] },
        { mat: "plume", prims: [ell(16, 20, 6.6, 7.2), ell(16, 25.6, 5.4, 3.6)], blend: 3,
          paint: [{ mat: "cream", prims: [ell(16, 25, 4, 3.6)], level: 4 }] },
        { mat: "gold", prims: both(ell(13.6, 29.6, 1.5, 0.9)) },
      );
      decals.push(
        ...eyes([12, 17], [18, 17], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        beak(15, 20),
      );
    } else {
      // Wings raised in a V: a plume arm to the wrist, primaries fanning out
      // from it as long flame tongues, secondaries trailing below the arm.
      const shoulder: V = [13, 14];
      const wrist: V = [7.4, 7.6];
      const primaries: V[] = [[6, 1.6], [2.8, 2.6], [1.4, 5.8], [1.3, 9.8], [2.3, 13.6]];
      const secondaries: [V, V][] = [[[9.6, 10.4], [4.4, 17.4]], [[11.6, 12.6], [7.8, 19.6]]];
      // Alternate feathers go in separate parts so each casts a thin
      // separation line on its neighbour: the fan reads as feathers.
      const feather = (t: V) => both(path([wrist, t], 1.9, 0.45));
      parts.push(
        // Tail: a fan of five plumes; alternating parts keep them separate.
        flame(both(path([[15.4, 20], [12, 24.4], [7.6, 27.8]], 2, 0.45)).concat([path([[16, 20], [16, 25], [16, 30.4]], 2.3, 0.5)])),
        flame(both(path([[15.6, 20], [13.8, 25], [11.8, 29.6]], 2, 0.45))),
        flame([...primaries.filter((_, i) => i % 2 === 0).flatMap(feather),
          ...secondaries.flatMap(([a, b]) => both(path([a, b], 1.8, 0.45)))]),
        flame(primaries.filter((_, i) => i % 2 === 1).flatMap(feather)),
        { mat: "plume", prims: both(path([shoulder, [10.2, 10.2], wrist], 3, 2.2)), blend: 1.5,
          paint: [{ mat: "rose", prims: both(ell(7.6, 8, 2.2, 2)) }] },
        flame([ell(16, 5.8, 1.6, 1.2), tongue(16, 6, 5, 1.2, 0.3), tongue(14, 6.4, 4.2, 1, -2.4), tongue(18, 6.4, 4.2, 1, 2.4)], { round: 1.3 }),
        { mat: "plume", prims: [ell(16, 9, 4.2, 3.9), ell(16, 16.5, 4.4, 5.6)], blend: 3,
          paint: [{ mat: "cream", prims: [ell(16, 17.5, 2.8, 3.8)] }] },
      );
      decals.push(
        ...eyes([13, 8], [17, 8], pose, "round"),
        beak(15, 11),
        sparkle(26, 17), sparkle(3, 18), sparkle(23, 26),
      );
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 20][stage], [13, 6, 0][stage]));
    return { parts, decals };
  },
};

// ── Candlesnail ──

export const candlesnail: Species = {
  id: "candlesnail",
  name: "Waxwick",
  element: "ember",
  tier: "common",
  stages: ["Wickling", "Tallowsnail", "Waxwick"],
  palette: { skin: "#ec9cae", belly: "#c8768f", wax: "#f6e3bd", wick: "#5a4450", flame: "#ff9a3a" },
  shiny: { skin: "#8fd0c2", belly: "#5fa8a0", wax: "#d8c8f6", flame: "#6fcfff" },
  lore: "Carries its own reading lamp and never hurries past a good paragraph. The slower the book, the taller its candle grows.",
  hint: "It leaves a trail of wax, not slime.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // Candle: a rounded wax column (x0..x1, top..bottom), a melted rim with
    // drips as its own part so each drip casts a line on the column, a wick.
    const candle = (x0: number, x1: number, top: number, bot: number, drips: [number, number][]) => {
      const cx = (x0 + x1) / 2;
      parts.push(
        { mat: "wax", prims: [poly([[x0, top], [x1, top], [x1 + 0.6, bot], [x0 - 0.6, bot]], 0.6)], round: (x1 - x0) * 0.7 },
        { mat: "wax", prims: [ell(cx, top + 0.3, (x1 - x0) / 2 + 0.7, 1.2), ...drips.map(([x, len]) => cap(x, top, x, top + len, 0.75, 1.05))],
          blend: 1.2, paint: [{ mat: "wax", prims: [ell(cx, top + 6, 12, 12)], level: 4 }] },
        { mat: "wick", prims: [cap(cx, top - 0.2, cx + 0.2, top - 1.6, 0.55)], line: false },
      );
    };
    /** Head rising from the foot, with two ball-tipped eye stalks. */
    const snail = (hx: number, hy: number, hr: number, tail: number, stalk: number) => {
      const s = stalk;
      const fy = 27.9;
      parts.push(
        { mat: "skin", prims: [cap(hx - hr * 0.35, hy - hr * 0.7, hx - hr * 0.6, hy - hr - s, 0.55), ell(hx - hr * 0.62, hy - hr - s, 1.05),
          cap(hx + hr * 0.35, hy - hr * 0.7, hx + hr * 0.6, hy - hr - s, 0.55), ell(hx + hr * 0.62, hy - hr - s, 1.05)], blend: 0.6 },
        // One mass: a round head on a neck that flows into a foot tapering
        // back to the tail tip, so no plate-like slab.
        { mat: "skin", prims: [ell(hx, hy, hr, hr * 1.05), path([[hx - hr * 0.7, fy - 0.2], [hx + hr, fy], [tail, fy + 0.4]], 2.1, 1.1)], blend: 3 },
      );
    };
    if (stage === 0) {
      candle(16.6, 22.4, 20, 27, [[17.4, 3], [21.5, 1.8]]);
      parts.push(flame(fire(19.5, 18.4, 4.6, 1.3, 0.3)));
      snail(12, 23.6, 4.4, 25.5, 1.4);
      decals.push(...eyes([9, 22], [13, 22], pose, "tall"), ...blush([8, 25], [14, 25], 1), stamp(11, 25, ["kk"], { k: "skin:1" }));
    } else if (stage === 1) {
      candle(15.8, 24.2, 15, 27, [[17, 4.6], [20.6, 2.2], [23.3, 3.4]]);
      parts.push(flame(fire(20, 13.2, 6.6, 1.6, 0.4)));
      snail(10.5, 22, 5, 28.4, 2);
      decals.push(...eyes([7, 20], [12, 20], pose, "tall"), ...blush([6, 23], [13, 23], 1), stamp(9, 24, ["k.k", ".k."], { k: "skin:1" }));
    } else {
      candle(15, 26, 11, 27, [[16.3, 7.2], [18.8, 3], [22, 5], [24.9, 2.4]]);
      parts.push(
        { mat: "wax", prims: [ell(26.2, 27.2, 2.6, 1.3)], paint: [{ mat: "wax", prims: [ell(26, 26, 4, 2)], level: 4 }] },
        flame(fire(20.5, 9.2, 8.2, 2, 0.5)),
      );
      snail(9.8, 21, 5.8, 30, 2.4);
      decals.push(...eyes([6, 19], [12, 19], pose, "tall"), ...blush([5, 22], [13, 22], 2), stamp(9, 23, ["k..k", ".kk."], { k: "skin:1" }));
    }
    if (pose === "sleep") decals.push(zzz([23, 26, 27][stage], [9, 4, 1][stage]));
    return { parts, decals };
  },
};

// ── Sparkfinch ──

export const sparkfinch: Species = {
  id: "sparkfinch",
  name: "Sparkfinch",
  element: "ember",
  tier: "common",
  stages: ["Sparkling", "Sparkfledge", "Sparkfinch"],
  palette: { plume: "#aba4bd", wing: "#8e87a6", breast: "#f59a6a", flame: "#ff8a38" },
  shiny: { plume: "#8fb6e6", wing: "#6f8fcf", breast: "#fff0c8", flame: "#ff5fa8" },
  lore: "Sings one bright note per page turned. A flock of them can keep a whole reading room warm through winter.",
  hint: "A soot-grey puff with a lit fuse.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const beak = (x: number, y: number) => stamp(x, y, ["bb", ".b"], { b: "flame:4" });
    const feet = (y: number) => stamp(13, y, ["f....f", "ff..ff"], { f: "flame:2" });
    /** Folded wings hugging the ball, tapering down-and-back; the last
     *  feathers glow like embers. */
    /** The body ball with a warm robin breast, and folded wings tucked
     *  inside its silhouette whose last feathers glow like embers. */
    const ball = (cy: number, rx: number, ry: number): Part[] => {
      const wx = rx * 0.76;
      const wy = cy + ry * 0.2;
      return [
        { mat: "plume", prims: [ell(16, cy, rx, ry)],
          paint: [{ mat: "breast", prims: [ell(16, cy + ry * 0.42, rx * 0.5, ry * 0.44)], level: 4 }] },
        { mat: "wing", prims: both(ell(16 - wx, wy, rx * 0.26, ry * 0.48, 12)),
          paint: [{ mat: "flame", prims: both(ell(16 - wx + 0.3, wy + ry * 0.42, rx * 0.3, ry * 0.18, 12)), level: 4 }] },
      ];
    };
    if (stage === 0) {
      parts.push(
        flame([tongue(16.2, 19.2, 3.6, 1, 1.4)]),
        ...ball(24.4, 6.4, 5.8),
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), beak(15, 25), feet(29));
    } else if (stage === 1) {
      parts.push(
        flame([tongue(21, 25, 5.4, 1.2, 4.6)]),
        flame([tongue(14.8, 15, 3.4, 0.9, -0.4), tongue(17.8, 15, 3.4, 0.9, 2.6)]),
        flame([tongue(16.2, 14.6, 4.8, 1.1, 1.6)]),
        ...ball(21.4, 7.4, 7),
      );
      decals.push(...eyes([12, 18], [18, 18], pose, "tall"), ...blush([10, 21], [20, 21]), beak(15, 21), feet(28));
    } else {
      parts.push(
        flame([path([[20, 24], [24.4, 23.4], [27.4, 20], [28.6, 15.6]], 1.9, 0.45)]),
        flame([tongue(21, 25, 7.4, 1.3, 7), tongue(20, 23.4, 5, 1, 2.6)]),
        flame([tongue(13.6, 12.4, 4.4, 1.1, -1), tongue(18.6, 12.4, 4.6, 1.1, 3.4)]),
        flame([tongue(16, 11.8, 7.2, 1.5, 1.8)]),
        ...ball(19.8, 8.2, 8.2),
      );
      decals.push(...eyes([12, 16], [18, 16], pose, "round"), ...blush([10, 19], [20, 19]), beak(15, 19), feet(28));
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 25][stage], [11, 6, 3][stage]));
    return { parts, decals };
  },
};

// ── Imp ──

export const imp: Species = {
  id: "imp",
  name: "Impish",
  element: "ember",
  tier: "rare",
  stages: ["Impling", "Imp", "Impish"],
  palette: { skin: "#f47c62", wing: "#a864b4", horn: "#f7dfae", flame: "#ffb03a" },
  shiny: { skin: "#63b8e0", wing: "#4a4f9e", horn: "#ffe7f2", flame: "#c88cff" },
  lore: "Dog-ears your pages, then swears it was the wind. Reads the last chapter first, and will absolutely tell you how it ends.",
  hint: "Horns, a grin, and a pointy tail.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    // A bat wing from the shoulder: a leading edge up to a finger tip, then a
    // scalloped trailing edge back to the body.
    // A bat wing on the left (mirrored for the right), authored at full size
    // around the shoulder and scaled per stage: a leading edge up to the
    // wrist, then three finger tips with scalloped membrane between them.
    const WING: V[] = [
      [0, 0], [-4.5, -7.5], [-7, -9.5], [-9.4, -8.6], [-11, -5],
      [-8.4, -3.8], [-10, -0.6], [-7, -1.4], [-6.2, 2], [-4, 0.2], [-1.6, 2.6],
    ];
    const wing = (sx: number, sy: number, k: number): Prim[] =>
      both(poly(WING.map(([x, y]): V => [sx + x * k, sy + y * k]), 0.35));
    /** The tail's spade tip: a kite pointing up. */
    const spade = (x: number, y: number, r: number): Prim => poly([[x, y - r * 1.4], [x + r, y + 0.1], [x, y + r * 0.6], [x - r, y + 0.1]], 0.3);
    // A lopsided smirk with one fang: cheeky, not scary.
    const grin = (x: number, y: number) => stamp(x, y, ["k...k", ".kkk.", "...w."], { k: "eye:3", w: "white:4" });
    if (stage === 0) {
      parts.push(
        { mat: "wing", prims: wing(12, 21, 0.42) },
        { mat: "skin", prims: [path([[19, 25.5], [23, 26.2], [24.4, 23.6]], 0.8, 0.7)], back: true },
        { mat: "skin", prims: [spade(24.4, 22.8, 1.5)] },
        { mat: "horn", prims: both(cap(11.6, 17.4, 10.8, 15.2, 1.2, 0.7)) },
        { mat: "skin", prims: [ell(16, 21.8, 6.4, 5.4), ...both(ell(13.6, 26.8, 1.4, 1.1))], blend: 1.5 },
      );
      decals.push(...eyes([12, 19], [18, 19], pose, "tall"), ...blush([10, 23], [20, 23]), grin(14, 22));
    } else if (stage === 1) {
      parts.push(
        { mat: "wing", prims: wing(12.4, 18.6, 0.66) },
        { mat: "skin", prims: [path([[18, 23.4], [23, 25.4], [26.2, 22.6], [25.8, 20]], 0.95, 0.75)], back: true },
        { mat: "skin", prims: [spade(25.8, 19, 1.8)] },
        { mat: "skin", prims: [ell(16, 21.6, 4, 3.8), ...both(cap(14.2, 23, 13.8, 26.2, 1.4, 1.3))], blend: 1.5 },
        flame([tongue(16, 9.8, 3.6, 1, 0.8)]),
        { mat: "horn", prims: both(path([[11.8, 11.4], [10.4, 9.2], [10.8, 7.4]], 1.3, 0.6)) },
        { mat: "skin", prims: [ell(16, 14.6, 6.4, 5.4), ...both(ell(9.4, 14.4, 1.4, 0.9, -20))], blend: 1 },
        { mat: "skin", prims: both(ell(11.9, 21, 1.3, 1.5)) },
      );
      decals.push(...eyes([12, 13], [18, 13], pose, "tall"), ...blush([10, 17], [20, 17]), grin(14, 16));
    } else {
      parts.push(
        { mat: "wing", prims: wing(12.6, 16.4, 1), paint: [{ mat: "wing", prims: both(path([[12.6, 16.4], [8.1, 8.9], [5.6, 6.9]], 0.6)), level: 4 }] },
        { mat: "skin", prims: [path([[18.5, 22.4], [24, 25.6], [28, 22.8], [27.6, 18.6]], 1.15, 0.8)], back: true },
        { mat: "skin", prims: [spade(27.6, 17.4, 2.2)] },
        { mat: "skin", prims: [ell(16, 20.4, 4.6, 4.4), ...both(cap(14, 22.5, 13.4, 26.8, 1.6, 1.5))], blend: 1.5 },
        flame([tongue(16, 6.8, 4.8, 1.2, 1)]),
        { mat: "horn", prims: both(path([[11.2, 8.4], [9.2, 5.6], [9.8, 2.8]], 1.6, 0.6)) },
        { mat: "skin", prims: [ell(16, 11.8, 7, 5.9), ...both(ell(8.4, 11.6, 1.9, 1.1, -22))], blend: 1 },
        { mat: "skin", prims: both(ell(11.4, 19.8, 1.5, 1.8)) },
      );
      decals.push(...eyes([12, 10], [18, 10], pose, "round"), ...blush([10, 13], [20, 13]), grin(14, 13));
    }
    if (pose === "sleep") decals.push(zzz([24, 25, 25][stage], [11, 3, 0][stage]));
    return { parts, decals };
  },
};

// ── Cindercrab ──

export const cindercrab: Species = {
  id: "cindercrab",
  name: "Calderacrab",
  element: "ember",
  tier: "rare",
  stages: ["Pebblepinch", "Cindercrab", "Calderacrab"],
  palette: { crab: "#f28c7a", rock: "#8e7c8c", flame: "#ff8a2e", smoke: "#cfc6d6" },
  shiny: { crab: "#7fc6e8", rock: "#5d6a82", flame: "#8cf06a", smoke: "#e2f2e0" },
  lore: "Moves house whenever it outgrows a volcano, which is roughly once per trilogy. Toasts marshmallows for anyone reading nearby.",
  hint: "A mountain that walks sideways.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Volcano shell: flared, slightly concave flanks and a flat crater lip. */
    const cone = (cx: number, top: number, bot: number, tw: number, bw: number): Prim => {
      const mid = top + (bot - top) * 0.62;
      const mw = tw + (bw - tw) * 0.5;
      return poly([[cx - tw, top], [cx + tw, top], [cx + mw, mid], [cx + bw, bot], [cx - bw, bot], [cx - mw, mid]], 0.7);
    };
    /** A little cloud of smoke: one big bump and two small ones. */
    const puff = (x: number, y: number, r: number): Prim[] => [ell(x, y - r * 0.3, r), ell(x - r * 1.1, y + r * 0.3, r * 0.75), ell(x + r * 1.1, y + r * 0.3, r * 0.75)];
    /** A pincer: a round palm with a V bite taken out, opening up-and-out. */
    const claw = (x: number, y: number, r: number, dir: 1 | -1): Part => ({
      mat: "crab", prims: [ell(x, y, r, r * 0.9)],
      cut: [poly([[x + dir * 0.2, y - 0.2], [x + dir * r * 1.4, y - r * 1.2], [x + dir * r * 1.5, y - r * 0.1]])],
    });
    const lava = (pts: V[], w = 0.6): Part => flame([path(pts, w, w * 0.8)], { line: false });
    const mouth = (x: number, y: number) => stamp(x, y, ["k.k", ".k."], { k: "crab:1" });
    if (stage === 0) {
      parts.push(
        { mat: "crab", prims: [cap(11, 28, 9.3, 29.6, 0.9), cap(21, 28, 22.7, 29.6, 0.9)], back: true },
        { mat: "rock", prims: [cone(16, 17.8, 25.2, 2.6, 7.2)] },
        flame([ell(16, 18, 2, 0.8)], { line: false }),
        { mat: "crab", prims: [ell(16, 26.4, 5.8, 3.4)] },
        claw(9.4, 26, 1.8, -1), claw(22.6, 26, 1.8, 1),
      );
      decals.push(...eyes([12, 24], [18, 24], pose, "tall"), ...blush([10, 27], [20, 27]), mouth(15, 27));
    } else if (stage === 1) {
      parts.push(
        { mat: "smoke", prims: puff(19.6, 9, 1.4), blend: 1 },
        { mat: "crab", prims: [cap(9, 26, 6.2, 29.6, 1), cap(23, 26, 25.8, 29.6, 1)], back: true },
        { mat: "rock", prims: [cone(16, 13.4, 23.6, 3, 9.6)] },
        flame([ell(16, 13.6, 2.4, 0.9)], { line: false }),
        lava([[14.6, 14.4], [14, 16.6], [14.4, 18.6]]),
        { mat: "crab", prims: [ell(16, 25, 6.8, 4)] },
        claw(7.2, 23.6, 2.5, -1), claw(24.8, 24.4, 2, 1),
      );
      decals.push(...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), mouth(15, 25));
    } else {
      parts.push(
        { mat: "smoke", prims: [...puff(8.6, 5, 1.7), ...puff(24, 3.6, 1.3)], blend: 1 },
        flame(fire(16, 9.8, 8.6, 2.2, 0.3)),
        { mat: "crab", prims: [cap(8, 25, 3.4, 29.4, 1.1), cap(10, 26.5, 7.4, 29.6, 1), cap(24, 25, 28.6, 29.4, 1.1), cap(22, 26.5, 24.6, 29.6, 1)], back: true },
        { mat: "rock", prims: [cone(16, 9.8, 22.4, 3.8, 11.6)] },
        flame([ell(16, 10, 3.4, 1)], { line: false }),
        lava([[13.6, 10.8], [12.8, 13.6], [13.4, 16.8]], 0.7),
        lava([[18.8, 10.8], [19.6, 13.2]], 0.6),
        { mat: "crab", prims: [ell(16, 23.6, 7.6, 4.6)] },
        claw(5.8, 21.2, 3.2, -1), claw(26.2, 23, 2.4, 1),
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "round"), ...blush([10, 24], [20, 24]), mouth(15, 24),
        stamp(22, 7, ["g"], { g: "flame:4" }, true), stamp(10, 9, ["g"], { g: "flame:5" }, true));
    }
    if (pose === "sleep") decals.push(zzz([24, 25, 26][stage], [12, 9, 11][stage]));
    return { parts, decals };
  },
};

// ── Solleo ──

export const solleo: Species = {
  id: "solleo",
  name: "Solleo",
  element: "ember",
  tier: "epic",
  stages: ["Sunkit", "Dawncub", "Solleo"],
  palette: { fur: "#efb56e", cream: "#fde9c2", mane: "#ffc23c", flame: "#ff7a2a", gem: "#ff5d7a" },
  shiny: { fur: "#e9e3f6", cream: "#ffffff", mane: "#9fd8ff", flame: "#6c7dff", gem: "#ffd84a" },
  lore: "Its mane rises with the sun and sets when the book closes. Readers who stay up past midnight find it glowing softly, waiting for them to finish.",
  hint: "A small sunrise with whiskers.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const face = (x: number, y: number) => stamp(x, y, [".nn.", "k..k", ".kk."], { n: "gem:2", k: "fur:1" });
    /** Straight, sharply tapered sun rays around (cx, cy). */
    const sun = (cx: number, cy: number, angles: number[], r0: number, len: number, w: number): Prim[] =>
      angles.map((a) => ray(cx, cy, a, r0, len, w, 0));
    if (stage === 0) {
      parts.push(
        flame([tongue(13.5, 18.6, 3, 0.9, -1.4), tongue(16, 18.2, 4, 1, 0.3), tongue(18.5, 18.6, 3, 0.9, 1.6)]),
        { mat: "fur", prims: [path([[20.5, 27.5], [24, 27.6], [25, 25]], 0.8, 0.7)], back: true },
        { mat: "fur", prims: [ell(16, 23.4, 6.8, 5.8), ...both(ell(11, 18.8, 1.6))], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(16, 25.6, 3, 1.8)], level: 4 }] },
        { mat: "fur", prims: both(ell(13.4, 29.2, 1.6, 1)) },
        flame([ell(25.2, 24.6, 1.1)], { line: false }),
      );
      decals.push(...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 24], [20, 24]), face(14, 24));
    } else if (stage === 1) {
      const rays = [-150, -120, -90, -60, -30, 0, 180].map((a) => ray(16, 13, a, 5.2, a === -90 ? 3.6 : 2.8, 1.2, 0.4));
      parts.push(
        flame(rays),
        { mat: "mane", prims: [ell(16, 13.5, 7.2, 6.6)], glow: true },
        { mat: "fur", prims: [path([[20, 28], [25, 28], [26.5, 24]], 0.9, 0.7)], back: true },
        { mat: "fur", prims: [ell(16, 24, 5.4, 5.2), ...both(cap(13.4, 25, 13.2, 29.3, 1.4, 1.4))], blend: 2,
          paint: [{ mat: "cream", prims: [ell(16, 24, 2.6, 3)], level: 4 }] },
        flame([ell(26.5, 23.4, 1.3)], { line: false }),
        { mat: "fur", prims: [ell(16, 14, 5.8, 5), ...both(ell(11.2, 9.6, 1.8))], blend: 1.2,
          paint: [{ mat: "cream", prims: [ell(16, 16.6, 2.8, 1.8)], level: 4 }] },
      );
      decals.push(...eyes([12, 12], [18, 12], pose, "tall"), ...blush([10, 15], [20, 15]), face(14, 15), glint(16, 10, "gem:4"));
    } else {
      parts.push(
        flame(sun(16, 11.6, [-60, 0, 60, 120, 180, 240], 7.4, 3.4, 1.6)),
        flame(sun(16, 11.6, [-90, -30, 30, 90, 150, 210], 7.4, 4.6, 1.8)),
        { mat: "mane", prims: [ell(16, 11.6, 8.6, 8.2)], glow: true },
        { mat: "fur", prims: [path([[21, 28.4], [26, 28.4], [28.6, 24.8], [28, 21.6]], 1.1, 0.8)], back: true },
        flame([ell(28, 20.6, 1.4, 1.6), tongue(28, 20.4, 3.4, 0.9, 0.6)], { line: false }),
        { mat: "fur", prims: [ell(16, 23.8, 6.6, 6), ...both(cap(13, 24, 12.8, 29.3, 1.8, 1.8))], blend: 2,
          paint: [{ mat: "cream", prims: [ell(16, 23.4, 2.4, 3.4)], level: 4 }, { mat: "cream", prims: both(ell(12.8, 29.4, 1.8, 0.9)), level: 4 }] },
        { mat: "fur", prims: [ell(16, 12, 6.4, 5.6), ...both(ell(10.4, 7.2, 1.9))], blend: 1.2,
          paint: [{ mat: "cream", prims: [ell(16, 15, 3, 1.8)], level: 4 }, { mat: "gem", prims: both(ell(10.4, 7.4, 0.9)) }] },
      );
      decals.push(...eyes([12, 11], [18, 11], pose, "round"), face(14, 13));
      if (pose !== "sleep") decals.push(sparkle(2, 22), sparkle(27, 1));
    }
    if (pose === "sleep") decals.push(zzz([24, 26, 27][stage], [14, 3, 0][stage]));
    return { parts, decals };
  },
};

export const EMBER: Species[] = [kindlemouse, cinderling, candlesnail, sparkfinch, hearthhound, imp, cindercrab, qilin, solleo, phoenix];
