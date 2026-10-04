/** Cached sprite rendering for species, and for pets wearing accessories. */

import type { Drawing, Sprite } from "./pixel.ts";
import { render, shiftDrawing } from "./pixel.ts";
import { animate } from "./motion.ts";
import type { Pose, Species, Stage } from "./kit.ts";
import type { AccessoryId, Wear } from "./accessories.ts";
import { ACCESSORY, ACC_PALETTE, wearDrawing } from "./accessories.ts";
import type { Fit } from "./fit.ts";
import { fitOf } from "./fit.ts";

const cache = new Map<string, Sprite>();

/** Frames per second of each clip. Sleep is a slow breath, drawn coarser. */
const FPS: Record<Pose, number> = { idle: 12, blink: 12, act: 12, sleep: 8 };

/** How many frames a clip of an animated species has (blink runs with the
 *  idle loop, so a blink can swap in on any frame). */
export function frameCount(s: Species, pose: Pose): number {
  const m = s.motion;
  if (!m) return 1;
  const sec = pose === "sleep" ? m.sleep : pose === "act" ? m.idle * (m.act ?? 1) : m.idle;
  return Math.round(sec * FPS[pose]);
}

/** A pose's drawing, still or as frame `i` of its clip: the act's own time
 *  goes to `draw`, and its moves run on the idle loop it plays over. */
function posed(s: Species, stage: Stage, pose: Pose, i: number | undefined, extra?: (d: Drawing) => Drawing): Drawing {
  if (i === undefined || !s.motion) return extra ? extra(s.draw(stage, pose)) : s.draw(stage, pose);
  const tau = i / frameCount(s, pose);
  const d = s.draw(stage, pose, tau);
  const t = pose === "act" ? (tau * (s.motion.act ?? 1)) % 1 : tau;
  return animate(extra ? extra(d) : d, t);
}

/** A species sprite: still, on its 32×32 canvas, or frame `i` of the
 *  pose's clip, with ROOM around it to move into. */
export function renderSpecies(s: Species, stage: Stage, pose: Pose, shiny = false, i?: number): Sprite {
  const key = `${s.id}/${stage}/${pose}/${shiny ? 1 : 0}/${i ?? ""}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const palette = shiny ? { ...s.palette, ...s.shiny } : s.palette;
    const d = posed(s, stage, pose, i);
    sprite = i === undefined ? render(d, palette) : render(shiftDrawing(d, ROOM.x, ROOM.top), palette, ROOM_W, ROOM_H);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Room around a creature for hats, and for wings and tails to swing
 *  into when animated: the creature keeps its 32×32 box (and its ground
 *  line), the extra canvas overflows it. Dressed and animated sprites use it. */
export const ROOM = { x: 5, top: 10, bottom: 2 };
export const ROOM_W = 32 + 2 * ROOM.x;
export const ROOM_H = 32 + ROOM.top + ROOM.bottom;

export const wearKey = (w: Wear) => [w.neck, w.face, w.head].map((x) => x ?? "").join("+");

/** A creature wearing accessories, on the padded ROOM_W × ROOM_H
 *  canvas. Accessories render in the same pass as the body, so they shade,
 *  outline and overlap like any other part — and when animated they ride
 *  the moves that carry the head and neck. */
export function renderDressed(s: Species, stage: Stage, pose: Pose, shiny: boolean, wear: Wear, i?: number): Sprite {
  const key = `${s.id}/${stage}/${pose}/${shiny ? 1 : 0}/${wearKey(wear)}/${i ?? ""}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const palette = { ...ACC_PALETTE, ...s.palette, ...(shiny ? s.shiny : {}) };
    const fit = fitOf(s, stage);
    const dressed = posed(s, stage, pose, i, (body) => {
      const worn = wearDrawing(fit, wear, palette[fit.skin] ?? "#888888", body);
      return { parts: [...body.parts, ...worn.parts], decals: [...(body.decals ?? []), ...worn.decals] };
    });
    sprite = render(shiftDrawing(dressed, ROOM.x, ROOM.top), palette, ROOM_W, ROOM_H);
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
