/** Where accessories sit on each creature, per growth stage.
 *
 *  Every species is measured from its own drawing: the eye decals give the
 *  glasses, the part those eyes are on is the head (hats sit on its top,
 *  between any ears or horns drawn as separate parts), and the narrowest
 *  row below the face is the neck. The measurement is a starting point:
 *  `fit/<element>.ts` corrects it by hand for every species that needs it,
 *  after looking at each one wearing everything (`scripts/wardrobe-sheet.ts`).
 *
 *  Coordinates are the creature's own 32×32 canvas; poses never change a
 *  creature's shape, so one fit per stage serves idle, blink and sleep. */

import type { Species, Stage } from "./kit.ts";
import type { Decal, Drawing, V } from "./pixel.ts";
import { SIZE, partCovers } from "./pixel.ts";
import { ARCANE_FIT } from "./fit/arcane.ts";
import { EMBER_FIT } from "./fit/ember.ts";
import { FROST_FIT } from "./fit/frost.ts";
import { LEAF_FIT } from "./fit/leaf.ts";
import { MOON_FIT } from "./fit/moon.ts";
import { SKY_FIT } from "./fit/sky.ts";
import { STONE_FIT } from "./fit/stone.ts";
import { TIDE_FIT } from "./fit/tide.ts";

export interface Fit {
  /** Top of the skull: center x, the first row of head, the skull's width
   *  just below the top, and a lean in degrees (+ = clockwise) for heads
   *  seen in ¾ or cocked. */
  head: { x: number; y: number; w: number; tilt: number };
  /** Eye boxes (top-left pixel of each, and their size) for glasses. */
  eyes: { l: V; r: V; w: number; h: number };
  /** Where a scarf or bow tie wraps: center, width across, lean. */
  neck: { x: number; y: number; w: number; tilt: number };
  /** The head's material, so glasses can contrast with it. */
  skin: string;
}

/** Per-accessory fine placement, for the odd creature where one item needs
 *  a nudge the shared anchor can't give (a horn through the brim, a beak
 *  under the bow tie). */
export interface Nudge {
  dx?: number;
  dy?: number;
  /** Size multiplier. */
  s?: number;
  tilt?: number;
  /** Mirror the item (tails and tassels hang the other way). */
  flip?: boolean;
  /** The item's second colorway, for creatures its first one blends into
   *  (a red scarf on a red bird) — or "gold", a third for scarves and bow
   *  ties when both blend (red and green on a quetzal). */
  alt?: boolean | "gold";
  /** Glasses only: force the frame color (default picks by the head's
   *  lightness). */
  frame?: "dark" | "gold" | "silver";
}

/** A hand correction for one stage: any field replaces the measured one. */
export interface Tweak {
  head?: Partial<Fit["head"]>;
  eyes?: Fit["eyes"];
  neck?: Partial<Fit["neck"]>;
  item?: Record<string, Nudge>;
}

export type FitTable = Record<string, [Tweak?, Tweak?, Tweak?]>;

const TWEAKS: FitTable = {
  ...LEAF_FIT, ...EMBER_FIT, ...TIDE_FIT, ...STONE_FIT, ...SKY_FIT, ...FROST_FIT, ...MOON_FIT, ...ARCANE_FIT,
};

const cache = new Map<string, Fit & { item: Record<string, Nudge> }>();

export function fitOf(sp: Species, stage: Stage): Fit & { item: Record<string, Nudge> } {
  const key = `${sp.id}/${stage}`;
  let f = cache.get(key);
  if (!f) {
    const m = measure(sp.draw(stage, "idle"));
    const t = TWEAKS[sp.id]?.[stage] ?? {};
    f = {
      head: { ...m.head, ...t.head },
      eyes: t.eyes ?? m.eyes,
      neck: { ...m.neck, ...t.neck },
      skin: m.skin,
      item: t.item ?? {},
    };
    cache.set(key, f);
  }
  return f;
}

/** The eye decals `kit.eyes()` makes: an eye ink plus a white highlight. */
function eyeDecals(d: Drawing): Decal[] {
  return (d.decals ?? []).filter(
    (dc) => !dc.over && Object.values(dc.inks).some((i) => i.startsWith("eye")) && dc.inks.w?.startsWith("white"),
  );
}

