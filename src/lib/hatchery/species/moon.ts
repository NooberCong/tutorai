import type { Species } from "../kit.ts";
import { blush, eyes, sparkle, stamp, zzz } from "../kit.ts";
import type { Decal, Part, Prim, V } from "../pixel.ts";
import { both, cap, ell, path, poly } from "../pixel.ts";

/** Five-point star polygon (points up). */
function star(cx: number, cy: number, r: number, round = 0.3, inner = 0.48): Prim {
  const pts: V[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const rr = i % 2 ? r * inner : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts, round);
}

/** Tiny 4-point twinkle stamp (a star spot on fur / skin). */
const twinkle = (x: number, y: number, ink: string): Decal =>
  stamp(x, y, [".s.", "sss", ".s."], { s: ink });

// ── Mooncat ──

export const mooncat: Species = {
  id: "mooncat",
  name: "Mooncat",
  element: "moon",
  tier: "common",
  stages: ["Crescent Kit", "Mooncat", "Lunar Tabby"],
  palette: { fur: "#aaaee2", cream: "#f2f0ff", moon: "#f8d266" },
  shiny: { fur: "#5b5fb4", cream: "#b4b8ee", moon: "#ffe79a" },
  lore: "Curls up on whichever page the moonlight lands on. Its crescent brightens a little each time you finish a chapter after midnight.",
  hint: "A sliver of silver on a sleepy brow.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const face = (ey: number, style: "tall" | "round", my: number) => {
      decals.push(...eyes([12, ey], [18, ey], pose, style), ...blush([10, ey + (style === "tall" ? 4 : 3)], [20, ey + (style === "tall" ? 4 : 3)]));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(stamp(15, ny, ["nn"], { n: "blush:2" }), stamp(14, ny + 1, ["k..k", ".kk."], { k: "fur:1" }));
      const moon = stage < 2 ? [".mm", "m..", ".mm"] : [".mm", "m..", "m..", ".mm"];
      decals.push(stamp(15, my, moon, { m: "moon:2" }));
    };
    const ears = (bx: number, by: number, h: number): Part => ({
      mat: "fur",
      prims: both(poly([[bx, by], [bx + 0.4, by - h], [bx + 4.8, by - h * 0.45]], 0.8)),
      paint: [{ mat: "blush", prims: both(poly([[bx + 1.3, by - 1.2], [bx + 1.4, by - h + 1.8], [bx + 3.6, by - h * 0.45 - 0.3]], 0)) }],
    });
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: [path([[21, 28], [24.5, 26.4], [25.2, 22.6]], 1.4, 1)], back: true },
        ears(9.2, 20, 7),
        { mat: "fur", round: 8, prims: [ell(16, 23, 7.5, 6.3)] },
        { mat: "fur", prims: both(ell(13, 29.2, 1.8, 1.2)) },
      );
      face(21, "tall", 17);
    } else if (stage === 1) {
      parts.push(
        { mat: "fur", prims: [path([[20, 28.4], [25, 27.4], [27, 22.8], [26, 19]], 1.7, 1.1)], back: true },
        { mat: "moon", glow: true, prims: [ell(25.8, 18.6, 1.3)] },
        ears(9, 14, 7.6),
        { mat: "fur", prims: [ell(16, 15, 7, 6), ell(16, 24, 5.8, 5.6)], blend: 3,
          paint: [{ mat: "cream", level: 4, prims: [ell(16, 21.4, 2.6, 2)] }] },
        { mat: "fur", round: 6, prims: both(ell(13.4, 28.8, 2, 1.4)) },
      );
      face(13, "tall", 9);
    } else {
      parts.push(
        { mat: "fur", prims: [path([[20.5, 28.6], [25.6, 28], [28.4, 23.4], [28, 17.6], [25.8, 14.4]], 2, 1.1)], back: true },
        { mat: "moon", glow: true, prims: [ell(25.4, 13.8, 1.7)] },
        ears(9.4, 10, 8),
        { mat: "fur", prims: [ell(16, 11, 7, 5.8), ell(16, 22.4, 6.2, 6.8), ...both(ell(11.8, 26.2, 3, 3.4))], blend: 3,
          paint: [{ mat: "cream", level: 4, prims: [ell(16, 18.6, 2.8, 2.4)] }] },
        { mat: "fur", round: 6, prims: both(ell(13.8, 28.9, 2.1, 1.5)) },
      );
      face(9, "tall", 5);
      decals.push(twinkle(19, 21, "moon:4"), stamp(10, 24, ["s"], { s: "moon:4" }), stamp(21, 25, ["s"], { s: "moon:4" }));
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
  },
};

// ── Lanternwisp ──

