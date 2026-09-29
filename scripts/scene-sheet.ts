/** Render every habitat with creatures standing in it, for painting by eye.
 *
 *    node scripts/scene-sheet.ts <out.png> [filter] [scale=5]
 *
 *  One row per element: the empty scene, then a hatchling, a juvenile, an
 *  adult of that element (and one from another element, to check the scene
 *  doesn't fight a foreign palette), then its egg. Scenes live in
 *  src/lib/hatchery/scenes.ts. */

import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { SPECIES } from "../src/lib/hatchery/species.ts";
import { ELEMENTS } from "../src/lib/hatchery/kit.ts";
import type { Stage } from "../src/lib/hatchery/kit.ts";
import type { Sprite } from "../src/lib/hatchery/pixel.ts";
import { renderSpecies } from "../src/lib/hatchery/catalog.ts";
import { drawEgg } from "../src/lib/hatchery/eggs.ts";
import { SCENE_H, SCENE_W, STAGE, renderScene } from "../src/lib/hatchery/scenes.ts";

const out = process.argv[2] ?? "scenes.png";
const filter = process.argv[3] ?? "";
const SCALE = Number(process.argv[4] ?? 5);
const GAP = 12;
const CW = SCENE_W * SCALE + GAP;
const CH = SCENE_H * SCALE + GAP;

const rows = ELEMENTS.filter((e) => !filter || e === filter);
const COLS = 6;
const W = COLS * CW + GAP;
const H = rows.length * CH + GAP;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1a1f1c"/>`;
const blit = (s: Sprite, x0: number, y0: number) => {
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4;
      if (!s.data[i + 3]) continue;
      const hex = `#${[s.data[i], s.data[i + 1], s.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      svg += `<rect x="${x0 + x * SCALE}" y="${y0 + y * SCALE}" width="${SCALE}" height="${SCALE}" fill="${hex}"/>`;
    }
  }
};

rows.forEach((el, ri) => {
  const y0 = GAP + ri * CH;
  const own = SPECIES.filter((s) => s.element === el);
  const other = SPECIES.filter((s) => s.element !== el);
  const cast: (Sprite | null)[] = [
    null,
    renderSpecies(own[0], 0 as Stage, "idle"),
    renderSpecies(own[5], 1 as Stage, "idle"),
    renderSpecies(own[9], 2 as Stage, "idle"),
    renderSpecies(other[(ri * 13) % other.length], 2 as Stage, "idle"),
    drawEgg(el, "rare", 0),
  ];
  cast.forEach((sp, ci) => {
    const x0 = GAP + ci * CW;
    blit(renderScene(el), x0, y0);
    if (sp) blit(sp, x0 + STAGE.x * SCALE, y0 + STAGE.y * SCALE);
  });
});
svg += "</svg>";
writeFileSync(out, new Resvg(svg).render().asPng());
console.log(`${rows.length} scenes → ${out}`);