export function measure(d: Drawing): Fit {
  // Eyes: the widest-apart pair on one row (a third eye or a gem is ignored).
  const found = eyeDecals(d);
  let pair: [Decal, Decal] | null = null;
  for (const a of found) {
    for (const b of found) {
      if (a === b || a.x >= b.x || a.y !== b.y) continue;
      if (!pair || b.x - a.x > pair[1].x - pair[0].x) pair = [a, b];
    }
  }
  const ew = pair ? pair[0].rows[0].length : 2;
  const eh = pair ? pair[0].rows.length : 2;
  const eyes: Fit["eyes"] = pair
    ? { l: [pair[0].x, pair[0].y], r: [pair[1].x, pair[1].y], w: ew, h: eh }
    : { l: [12, 16], r: [18, 16], w: 2, h: 2 };
  const ex = (eyes.l[0] + eyes.r[0] + ew) / 2; // between the eyes
  const ey = Math.round(eyes.l[1] + eh / 2);

  // Anything drawn at all, and the head: the topmost part under the eyes.
  const solid = (x: number, y: number) => d.parts.some((p) => partCovers(p, x, y));
  let head = d.parts.length - 1;
  for (let i = d.parts.length - 1; i >= 0; i--) {
    if (partCovers(d.parts[i], Math.floor(ex), ey)) {
      head = i;
      break;
    }
  }
  const inHead = (x: number, y: number) => partCovers(d.parts[head], x, y);
  const run = (y: number, x0: number, test: (x: number, y: number) => boolean): [number, number] => {
    let a = x0;
    let b = x0;
    while (a > 0 && test(a - 1, y)) a--;
    while (b < SIZE - 1 && test(b + 1, y)) b++;
    return [a, b + 1];
  };

  // Skull top: the head's first row above the eyes' midpoint.
  const cx = Math.floor(ex);
  let top = ey;
  while (top > 0 && inHead(cx, top - 1)) top--;
  const [ha, hb] = run(Math.min(top + 2, ey), cx, inHead);

  // Neck: where the head part ends above the body, or, for a head and body
  // drawn as one blob, the narrowest row between the face and the feet.
  const eyeBottom = eyes.l[1] + eh;
  let bottom = eyeBottom;
  while (bottom < SIZE - 1 && inHead(cx, bottom + 1)) bottom++;
  let ny: number;
  if (bottom - eyeBottom <= 9 && solid(cx, bottom + 1)) {
    ny = bottom;
  } else {
    // A real neck is clearly narrower than the face; a round blob has none,
    // and the wrap goes just under the face.
    const faceW = (() => {
      const [a, b] = run(eyeBottom - 1, cx, inHead);
      return b - a;
    })();
    let best = eyeBottom + 2;
    let bestW = faceW - 1.5;
    for (let y = eyeBottom + 2; y <= Math.min(bottom - 4, eyeBottom + 7); y++) {
      if (!inHead(cx, y)) break;
      const [a, b] = run(y, cx, inHead);
      if (b - a < bestW) {
        bestW = b - a;
        best = y;
      }
    }
    ny = best;
  }
  // The neck's width is the body there — the topmost part at that point —
  // not wings or arms drawn beside it.
  let under = -1;
  for (let i = d.parts.length - 1; i >= 0; i--) {
    if (partCovers(d.parts[i], cx, ny)) {
      under = i;
      break;
    }
  }
  const inUnder = (x: number, y: number) => under >= 0 && partCovers(d.parts[under], x, y);
  const [na, nb] = under >= 0 ? run(ny, cx, inUnder) : solid(cx, ny) ? run(ny, cx, solid) : [cx - 4, cx + 4];

  return {
    head: { x: (ha + hb) / 2, y: top, w: hb - ha, tilt: 0 },
    eyes,
    neck: { x: (na + nb) / 2, y: ny + 0.5, w: nb - na, tilt: 0 },
    skin: d.parts[head]?.mat ?? "eye",
  };
}