export const lanternwisp: Species = {
  id: "lanternwisp",
  name: "Lanternwisp",
  element: "moon",
  tier: "common",
  stages: ["Flicker", "Wickwisp", "Lanternwisp"],
  palette: { wisp: "#c2d8f8", flame: "#ffc45e", iron: "#8e84b4" },
  shiny: { wisp: "#f6c2e2", flame: "#86f0d6", iron: "#6f94b0" },
  lore: "A reading light that got lonely and went looking for readers. It hovers just over your shoulder so the page never goes dark.",
  hint: "Something small keeps the candle lit.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** A little hanging lantern: bail, cap, glowing pane, base. */
    const lantern = (x: number, y: number, s: number): Part[] => [
      { mat: "iron", prims: [path([[x - 1.3 * s, y + 0.6 * s], [x, y - 1.2 * s], [x + 1.3 * s, y + 0.6 * s]], 0.8)] },
      { mat: "flame", glow: true, prims: [poly([[x - 1.6 * s, y + 1.4 * s], [x + 1.6 * s, y + 1.4 * s], [x + 1.6 * s, y + 5 * s], [x - 1.6 * s, y + 5 * s]], 0.5)] },
      { mat: "iron", prims: [ell(x, y + 1.2 * s, 2.3 * s, 0.9), ell(x, y + 5.4 * s, 2.3 * s, 0.9)] },
    ];
    if (stage === 0) {
      parts.push(
        { mat: "wisp", round: 9, prims: [ell(16, 21.4, 6.6, 5.6), path([[16, 17], [17.8, 13.6], [20.2, 12]], 2.8, 0.9),
          path([[12.4, 24.6], [12, 27], [14.6, 27.6]], 1.4, 0.8)], blend: 2 },
        { mat: "flame", glow: true, prims: [ell(21, 11.2, 1.6, 2)] },
      );
      decals.push(...eyes([12, 19], [18, 19], pose, "tall"), ...blush([10, 23], [20, 23]));
      decals.push(stamp(15, 23, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "wisp", round: 10, prims: [ell(17, 16, 7.2, 6.6), path([[17, 11], [19, 7.6], [21.6, 6.4]], 2.8, 0.9),
          path([[17, 20], [16.6, 24.4], [19.4, 27], [23, 26]], 5.4, 0.8)], blend: 3 },
        { mat: "flame", glow: true, prims: [ell(22.4, 5.8, 1.5, 1.9)] },
        { mat: "wisp", prims: [path([[11, 19.2], [8.4, 19], [6.6, 17]], 1.3, 1)] },
        ...lantern(6, 18, 1.05),
      );
      decals.push(...eyes([13, 14], [19, 14], pose, "tall"), ...blush([11, 18], [21, 18]));
      decals.push(stamp(16, 18, ["kk"], { k: "eye:3" }));
    } else {
      parts.push(
        { mat: "wisp", round: 12, prims: [ell(17, 14.6, 8, 7.2), path([[17, 9.4], [19.4, 5.4], [22.6, 3.8]], 3.6, 1),
          path([[18, 19], [17.6, 24.4], [20.8, 27.6], [25.4, 26.6], [26.8, 24]], 6.4, 0.9)], blend: 3 },
        { mat: "flame", glow: true, prims: [ell(23.6, 3.4, 1.7, 2.1)] },
        { mat: "wisp", prims: [path([[10.4, 18], [8, 17.6], [6.2, 14.4]], 1.6, 1.1)] },
        ...lantern(5.8, 15.6, 1.4),
      );
      decals.push(...eyes([13, 13], [19, 13], pose, "tall"), ...blush([11, 17], [21, 17]));
      decals.push(stamp(15, 17, ["k..k", ".kk."], { k: "eye:3" }));
    }
    if (pose === "sleep") decals.push(zzz(stage === 0 ? 25 : 26, stage === 0 ? 4 : 10));
    return { parts, decals };
  },
};

// ── Jackalope ──

export const jackalope: Species = {
  id: "jackalope",
  name: "Jackalope",
  element: "moon",
  tier: "rare",
  stages: ["Budlope", "Tinelope", "Jackalope"],
  palette: { fur: "#dcb994", cream: "#f8eedc", antler: "#d6d0f0", star: "#a8e6ff" },
  shiny: { fur: "#7274c0", cream: "#cfd2f4", antler: "#ffe0a0", star: "#ff9edc" },
  lore: "Said not to exist, which suits it: it only reads books nobody believes in. Each tine of its antlers holds one star it borrowed from the margins.",
  hint: "Rabbit ears, and something branching between them.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const ears = (cx: number, cy: number, rx: number, ry: number, rot: number): Part => ({
      mat: "fur",
      prims: both(ell(cx, cy, rx, ry, rot)),
      paint: [{ mat: "blush", prims: both(ell(cx + 0.2, cy + 0.2, rx * 0.42, ry * 0.7, rot)) }],
    });
    const face = (ey: number, style: "tall" | "round") => {
      decals.push(...eyes([12, ey], [18, ey], pose, style), ...blush([10, ey + (style === "tall" ? 4 : 3)], [20, ey + (style === "tall" ? 4 : 3)]));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(stamp(15, ny, ["nn"], { n: "blush:2" }), stamp(15, ny + 1, ["kk"], { k: "fur:1" }));
    };
    if (stage === 0) {
      parts.push(
        { mat: "fur", prims: both(ell(13, 29.2, 2.2, 1.2)), back: true },
        ears(11, 15.6, 1.9, 4.4, -18),
        { mat: "antler", prims: both(cap(14, 18.2, 13.4, 15.8, 1, 0.9)) },
        { mat: "fur", round: 8, prims: [ell(16, 23.4, 7, 6)] },
      );
      face(21, "tall");
    } else if (stage === 1) {
      parts.push(
        ears(9.6, 11.2, 1.9, 5, -34),
        { mat: "antler", prims: both(path([[14.2, 11], [13.2, 7.6], [11.4, 5.4]], 1.1, 0.85)),
          paint: [{ mat: "star", level: 4, prims: both(ell(11.2, 5.2, 1.2)) }] },
        { mat: "fur", prims: [ell(16, 16, 7, 6), ell(16, 24.6, 6, 5), ...both(ell(11.8, 26.4, 2.6, 2.6))], blend: 4,
          paint: [{ mat: "cream", level: 4, prims: [ell(16, 23.4, 2.8, 2.6)] }] },
        { mat: "fur", round: 6, prims: both(ell(12.8, 29.2, 2.4, 1.2)) },
      );
      face(14, "tall");
      decals.push(sparkle(10, 4, "star:4"), sparkle(19, 4, "star:4"));
    } else {
      parts.push(
        ears(7.8, 11.6, 2, 4.8, -42),
        { mat: "antler", prims: [
          ...both(path([[14.4, 9.6], [12.8, 6], [9.6, 3.8], [5.6, 3.2]], 1.3, 0.85)),
          ...both(path([[12.9, 6.6], [13.2, 2.6]], 0.95, 0.8)),
          ...both(path([[9.6, 3.9], [9.2, 1.6]], 0.9, 0.8)),
        ], paint: [{ mat: "star", level: 4, prims: [...both(ell(5.4, 3.2, 1.3)), ...both(ell(13.2, 2.2, 1.2)), ...both(ell(9.2, 1.2, 1.2))] }] },
        { mat: "fur", prims: [ell(16, 14.8, 7.2, 6), ell(16, 23.6, 7, 6), ...both(ell(11, 26, 2.8, 3))], blend: 4,
          paint: [{ mat: "cream", level: 4, prims: [ell(16, 22.8, 3.4, 3.2)] }] },
        { mat: "fur", round: 6, prims: both(ell(12, 29.3, 2.4, 1.2)) },
      );
      face(13, "round");
      decals.push(sparkle(3, 2, "star:4"), sparkle(26, 2, "star:4"));
      decals.push(stamp(13, 1, ["s"], { s: "star:5" }, true), stamp(18, 1, ["s"], { s: "star:5" }, true),
        stamp(9, 0, ["s"], { s: "star:5" }, true), stamp(22, 0, ["s"], { s: "star:5" }, true));
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 0 ? 5 : 12));
    return { parts, decals };
  },
};

