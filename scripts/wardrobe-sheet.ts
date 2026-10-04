/** Render species wearing every accessory, for fitting them by eye.
 *
 *    node scripts/wardrobe-sheet.ts <out-dir> [filter] [scale=4] [columns]
 *
 *  Writes one PNG per species (`<id>.png`): a row per growth stage, a column
 *  per accessory, then a full outfit, on the app's dark ink. A faint grid
 *  marks the creature's own 32×32 box. `filter` keeps species whose id or
 *  element contains it; `columns` (comma-separated captions) keeps only
 *  those columns, for a close look at a few. Fits live in src/lib/hatchery/fit/<element>.ts. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { SPECIES } from "../src/lib/hatchery/species.ts";
import { ROOM_H, ROOM, ROOM_W, renderDressed } from "../src/lib/hatchery/catalog.ts";
import type { Wear } from "../src/lib/hatchery/accessories.ts";
import { ACCESSORIES } from "../src/lib/hatchery/accessories.ts";
import type { Stage } from "../src/lib/hatchery/kit.ts";

const outDir = process.argv[2] ?? "wardrobe";
const filter = process.argv[3] ?? "";
const SCALE = Number(process.argv[4] ?? 4);
const CW = ROOM_W * SCALE + 12;
const CH = ROOM_H * SCALE + 26;
const LABEL_W = 110;

const only = process.argv[5]?.split(",");
const allColumns: { caption: string; wear: Wear }[] = [
  { caption: "plain", wear: {} },
  ...ACCESSORIES.map((a) => ({ caption: a.id, wear: { [a.slot]: a.id } as Wear })),
  { caption: "outfit", wear: { head: "nightcap", face: "glasses", neck: "scarf" } },
  { caption: "outfit 2", wear: { head: "mortarboard", neck: "bowtie" } },
];
const columns = only ? allColumns.filter((c) => only.includes(c.caption)) : allColumns;

mkdirSync(outDir, { recursive: true });
const list = SPECIES.filter((s) => !filter || s.id === filter || s.element === filter || s.id.includes(filter));
for (const sp of list) {
  const W = LABEL_W + columns.length * CW + 8;
  const H = 40 + 3 * CH;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#0f1512"/>`;
  svg += `<text x="10" y="24" font-family="Segoe UI" font-size="16" fill="#e7f0e9">${sp.name} · ${sp.id} · ${sp.tier} ${sp.element}</text>`;
  ([0, 1, 2] as Stage[]).forEach((st) => {
    const y0 = 36 + st * CH;
    svg += `<text x="10" y="${y0 + CH / 2}" font-family="Segoe UI" font-size="13" fill="#8ea696">${["hatchling", "juvenile", "adult"][st]}</text>`;
    columns.forEach((col, ci) => {
      const x0 = LABEL_W + ci * CW;
      svg += `<rect x="${x0}" y="${y0}" width="${CW - 6}" height="${CH - 20}" rx="6" fill="#151d18"/>`;
      // The creature's own box.
      svg += `<rect x="${x0 + 3 + ROOM.x * SCALE}" y="${y0 + 3 + ROOM.top * SCALE}" width="${32 * SCALE}" height="${32 * SCALE}" fill="none" stroke="#1f2a23" stroke-width="1"/>`;
      const { w, h, data } = renderDressed(sp, st, "idle", false, col.wear);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (!data[i + 3]) continue;
          const hex = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
          svg += `<rect x="${x0 + 3 + x * SCALE}" y="${y0 + 3 + y * SCALE}" width="${SCALE}" height="${SCALE}" fill="${hex}"/>`;
        }
      }
      svg += `<text x="${x0 + 4}" y="${y0 + CH - 8}" font-family="Consolas" font-size="11" fill="#5b6f63">${col.caption}</text>`;
    });
  });
  svg += `</svg>`;
  writeFileSync(join(outDir, `${sp.id}.png`), new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
}
console.log(`${list.length} species → ${outDir}`);
