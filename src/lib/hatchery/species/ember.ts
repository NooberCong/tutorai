import type { Species } from "../kit.ts";
import { blush, eyes, stamp, twinkle, zzz } from "../kit.ts";
import type { Move } from "../motion.ts";
import { ease, flicker, pulse, rig, rise, sine, stepped } from "../motion.ts";
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

// ── motion helpers ──

/** A tongue's lick: it sways from its base on its own slow flicker, the
 *  wave running up to the tip, so neighbouring tongues never lick in step. */
const lick = (base: V, h: number, seed: number, turn = 7): Move => ({ at: base, wave: flicker(1, seed), turn, bend: h, lag: 0.2 });

/** `fire()` with each of its three tongues licking on its own flicker (the
 *  base stays put), and every shape riding `carry` after. */
const litFire = (x: number, y: number, h: number, w: number, lean: number, seed: number, turn: number, carry: Move[] = []): Prim[] => {
  const [base, mid, left, right] = fire(x, y, h, w, lean);
  rig([lick([x, y - w * 0.3], h - w * 0.3, seed, turn)], mid);
  rig([lick([x - w * 0.62, y - w * 0.5], h * 0.55, seed + 1, turn)], left);
  rig([lick([x + w * 0.62, y - w * 0.5], h * 0.68, seed + 2, turn)], right);
  return rig(carry, base, mid, left, right);
};