/// ── Baku ──

export const baku: Species = {
  id: "baku",
  name: "Baku",
  element: "moon",
  tier: "epic",
  stages: ["Snoozlet", "Dozer", "Baku"],
  palette: { hide: "#9298e8", saddle: "#d8cff4", dream: "#f0a8f4", star: "#ffe07a" },
  shiny: { hide: "#eca0bf", saddle: "#5e5aa8", dream: "#98f0dc", star: "#fff3b0" },
  lore: "Eats bad dreams and leaves the good ones, like a careful editor. Falls asleep on open books and wakes up having read them.",
  hint: "It snacks on nightmares; you won't miss them.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Tapir authored at adult size, facing left; `s` shrinks it toward the
     *  ground point (16, 29.6). */
    const k = [0.62, 0.8, 1][stage];
    const P = (x: number, y: number): V => [16 + (x - 16) * k, 29.6 + (y - 29.6) * k];
    const E = (x: number, y: number, rx: number, ry = rx, rot = 0) => ell(...P(x, y), rx * k, ry * k, rot);
    const leg = (x: number) => cap(...P(x, 25), ...P(x, 28.6), 2.2 * k, 2.3 * k);
    parts.push(
      { mat: "hide", back: true, round: 7, prims: [leg(15.6), leg(23.4)] },
      // Chubby body: arched back rising to a round rump.
      { mat: "hide", round: 12, blend: 4, prims: [E(18.4, 21.4, 8.4, 6), E(24.4, 19.6, 5.8, 6.4)],
        paint: [
          { mat: "saddle", level: 3, prims: [E(26.6, 19.2, 6.4, 8.4, 10)] },
          { mat: "saddle", level: 4, prims: [E(25.6, 16.4, 5.8, 4.2, 10)] },
        ] },
      { mat: "hide", round: 7, prims: [leg(11.6), leg(26.2)] },
      // Big round head with a droopy trunk.
      { mat: "hide", round: 14, blend: 2, prims: [E(10.4, 15.6, 7, 6.4),
        path([P(5, 18.4), P(2.8, 20.6), P(2.4, 23.6)], 2.6 * k, 1.5 * k)] },
      { mat: "hide", prims: [E(5.6, 10, 2, 1.9), E(14.6, 9.6, 2, 1.9)],
        paint: [{ mat: "saddle", level: 4, prims: [E(5.5, 9.7, 1, 0.9), E(14.5, 9.3, 1, 0.9)] }] },
    );
    const [ex, ey] = P(6.4, 13.6).map(Math.round);
    const gap = stage === 0 ? 4 : 5;
    decals.push(...eyes([ex, ey], [ex + gap, ey], pose, "tall"));
    decals.push(...blush([ex - 1, ey + 4], [ex + gap + 1, ey + 4], stage === 0 ? 1 : 2));
    if (stage === 0) {
      parts.push({ mat: "dream", glow: true, prims: [ell(22.4, 16.4, 1.8)] });
    } else if (stage === 1) {
      parts.push({ mat: "dream", glow: true, prims: [ell(24.2, 8.2, 2.7)] }, { mat: "dream", glow: true, prims: [ell(20.4, 12.4, 1.3), ell(28.4, 12.2, 1.1)] });
      decals.push(stamp(23, 7, [".s.", "sss", ".s."], { s: "star:5" }));
    } else {
      parts.push(
        { mat: "dream", glow: true, prims: [ell(24.4, 5, 3)] },
        { mat: "dream", glow: true, prims: [ell(19.8, 8.6, 1.4), ell(28.6, 9.4, 1.6)] },
      );
      decals.push(
        stamp(23, 4, [".s.", "sss", ".s."], { s: "star:5" }),
        twinkle(24, 16, "star:3"), stamp(22, 21, ["s"], { s: "star:3" }), stamp(28, 22, ["s"], { s: "star:3" }),
      );
    }
    if (pose === "sleep") decals.push(stage === 0 ? zzz(26, 8) : zzz(15, stage === 2 ? 1 : 4));
    return { parts, decals };
  },
};

// ── Starwhale ──

