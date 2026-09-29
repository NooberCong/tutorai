/** Cached sprite rendering for species, and for pets wearing accessories. */

import type { Sprite } from "./pixel.ts";
import { render, shiftDrawing } from "./pixel.ts";
import type { Pose, Species, Stage } from "./kit.ts";
import type { AccessoryId, Wear } from "./accessories.ts";
import { ACCESSORY, ACC_PALETTE, wearDrawing } from "./accessories.ts";
import type { Fit } from "./fit.ts";
import { fitOf } from "./fit.ts";

const cache = new Map<string, Sprite>();

export function renderSpecies(s: Species, stage: Stage, pose: Pose, shiny = false): Sprite {
  const key = `${s.id}/${stage}/${pose}/${shiny ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = render(s.draw(stage, pose), shiny ? { ...s.palette, ...s.shiny } : s.palette);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Room around a dressed creature for hats and tails: the creature keeps
 *  its 32×32 box (and its ground line), the extra canvas overflows it. */
export const DRESSED_PAD = { x: 5, top: 10 };
export const DRESSED_W = 32 + 2 * DRESSED_PAD.x;
export const DRESSED_H = 32 + DRESSED_PAD.top;

export const wearKey = (w: Wear) => [w.neck, w.face, w.head].map((x) => x ?? "").join("+");

/** A creature wearing accessories, on the padded DRESSED_W × DRESSED_H
 *  canvas. Accessories render in the same pass as the body, so they shade,
 *  outline and overlap like any other part. */
export function renderDressed(s: Species, stage: Stage, pose: Pose, shiny: boolean, wear: Wear): Sprite {
  const key = `${s.id}/${stage}/${pose}/${shiny ? 1 : 0}/${wearKey(wear)}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const palette = { ...ACC_PALETTE, ...s.palette, ...(shiny ? s.shiny : {}) };
    const fit = fitOf(s, stage);
    const body = s.draw(stage, pose);
    const worn = wearDrawing(fit, wear, palette[fit.skin] ?? "#888888");
    const d = shiftDrawing(
      { parts: [...body.parts, ...worn.parts], decals: [...(body.decals ?? []), ...worn.decals] },
      DRESSED_PAD.x,
      DRESSED_PAD.top,
    );
    sprite = render(d, palette, DRESSED_W, DRESSED_H);
    cache.set(key, sprite);
  }
  return sprite;
}

/** An accessory on its own, centered on a 32×32 canvas: as if worn by a
 *  medium head, with nothing drawn under it. Glasses take their gold frame,
 *  which reads on the app's dark ink. */
export function renderItem(id: AccessoryId): Sprite {
  const key = `item/${id}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const slot = ACCESSORY[id].slot;
    const fit: Fit & { item: Record<string, never> } = {
      head: { x: 16, y: 22, w: id === "flowercrown" ? 15 : 12, tilt: 0 },
      eyes: { l: [10, 15], r: [20, 15], w: 2, h: 2 },
      neck: { x: 16, y: id === "scarf" ? 11.5 : 16, w: 16, tilt: 0 },
      skin: "",
      item: {},
    };
    const worn = wearDrawing(fit, { [slot]: id }, "#000000");
    sprite = centered(render({ parts: worn.parts, decals: worn.decals }, ACC_PALETTE));
    cache.set(key, sprite);
  }
  return sprite;
}

/** Move a sprite's drawn pixels to the middle of its canvas. */
function centered(s: Sprite): Sprite {
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (!s.data[(y * s.w + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return s;
  const dx = Math.floor((s.w - (x1 - x0 + 1)) / 2) - x0;
  const dy = Math.floor((s.h - (y1 - y0 + 1)) / 2) - y0;
  const data = new Uint8ClampedArray(s.data.length);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const from = (y * s.w + x) * 4;
      data.set(s.data.subarray(from, from + 4), ((y + dy) * s.w + x + dx) * 4);
    }
  }
  return { w: s.w, h: s.h, data };
}