/** The act's envelope: 0 at both ends, so the act meets the idle loop. */
const envelope = (a: number, up: [number, number] = [0.08, 0.35], down: [number, number] = [0.62, 0.9]) =>
  a < 0 ? 0 : ease(up[0], up[1])(a) * (1 - ease(down[0], down[1])(a));

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
  // A breath swelling the body, the head following a beat later, the tail
  // swaying with its flame licking at the tip, one ear easing back now and
  // then. Its act: it lifts its tail-lamp up over its head to light the
  // page, the flame held steady while it tilts its head to look, then
  // lowers it again.
  motion: { idle: 3.2, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const lamp = envelope(a, [0.06, 0.4], [0.62, 0.94]);
    const calm = pose === "sleep" ? 0.4 : 1;
    // Held up, the flame burns steadier.
    const steady = calm * (1 - 0.6 * lamp);
    const breath = stepped(rise(1));
    /** Head + pear body + feet as one mass (no leg stripes), cream tummy;
     *  the head shape rides `head`. */
    const body = (hy: number, hr: V, by: number, br: V, feet: number, tum: V, head: Move[]): Part => ({
      mat: "fur", prims: [...rig(head, ell(16, hy, hr[0], hr[1])), ell(16, by, br[0], br[1]), ...both(ell(16 - feet, 29.4, 1.9, 1.1))], blend: 2,
      paint: [{ mat: "cream", prims: [ell(16, by + 0.6, tum[0], tum[1])], level: 4 }],
    });
    const ears = (x: number, y: number, r: number): Part => ({
      mat: "fur", prims: both(ell(x, y, r)), paint: [{ mat: "ear", prims: both(ell(x + 0.2, y + 0.3, r * 0.6)) }],
    });
    /** The left ear eases back about its base once a loop. */
    const flick = (x: number, y: number): Move => ({ at: [x, y], wave: pulse(pose === "sleep" ? 0.7 : 0.45, 0.3), turn: -12 * calm, side: "left" });
    const nose = (y: number) => stamp(15, y, ["nn"], { n: "ear:2" });
    /** The tail sways from its root, a wave running out to the flame; in
     *  the act it draws up, raising the lamp `lift` px. */
    const tail = (root: V, len: number, tall: number, lift: number): Move[] => [
      { at: root, wave: sine(1, 0.3), turn: 5 * calm * (1 - lamp), bend: len, lag: 0.3 },
      { at: root, wave: () => lamp, grow: [0, lift / tall] },
    ];
    /** The flame rides the tail's sway, and rises with its tip. */
    const held = (sway: Move[], lift: number): Move[] => [sway[0], { at: [0, 0], wave: () => lamp, shift: [0, -lift] }];
    if (stage === 0) {
      // One blob: it swells as a whole, everything on it riding along.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.08] };
      const sway = tail([20, 28.5], 8, 4.5, 2);
      parts.push(
        ...rig(sway, { mat: "fur", prims: [path([[20, 28.5], [24.5, 28.8], [26.5, 26.5], [26.5, 24]], 1, 0.8)], back: true }),
        flame(litFire(26.5, 24, 5, 1.4, 0.4, 0, 7 * steady, held(sway, 2))),
        ...rig([flick(11.6, 20.4), swell], ears(10.8, 18.6, 2.6)),
        ...rig([swell], { mat: "fur", prims: [ell(16, 24.2, 6.6, 5.9)], paint: [{ mat: "cream", prims: [ell(16, 29, 3.4, 1.8)], level: 4 }] }),
      );
      const glance: Move = { at: [16, 22], wave: () => lamp, shift: [1, 0] };
      decals.push(...rig([glance, swell], ...eyes([12, 22], [18, 22], pose, "tall"), nose(25)), ...rig([swell], ...blush([10, 25], [20, 25])));
      if (pose === "sleep") decals.push(zzz(21, 11));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    // The head rides the breath a beat behind the body; in the act the
    // face turns a pixel toward the lamp.
    const lift: Move = { at: [16, 21], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const glance: Move = { at: [16, 16], wave: () => lamp, shift: [1, 0] };
    const head = [lift];
    if (stage === 1) {
      const sway = tail([21, 28.5], 9, 6.5, 2);
      parts.push(
        ...rig(sway, { mat: "fur", prims: [path([[21, 28.5], [25.5, 28.8], [27.8, 25.5], [27.3, 22]], 1.1, 0.8)], back: true }),
        flame(litFire(27.3, 22, 7.5, 1.8, 0.2, 0, 7 * steady, held(sway, 2))),
        ...rig([flick(10.8, 16.4), ...head], ears(9.6, 13.6, 3.7)),
        body(19, [7, 6], 25.4, [6.2, 4.2], 3.2, [3, 2.8], head),
      );
      decals.push(...rig([glance, ...head], ...eyes([12, 18], [18, 18], pose, "tall"), nose(21)), ...rig(head, ...blush([10, 21], [20, 21])));
    } else {
      const sway = tail([21.5, 29], 11, 6.5, 2);
      const flames = [
        ell(28, 21.6, 2.6, 2.3),
        ...rig([lick([28, 22], 14, 0, 6 * steady)], path([[28, 22], [28.4, 18], [27.2, 14], [27.6, 10.5], [29, 8]], 2.5, 0.45)),
        ...rig([lick([26, 21], 6.5, 1, 7 * steady)], tongue(26, 21, 6.5, 1.1, -2.2)),
        ...rig([lick([30, 21], 7.5, 2, 7 * steady)], tongue(30, 21, 7.5, 1, 1)),
      ];
      parts.push(
        ...rig(sway, { mat: "fur", prims: [path([[21.5, 29], [26.5, 28.8], [28.8, 25.5], [28.2, 22.5]], 1.4, 0.9)], back: true }),
        flame(rig(held(sway, 2), ...flames)),
        ...rig([flick(10.6, 13), ...head], ears(9.2, 9.8, 4.4)),
        body(15.4, [7.8, 6.4], 25, [7, 4.8], 3.8, [3.8, 3.2], head),
      );
      decals.push(
        ...rig([glance, ...head], ...eyes([12, 14], [18, 14], pose, "tall")),
        ...rig(head, stamp(9, 18, ["fg"], { f: "flame:4", g: "flame:5" }), stamp(21, 18, ["gf"], { f: "flame:4", g: "flame:5" })),
        ...rig([glance, ...head], nose(17), stamp(14, 18, ["k..k", ".kk."], { k: "fur:1" })),
      );
    }
    if (pose === "sleep") decals.push(zzz([21, 23, 14][stage], [11, 5, 0][stage]));
    return { parts, decals, head, neck: [] };
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
  // Each flame tongue licks on its own slow flicker, the head rises on a
  // calm breath, the tail sways. Its act: the flames draw up a little
  // taller and its spots brighten as it closes its eyes, then settle.
  motion: { idle: 3, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const glow = a < 0 ? 0 : ease(0.08, 0.35)(a) * (1 - ease(0.65, 0.92)(a));
    const look = glow > 0.4 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.5 : 1;
    const breath = stepped(rise(1));
    const smile = (x: number, y: number) => stamp(x, y, ["k..k", ".kk."], { k: "skin:1" });
    /** A flame tongue that licks: it sways from its base on its own
     *  flicker, the wave running up to the tip; in the act it draws up. */
    let seed = 0;
    const lick = (x: number, y: number, h: number, w: number, lean = 0): Prim =>
      rig([
        { at: [x, y], wave: flicker(1, seed++), turn: 7 * calm, bend: h, lag: 0.2 },
        { at: [x, y], wave: () => glow, grow: [0, 0.3] },
      ], tongue(x, y, h, w, lean))[0];
    const sway = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.35), turn: 6 * calm, bend: len, lag: 0.3 });
    /** Its spots, bright as they glow in the act. */
    const spot = (x: number, y: number, ink = "flame:5") => glint(x, y, glow > 0.5 ? "#fff6d6" : ink);
    if (stage === 0) {
      const lift: Move = { at: [14, 22], wave: breath, grow: [0.02, 0.07] };
      parts.push(
        ...rig([sway([20, 27], 9)], { mat: "skin", prims: [path([[20, 27], [25, 28.4], [27.8, 26.6], [28.4, 24]], 1.9, 0.8)], back: true }),
        ...rig([lift], flame([lick(14.4, 18.6, 3.8, 1.1, 1.4)])),
        { mat: "skin", prims: [...rig([lift], ell(14.4, 23.8, 6.8, 5.6)), ell(19.6, 26.6, 4.4, 2.8), ell(10.6, 29.2, 1.8, 1), ell(18.8, 29.3, 1.7, 1)], blend: 2.5 },
      );
      decals.push(
        ...rig([lift], ...eyes([10, 21], [16, 21], look, "tall"), ...blush([8, 24], [18, 24]), smile(12, 24)),
        spot(20, 24), spot(23, 26),
      );
      if (pose === "sleep") decals.push(zzz(22, 13));
      return { parts, decals, head: [lift], neck: [] };
    }
    if (stage === 1) {
      const lift: Move = { at: [13.6, 24], wave: (u) => breath(u - 0.08), shift: [0, -1] };
      parts.push(
        flame([lick(18.4, 21.8, 3.6, 1.1, 1.4), lick(24.6, 22.8, 3.2, 1, 1.4)]),
        flame([lick(21.4, 22, 4.6, 1.2, 1.8)]),
        ...rig([sway([24, 26], 8)], { mat: "skin", prims: [path([[24, 26], [28, 26], [29.6, 22.8], [28.4, 20.4]], 2, 0.8)], back: true }),
        { mat: "skin", prims: [cap(24, 26.5, 24.6, 29.4, 1.5, 1.3)], back: true },
        { mat: "skin", prims: [...rig([lift], ell(13.6, 21.6, 6.6, 5)), ell(19.5, 25.6, 7, 3.8), cap(10.2, 25, 9.6, 29.2, 1.8, 1.5), cap(18, 26, 18, 29.2, 1.7, 1.5)], blend: 2.2 },
      );
      decals.push(
        ...rig([lift], ...eyes([9, 19], [15, 19], look, "tall"), ...blush([7, 22], [17, 22]), smile(11, 22)),
        spot(22, 25), spot(25, 26),
      );
      if (pose === "sleep") decals.push(zzz(24, 11));
      return { parts, decals, head: [lift], neck: [] };
    }
    const lift: Move = { at: [11.5, 24], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    parts.push(
      ...rig([lift], flame([lick(8.6, 15.6, 4.2, 1.2, 1.4), lick(14, 15.6, 4.8, 1.2, 2.2)])),
      flame([lick(21.5, 19.9, 4.6, 1.2, 1.8)]),
      ...rig([lift], flame([lick(11.2, 15, 6.8, 1.4, 2)])),
      flame([lick(18, 20, 3.8, 1.1, 1.6), lick(25, 20.8, 3.4, 1, 1.6)]),
      ...rig([sway([25, 25], 11)], { mat: "skin", prims: [path([[25, 25], [29, 23.2], [30, 19], [28, 15.5]], 2.3, 0.8)], back: true }),
      { mat: "skin", prims: [cap(25.5, 27, 27, 29, 1.6, 1.4), ell(27.4, 29.4, 1.8, 1)], back: true },
      { mat: "skin", prims: [...rig([lift], ell(11.5, 20.8, 6.8, 5)), ell(19, 25.3, 8.5, 4.1),
        cap(8.4, 25, 7.6, 28.8, 2, 1.6), ell(7, 29.3, 2, 1.1), cap(21, 26.5, 21.6, 28.8, 1.9, 1.6), ell(22.2, 29.3, 2, 1.1)], blend: 2 },
    );
    decals.push(
      ...rig([lift], ...eyes([7, 18], [14, 18], look, "round"), stamp(9, 22, ["k....k", ".kkkk."], { k: "skin:1" }), spot(5, 21, "flame:4"), spot(16, 21, "flame:4")),
      spot(18, 23), spot(21, 22), spot(24, 23), spot(27, 22), spot(22, 25), spot(25, 26),
    );
    if (pose === "sleep") decals.push(zzz(24, 6));
    return { parts, decals, head: [lift], neck: [] };
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
  // A slow breath, the head riding it a beat later, the torch of a tail
  // swaying with its flames licking, the ear flames flickering. Its act: a
  // happy wag, three easy swings of the tail while it tilts its head and
  // squints with pleasure, then settles.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const glad = envelope(a, [0.06, 0.3], [0.66, 0.94]);
    const look = glad > 0.55 ? "blink" : pose;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** The tail: an easy idle sway, and in the act three wags. */
    const wag = (root: V, len: number): Move[] => [
      { at: root, wave: sine(1, 0.2), turn: 5 * calm * (1 - glad), bend: len, lag: 0.3 },
      { at: root, wave: () => glad * Math.sin(Math.PI * 2 * 3 * a), turn: 9, bend: len, lag: 0.15 },
    ];
    // Nose, grin, and a little panting tongue.
    const face = (x: number, y: number) =>
      stamp(x, y, [".nn.", "k..k", ".tt."], { n: "eye:3", k: "fur:1", t: "blush:3" });
    /** Sitting body: head, chest, front legs as one mass; cream muzzle,
     *  chest and paws; a shadow seam between the legs instead of a part line.
     *  The head and muzzle ride `head`. */
    const sitter = (hy: number, hr: V, by: number, br: V, lx: number, ly: number, lr: number, head: Move[]): Part => ({
      mat: "fur", prims: [...rig(head, ell(16, hy, hr[0], hr[1])), ell(16, by, br[0], br[1]), ...both(cap(16 - lx, by, 16 - lx, ly, lr, lr))], blend: 3,
      paint: [
        { mat: "cream", prims: [...rig(head, ell(16, hy + hr[1] * 0.55, hr[0] * 0.5, hr[1] * 0.42)), ell(16, by - 0.4, br[0] * 0.5, br[1] * 0.62)], level: 4 },
        { mat: "cream", prims: both(ell(16 - lx, ly + lr * 0.4, lr, 0.9)), level: 4 },
        { mat: "fur", prims: [cap(16, by + br[1] * 0.35, 16, ly + lr, 0.5)], level: 1 },
      ],
    });
    if (stage === 0) {
      // One blob: it swells as a whole; the head tilts on it in the act.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.07] };
      const tilt: Move = { at: [16, 26], wave: () => glad, turn: 6 };
      const head = [tilt, swell];
      /** The floppy ears swing a little, a beat behind the breath. */
      const flop: Move = { at: [10.8, 17], wave: sine(1, 0.1), turn: 4 * calm, pair: true };
      const sway = wag([20, 27], 5);
      parts.push(
        ...rig(sway, { mat: "fur", prims: [path([[20, 27], [23, 26.2], [24.2, 24]], 1.3, 0.9)], back: true }),
        flame(rig([lick([24.4, 24.4], 2, 0, 9 * calm), ...sway], ell(24.4, 23.4, 1.1, 1.3)), { line: false }),
        { mat: "fur", prims: [...rig(head, ell(16, 21.4, 6.6, 5.8)), ell(16, 26.8, 5.2, 3.4), ...both(ell(13.4, 29.2, 1.8, 1.1))], blend: 3,
          paint: [{ mat: "cream", prims: [...rig(head, ell(16, 24.6, 3.2, 2.1)), ell(16, 28.4, 2.6, 1.6)], level: 4 }] },
        ...rig([flop, ...head], { mat: "fur", prims: both(cap(10.8, 17, 8.4, 21.4, 2, 1.6)) }),
        flame(rig([flop, ...head], ...both(ell(8.2, 22.2, 1.2, 1.1))), { line: false }),
      );
      decals.push(...rig(head, ...eyes([12, 19], [18, 19], look, "tall"), ...blush([10, 23], [20, 23]), face(14, 22)));
      if (pose === "sleep") decals.push(zzz(22, 11));
      return { parts, decals, head, neck: [swell] };
    }
    // The head rides the breath a beat behind the chest, and tilts in the act.
    const neck: V = stage === 1 ? [16, 20] : [16, 17.5];
    const lift: Move = { at: neck, wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const tilt: Move = { at: neck, wave: () => glad, turn: 5 };
    const head = [tilt, lift];
    /** Each ear flame licks on its own, riding the ear. */
    const earFlames = (x: number, y: number, h: number, w: number, lean: number) => {
      const [l, r] = both(tongue(x, y, h, w, lean));
      rig([lick([x, y], h, 3, 8 * calm)], l);
      rig([lick([32 - x, y], h, 5, 8 * calm)], r);
      return flame(rig(head, l, r), { line: false });
    };
    if (stage === 1) {
      const sway = wag([23.4, 25.6], 8);
      parts.push(
        flame(litFire(24.6, 25, 7.4, 1.5, 2, 0, 7 * calm, sway)),
        { mat: "fur", prims: both(ell(10.8, 27, 2.6, 2.6)), back: true },
        ...rig(head, { mat: "fur", prims: both(poly([[9.4, 13.8], [7.4, 8.6], [13.4, 10.8]], 1)) }),
        earFlames(9.8, 12.6, 5, 1.1, -1.4),
        sitter(15, [6.8, 5.8], 24, [5.6, 5], 3, 28.4, 1.6, head),
      );
      decals.push(...rig(head, ...eyes([12, 13], [18, 13], look, "tall"), ...blush([10, 17], [20, 17]), face(14, 16)));
    } else {
      const sway = wag([22.5, 26.5], 13);
      parts.push(
        flame(rig(sway,
          ...rig([lick([22.5, 26.5], 14, 0, 5 * calm)], path([[22.5, 26.5], [26, 24.5], [27.4, 20], [28.6, 13.5]], 2.2, 0.45)),
          ...rig([lick([25.5, 25], 6, 1, 7 * calm)], tongue(25.5, 25, 6, 1, 3)))),
        flame(rig([lick([24, 26.5], 4.4, 2, 7 * calm), ...sway], tongue(24, 26.5, 4.4, 1, 3.6))),
        { mat: "fur", prims: both(ell(10, 26.6, 3, 3.2)), back: true },
        ...rig(head, { mat: "fur", prims: both(poly([[9.2, 10.6], [9, 4.6], [14, 7.4]], 1)) }),
        earFlames(10.6, 9.6, 7.6, 1.3, -1),
        sitter(11.8, [6.8, 5.6], 22, [6.4, 6.2], 3.2, 28.2, 1.9, head),
        { mat: "obsidian", prims: [path([[10.8, 17.8], [16, 19.2], [21.2, 17.8]], 1.1)] },
        flame([ell(16, 21, 1.2, 1.4)], { line: false }),
      );
      decals.push(...rig(head, ...eyes([12, 10], [18, 10], look, "round"), face(14, 13)));
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 24][stage], [11, 4, 1][stage]));
    return { parts, decals, head, neck: [] };
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
  // A slow breath, the head riding it a beat later, the flame tail and the
  // mane licking, the hoof flames flickering low. Its act: one soft step,
  // the near forehoof lifting and setting down so gently its flames bloom
  // up around it, and where it stood a little ember-flower opens and fades.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    // The step: up, a held beat, down; then the bloom where it lands.
    const step = a < 0 ? 0 : ease(0.08, 0.26)(a) * (1 - ease(0.36, 0.5)(a));
    const bloom = a < 0 ? 0 : ease(0.46, 0.56)(a) * (1 - ease(0.66, 0.9)(a));
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    // Leaf ears: drooping on the fawn, perked up-and-out on the grown qilin.
    const ears = (hx: number, y: number, d: number, rx: number, tilt = 28): Part => ({
      mat: "hide", prims: [ell(hx - d, y, rx, 1.3, tilt), ell(hx + d, y, rx, 1.3, -tilt)],
      paint: [{ mat: "cream", prims: [ell(hx - d - 0.2, y + 0.1, rx * 0.55, 0.5, tilt), ell(hx + d + 0.2, y + 0.1, rx * 0.55, 0.5, -tilt)] }],
    });
    let seed = 0;
    /** Flame licks flaring up behind a hoof (drawn before the legs); they
     *  flicker low, and bloom up when the hoof sets down. */
    const licks = (x: number, h: number, carry: Move[] = [], blooms = false): Prim[] => {
      const up: Move[] = blooms ? [{ at: [x, 29.6], wave: () => bloom, grow: [0, 0.3] }] : [];
      return [
        ...rig([lick([x - 1.1, 29.6], h * 0.8, seed++, 6 * calm), ...up, ...carry], tongue(x - 1.1, 29.6, h * 0.8, 0.9, -1.3)),
        ...rig([lick([x + 1.1, 29.6], h, seed++, 6 * calm), ...up, ...carry], tongue(x + 1.1, 29.6, h, 0.9, 1.3)),
      ];
    };
    /** The glowing hoof itself (drawn after the legs). */
    const hoof = (x: number): Prim => ell(x, 29.4, 1.35, 0.95);
    /** The ember-flower opening where the hoof came down: a spark, the
     *  bloom, a spark, gone. */
    const flower = (x: number, y: number) => {
      if (a < 0.5 || a > 0.86) return;
      const k = (a - 0.5) / 0.36;
      decals.push(k < 0.2 || k > 0.8
        ? stamp(x + 1, y + 1, ["s"], { s: k < 0.2 ? "flame:4" : "gold:4" }, true)
        : stamp(x, y, [".p.", "pcp", ".p."], { p: "flame:3", c: "gold:5" }, true));
    };
    /** The tail flame sways from its root. */
    const tail = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.3), turn: 5 * calm, bend: len, lag: 0.3 });
    if (stage === 0) {
      const hx = 13;
      const lift: Move = { at: [hx, 24], wave: (u) => breath(u - 0.08), shift: [0, -1] };
      const head = [lift];
      // The fawn's step: the near leg draws up a pixel.
      const raise: Move = { at: [22.2, 26], wave: () => step, grow: [0, -1 / 3.2] };
      const hoofUp: Move = { at: [22.4, 29.6], wave: () => step, shift: [0, -1] };
      parts.push(
        flame(rig([lick([24, 24.5], 3.6, 0, 7 * calm), tail([21, 25], 5)], tongue(24, 24.5, 3.6, 1, 1.6))),
        { mat: "hide", prims: [ell(19.5, 24.8, 5, 3.2), cap(16, 26, 16, 29.2, 1.5, 1.3), ...rig([raise], cap(22.2, 26, 22.4, 29.2, 1.5, 1.3))], blend: 1.5,
          paint: [
            { mat: "cream", prims: [ell(18.5, 23, 0.7), ell(21, 22.6, 0.7), ell(23, 23.6, 0.7)] },
            { mat: "flame", prims: [ell(16, 29.6, 1.6, 0.8), ...rig([hoofUp], ell(22.4, 29.6, 1.6, 0.8))], level: 4 },
          ] },
        ...rig(head, ears(hx, 17.2, 5.6, 2.3)),
        ...rig(head, { mat: "hide", prims: [ell(hx, 18.8, 5.6, 5)], paint: [{ mat: "cream", prims: [ell(hx, 21.9, 2.4, 1.5)], level: 4 }] }),
        ...rig(head, { mat: "gold", prims: [cap(hx, 14.4, hx, 12.3, 1.3, 0.8)] }),
      );
      decals.push(...rig(head,
        ...eyes([hx - 4, 17], [hx + 2, 17], pose, "tall"),
        ...blush([hx - 6, 20], [hx + 4, 20]),
        stamp(hx - 1, 21, ["kk"], { k: "hide:1" }),
      ));
      flower(19, 28);
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head, neck: [] };
    }
    if (stage === 1) {
      const hx = 12;
      const lift: Move = { at: [hx, 17], wave: (u) => breath(u - 0.08), shift: [0, -1] };
      const head = [lift];
      // The step: the near foreleg draws up, its hoof and flames with it.
      const raise: Move = { at: [21.5, 23], wave: () => step, grow: [0, -2 / 6] };
      const hoofUp: Move = { at: [21.5, 29.4], wave: () => step, shift: [0, -2] };
      parts.push(
        flame(litFire(25.5, 21, 7, 1.5, 2, 0, 7 * calm, [tail([23, 22], 9)])),
        { mat: "hide", prims: [cap(15.5, 23, 15.5, 29, 1.35, 1.15), cap(23, 23, 23, 29, 1.35, 1.15)], back: true, round: 3 },
        { mat: "hide", prims: [ell(19, 21.5, 6.8, 3.8), cap(17, 19, 13, 14, 2.4, 2.2)], blend: 2,
          paint: [
            { mat: "gold", prims: [ell(19, 19, 0.7), ell(21.5, 19.2, 0.7), ell(24, 19.8, 0.7), ell(20.2, 20.8, 0.7), ell(22.8, 21, 0.7)] },
          ] },
        flame([...licks(13.5, 3.6), ...licks(21.5, 3.6, [hoofUp], true)]),
        { mat: "hide", prims: [cap(13.5, 23, 13.5, 29, 1.45, 1.25), ...rig([raise], cap(21.5, 23, 21.5, 29, 1.45, 1.25))], round: 3 },
        flame([hoof(13.5), ...rig([hoofUp], hoof(21.5))]),
        ...rig(head, ears(hx, 11.6, 5.4, 2.5)),
        ...rig(head, { mat: "gold", prims: [cap(hx - 2, 9, hx - 2.8, 6.2, 1, 0.7), cap(hx + 2, 9, hx + 2.8, 6.2, 1, 0.7)] }),
        ...rig(head, { mat: "hide", prims: [ell(hx, 13, 5.2, 4.6)], paint: [{ mat: "cream", prims: [ell(hx, 15.9, 2.4, 1.5)], level: 4 }] }),
      );
      decals.push(...rig(head,
        ...eyes([hx - 4, 12], [hx + 2, 12], pose, "tall"),
        ...blush([hx - 5, 15], [hx + 3, 15]),
        stamp(hx - 1, 16, ["kk"], { k: "hide:1" }),
      ));
      flower(17, 27);
      if (pose === "sleep") decals.push(zzz(24, 3));
      return { parts, decals, head, neck: [] };
    }
    const hx = 11;
    const lift: Move = { at: [hx, 15], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const head = [lift];
    const raise: Move = { at: [24, 22], wave: () => step, grow: [0, -2 / 7.2] };
    const hoofUp: Move = { at: [24, 29.4], wave: () => step, shift: [0, -2] };
    const antler: V[] = [[hx - 2, 6.5], [hx - 3.2, 3.6], [hx - 4.4, 1.2]];
    const tine: V[] = [[hx - 3.3, 3.9], [hx - 6.2, 3]];
    /** A mane ray licks from its root on the neck. */
    const mane = (cx: number, cy: number, deg: number, len: number, w: number, s: number): Prim =>
      rig([{ at: [cx, cy], wave: flicker(1, s), turn: 6 * calm, bend: len, lag: 0.25 }], ray(cx, cy, deg, 0, len, w, 1.8))[0];
    const sway = tail([26, 18.5], 12);
    parts.push(
      flame(rig([sway],
        ...rig([lick([26, 18.5], 12, 0, 4 * calm)], path([[26, 18.5], [28.6, 15.5], [28.2, 11.5], [30, 7]], 2, 0.45)),
        ...rig([lick([27, 18], 6, 1, 6 * calm)], tongue(27, 18, 6, 1.1, 3)))),
      { mat: "hide", prims: [cap(16, 22, 16, 29.2, 1.45, 1.25), cap(26, 22, 26, 29.2, 1.45, 1.25)], back: true, round: 3 },
      flame([mane(15.4, 9.6, -55, 7, 1.7, 2), mane(17.8, 12.4, -50, 6.5, 1.7, 3), mane(20.4, 15, -45, 5.5, 1.5, 4)]),
      { mat: "hide", prims: [ell(20.5, 19.8, 7.6, 4.4), cap(16.5, 17.5, hx + 1, 11.5, 3, 2.5)], blend: 2.5,
        paint: [
          { mat: "gold", prims: [
            ell(19.5, 17.4, 0.7), ell(22.1, 17.3, 0.7), ell(24.7, 17.7, 0.7),
            ell(20.8, 19.3, 0.7), ell(23.4, 19.4, 0.7), ell(26, 19.8, 0.7), ell(22.1, 21.3, 0.7), ell(24.7, 21.4, 0.7),
          ] },
        ] },
      flame([...licks(14, 4.6), ...licks(24, 4.6, [hoofUp], true)]),
      { mat: "hide", prims: [cap(14, 22, 14, 29.2, 1.55, 1.3), ...rig([raise], cap(24, 22, 24, 29.2, 1.55, 1.3))], round: 3 },
      flame([hoof(14), ...rig([hoofUp], hoof(24))]),
      ...rig(head, { mat: "gold", prims: [path(antler, 1, 0.7), path(tine, 0.8, 0.6), path(mx(hx, antler), 1, 0.7), path(mx(hx, tine), 0.8, 0.6)] }),
      ...rig(head, ears(hx, 7.6, 5, 2.5, -30)),
      ...rig(head, { mat: "hide", prims: [ell(hx, 10.5, 5.4, 4.7)], paint: [{ mat: "cream", prims: [ell(hx, 13.7, 2.5, 1.5)], level: 4 }] }),
    );
    decals.push(...rig(head,
      ...eyes([hx - 4, 9], [hx + 2, 9], pose, "round"),
      stamp(hx - 1, 13, ["kk"], { k: "hide:1" }),
      glint(hx, 7, "gold:5"),
    ));
    flower(18, 27);
    if (pose === "sleep") decals.push(zzz(24, 3));
    return { parts, decals, head, neck: [] };
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
  // A slow breath, the head riding it a beat later; the raised wings drift
  // a pixel on the breath with a wave running out through the feathers,
  // every flame feather licking on its own, the tail fan swaying, the
  // sparkles twinkling in turn. Its act: one slow, grand wingbeat, the
  // raised wings sweeping down and folding in a little as the tail fan
  // opens and the crest draws up, sparks twinkling at the bottom of the
  // stroke, then the wings rise back into their V.
  motion: { idle: 4, sleep: 6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    /** The wingbeat over act time u: up, then down, then back to rest,
     *  starting and ending still. */
    const stroke = (u: number) => {
      if (a < 0) return 0;
      const p = Math.min(1, Math.max(0, (u - 0.08) / 0.84));
      return Math.sin(2 * Math.PI * p) * Math.sin(Math.PI * p);
    };
    const open = envelope(a, [0.2, 0.42], [0.55, 0.85]);
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const beak = (x: number, y: number) => stamp(x, y, ["ll", "dd"], { l: "gold:4", d: "gold:2" });
    if (stage === 0) {
      // One round chick: it swells as a whole; its wing nubs flutter twice
      // in the act.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.07] };
      const flap: Move = { at: [10.4, 23], wave: (u) => (a < 0 ? 0 : -Math.sin(4 * Math.PI * u) * open), turn: 20, pair: true };
      const nub: Move = { at: [10.4, 23], wave: sine(1, 0.1), turn: 6 * calm, pair: true };
      parts.push(
        flame(litFire(16, 18.8, 5.5, 1.5, 0.3, 0, 7 * calm, [{ at: [16, 19], wave: () => open, grow: [0, 0.2] }, swell])),
        ...rig([swell], { mat: "plume", prims: [ell(16, 23.8, 6.6, 6), ell(10.2, 22.4, 1.5), ell(21.8, 22.4, 1.5)], blend: 1.5,
          paint: [{ mat: "cream", prims: [ell(16, 27.4, 3.8, 2.4)], level: 4 }] }),
        ...rig([nub, flap, swell], { mat: "plume", prims: both(ell(9.9, 25, 1.5, 2.5, 20)) }),
        { mat: "gold", prims: both(ell(13.6, 29.8, 1.4, 0.9)) },
      );
      decals.push(...rig([swell],
        ...eyes([12, 21], [18, 21], pose, "tall"),
        ...blush([10, 24], [20, 24]),
        beak(15, 24),
      ));
      if (pose === "sleep") decals.push(zzz(22, 13));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    if (stage === 1) {
      // The round body swells on the breath, the crest fire riding it.
      const swell: Move = { at: [16, 29], wave: breath, grow: [0.02, 0.06] };
      const wing: Move[] = [
        { at: [11, 19], wave: sine(1, 0.1), turn: 5 * calm, bend: 9, lag: 0.15, pair: true },
        { at: [11, 19], wave: stroke, turn: 12, bend: 9, lag: 0.08, pair: true },
      ];
      const [wl, wr] = both(tongue(6.2, 16.2, 6, 1.5, -2.6));
      rig([lick([6.2, 16.2], 6, 6, 7 * calm)], wl);
      rig([lick([25.8, 16.2], 6, 7, 7 * calm)], wr);
      parts.push(
        // The tail tongues stay still: they only show as a rim behind the body.
        flame([tongue(14.5, 27.5, 4.5, 1.2, -4), tongue(17.5, 27.5, 4.5, 1.2, 4)]),
        flame(litFire(16, 12.8, 7, 1.9, 0.4, 0, 7 * calm, [{ at: [16, 13], wave: () => open, grow: [0, 0.15] }, swell])),
        flame(rig(wing, wl, wr)),
        ...rig(wing, { mat: "plume", prims: both(path([[11, 19], [7.8, 18.6], [6.2, 16]], 2.4, 1.5)),
          paint: [{ mat: "rose", prims: both(ell(6.8, 16.8, 1.8, 1.8)) }] }),
        ...rig([swell], { mat: "plume", prims: [ell(16, 20, 6.6, 7.2), ell(16, 25.6, 5.4, 3.6)], blend: 3,
          paint: [{ mat: "cream", prims: [ell(16, 25, 4, 3.6)], level: 4 }] }),
        { mat: "gold", prims: both(ell(13.6, 29.6, 1.5, 0.9)) },
      );
      decals.push(...rig([swell],
        ...eyes([12, 17], [18, 17], pose, "tall"),
        ...blush([10, 20], [20, 20]),
        beak(15, 20),
      ));
      if (pose === "sleep") decals.push(zzz(24, 6));
      return { parts, decals, head: [swell], neck: [swell] };
    }
    // Wings raised in a V: a plume arm to the wrist, primaries fanning out
    // from it as long flame tongues, secondaries trailing below the arm.
    const shoulder: V = [13, 14];
    const wrist: V = [7.4, 7.6];
    const primaries: V[] = [[6, 1.6], [2.8, 2.6], [1.4, 5.8], [1.3, 9.8], [2.3, 13.6]];
    const secondaries: [V, V][] = [[[9.6, 10.4], [4.4, 17.4]], [[11.6, 12.6], [7.8, 19.6]]];
    const lift: Move = { at: [16, 13], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    // The wings drift on the breath; in the act they sweep down and fold in
    // a little (they already reach the canvas edges, so never out).
    const sweep = envelope(a, [0.1, 0.4], [0.5, 0.88]);
    const wing: Move[] = [
      { at: shoulder, wave: (u) => breath(u - 0.12), turn: 4 * calm, bend: 12, lag: 0, pair: true },
      { at: shoulder, wave: () => sweep, turn: -12, grow: [-0.14, -0.14], pair: true },
    ];
    let seed = 0;
    // Alternate feathers go in separate parts so each casts a thin
    // separation line on its neighbour: the fan reads as feathers. Each
    // licks from the wrist on its own flicker.
    const feather = (tip: V) => {
      const len = Math.hypot(tip[0] - wrist[0], tip[1] - wrist[1]);
      const [l, r] = both(path([wrist, tip], 1.9, 0.45));
      rig([lick(wrist, len, seed, 5 * calm)], l);
      rig([lick([32 - wrist[0], wrist[1]], len, seed++ + 0.5, 5 * calm)], r);
      return rig(wing, l, r);
    };
    const covert = ([p, q]: [V, V]) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const [l, r] = both(path([p, q], 1.8, 0.45));
      rig([lick(p, len, seed, 5 * calm)], l);
      rig([lick([32 - p[0], p[1]], len, seed++ + 0.5, 5 * calm)], r);
      return rig(wing, l, r);
    };
    /** The tail fan sways from its root; the outer plumes open in the act. */
    const sway: Move = { at: [16, 20], wave: sine(1, 0.3), turn: 3 * calm, bend: 10, lag: 0.3 };
    const fan: Move = { at: [16, 20], wave: () => sweep, turn: 6, bend: 10, pair: true };
    parts.push(
      // Tail: a fan of five plumes; alternating parts keep them separate.
      flame([...rig([sway, fan], ...both(path([[15.4, 20], [12, 24.4], [7.6, 27.8]], 2, 0.45))), ...rig([sway], path([[16, 20], [16, 25], [16, 30.4]], 2.3, 0.5))]),
      flame(rig([sway, fan], ...both(path([[15.6, 20], [13.8, 25], [11.8, 29.6]], 2, 0.45)))),
      flame([...primaries.filter((_, i) => i % 2 === 0).flatMap(feather), ...secondaries.flatMap(covert)]),
      flame(primaries.filter((_, i) => i % 2 === 1).flatMap(feather)),
      ...rig(wing, { mat: "plume", prims: both(path([shoulder, [10.2, 10.2], wrist], 3, 2.2)), blend: 1.5,
        paint: [{ mat: "rose", prims: both(ell(7.6, 8, 2.2, 2)) }] }),
      flame(rig([{ at: [16, 6], wave: () => open, grow: [0, 0.2] }, lift],
        ell(16, 5.8, 1.6, 1.2),
        ...rig([lick([16, 6], 5, 10, 6 * calm)], tongue(16, 6, 5, 1.2, 0.3)),
        ...rig([lick([14, 6.4], 4.2, 11, 7 * calm)], tongue(14, 6.4, 4.2, 1, -2.4)),
        ...rig([lick([18, 6.4], 4.2, 12, 7 * calm)], tongue(18, 6.4, 4.2, 1, 2.4))), { round: 1.3 }),
      { mat: "plume", prims: [...rig([lift], ell(16, 9, 4.2, 3.9)), ell(16, 16.5, 4.4, 5.6)], blend: 3,
        paint: [{ mat: "cream", prims: [ell(16, 17.5, 2.8, 3.8)] }] },
    );
    decals.push(
      ...rig([lift], ...eyes([13, 8], [17, 8], pose, "round"), beak(15, 11)),
      ...twinkle(26, 17, t, 0.1), ...twinkle(3, 18, t, 0.45), ...twinkle(23, 26, t, 0.75),
    );
    // Sparks shaken loose at the bottom of the stroke.
    if (a >= 0) decals.push(...twinkle(3, 1, a, 0.36, "#fff4c2", 0.26), ...twinkle(26, 2, a, 0.44, "#fff4c2", 0.26));
    if (pose === "sleep") decals.push(zzz(20, 0));
    return { parts, decals, head: [lift], neck: [] };
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
  // A slow breath lifting the head, its eye stalks drifting out of step,
  // the candle flame licking on its own. Its act: it stretches up toward
  // its candle, stalks leaning in to read by the light, while a bead of
  // fresh wax gathers under the rim and slides slowly down the candle.
  motion: { idle: 3.6, sleep: 5.4, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const reach = envelope(a, [0.06, 0.32], [0.66, 0.94]);
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    // Candle: a rounded wax column (x0..x1, top..bottom), a melted rim with
    // drips as its own part so each drip casts a line on the column, a wick.
    // In the act a bead of wax slips out from under the rim at `bx` and
    // slides down the column until the snail's foot hides it.
    const candle = (x0: number, x1: number, top: number, bot: number, drips: [number, number][], bx: number) => {
      const cx = (x0 + x1) / 2;
      parts.push({ mat: "wax", prims: [poly([[x0, top], [x1, top], [x1 + 0.6, bot], [x0 - 0.6, bot]], 0.6)], round: (x1 - x0) * 0.7 });
      if (a > 0.1 && a < 0.92) {
        // It swells out from under the rim, slides down, and soaks away at
        // the foot of the candle.
        const size: Move = { at: [bx, top], wave: () => 1 - ease(0.1, 0.24)(a) * (1 - ease(0.76, 0.9)(a)), grow: [-0.98, -0.98] };
        const fall: Move = { at: [bx, top], wave: () => ease(0.16, 0.84)(a), shift: [0, bot - 0.5 - top] };
        parts.push({ mat: "wax", prims: rig([size, fall], cap(bx, top - 0.5, bx, top + 0.9, 0.8, 1.15)), paint: [{ mat: "wax", prims: [ell(bx, top, 4, 4)], level: 5 }] });
      }
      parts.push(
        { mat: "wax", prims: [ell(cx, top + 0.3, (x1 - x0) / 2 + 0.7, 1.2), ...drips.map(([x, len]) => cap(x, top, x, top + len, 0.75, 1.05))],
          blend: 1.2, paint: [{ mat: "wax", prims: [ell(cx, top + 6, 12, 12)], level: 4 }] },
        { mat: "wick", prims: [cap(cx, top - 0.2, cx + 0.2, top - 1.6, 0.55)], line: false },
      );
    };
    /** Head rising from the foot, with two ball-tipped eye stalks. The head
     *  rides `head`; each stalk drifts on its own and leans in to read. */
    const snail = (hx: number, hy: number, hr: number, tail: number, stalk: number, head: Move[]) => {
      const s = stalk;
      const fy = 27.9;
      const stalkMoves = (b: V, phase: number): Move[] => [
        { at: b, wave: sine(1, phase), turn: 8 * calm },
        { at: b, wave: () => reach, turn: 14 },
        ...head,
      ];
      const lb: V = [hx - hr * 0.35, hy - hr * 0.7];
      const rb: V = [hx + hr * 0.35, hy - hr * 0.7];
      parts.push(
        { mat: "skin", prims: [
          ...rig(stalkMoves(lb, 0), cap(lb[0], lb[1], hx - hr * 0.6, hy - hr - s, 0.55), ell(hx - hr * 0.62, hy - hr - s, 1.05)),
          ...rig(stalkMoves(rb, 0.3), cap(rb[0], rb[1], hx + hr * 0.6, hy - hr - s, 0.55), ell(hx + hr * 0.62, hy - hr - s, 1.05)),
        ], blend: 0.6 },
        // One mass: a round head on a neck that flows into a foot tapering
        // back to the tail tip, so no plate-like slab.
        { mat: "skin", prims: [...rig(head, ell(hx, hy, hr, hr * 1.05)), path([[hx - hr * 0.7, fy - 0.2], [hx + hr, fy], [tail, fy + 0.4]], 2.1, 1.1)], blend: 3 },
      );
    };
    // The head rides the breath, and stretches up a pixel more in the act.
    const lift: Move = { at: [10, 22], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const stretch: Move = { at: [10, 22], wave: () => reach, shift: [0, -1] };
    const head = [stretch, lift];
    /** The candle flame licks on its own. */
    const burn = (x: number, y: number, h: number, w: number, lean: number) => flame(litFire(x, y, h, w, lean, 0, 6 * calm));
    if (stage === 0) {
      candle(16.6, 22.4, 20, 27, [[17.4, 3], [21.5, 1.8]], 19.6);
      parts.push(burn(19.5, 18.4, 4.6, 1.3, 0.3));
      snail(12, 23.6, 4.4, 25.5, 1.4, head);
      decals.push(...rig(head, ...eyes([9, 22], [13, 22], pose, "tall"), ...blush([8, 25], [14, 25], 1), stamp(11, 25, ["kk"], { k: "skin:1" })));
    } else if (stage === 1) {
      candle(15.8, 24.2, 15, 27, [[17, 4.6], [20.6, 2.2], [23.3, 3.4]], 22);
      parts.push(burn(20, 13.2, 6.6, 1.6, 0.4));
      snail(10.5, 22, 5, 28.4, 2, head);
      decals.push(...rig(head, ...eyes([7, 20], [12, 20], pose, "tall"), ...blush([6, 23], [13, 23], 1), stamp(9, 24, ["k.k", ".k."], { k: "skin:1" })));
    } else {
      candle(15, 26, 11, 27, [[16.3, 7.2], [18.8, 3], [22, 5], [24.9, 2.4]], 20.4);
      parts.push(
        { mat: "wax", prims: [ell(26.2, 27.2, 2.6, 1.3)], paint: [{ mat: "wax", prims: [ell(26, 26, 4, 2)], level: 4 }] },
        burn(20.5, 9.2, 8.2, 2, 0.5),
      );
      snail(9.8, 21, 5.8, 30, 2.4, head);
      decals.push(...rig(head, ...eyes([6, 19], [12, 19], pose, "tall"), ...blush([5, 22], [13, 22], 2), stamp(9, 23, ["k..k", ".kk."], { k: "skin:1" })));
    }
    if (pose === "sleep") decals.push(zzz([23, 26, 27][stage], [9, 4, 1][stage]));
    return { parts, decals, head, neck: [] };
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
  // A round little breath, the crest flames licking each on its own, the
  // tail flame swaying. Its act: a song. It puffs up its chest, lifts its
  // gaze, opens its beak with its eyes shut, its wings easing out, and one
  // bright note floats up beside it and fades.
  motion: { idle: 3.2, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const song = envelope(a, [0.08, 0.3], [0.62, 0.9]);
    // The chest puffs first, then the gaze lifts and the eyes close, then
    // the beak opens: one change at a time.
    const singing = song > 0.85;
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const beak = (x: number, y: number) =>
      singing ? stamp(x, y, ["bb", "kk", ".b"], { b: "flame:4", k: "eye:3" }) : stamp(x, y, ["bb", ".b"], { b: "flame:4" });
    const feet = (y: number) => stamp(13, y, ["f....f", "ff..ff"], { f: "flame:2" });
    /** The body ball with a warm robin breast, and folded wings tucked
     *  inside its silhouette whose last feathers glow like embers. The ball
     *  swells on the breath and puffs up for the song; the wings ease out
     *  from their tops as it sings. */
    const ball = (cy: number, rx: number, ry: number, swell: Move[]): Part[] => {
      const wx = rx * 0.76;
      const wy = cy + ry * 0.2;
      const ease_: Move = { at: [16 - wx, wy - ry * 0.4], wave: () => song, turn: 6, pair: true };
      return [
        ...rig(swell, { mat: "plume", prims: [ell(16, cy, rx, ry)],
          paint: [{ mat: "breast", prims: [ell(16, cy + ry * 0.42, rx * 0.5, ry * 0.44)], level: 4 }] }),
        ...rig([ease_, ...swell], { mat: "wing", prims: both(ell(16 - wx, wy, rx * 0.26, ry * 0.48, 12)),
          paint: [{ mat: "flame", prims: both(ell(16 - wx + 0.3, wy + ry * 0.42, rx * 0.3, ry * 0.18, 12)), level: 4 }] }),
      ];
    };
    /** Breath and the song's puff, about the ball's lowest point. */
    const swelling = (cy: number, ry: number): Move[] => [
      { at: [16, cy + ry], wave: breath, grow: [0.02, 1 / (2 * ry)] },
      { at: [16, cy + ry], wave: stepped(() => song), grow: [1 / (2 * ry), 1 / (2 * ry)] },
    ];
    /** The face lifts its gaze a pixel while it sings. */
    const gaze: Move = { at: [16, 16], wave: () => Math.max(0, 2 * song - 1), shift: [0, -1] };
    let seed = 0;
    /** A crest or tail tongue licking on its own flicker. */
    const tip = (x: number, y: number, h: number, w: number, lean: number, carry: Move[], turn = 7): Prim =>
      rig([lick([x, y], h, seed++, turn * calm), ...carry], tongue(x, y, h, w, lean))[0];
    /** The note: a spark rising beside the bird, then gone. */
    const note = (x: number, y: number) => {
      if (a < 0.3 || a > 0.72) return;
      const k = (a - 0.3) / 0.42;
      const ny = y - Math.round(4 * k);
      decals.push(k < 0.2 || k > 0.8 ? stamp(x + 1, ny + 1, ["s"], { s: "#fff4c2" }, true) : stamp(x, ny, [".s.", "sss", ".s."], { s: "#fff4c2" }, true));
    };
    const look = song > 0.7 ? "blink" : pose;
    let swell: Move[];
    if (stage === 0) {
      swell = swelling(24.4, 5.8);
      parts.push(
        flame([tip(16.2, 19.2, 3.6, 1, 1.4, swell)]),
        ...ball(24.4, 6.4, 5.8, swell),
      );
      decals.push(...rig([gaze, ...swell], ...eyes([12, 22], [18, 22], look, "tall")), ...rig(swell, ...blush([10, 25], [20, 25]), beak(15, 25)), feet(29));
      note(5, 20);
    } else if (stage === 1) {
      swell = swelling(21.4, 7);
      const sway: Move = { at: [21, 25], wave: sine(1, 0.3), turn: 6 * calm, bend: 5.4, lag: 0.3 };
      parts.push(
        flame([tip(21, 25, 5.4, 1.2, 4.6, [sway])]),
        flame([tip(14.8, 15, 3.4, 0.9, -0.4, swell), tip(17.8, 15, 3.4, 0.9, 2.6, swell)]),
        flame([tip(16.2, 14.6, 4.8, 1.1, 1.6, swell)]),
        ...ball(21.4, 7.4, 7, swell),
      );
      decals.push(...rig([gaze, ...swell], ...eyes([12, 18], [18, 18], look, "tall")), ...rig(swell, ...blush([10, 21], [20, 21]), beak(15, 21)), feet(28));
      note(4, 16);
    } else {
      swell = swelling(19.8, 8.2);
      const sway: Move = { at: [20, 24], wave: sine(1, 0.3), turn: 5 * calm, bend: 10, lag: 0.3 };
      parts.push(
        flame([rig([lick([20, 24], 10, 9, 4 * calm), sway], path([[20, 24], [24.4, 23.4], [27.4, 20], [28.6, 15.6]], 1.9, 0.45))[0]]),
        flame([tip(21, 25, 7.4, 1.3, 7, [sway]), tip(20, 23.4, 5, 1, 2.6, [sway])]),
        flame([tip(13.6, 12.4, 4.4, 1.1, -1, swell), tip(18.6, 12.4, 4.6, 1.1, 3.4, swell)]),
        flame([tip(16, 11.8, 7.2, 1.5, 1.8, swell)]),
        ...ball(19.8, 8.2, 8.2, swell),
      );
      decals.push(...rig([gaze, ...swell], ...eyes([12, 16], [18, 16], look, "round")), ...rig(swell, ...blush([10, 19], [20, 19]), beak(15, 19)), feet(28));
      note(3, 14);
    }
    if (pose === "sleep") decals.push(zzz([22, 24, 25][stage], [11, 6, 3][stage]));
    return { parts, decals, head: swell, neck: swell };
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
  // A breath with the head riding it a beat later, the bat wings lifting
  // lazily on it, the tail swaying with its spade a beat behind, the head
  // flame licking. Its act: a cheeky wink. It leans its head over, shuts
  // one eye, the wings perk up and the spade tail swirls, then it settles
  // as if nothing happened.
  motion: { idle: 3.4, sleep: 5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const sly = envelope(a, [0.08, 0.3], [0.62, 0.9]);
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    // A bat wing on the left (mirrored for the right), authored at full size
    // around the shoulder and scaled per stage: a leading edge up to the
    // wrist, then three finger tips with scalloped membrane between them.
    const WING: V[] = [
      [0, 0], [-4.5, -7.5], [-7, -9.5], [-9.4, -8.6], [-11, -5],
      [-8.4, -3.8], [-10, -0.6], [-7, -1.4], [-6.2, 2], [-4, 0.2], [-1.6, 2.6],
    ];
    const wing = (sx: number, sy: number, k: number): Prim[] =>
      both(poly(WING.map(([x, y]): V => [sx + x * k, sy + y * k]), 0.35));
    /** The wings lift lazily on the breath (only ever up: the tips already
     *  reach the canvas edge) and perk up in the act. */
    const flap = (sx: number, sy: number): Move[] => [
      { at: [sx, sy], wave: (u) => rise(1)(u - 0.1), turn: 6 * calm, pair: true },
      { at: [sx, sy], wave: () => sly, turn: 9, pair: true },
    ];
    /** The tail sways from its root, the spade a beat behind; in the act
     *  it swirls. */
    const swish = (root: V, len: number): Move[] => [
      { at: root, wave: sine(1, 0.2), turn: 6 * calm, bend: len, lag: 0.3 },
      { at: root, wave: (u) => (a < 0 ? 0 : sly * Math.sin(2 * Math.PI * 2 * u)), turn: 8, bend: len, lag: 0.2 },
    ];
    /** The tail's spade tip: a kite pointing up. */
    const spade = (x: number, y: number, r: number): Prim => poly([[x, y - r * 1.4], [x + r, y + 0.1], [x, y + r * 0.6], [x - r, y + 0.1]], 0.3);
    // A lopsided smirk with one fang: cheeky, not scary.
    const grin = (x: number, y: number) => stamp(x, y, ["k...k", ".kkk.", "...w."], { k: "eye:3", w: "white:4" });
    /** Eyes, the right one shut in a wink at the act's height. */
    const winking = (l: V, r: V, style: "tall" | "round") => {
      const open = eyes(l, r, pose, style);
      return sly > 0.45 ? [open[0], eyes(l, r, "blink", style)[1]] : open;
    };
    if (stage === 0) {
      // One blob: it swells as a whole; in the act it leans a pixel over.
      const swell: Move = { at: [16, 29], wave: breath, grow: [0.02, 0.08] };
      const lean: Move = { at: [16, 29], wave: () => sly, shift: [1, 0] };
      const sway = swish([19, 25.5], 6);
      parts.push(
        ...rig([...flap(12, 21), lean, swell], { mat: "wing", prims: wing(12, 21, 0.42) }),
        ...rig(sway, { mat: "skin", prims: [path([[19, 25.5], [23, 26.2], [24.4, 23.6]], 0.8, 0.7)], back: true }),
        ...rig(sway, { mat: "skin", prims: [spade(24.4, 22.8, 1.5)] }),
        ...rig([lean, swell], { mat: "horn", prims: both(cap(11.6, 17.4, 10.8, 15.2, 1.2, 0.7)) }),
        { mat: "skin", prims: [...rig([lean, swell], ell(16, 21.8, 6.4, 5.4)), ...both(ell(13.6, 26.8, 1.4, 1.1))], blend: 1.5 },
      );
      decals.push(...rig([lean, swell], ...winking([12, 19], [18, 19], "tall"), ...blush([10, 23], [20, 23]), grin(14, 22)));
      if (pose === "sleep") decals.push(zzz(24, 11));
      return { parts, decals, head: [lean, swell], neck: [swell] };
    }
    // The head rides the breath a beat behind the body, and leans a pixel
    // over in the act.
    const hy = stage === 1 ? 19 : 17;
    const lift: Move = { at: [16, hy], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const lean: Move = { at: [16, hy], wave: () => sly, shift: [1, 0] };
    const head = [lean, lift];
    /** The head flame licks on its own, riding the head. */
    const crown = (x: number, y: number, h: number, w: number, lean_: number) =>
      flame(rig([lick([x, y], h, 0, 8 * calm), ...head], tongue(x, y, h, w, lean_)));
    if (stage === 1) {
      const sway = swish([18, 23.4], 9);
      parts.push(
        ...rig(flap(12.4, 18.6), { mat: "wing", prims: wing(12.4, 18.6, 0.66) }),
        ...rig(sway, { mat: "skin", prims: [path([[18, 23.4], [23, 25.4], [26.2, 22.6], [25.8, 20]], 0.95, 0.75)], back: true }),
        ...rig(sway, { mat: "skin", prims: [spade(25.8, 19, 1.8)] }),
        { mat: "skin", prims: [ell(16, 21.6, 4, 3.8), ...both(cap(14.2, 23, 13.8, 26.2, 1.4, 1.3))], blend: 1.5 },
        crown(16, 9.8, 3.6, 1, 0.8),
        ...rig(head, { mat: "horn", prims: both(path([[11.8, 11.4], [10.4, 9.2], [10.8, 7.4]], 1.3, 0.6)) }),
        ...rig(head, { mat: "skin", prims: [ell(16, 14.6, 6.4, 5.4), ...both(ell(9.4, 14.4, 1.4, 0.9, -20))], blend: 1 }),
        { mat: "skin", prims: both(ell(11.9, 21, 1.3, 1.5)) },
      );
      decals.push(...rig(head, ...winking([12, 13], [18, 13], "tall"), ...blush([10, 17], [20, 17]), grin(14, 16)));
    } else {
      const sway = swish([18.5, 22.4], 12);
      parts.push(
        ...rig(flap(12.6, 16.4), { mat: "wing", prims: wing(12.6, 16.4, 1), paint: [{ mat: "wing", prims: both(path([[12.6, 16.4], [8.1, 8.9], [5.6, 6.9]], 0.6)), level: 4 }] }),
        ...rig(sway, { mat: "skin", prims: [path([[18.5, 22.4], [24, 25.6], [28, 22.8], [27.6, 18.6]], 1.15, 0.8)], back: true }),
        ...rig(sway, { mat: "skin", prims: [spade(27.6, 17.4, 2.2)] }),
        { mat: "skin", prims: [ell(16, 20.4, 4.6, 4.4), ...both(cap(14, 22.5, 13.4, 26.8, 1.6, 1.5))], blend: 1.5 },
        crown(16, 6.8, 4.8, 1.2, 1),
        ...rig(head, { mat: "horn", prims: both(path([[11.2, 8.4], [9.2, 5.6], [9.8, 2.8]], 1.6, 0.6)) }),
        ...rig(head, { mat: "skin", prims: [ell(16, 11.8, 7, 5.9), ...both(ell(8.4, 11.6, 1.9, 1.1, -22))], blend: 1 }),
        { mat: "skin", prims: both(ell(11.4, 19.8, 1.5, 1.8)) },
      );
      decals.push(...rig(head, ...winking([12, 10], [18, 10], "round"), ...blush([10, 13], [20, 13]), grin(14, 13)));
    }
    if (pose === "sleep") decals.push(zzz([24, 25, 25][stage], [11, 3, 0][stage]));
    return { parts, decals, head, neck: [] };
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
  // The crab breathes and its volcano rises and settles with it, the
  // claws easing open and shut out of step, the smoke drifting, the crater
  // fire licking. Its act: it raises both claws as its volcano puffs out a
  // little cloud of smoke that floats up and thins away.
  motion: { idle: 3.8, sleep: 5.5, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const cheer = envelope(a, [0.08, 0.32], [0.62, 0.9]);
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    /** Volcano shell: flared, slightly concave flanks and a flat crater lip. */
    const cone = (cx: number, top: number, bot: number, tw: number, bw: number): Prim => {
      const mid = top + (bot - top) * 0.62;
      const mw = tw + (bw - tw) * 0.5;
      return poly([[cx - tw, top], [cx + tw, top], [cx + mw, mid], [cx + bw, bot], [cx - bw, bot], [cx - mw, mid]], 0.7);
    };
    /** A little cloud of smoke: one big bump and two small ones. */
    const puff = (x: number, y: number, r: number): Prim[] => [ell(x, y - r * 0.3, r), ell(x - r * 1.1, y + r * 0.3, r * 0.75), ell(x + r * 1.1, y + r * 0.3, r * 0.75)];
    /** A pincer: a round palm with a V bite taken out, opening up-and-out.
     *  It eases open and shut about its wrist `w`, and lifts in the act. */
    const claw = (x: number, y: number, r: number, dir: 1 | -1, w: V, phase: number): Part => ({
      mat: "crab", prims: [ell(x, y, r, r * 0.9)],
      cut: [poly([[x + dir * 0.2, y - 0.2], [x + dir * r * 1.4, y - r * 1.2], [x + dir * r * 1.5, y - r * 0.1]])],
      move: [
        { at: w, wave: sine(1, phase), turn: -dir * 5 * calm },
        { at: w, wave: () => cheer, turn: -dir * 18, shift: [0, -1] },
      ],
    });
    const lava = (pts: V[], w = 0.6): Part => flame([path(pts, w, w * 0.8)], { line: false });
    const mouth = (x: number, y: number) => stamp(x, y, ["k.k", ".k."], { k: "crab:1" });
    /** The smoke drifts a pixel to and fro. */
    const drift = (phase: number): Move => ({ at: [16, 8], wave: sine(1, phase), shift: [1, 0] });
    /** The act's cloud: it swells out of the crater, floats up and away by
     *  (dx, dy), and thins to nothing. Drawn behind the shell. */
    const cloud = (x: number, y: number, dx: number, dy: number, r: number) => {
      if (a < 0.2 || a > 0.95) return;
      const size: Move = { at: [x, y], wave: () => 1 - ease(0.2, 0.42)(a) * (1 - ease(0.7, 0.92)(a)), grow: [-0.95, -0.95] };
      const rise_: Move = { at: [x, y], wave: () => ease(0.22, 0.9)(a), shift: [dx, dy] };
      parts.push({ mat: "smoke", prims: rig([size, rise_], ...puff(x, y, r)), blend: 1 });
    };
    // The body swells on the breath and lifts the shell with it, so a hat
    // on the crater and glasses on the eyes rise together.
    const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.1] };
    const heave: Move = { at: [16, 20], wave: breath, shift: [0, -1] };
    if (stage === 0) {
      cloud(16, 17.4, 2, -6, 1.1);
      parts.push(
        { mat: "crab", prims: [cap(11, 28, 9.3, 29.6, 0.9), cap(21, 28, 22.7, 29.6, 0.9)], back: true },
        ...rig([heave], { mat: "rock", prims: [cone(16, 17.8, 25.2, 2.6, 7.2)] }),
        ...rig([heave], flame([ell(16, 18, 2, 0.8)], { line: false })),
        ...rig([swell], { mat: "crab", prims: [ell(16, 26.4, 5.8, 3.4)] }),
        claw(9.4, 26, 1.8, -1, [11, 27], 0), claw(22.6, 26, 1.8, 1, [21, 27], 0.3),
      );
      decals.push(...rig([swell], ...eyes([12, 24], [18, 24], pose, "tall"), ...blush([10, 27], [20, 27]), mouth(15, 27)));
    } else if (stage === 1) {
      cloud(16, 12.8, -2, -6, 1.3);
      parts.push(
        ...rig([drift(0.1)], { mat: "smoke", prims: puff(19.6, 9, 1.4), blend: 1 }),
        { mat: "crab", prims: [cap(9, 26, 6.2, 29.6, 1), cap(23, 26, 25.8, 29.6, 1)], back: true },
        ...rig([heave], { mat: "rock", prims: [cone(16, 13.4, 23.6, 3, 9.6)] }),
        ...rig([heave], flame([ell(16, 13.6, 2.4, 0.9)], { line: false })),
        ...rig([heave], lava([[14.6, 14.4], [14, 16.6], [14.4, 18.6]])),
        ...rig([swell], { mat: "crab", prims: [ell(16, 25, 6.8, 4)] }),
        claw(7.2, 23.6, 2.5, -1, [10, 25.5], 0), claw(24.8, 24.4, 2, 1, [22.6, 25.6], 0.3),
      );
      decals.push(...rig([swell], ...eyes([12, 22], [18, 22], pose, "tall"), ...blush([10, 25], [20, 25]), mouth(15, 25)));
    } else {
      cloud(18, 9, 4, -4, 1.4);
      parts.push(
        ...rig([drift(0.1)], { mat: "smoke", prims: puff(8.6, 5, 1.7), blend: 1 }),
        ...rig([drift(0.6)], { mat: "smoke", prims: puff(24, 3.6, 1.3), blend: 1 }),
        flame(litFire(16, 9.8, 8.6, 2.2, 0.3, 0, 6 * calm, [heave])),
        { mat: "crab", prims: [cap(8, 25, 3.4, 29.4, 1.1), cap(10, 26.5, 7.4, 29.6, 1), cap(24, 25, 28.6, 29.4, 1.1), cap(22, 26.5, 24.6, 29.6, 1)], back: true },
        ...rig([heave], { mat: "rock", prims: [cone(16, 9.8, 22.4, 3.8, 11.6)] }),
        ...rig([heave], flame([ell(16, 10, 3.4, 1)], { line: false })),
        ...rig([heave], lava([[13.6, 10.8], [12.8, 13.6], [13.4, 16.8]], 0.7)),
        ...rig([heave], lava([[18.8, 10.8], [19.6, 13.2]], 0.6)),
        ...rig([swell], { mat: "crab", prims: [ell(16, 23.6, 7.6, 4.6)] }),
        claw(5.8, 21.2, 3.2, -1, [9.4, 23.4], 0), claw(26.2, 23, 2.4, 1, [23, 24.4], 0.3),
      );
      decals.push(...rig([swell], ...eyes([12, 21], [18, 21], pose, "round"), ...blush([10, 24], [20, 24]), mouth(15, 24)),
        ...rig([heave], stamp(22, 7, ["g"], { g: "flame:4" }, true), stamp(10, 9, ["g"], { g: "flame:5" }, true)));
    }
    if (pose === "sleep") decals.push(zzz([24, 25, 26][stage], [12, 9, 11][stage]));
    return { parts, decals, head: [heave], neck: [swell] };
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
  // A slow breath with the head and its sun-mane riding it a beat later,
  // every ray licking on its own, the tail swaying with its flame, the
  // sparkles twinkling in turn. Its act: a sunrise. It lifts its chin and
  // its mane slowly wheels round and reaches out a little further, then
  // turns back and settles.
  motion: { idle: 3.8, sleep: 5.6, act: 1 },
  draw(stage, pose, t) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const a = pose === "act" ? (t ?? 0) : -1;
    const dawn = envelope(a, [0.08, 0.4], [0.6, 0.92]);
    const calm = pose === "sleep" ? 0.4 : 1;
    const breath = stepped(rise(1));
    const face = (x: number, y: number) => stamp(x, y, [".nn.", "k..k", ".kk."], { n: "gem:2", k: "fur:1" });
    let seed = 0;
    /** A ray licking from its root on its own flicker. */
    const lit = (cx: number, cy: number, deg: number, r0: number, len: number, w: number, curl: number): Prim => {
      const rad = (deg * Math.PI) / 180;
      const root: V = [cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0];
      return rig([lick(root, len, seed++, 6 * calm)], ray(cx, cy, deg, r0, len, w, curl))[0];
    };
    /** Straight, sharply tapered sun rays around (cx, cy). */
    const sun = (cx: number, cy: number, angles: number[], r0: number, len: number, w: number): Prim[] =>
      angles.map((d) => lit(cx, cy, d, r0, len, w, 0));
    /** The tail sways from its root; its flame tip rides it and licks. */
    const sway = (root: V, len: number): Move => ({ at: root, wave: sine(1, 0.3), turn: 6 * calm, bend: len, lag: 0.3 });
    if (stage === 0) {
      // One blob: it swells as a whole; in the act it lifts its chin and its
      // little crown of flames stretches up.
      const swell: Move = { at: [16, 30], wave: breath, grow: [0.02, 0.07] };
      const chin: Move = { at: [16, 24], wave: () => dawn, shift: [0, -1] };
      const crown: Move = { at: [16, 18.6], wave: () => dawn, grow: [0, 0.3] };
      const tail = sway([20.5, 27.5], 6);
      parts.push(
        flame(rig([crown, chin, swell],
          ...rig([lick([13.5, 18.6], 3, 0, 7 * calm)], tongue(13.5, 18.6, 3, 0.9, -1.4)),
          ...rig([lick([16, 18.2], 4, 1, 7 * calm)], tongue(16, 18.2, 4, 1, 0.3)),
          ...rig([lick([18.5, 18.6], 3, 2, 7 * calm)], tongue(18.5, 18.6, 3, 0.9, 1.6)))),
        ...rig([tail], { mat: "fur", prims: [path([[20.5, 27.5], [24, 27.6], [25, 25]], 0.8, 0.7)], back: true }),
        ...rig([swell], { mat: "fur", prims: [...rig([chin], ell(16, 23.4, 6.8, 5.8), ...both(ell(11, 18.8, 1.6))), ], blend: 1.5,
          paint: [{ mat: "cream", prims: rig([chin], ell(16, 25.6, 3, 1.8)), level: 4 }] }),
        { mat: "fur", prims: both(ell(13.4, 29.2, 1.6, 1)) },
        flame(rig([lick([25.2, 25.4], 2, 3, 9 * calm), tail], ell(25.2, 24.6, 1.1)), { line: false }),
      );
      decals.push(...rig([chin, swell], ...eyes([12, 21], [18, 21], pose, "tall"), ...blush([10, 24], [20, 24]), face(14, 24)));
      if (pose === "sleep") decals.push(zzz(24, 14));
      return { parts, decals, head: [chin, swell], neck: [swell] };
    }
    // The head and its mane ride the breath a beat behind the body, and the
    // chin lifts a pixel more at dawn.
    const lift: Move = { at: [16, 20], wave: (u) => breath(u - 0.08), shift: [0, -1] };
    const chin: Move = { at: [16, 20], wave: () => dawn, shift: [0, -1] };
    const head = [chin, lift];
    if (stage === 1) {
      // The rays wheel a step round the head and reach out at dawn.
      const wheel: Move[] = [
        { at: [16, 13], wave: () => dawn, turn: 12 },
        { at: [16, 13], wave: stepped(() => dawn), grow: [0.12, 0.12] },
      ];
      const rays = [-150, -120, -90, -60, -30, 0, 180].map((d) => lit(16, 13, d, 5.2, d === -90 ? 3.6 : 2.8, 1.2, 0.4));
      const tail = sway([20, 28], 7);
      parts.push(
        flame(rig([...wheel, ...head], ...rays)),
        ...rig(head, { mat: "mane", prims: [ell(16, 13.5, 7.2, 6.6)], glow: true }),
        ...rig([tail], { mat: "fur", prims: [path([[20, 28], [25, 28], [26.5, 24]], 0.9, 0.7)], back: true }),
        { mat: "fur", prims: [ell(16, 24, 5.4, 5.2), ...both(cap(13.4, 25, 13.2, 29.3, 1.4, 1.4))], blend: 2,
          paint: [{ mat: "cream", prims: [ell(16, 24, 2.6, 3)], level: 4 }] },
        flame(rig([lick([26.5, 24.4], 2.4, 3, 9 * calm), tail], ell(26.5, 23.4, 1.3)), { line: false }),
        ...rig(head, { mat: "fur", prims: [ell(16, 14, 5.8, 5), ...both(ell(11.2, 9.6, 1.8))], blend: 1.2,
          paint: [{ mat: "cream", prims: [ell(16, 16.6, 2.8, 1.8)], level: 4 }] }),
      );
      decals.push(...rig(head, ...eyes([12, 12], [18, 12], pose, "tall"), ...blush([10, 15], [20, 15]), face(14, 15), glint(16, 10, "gem:4")));
      if (pose === "sleep") decals.push(zzz(26, 3));
      return { parts, decals, head, neck: [] };
    }
    // The adult's sun already fills the canvas: it stays put (the head
    // breathes inside it) and only wheels round at dawn.
    const wheel: Move[] = [{ at: [16, 11.6], wave: () => dawn, turn: 10 }];
    const tail = sway([21, 28.4], 9);
    parts.push(
      flame(rig(wheel, ...sun(16, 11.6, [-60, 0, 60, 120, 180, 240], 7.4, 3.4, 1.6))),
      flame(rig(wheel, ...sun(16, 11.6, [-90, -30, 30, 90, 150, 210], 7.4, 4.6, 1.8))),
      { mat: "mane", prims: [ell(16, 11.6, 8.6, 8.2)], glow: true },
      ...rig([tail], { mat: "fur", prims: [path([[21, 28.4], [26, 28.4], [28.6, 24.8], [28, 21.6]], 1.1, 0.8)], back: true }),
      flame(rig([tail], ell(28, 20.6, 1.4, 1.6), ...rig([lick([28, 20.4], 3.4, 3, 9 * calm)], tongue(28, 20.4, 3.4, 0.9, 0.6))), { line: false }),
      { mat: "fur", prims: [ell(16, 23.8, 6.6, 6), ...both(cap(13, 24, 12.8, 29.3, 1.8, 1.8))], blend: 2,
        paint: [{ mat: "cream", prims: [ell(16, 23.4, 2.4, 3.4)], level: 4 }, { mat: "cream", prims: both(ell(12.8, 29.4, 1.8, 0.9)), level: 4 }] },
      ...rig(head, { mat: "fur", prims: [ell(16, 12, 6.4, 5.6), ...both(ell(10.4, 7.2, 1.9))], blend: 1.2,
        paint: [{ mat: "cream", prims: [ell(16, 15, 3, 1.8)], level: 4 }, { mat: "gem", prims: both(ell(10.4, 7.4, 0.9)) }] }),
    );
    decals.push(...rig(head, ...eyes([12, 11], [18, 11], pose, "round"), face(14, 13)));
    if (pose !== "sleep") decals.push(...twinkle(2, 22, t, 0.15), ...twinkle(27, 1, t, 0.6));
    if (pose === "sleep") decals.push(zzz(27, 0));
    return { parts, decals, head, neck: [] };
  },
};

export const EMBER: Species[] = [kindlemouse, cinderling, candlesnail, sparkfinch, hearthhound, imp, cindercrab, qilin, solleo, phoenix];