const constellation = (x: number, y: number): Decal =>
  stamp(x, y, [
    "s.....",
    ".k...s",
    "..k.k.",
    "...s..",
  ], { s: "star:5", k: "body:5" });

export const starwhale: Species = {
  id: "starwhale",
  name: "Starwhale",
  element: "moon",
  tier: "legendary",
  stages: ["Starfry", "Skycalf", "Starwhale"],
  palette: { body: "#6679dc", belly: "#cfe6ff", fin: "#7cf0cf", aurora: "#e59cff", star: "#ffe38a" },
  shiny: { body: "#e08cbf", belly: "#fff0c8", fin: "#9fb4ff", aurora: "#fff09a", star: "#ffffff" },
  lore: "Swims the night sky, humming the constellations back into order. Every book finished anywhere adds one more star to its back.",
  hint: "A song beneath the stars, and it is swimming.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    if (stage === 0) {
      parts.push(
        { mat: "body", prims: [path([[20, 21], [23.5, 19], [25, 15.5]], 2.2, 1), ell(23.8, 14.3, 1.9, 1, -35), ell(26.3, 15.3, 1.8, 1, 40)],
          paint: [{ mat: "aurora", prims: [ell(26.6, 15.2, 1.2)] }] },
        { mat: "body", prims: [ell(16, 20.5, 7, 5.5)], paint: [{ mat: "belly", level: 3, prims: [ell(15.5, 26, 6, 3)] }, { mat: "belly", level: 4, prims: [ell(15.5, 25.2, 6, 2)] }] },
        { mat: "fin", glow: true, prims: [ell(8.6, 22.2, 2.3, 1.1, -25)] },
        { mat: "star", glow: true, prims: [star(15.5, 12, 2.6, 0.3)] },
      );
      decals.push(...eyes([12, 18], [18, 18], pose, "tall"), ...blush([10, 22], [20, 22]));
      decals.push(stamp(15, 22, ["k..k", ".kk."], { k: "body:1" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "body", prims: [path([[21, 20], [25.5, 17], [27, 12.5]], 3, 1.2), ell(25, 10.8, 2.5, 1.2, -40), ell(28.5, 11.8, 2.2, 1.1, 50)],
          paint: [{ mat: "aurora", prims: [ell(28.9, 11.9, 1.4)] }] },
        { mat: "fin", glow: true, back: true, prims: [ell(23.8, 21.5, 2.4, 1.1, 25)] },
        { mat: "body", prims: [ell(15, 18.5, 9.5, 6.5)], paint: [{ mat: "belly", level: 3, prims: [ell(14, 25.2, 8.5, 3.8)] }, { mat: "belly", level: 4, prims: [ell(14, 24.2, 8.5, 2.6)] }] },
        { mat: "fin", glow: true, prims: [ell(5.3, 21, 3.3, 1.5, -25)],
          paint: [{ mat: "aurora", prims: [ell(2.8, 22.5, 1.6)] }] },
        { mat: "star", glow: true, prims: [star(12, 9.4, 2.8, 0.3)] },
      );
      decals.push(...eyes([10, 17], [16, 17], pose, "tall"), ...blush([8, 21], [18, 21]));
      decals.push(stamp(12, 21, ["k..k", ".kk."], { k: "body:1" }));
      decals.push(constellation(15, 13), stamp(21, 16, ["s"], { s: "star:5" }));
    } else {
      parts.push(
        { mat: "body", prims: [path([[21, 16], [25.5, 11.5], [27, 6.5]], 4, 1.5), ell(24.8, 4.6, 2.9, 1.4, -35), ell(28.6, 5.4, 2.4, 1.2, 55)],
          paint: [{ mat: "aurora", prims: [ell(29.4, 5.8, 1.6), ell(22.6, 4, 1.4)] }] },
        { mat: "fin", glow: true, back: true, prims: [path([[22, 20], [26, 20.5], [29, 22.5]], 2.4, 1)],
          paint: [{ mat: "aurora", prims: [ell(28.5, 22.3, 1.8)] }] },
        { mat: "body", prims: [ell(15, 16.5, 11, 8.3)], paint: [{ mat: "belly", level: 3, prims: [ell(14, 25.4, 10, 5)] }, { mat: "belly", level: 4, prims: [ell(14, 24.2, 10, 3.2)] }] },
        { mat: "fin", glow: true, prims: [path([[7.5, 21.5], [4, 23], [1.8, 26]], 2.8, 1.2)],
          paint: [{ mat: "aurora", prims: [ell(2.2, 25.3, 2.3)] }] },
        { mat: "star", glow: true, prims: [star(9.5, 5.5, 3, 0.35)] },
      );
      decals.push(...eyes([9, 13], [16, 13], pose, "tall"), ...blush([7, 17], [18, 17]));
      decals.push(stamp(11, 17, ["k...k", ".kkk."], { k: "body:1" }));
      decals.push(
        constellation(17, 10),
        stamp(20, 17, ["s.", "..", ".s"], { s: "star:5" }),
        stamp(5, 12, ["s"], { s: "star:5" }),
        stamp(13, 11, ["s"], { s: "star:5" }),
        stamp(24, 15, ["s"], { s: "star:5" }),
        sparkle(1, 3, "star:5"), sparkle(28, 16), sparkle(0, 16, "fin:5"),
      );
      if (pose !== "sleep") decals.push(sparkle(15, 0));
      decals.push(
      );
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(16, 0) : zzz(26, 2));
    return { parts, decals };
  },
};

// ── helpers: thread / web lines as crisp 1px decals ──

/** True inside any of the given ellipses/paths grown by `pad` px — keeps
 *  web lines off the creature. */
