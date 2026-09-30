/** Render the reader backdrops, for painting by eye.
 *
 *    node scripts/backdrop-sheet.ts <out-dir> [element] [--dim] [--w=1600]
 *
 *  Writes one PNG per element. With --dim, each is shown the way the reader
 *  shows it: dimmed, with a blank page column in the middle. Backdrops live
 *  in src/lib/hatchery/backdrops.ts. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { ELEMENTS } from "../src/lib/hatchery/kit.ts";
import { BACKDROP_H, BACKDROP_W, renderBackdrop } from "../src/lib/hatchery/backdrops.ts";

const dir = process.argv[2] ?? "backdrops";
const args = process.argv.slice(3);
const dim = args.includes("--dim");
const w = Number(args.find((a) => a.startsWith("--w="))?.slice(4) ?? BACKDROP_W);
const h = Math.round((w * BACKDROP_H) / BACKDROP_W);
const filter = args.find((a) => !a.startsWith("--")) ?? "";
mkdirSync(dir, { recursive: true });

function png(data: Uint8ClampedArray, w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const el of ELEMENTS.filter((e) => !filter || e === filter)) {
  const t0 = performance.now();
  const data = renderBackdrop(el, w, h);
  const ms = Math.round(performance.now() - t0);
  if (dim) {
    // mirror .reader-host.has-backdrop .reader in styles.css
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const t = Math.abs(x / w - 0.5) * 2;
        const a = 0.82 + (0.5 - 0.82) * t;
        const page = Math.abs(x - w / 2) < w * 0.24 && y > h * 0.04;
        for (let c = 0; c < 3; c++) data[i + c] = page ? 255 : data[i + c] * (1 - a) + [5, 8, 7][c] * a;
      }
    }
  }
  const out = join(dir, `${el}${dim ? "-dim" : ""}.png`);
  writeFileSync(out, png(data, w, h));
  console.log(`${out}  ${ms} ms`);
}
