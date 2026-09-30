/** Render the reader backdrops, for painting by eye.
 *
 *    node scripts/backdrop-sheet.ts <out-dir> [element] [--dim] [--live] [--w=1600]
 *
 *  Writes one PNG per element. With --dim, each is shown the way the reader
 *  shows it: dimmed, with a blank page column in the middle. With --live,
 *  writes what the living backdrop draws from instead: the still base, its
 *  mask channels 0–2 as RGB and 3 as gray, and the layer if any. Backdrops
 *  live in src/lib/hatchery/backdrops.ts. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { ELEMENTS } from "../src/lib/hatchery/kit.ts";
import { BACKDROP_H, BACKDROP_W, paintLive, renderBackdrop } from "../src/lib/hatchery/backdrops.ts";

const dir = process.argv[2] ?? "backdrops";
const args = process.argv.slice(3);
const dim = args.includes("--dim");
const live = args.includes("--live");
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

/** Channels of an RGBA image as an opaque one: `pick` maps a pixel's four
 *  values to its RGB. */
function view(src: Uint8ClampedArray, pick: (v: Uint8ClampedArray, i: number) => [number, number, number]) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out.set(pick(src, i), i);
    out[i + 3] = 255;
  }
  return out;
}

for (const el of ELEMENTS.filter((e) => !filter || e === filter)) {
  if (live) {
    const t0 = performance.now();
    const b = paintLive(el, w, h);
    const ms = Math.round(performance.now() - t0);
    writeFileSync(join(dir, `${el}-base.png`), png(b.base, w, h));
    writeFileSync(join(dir, `${el}-mask.png`), png(view(b.mask, (v, i) => [v[i], v[i + 1], v[i + 2]]), w, h));
    writeFileSync(join(dir, `${el}-mask3.png`), png(view(b.mask, (v, i) => [v[i + 3], v[i + 3], v[i + 3]]), w, h));
    if (b.layer) writeFileSync(join(dir, `${el}-layer.png`), png(view(b.layer, (v, i) => [v[i], v[i + 1], v[i + 2]]), w, h));
    console.log(`${el} live  ${ms} ms`);
    continue;
  }
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