function covered(prims: Prim[], x: number, y: number, pad = 1.2): boolean {
  for (const p of prims) {
    if (p.k === "ell") {
      const dx = (x - p.c[0]) / (p.r[0] + pad);
      const dy = (y - p.c[1]) / (p.r[1] + pad);
      if (dx * dx + dy * dy <= 1) return true;
    } else if (p.k === "path" || p.k === "cap") {
      const pts = p.k === "path" ? p.pts : [p.a, p.b];
      const r = (p.k === "path" ? Math.max(p.r0, p.r1) : Math.max(p.ra, p.rb)) + pad;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const ex = bx - ax;
        const ey = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
        if (Math.hypot(x - ax - ex * t, y - ay - ey * t) <= r) return true;
      }
    }
  }
  return false;
}

/** 1px lines (Bresenham) as one decal, skipping pixels near `hide`. */
function lines(segs: [V, V][], ink: string, hide: Prim[] = [], over = true): Decal {
  const g: string[][] = Array.from({ length: 32 }, () => Array(32).fill("."));
  for (const [a, b] of segs) {
    let x0 = Math.round(a[0]);
    let y0 = Math.round(a[1]);
    const x1 = Math.round(b[0]);
    const y1 = Math.round(b[1]);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < 32 && y0 < 32 && !covered(hide, x0 + 0.5, y0 + 0.5)) g[y0][x0] = "w";
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  return { x: 0, y: 0, rows: g.map((r) => r.join("")), inks: { w: ink }, over };
}

/** Points of a radial web: `spokes` rays and polygonal rings through them. */
function webPt(cx: number, cy: number, i: number, r: number, spokes: number, rot: number): V {
  const a = ((rot + (i * 360) / spokes) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}
function web(cx: number, cy: number, radii: number[], spokes: number, rot = 0): [V, V][] {
  const segs: [V, V][] = [];
  const R = radii[radii.length - 1];
  for (let i = 0; i < spokes; i++) segs.push([[cx, cy], webPt(cx, cy, i, R, spokes, rot)]);
  for (const r of radii) {
    for (let i = 0; i < spokes; i++) segs.push([webPt(cx, cy, i, r, spokes, rot), webPt(cx, cy, i + 1, r, spokes, rot)]);
  }
  return segs;
}

// ── Batling ──

/** Bat wings wrapped shut like a cloak: pointed wrists above the
 *  shoulders, a zig-zag hem at the finger tips, the left wing overlapping
 *  the right so a seam runs down the front. Authored at adult size around
 *  the bottom-center pivot (16, 30.8); `s` scales it for younger stages. */
function batCloak(s: number): Part[] {
  const P = (x: number, y: number): V => [16 + (x - 16) * s, 30.8 + (y - 30.8) * s];
  const left: V[] = [
    [4.4, 5.6], [4.6, 9.6], [3, 14.6], [2.8, 21], [3.4, 26.6], [4.6, 30.4], [7.8, 27.6], [10.8, 30.8],
    [13.8, 28], [17.6, 30.8], [17.8, 24], [15.6, 19.4], [11, 15], [7.6, 10.6],
  ];
  const r = 0.45;
  return [
    { mat: "wing", prims: [poly(left.map(([x, y]) => P(32 - x, y)), r)] },
    { mat: "wing", prims: [poly(left.map(([x, y]) => P(x, y)), r)] },
  ];
}

export const batling: Species = {
  id: "batling",
  name: "Duskwing",
  element: "moon",
  tier: "common",
  stages: ["Batling", "Flutterpuff", "Duskwing"],
  palette: { fur: "#b4a6ea", wing: "#7a58aa", fluff: "#f4dfb4" },
  shiny: { fur: "#f3c08e", wing: "#9c4f58", fluff: "#fff2d8" },
  lore: "Sleeps upside down between two tall books and wakes the moment you switch off the lamp. Wraps itself in its wings like a reader in a blanket.",
  hint: "A blanket with ears, waiting for dusk.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const ear = (base: V, tip: V, inner: V, w: number): Part => ({
      mat: "fur",
      prims: both(poly([[base[0] - w * 0.2, base[1]], tip, [base[0] + w, base[1] - w * 0.55]], 0.9)),
      paint: [{ mat: "blush", prims: both(poly([[base[0] + 0.6, base[1] - 1.2], [inner[0], inner[1]], [base[0] + w - 1.4, base[1] - w * 0.55 - 0.2]], 0)) }],
    });
    const face = (ey: number) => {
      decals.push(...eyes([12, ey], [18, ey], pose, "tall"), ...blush([10, ey + 4], [20, ey + 4]));
      decals.push(stamp(15, ey + 4, ["kk", "w."], { k: "eye:3", w: "white:4" }));
    };
    if (stage === 0) {
      parts.push(
        ear([10, 20.4], [8.4, 11.6], [9.6, 14.4], 5),
        ...batCloak(0.55),
        { mat: "fur", round: 8, prims: [ell(16, 22.6, 6.8, 5.8)] },
      );
      face(20);
    } else if (stage === 1) {
      parts.push(
        ear([10, 15.6], [8, 5.6], [9.2, 8.8], 5),
        ...batCloak(0.74),
        { mat: "fluff", line: false, prims: [ell(16, 22, 3.4, 1.8)], paint: [{ mat: "fluff", level: 4, prims: [ell(16, 21.6, 3.4, 1.6)] }] },
        { mat: "fur", round: 8, prims: [ell(16, 16.2, 6.8, 5.6)] },
      );
      face(15);
    } else {
      parts.push(
        ear([9.4, 11], [6.8, 2.2], [8.2, 5.4], 5.6),
        ...batCloak(1),
        { mat: "fluff", line: false, prims: [ell(16, 20.4, 4.4, 2.2)], paint: [{ mat: "fluff", level: 4, prims: [ell(16, 20, 4.4, 2)] }] },
        { mat: "fur", round: 9, prims: [ell(16, 13, 7.2, 6.2)] },
      );
      face(12);
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
  },
};

