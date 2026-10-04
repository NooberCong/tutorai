/** Shared vocabulary for species recipes: the catalog types plus face and
 *  flourish decals, so every creature's eyes, blush and sleep "z" come from
 *  one place and the collection reads as one family. */

import type { Decal, Drawing, Ink, Palette, V } from "./pixel.ts";
import { rise } from "./motion.ts";
import { SIZE } from "./pixel.ts";

export type Element = "leaf" | "ember" | "tide" | "stone" | "sky" | "frost" | "moon" | "arcane";
export type Tier = "common" | "rare" | "epic" | "legendary";
/** 0 hatchling · 1 juvenile · 2 adult. */
export type Stage = 0 | 1 | 2;
/** "act" is the creature's signature act, eyes open like "idle". */
export type Pose = "idle" | "blink" | "sleep" | "act";

/** Whether the eyes are open in a pose. */
export const awake = (pose: Pose) => pose === "idle" || pose === "act";

export const ELEMENTS: Element[] = ["leaf", "ember", "tide", "stone", "sky", "frost", "moon", "arcane"];
export const TIERS: Tier[] = ["common", "rare", "epic", "legendary"];

export interface Species {
  id: string;
  name: string;
  element: Element;
  tier: Tier;
  /** Names per growth stage, e.g. ["Sproutling", "Sprigling", "Sprigbuck"]. */
  stages: [string, string, string];
  /** Materials used by `draw` (see pixel.ts). `eye`, `white`, `blush` have
   *  defaults. */
  palette: Palette;
  /** Overrides applied for the rare shiny variant. */
  shiny: Palette;
  /** Field-guide entry, one or two sentences. */
  lore: string;
  /** Shown under the silhouette before it's discovered. */
  hint: string;
  /** The creature in a pose. Animated ones also mark their moving parts
   *  (motion.ts); `t` (0–1) is the act's own time in "act". */
  draw(stage: Stage, pose: Pose, t?: number): Drawing;
  /** Animated creatures: the idle loop and the sleeping breath, in
   *  seconds, and how many idle loops the signature act lasts. The act
   *  plays over the idle loop from its start, so it starts and ends on the
   *  loop's first frame. Unset: a still sprite the UI bobs. */
  motion?: { idle: number; sleep: number; act?: number };
}

// ── face decals ──

const EYE_OPEN: Record<string, string[]> = {
  dot: ["k"],
  round: ["wk", "kk"],
  tall: ["wk", "kk", "kk"],
  big: ["wkk", "kkk", "kkk"],
};

/** Two eyes with top-left positions `l` and `r`. Highlights sit top-left on
 *  both (one light source), not mirrored. */
export function eyes(
  l: V,
  r: V,
  pose: Pose,
  style: keyof typeof EYE_OPEN = "round",
  ink: Ink = "eye:3",
): Decal[] {
  const rows = EYE_OPEN[style];
  const w = rows[0].length;
  const inks = { k: ink, w: "white:4" };
  if (awake(pose)) {
    return [
      { x: l[0], y: l[1], rows, inks },
      { x: r[0], y: r[1], rows, inks },
    ];
  }
  // Closed (blink and sleep alike): a lash line on the eye's lower row. At
  // 2px wide there's no room for an arc; sleep reads from the "z" and the
  // UI's slow breathing instead.
  const lid = ["k".repeat(w)];
  const dy = rows.length - 1;
  return [
    { x: l[0], y: l[1] + dy, rows: lid, inks },
    { x: r[0], y: r[1] + dy, rows: lid, inks },
  ];
}

export function blush(l: V, r: V, width = 2): Decal[] {
  const rows = ["b".repeat(width)];
  const inks = { b: "blush:3" };
  return [
    { x: l[0], y: l[1], rows, inks },
    { x: r[0], y: r[1], rows, inks },
  ];
}

/** Any small hand-authored stamp: mouths, fangs, gems, markings. */
export const stamp = (x: number, y: number, rows: string[], inks: Record<string, Ink>, over = false): Decal => ({
  x, y, rows, inks, over,
});

/** The sleeping "z", floated above-right of the head; when animated it
 *  drifts up and out a pixel on each breath — only as far as the canvas
 *  allows, so one drawn against an edge drifts along it instead. */
export const zzz = (x: number, y: number): Decal => {
  const dx = x + 4 < SIZE ? 1 : 0;
  const dy = y > 0 ? -1 : 0;
  return {
    x, y, over: true,
    rows: ["zzzz", "...z", "..z.", ".z..", "zzzz"],
    inks: { z: "#cfe3d6" },
    move: [{ at: [x, y], wave: rise(1), shift: dx || dy ? [dx, dy] : [-1, 0] }],
  };
};

/** Sparkle for shinies / legendaries. */
export const sparkle = (x: number, y: number, ink: Ink = "#fff4c2"): Decal => ({
  x, y, over: true,
  rows: [".s.", "sss", ".s."],
  inks: { s: ink },
});

/** A sparkle that twinkles when animated: at loop time `t` it's a dot,
 *  then the cross, then a dot again over `len` of the loop from `at`, and
 *  gone otherwise. Still (no `t`), it's the plain sparkle. */
export function twinkle(x: number, y: number, t: number | undefined, at: number, ink: Ink = "#fff4c2", len = 0.35): Decal[] {
  if (t === undefined) return [sparkle(x, y, ink)];
  const u = (((t - at) % 1) + 1) % 1;
  if (u >= len) return [];
  const k = u / len;
  return [k < 0.25 || k > 0.75 ? stamp(x + 1, y + 1, ["s"], { s: ink }, true) : sparkle(x, y, ink)];
}
