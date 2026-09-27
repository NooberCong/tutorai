/** Shared vocabulary for species recipes: the catalog types plus face and
 *  flourish decals, so every creature's eyes, blush and sleep "z" come from
 *  one place and the collection reads as one family. */

import type { Decal, Drawing, Ink, Palette, V } from "./pixel.ts";

export type Element = "leaf" | "ember" | "tide" | "stone" | "sky" | "frost" | "moon" | "arcane";
export type Tier = "common" | "rare" | "epic" | "legendary";
/** 0 hatchling · 1 juvenile · 2 adult. */
export type Stage = 0 | 1 | 2;
export type Pose = "idle" | "blink" | "sleep";

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
  draw(stage: Stage, pose: Pose): Drawing;
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
  if (pose === "idle") {
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

/** The sleeping "z", floated above-right of the head. */
export const zzz = (x: number, y: number): Decal => ({
  x, y, over: true,
  rows: ["zzzz", "...z", "..z.", ".z..", "zzzz"],
  inks: { z: "#cfe3d6" },
});

/** Sparkle for shinies / legendaries. */
export const sparkle = (x: number, y: number, ink: Ink = "#fff4c2"): Decal => ({
  x, y, over: true,
  rows: [".s.", "sss", ".s."],
  inks: { s: ink },
});