// ── Glowbug ──

export const glowbug: Species = {
  id: "glowbug",
  name: "Glowbug",
  element: "moon",
  tier: "common",
  stages: ["Glowgrub", "Blinkbug", "Glowbug"],
  palette: { shell: "#8293de", wing: "#a9c6f2", glow: "#dcf76c" },
  shiny: { shell: "#d97a98", wing: "#f2b6d2", glow: "#7ff2ff" },
  lore: "Blinks once for every line you read, and twice when you skip one. Bookworms who stay up late tend to collect a few.",
  hint: "A small lantern that found its own wings.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const antennae = (x0: number, y0: number, tip: V, r: number): Part[] => [
      { mat: "shell", line: false, prims: both(path([[x0, y0], [x0 - 1, (y0 + tip[1]) / 2 - 0.4], tip], 0.9, 0.8)) },
      { mat: "glow", glow: true, line: false, prims: both(ell(tip[0] - 0.4, tip[1] - 0.2, r)) },
    ];
    const face = (ey: number, style: "tall" | "round" = "tall") => {
      decals.push(...eyes([12, ey], [18, ey], pose, style), ...blush([10, ey + 4], [20, ey + 4]));
      decals.push(stamp(15, ey + 4, ["kk"], { k: "eye:3" }));
    };
    if (stage === 0) {
      parts.push(
        { mat: "glow", glow: true, prims: [ell(23, 25.8, 3.4, 3.1)] },
        { mat: "shell", prims: [ell(19.6, 26.4, 2.8, 2.6)] },
        { mat: "shell", round: 7, prims: [ell(15, 23.2, 6.4, 5.6)] },
        ...antennae(13, 18, [11.4, 14.8], 1),
      );
      decals.push(...eyes([11, 21], [17, 21], pose, "tall"), ...blush([9, 25], [19, 25]));
      decals.push(stamp(14, 25, ["kk"], { k: "eye:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "wing", glow: true, prims: both(cap(12, 15.4, 8, 10.6, 1.4, 3)) },
        { mat: "glow", glow: true, prims: [ell(16, 24, 4.6, 4.2)] },
        { mat: "shell", round: 8, prims: [ell(16, 16.4, 6.8, 5.8)] },
        ...antennae(13.6, 11.4, [10.6, 6.4], 1.2),
      );
      face(15);
    } else {
      parts.push(
        { mat: "wing", glow: true, prims: both(cap(12, 17.4, 6.6, 20, 1.4, 2.8)) },
        { mat: "wing", glow: true, prims: both(cap(11.6, 12.6, 5.8, 6.2, 1.8, 4)) },
        { mat: "glow", glow: true, prims: [ell(16, 23.4, 6.2, 5.2)] },
        { mat: "shell", prims: [ell(16, 18.2, 5, 2.2)] },
        { mat: "shell", round: 9, prims: [ell(16, 12.8, 7.4, 6.2)] },
        ...antennae(13.2, 7.2, [9.4, 2.4], 1.4),
      );
      face(11);
    }
    if (pose === "sleep") decals.push(stage === 2 ? zzz(26, 25) : zzz(25, 2));
    return { parts, decals };
  },
};

// ── Raven ──

