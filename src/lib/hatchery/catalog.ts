/** Cached sprite rendering for species. */

import type { Sprite } from "./pixel.ts";
import { render } from "./pixel.ts";
import type { Pose, Species, Stage } from "./kit.ts";
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
