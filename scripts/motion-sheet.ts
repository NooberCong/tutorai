/** Render an animated creature's clips frame by frame to a PNG, for review.
 *
 *    node scripts/motion-sheet.ts <out.png> <species-id> [stage=all] [clip=idle] [scale=4] [step=1] [diff|-] [from:to]
 *
 *  One block per growth stage, frames in reading order with their index, on
 *  the app's dark ink. `clip` is idle, blink, sleep, act or dressed (the idle
 *  loop wearing a scarf, glasses and a wizard hat, to check they ride along).
 *  `step` shows every nth frame; `diff` dots each pixel that changed since the
 *  frame before, to see exactly what moves when; `from:to` limits the frames.
 *  Judge the motion by reading across a row as a flipbook: silhouette first,
 *  then what leads and what follows. */

import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { speciesById } from "../src/lib/hatchery/species.ts";
import { frameCount, renderDressed, renderSpecies } from "../src/lib/hatchery/catalog.ts";
import type { Pose, Stage } from "../src/lib/hatchery/kit.ts";
import type { Sprite } from "../src/lib/hatchery/pixel.ts";

const [out = "motion.png", id = "", stageArg = "all", clip = "idle", scaleArg = "4", stepArg = "1", diffArg = "", range = ""] = process.argv.slice(2);
const DIFF = diffArg === "diff";
const sp = speciesById(id);
if (!sp?.motion) throw new Error(`${id} isn't an animated species`);
const SCALE = Number(scaleArg);
const STEP = Number(stepArg);
const dressed = clip === "dressed";
const pose = (dressed ? "idle" : clip) as Pose;
const stages: Stage[] = stageArg === "all" ? [0, 1, 2] : [Number(stageArg) as Stage];
const n = frameCount(sp, pose);
// Rows fit a ~2000 px wide view, so frames are never shown shrunk.
const PER_ROW = Math.max(2, Math.floor(2000 / (42 * SCALE + 12)));

const [from, to] = range ? range.split(":").map(Number) : [0, n - 1];
const frame = (st: Stage, i: number): Sprite =>
  dressed
    ? renderDressed(sp, st, pose, false, { neck: "scarf", face: "glasses", head: "wizardhat" }, i)
    : renderSpecies(sp, st, pose, false, i);
const indices = Array.from({ length: n }, (_, i) => i).filter((i) => i >= from && i <= to && (i - from) % STEP === 0);

const blocks = stages.map((st) => ({ st, sprites: indices.map((i) => frame(st, i)), prev: indices.map((i) => frame(st, (i + n - STEP) % n)) }));
const cw = blocks[0].sprites[0].w * SCALE + 12;
const ch = blocks[0].sprites[0].h * SCALE + 22;
const rowsOf = (k: number) => Math.ceil(k / PER_ROW);
const W = 20 + PER_ROW * cw;
const H = blocks.reduce((h, b) => h + 26 + rowsOf(b.sprites.length) * ch, 10);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0f1512"/>`;
let y = 10;
for (const b of blocks) {
  svg += `<text x="10" y="${y + 16}" font-family="Segoe UI" font-size="14" fill="#e7f0e9">${sp.name} · stage ${b.st} · ${clip} · ${n} frames</text>`;
  y += 26;
  b.sprites.forEach((s, k) => {
    const x0 = 10 + (k % PER_ROW) * cw;
    const y0 = y + Math.floor(k / PER_ROW) * ch;
    svg += `<rect x="${x0}" y="${y0}" width="${cw - 6}" height="${ch - 20}" fill="#151d18"/>`;
    for (let py = 0; py < s.h; py++) {
      for (let px = 0; px < s.w; px++) {
        const i = (py * s.w + px) * 4;
        if (!s.data[i + 3]) continue;
        const hex = `#${[s.data[i], s.data[i + 1], s.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        svg += `<rect x="${x0 + 3 + px * SCALE}" y="${y0 + 3 + py * SCALE}" width="${SCALE}" height="${SCALE}" fill="${hex}"/>`;
      }
    }
    const prev = b.prev[k];
    for (let i = 0; DIFF && i < s.w * s.h; i++) {
      if ([0, 1, 2, 3].every((c) => s.data[i * 4 + c] === prev.data[i * 4 + c])) continue;
      const d = Math.max(1, SCALE / 3);
      svg += `<rect x="${x0 + 3 + (i % s.w) * SCALE + (SCALE - d) / 2}" y="${y0 + 3 + Math.floor(i / s.w) * SCALE + (SCALE - d) / 2}" width="${d}" height="${d}" fill="#ff2bd6"/>`;
    }
    svg += `<text x="${x0 + 4}" y="${y0 + ch - 7}" font-family="Consolas" font-size="11" fill="#5b6f63">${indices[k]}</text>`;
  });
  y += rowsOf(b.sprites.length) * ch;
}
svg += `</svg>`;
writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
console.log(`${sp.id} ${clip}: ${n} frames → ${out}`);