export const raven: Species = {
  id: "raven",
  name: "Nightraven",
  element: "moon",
  tier: "rare",
  stages: ["Inkchick", "Quillraven", "Nightraven"],
  palette: { plume: "#5a64b0", beak: "#b9bcdc", key: "#f6cb5c" },
  shiny: { plume: "#dcd6f2", beak: "#7c78b0", key: "#7fd8ff" },
  lore: "Collects the keys to locked diaries and the last lines of unfinished poems. It will trade either for a good bookmark.",
  hint: "Clever dark feathers, and something that opens.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const eyeInk = "key:3";
    const star = (x: number, y: number) => stamp(x, y, ["s"], { s: "key:5" });
    if (stage === 0) {
      parts.push(
        { mat: "beak", prims: [cap(14, 27.5, 13.6, 29.8, 0.9), cap(17.4, 27.5, 17.8, 29.8, 0.9)] },
        { mat: "plume", round: 7, prims: [ell(16, 23.2, 7, 6.2), path([[17.5, 17.8], [19, 14.6]], 1.3, 0.8), path([[15.6, 17.6], [15.4, 14.8]], 1, 0.8)], blend: 1.5 },
        { mat: "plume", prims: [ell(21.4, 24.6, 2, 3.2, -25)] },
        { mat: "beak", prims: [poly([[13.2, 22], [9.4, 23.2], [8.2, 24.2], [9.6, 24.8], [13.2, 25.2]], 0.6)] },
      );
      decals.push(...eyes([11, 20], [16, 20], pose, "tall", eyeInk), stamp(18, 24, ["bb"], { b: "blush:3" }));
    } else if (stage === 1) {
      parts.push(
        { mat: "plume", back: true, prims: [poly([[16.5, 22], [20.5, 22], [24, 29.6], [19, 30]], 0.6)] },
        { mat: "beak", prims: [path([[13.6, 26], [13.2, 29.8], [11.4, 30]], 0.9), path([[17, 26], [17.2, 29.8], [15.4, 30]], 0.9)] },
        { mat: "plume", prims: [ell(15, 13.6, 5.6, 5), ell(16.4, 21.8, 5.8, 6.4, -8),
          path([[17.6, 9.6], [20.2, 7.2]], 1.2, 0.8), path([[11.6, 17], [12.2, 19.6]], 1.4, 0.8)], blend: 3 },
        { mat: "plume", prims: [path([[19, 16], [21, 21.6], [21.6, 27.6]], 3, 1)] },
        { mat: "beak", prims: [poly([[12.6, 12.4], [8.6, 13.4], [5.4, 15], [6.8, 15.8], [9.6, 16.2], [12.6, 16.4]], 0.6)] },
      );
      decals.push(...eyes([10, 11], [15, 11], pose, "round", eyeInk));
      decals.push(star(20, 20), star(15, 23), star(22, 25));
    } else {
      parts.push(
        { mat: "plume", back: true, prims: [poly([[17, 22], [22, 22], [26.4, 30.4], [20.4, 30.8]], 0.6)] },
        { mat: "beak", prims: [path([[14, 25.4], [13.4, 29.8], [11.2, 30]], 1), path([[18, 25.4], [18.4, 29.8], [16.2, 30]], 1)] },
        { mat: "plume", prims: [ell(15, 11, 6.2, 5.6), ell(16.6, 20.4, 6.8, 7.4, -8),
          path([[18.6, 6.6], [22, 3.8]], 1.5, 0.8), path([[16.4, 5.8], [17.8, 2.2]], 1.3, 0.8),
          path([[10.6, 15], [11, 18.8]], 1.6, 0.8), path([[13, 16], [13.8, 19.4]], 1.3, 0.8)], blend: 3 },
        { mat: "plume", prims: [path([[19.6, 13.8], [22.6, 20.4], [23.6, 27.8]], 3.6, 1)],
          paint: [{ mat: "plume", level: 4, prims: [path([[18.6, 14.2], [20.2, 18.2]], 0.9)] }] },
        { mat: "beak", prims: [poly([[12.4, 9.6], [8, 10.6], [3.6, 12.8], [4.4, 14], [8.4, 14.2], [12.4, 14.4]], 0.6)] },
      );
      decals.push(...eyes([9, 8], [15, 8], pose, "round", eyeInk));
      // The key, hanging from the beak tip by its bow.
      decals.push(stamp(3, 14, [".k.", "k.k", ".k.", ".k.", ".kk", ".k.", ".kk"], { k: "key:4" }));
      decals.push(twinkle(20, 19, "key:5"), star(15, 21), star(22, 25), star(18, 26), star(12, 19), sparkle(27, 11, "key:5"));
    }
    if (pose === "sleep") decals.push(zzz(25, 3));
    return { parts, decals };
  },
};

// ── Slumbersloth ──

export const slumbersloth: Species = {
  id: "slumbersloth",
  name: "Slumbersloth",
  element: "moon",
  tier: "rare",
  stages: ["Snugglet", "Drowsloth", "Slumbersloth"],
  palette: { fur: "#bca78f", mask: "#f3e8d2", bark: "#9c7c64", cap: "#7c9ef0", gold: "#ffd970" },
  shiny: { fur: "#d4d0ea", mask: "#fffaf2", bark: "#8a7fb4", cap: "#f08cb0", gold: "#8ff0ff" },
  lore: "Reads one sentence per night, very thoroughly. Has been on the same bedtime story for three years and loves every word.",
  hint: "Hangs on, nods off, never lets go.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    /** Cream mask with the drooping dark patches round the eyes. */
    const face = (cx: number, cy: number, s = 1) => [
      { mat: "mask", level: 4, prims: [ell(cx, cy + 0.4 * s, 5.4 * s, 4 * s)] },
      { mat: "bark", level: 1, prims: [ell(cx - 3.2 * s, cy + 0.9 * s, 2.5 * s, 1.3 * s, -28), ell(cx + 3.2 * s, cy + 0.9 * s, 2.5 * s, 1.3 * s, 28)] },
    ];
    const features = (ey: number, style: "tall" | "round") => {
      decals.push(...eyes([12, ey], [18, ey], pose, style));
      const ny = ey + (style === "tall" ? 3 : 2);
      decals.push(stamp(14, ny, ["k..k", ".kk."], { k: "bark:1" }));
    };
    /** Floppy nightcap: a cone flopping over to the right, cream brim, gold
     *  pompom. (cx, by) is the brim center; s scales it. */
    const nightcap = (cx: number, by: number, s: number): Part[] => {
      const P = (x: number, y: number): V => [cx + x * s, by + y * s];
      return [
        { mat: "cap", prims: [path([P(-4, -1), P(1, -4.4), P(6, -3.6), P(9, 0.4), P(9.8, 3.6)], 3.4 * s, 0.9)] },
        { mat: "mask", prims: [ell(...P(0, 0), 6.6 * s, 1.5 * s)] },
        { mat: "gold", prims: [ell(...P(10, 4.6), 1.7 * s)] },
      ];
    };
    if (stage === 0) {
      parts.push(
        { mat: "fur", round: 8, prims: [ell(16, 23.4, 7.4, 6.4)], paint: face(16, 22.6, 0.85) },
        { mat: "fur", prims: both(path([[9.8, 25.2], [12, 27.8], [14.4, 27.8]], 1.6, 1.3)) },
        ...nightcap(16, 18.2, 0.8),
      );
      features(21, "tall");
    } else if (stage === 1) {
      parts.push(
        { mat: "bark", prims: [path([[4.6, 6.4], [16, 5.6], [27.4, 6.2]], 1.3, 1.1)] },
        { mat: "fur", round: 9, prims: [ell(16, 20.6, 7.2, 7.4)], paint: face(16, 18.2, 0.9) },
        { mat: "fur", prims: both(path([[10.6, 18.6], [10.2, 12], [11.6, 7]], 1.8, 1.4)) },
        { mat: "mask", line: false, prims: both(path([[11.2, 5.6], [12.2, 4.6], [13.4, 5.2]], 0.8)) },
        { mat: "fur", prims: both(ell(12, 27.4, 2.2, 1.8)) },
        ...nightcap(16, 13.8, 0.8),
      );
      features(17, "tall");
    } else {
      parts.push(
        { mat: "bark", prims: [path([[2.4, 5.2], [10, 4.4], [22, 4.6], [29.6, 5.8]], 1.5, 1.2), path([[22.6, 4.6], [25.2, 2.4]], 0.9, 0.8)] },
        { mat: "fur", round: 10, prims: [ell(16, 19.4, 8.8, 9.2)],
          paint: [...face(16, 16.4), { mat: "gold", prims: [ell(15.6, 24.8, 2.6)], cut: [ell(17.1, 23.9, 2.2)] }] },
        { mat: "fur", prims: both(path([[9.4, 18.4], [9, 11], [10.8, 5.8]], 2.3, 1.7)) },
        { mat: "mask", line: false, prims: both(path([[10.2, 4.4], [11.4, 3], [13, 3.6]], 0.85)) },
        { mat: "fur", prims: both(ell(11.6, 28, 2.8, 2)) },
        ...nightcap(16, 11.2, 1),
      );
      features(15, "round");
    }
    if (pose === "sleep") decals.push(zzz(26, stage === 0 ? 5 : 20));
    return { parts, decals };
  },
};

