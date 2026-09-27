/** Render hatchery sprites to a PNG contact sheet for visual review.
 *
 *    node scripts/sprite-sheet.ts [out.png] [filter]
 *
 *  Runs the app's own rasterizer (Node strips the TS types natively), so the
 *  sheet is exactly what the app will draw. Each row is one species: its egg,
 *  then every growth stage, then the shiny adult and the blink/sleep frames,
 *  on the app's dark ink so outline contrast is judged where it matters.
 *  `filter` keeps only species whose id or element contains it. */

import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { SPECIES } from "../src/lib/hatchery/species.ts";
import { drawEgg } from "../src/lib/hatchery/eggs.ts";
import { renderSpecies } from "../src/lib/hatchery/catalog.ts";
import type { Sprite } from "../src/lib/hatchery/pixel.ts";

const out = process.argv[2] ?? "sprite-sheet.png";
const filter = process.argv[3] ?? "";
const SCALE = Number(process.argv[4] ?? 5);
const CELL = 32 * SCALE + 16;
const LABEL_W = 170;

const list = SPECIES.filter((s) => !filter || s.id.includes(filter) || s.element.includes(filter));

type Cell = { sprite: Sprite; caption: string };
const rows: { label: string; cells: Cell[] }[] = list.map((s) => ({
  label: `${s.name}\n${s.tier} · ${s.element}`,
  cells: [
    { sprite: drawEgg(s.element, s.tier, 0), caption: "egg" },
    { sprite: renderSpecies(s, 0, "idle"), caption: "hatchling" },
    { sprite: renderSpecies(s, 1, "idle"), caption: "juvenile" },
    { sprite: renderSpecies(s, 2, "idle"), caption: "adult" },
    { sprite: renderSpecies(s, 2, "idle", true), caption: "shiny" },
    { sprite: renderSpecies(s, 1, "blink"), caption: "blink" },
    { sprite: renderSpecies(s, 0, "sleep"), caption: "sleep" },
  ],
}));

const cols = Math.max(...rows.map((r) => r.cells.length));
const W = LABEL_W + cols * CELL;
const H = rows.length * (CELL + 14) + 10;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
svg += `<rect width="${W}" height="${H}" fill="#0f1512"/>`;
rows.forEach((row, ri) => {
  const y0 = 8 + ri * (CELL + 14);
  row.label.split("\n").forEach((line, li) => {
    svg += `<text x="10" y="${y0 + 60 + li * 18}" font-family="Segoe UI" font-size="${li ? 12 : 15}" fill="${li ? "#8ea696" : "#e7f0e9"}">${esc(line)}</text>`;
  });
  row.cells.forEach((cell, ci) => {
    const x0 = LABEL_W + ci * CELL;
    svg += `<rect x="${x0}" y="${y0}" width="${CELL - 8}" height="${CELL - 8}" rx="8" fill="#151d18"/>`;
    const { w, h, data } = cell.sprite;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3]) continue;
        const hex = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        svg += `<rect x="${x0 + 4 + x * SCALE}" y="${y0 + 4 + y * SCALE}" width="${SCALE}" height="${SCALE}" fill="${hex}"/>`;
      }
    }
    svg += `<text x="${x0 + 6}" y="${y0 + CELL + 2}" font-family="Consolas" font-size="11" fill="#5b6f63">${cell.caption}</text>`;
  });
});
svg += `</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
writeFileSync(out, png);
console.log(`${list.length} species → ${out} (${W}×${H})`);