// ── Starweaver ──

export const starweaver: Species = {
  id: "starweaver",
  name: "Starweaver",
  element: "moon",
  tier: "epic",
  stages: ["Spinlet", "Threadling", "Starweaver"],
  palette: { body: "#e79ab8", web: "#9cc4f0", star: "#ffe27a" },
  shiny: { body: "#6cc7b6", web: "#f0a8d8", star: "#fff0a0" },
  lore: "Weaves the constellations back together whenever the sky gets dog-eared. Reads by the light of its own web.",
  hint: "It mends the sky one thread at a time.",
  draw(stage, pose) {
    const parts: Part[] = [];
    const decals: Decal[] = [];
    const face = (ey: number) => {
      decals.push(...eyes([12, ey], [18, ey], pose, "tall"), ...blush([10, ey + 3], [20, ey + 3]));
      decals.push(stamp(13, ey - 2, ["k....k"], { k: "eye:3" }), stamp(15, ey + 3, ["kk"], { k: "eye:3" }));
    };
    if (stage === 0) {
      parts.push(
        { mat: "body", back: true, prims: both(path([[11.6, 23], [8.6, 21.8], [7, 25]], 1, 0.85)) },
        { mat: "body", prims: both(path([[11.6, 26.4], [9.2, 26.6], [8.6, 29.4]], 1, 0.85)) },
        { mat: "body", round: 12, prims: [ell(16, 24, 6.6, 5.8)] },
        { mat: "star", glow: true, prims: [star(16, 8.4, 2.6, 0.3)] },
      );
      decals.push(lines([[[16, 11], [16, 17]]], "web:4"));
      face(22);
    } else {
      // Sits in the middle of its web, legs splayed along the threads.
      const k = stage === 2 ? 1 : 0.74;
      const cx = 16;
      const cy = stage === 2 ? 18.4 : 20;
      const P = (x: number, y: number): V => [cx + x * k, cy + y * k];
      /** A short two-segment leg splayed at `deg` (left side), knee lifted. */
      const leg = (deg: number): Prim[] => {
        const d = (deg * Math.PI) / 180;
        const at = (r: number, dy: number) => P(Math.cos(d) * r, Math.sin(d) * r + dy);
        return both(path([at(5.6, 0), at(10, -2), at(12.6, 0.6)], 0.95, 0.8));
      };
      const legsA = [...leg(208), ...leg(138)];
      const legsB = [...leg(172)];
      const abd = ell(...P(0, -8), 5.8 * k, 4.6 * k);
      const body = ell(...P(0, 0.6), 7.4 * k, 6.8 * k);
      const radii = stage === 2 ? [6, 10.5, 14.4] : [5, 9.5];
      const wy = stage === 2 ? 14.6 : 16;
      decals.push(lines(web(cx, wy, radii, 8, 22.5), "web:3", [abd, body, ...legsA, ...legsB, ...(pose === "sleep" ? [ell(27.5, 4, 2.6, 3.2)] : [])]));
      parts.push(
        { mat: "body", back: true, prims: legsA },
        { mat: "body", back: true, prims: legsB },
        { mat: "body", prims: [abd] },
        { mat: "star", glow: true, prims: [star(...P(0, -9), 3.9 * k, 0.3)] },
        { mat: "body", round: 12, prims: [body] },
      );
      const node = (i: number, r: number) => webPt(cx, wy, i, r, 8, 22.5).map((v) => Math.round(v)) as V;
      const R = radii[radii.length - 1];
      decals.push(sparkle(node(6, R)[0] - 1, node(6, R)[1] - 1, "star:5"), stamp(...node(1, R), ["s"], { s: "star:5" }, true));
      if (stage === 2) {
        decals.push(
          sparkle(node(3, R)[0] - 1, node(3, R)[1] - 1, "star:5"),
          stamp(...node(7, 10.5), ["s"], { s: "star:5" }, true),
          stamp(...node(4, 10.5), ["s"], { s: "star:5" }, true),
        );
      }
      face(Math.round(cy - 1.4));
    }
    if (pose === "sleep") decals.push(zzz(26, 2));
    return { parts, decals };
  },
};

export const MOON: Species[] = [mooncat, lanternwisp, batling, glowbug, jackalope, raven, slumbersloth, baku, starweaver, starwhale];
