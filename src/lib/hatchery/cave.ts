/** The crystal cavern's life, over its reader backdrop (ambience.ts):
 *  glowworms hanging their beaded threads from the roof, drops of water
 *  falling from the stalactites into the pool, dust turning in the light
 *  from the crack in the roof, and once in a long while a bat.
 *
 *  Drops fall on the schedule in DRIPS, which living.ts also follows to
 *  ring the water where they land, so the two meet exactly. Everything is
 *  drawn in the painting's 1600×1000 scene space; threads and bats are
 *  painted once and stamped, so it stays cheap. */

import type { Layer } from "./ambience.ts";
import { CAVE_CRACK, DRIPS, rng } from "./backdrops.ts";

type Ctx = OffscreenCanvasRenderingContext2D;
type Point = [x: number, y: number];

const TAU = Math.PI * 2;
/** Sprites are painted at this many pixels per scene unit. */
const RES = 2;
/** The cavern's two seen strips, beside the pages. */
const SIDES: readonly Point[] = [[10, 410], [1190, 1590]];

/** A soft round light, `core` adding a bright centre; painted once. */
function speck(color: string, core: boolean): OffscreenCanvas {
  const s = new OffscreenCanvas(32, 32);
  const c = s.getContext("2d")!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  if (core) g.addColorStop(0, "#ffffff");
  g.addColorStop(core ? 0.18 : 0, color);
  g.addColorStop(0.45, color + "55");
  g.addColorStop(1, color + "00");
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return s;
}

// ── glowworms ──

const WORM = "#7ff0e6";

/** One thread, `len` long, hanging from the top centre of its sprite: a
 *  faint silk line strung with droplets that hold the worm's light. */
function thread(len: number, r: () => number): OffscreenCanvas {
  const w = 10;
  const s = new OffscreenCanvas(w * RES, Math.ceil((len + 6) * RES));
  const c = s.getContext("2d")!;
  c.scale(RES, RES);
  const line = c.createLinearGradient(0, 0, 0, len);
  line.addColorStop(0, "rgba(170,240,235,0.32)");
  line.addColorStop(1, "rgba(170,240,235,0.08)");
  c.strokeStyle = line;
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w / 2, len);
  c.stroke();
  const bead = speck(WORM, true);
  for (let y = 8 + r() * 6; y < len; y += 5 + r() * 8) {
    const size = (0.8 + r() * 1.1) * (1 - (y / len) * 0.35);
    c.globalAlpha = 0.45 + r() * 0.5;
    c.drawImage(bead, w / 2 - size * 2, y - size * 2, size * 4, size * 4);
  }
  return s;
}

/** Glowworms on the roof over each strip: specks of blue-green light,
 *  most trailing a thread of glistening beads that sways in the cave's
 *  faint draught. Each glows and dims slowly, on its own. */
export function glowworms(seed: number): Layer {
  const r = rng(seed);
  const glow = speck(WORM, true);
  const worms = SIDES.flatMap(([a, b]) =>
    Array.from({ length: 54 }, () => {
      const x = a + r() * (b - a);
      // the crack lets in too much light for them
      const lit = Math.abs(x - CAVE_CRACK[0]) < 60;
      const hangs = !lit && r() < 0.55;
      const len = 40 + r() ** 1.4 * 300;
      return {
        x,
        y: 34 + r() * 70,
        img: hangs ? thread(len, r) : null,
        len,
        size: 1.2 + r() * 1.6,
        ph: r() * TAU,
        f: 0.15 + r() * 0.35,
        sw: 0.3 + r() * 0.4,
        dim: lit,
      };
    }),
  );
  return {
    update() {},
    draw(c, t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      // the draught moves along the roof, so neighbours sway together
      const draft = (x: number) => 0.012 * Math.sin(t * 0.21 - x * 0.006) + 0.006 * Math.sin(t * 0.47 + x * 0.013);
      for (const w of worms) {
        if (w.x < x0 - 30 || w.x > x1 + 30) continue;
        const shine = 0.7 + 0.3 * Math.sin(t * w.f + w.ph);
        if (w.img) {
          const a = draft(w.x) + 0.006 * Math.sin(t * w.sw + w.ph);
          c.globalAlpha = 0.65 + 0.35 * shine;
          c.save();
          c.translate(w.x, w.y);
          c.rotate(a);
          c.drawImage(w.img, -5, 0, 10, w.img.height / RES);
          c.restore();
        }
        const s = w.size * 2.4;
        c.globalAlpha = (w.dim ? 0.3 : 0.95) * shine;
        c.drawImage(glow, w.x - s, w.y - s, s * 2, s * 2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

// ── drips ──

/** Scene units per second², for a fall that looks a few metres long. */
const G = 1400;

/** Water gathering at the stalactites' tips and falling into the pool,
 *  each on its DRIPS schedule: a bead swells, lets go, falls catching the
 *  crystals' light, and splashes up a few droplets where it lands. */
export function drips(): Layer {
  const drop = speck("#cfefff", true);
  const ds = DRIPS.map((d) => ({ ...d, fall: Math.sqrt((2 * (d.y - d.tip)) / G) }));
  return {
    update() {},
    draw(c, t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      for (const d of ds) {
        if (d.x < x0 - 20 || d.x > x1 + 20) continue;
        const age = (((t + d.at) % d.every) + d.every) % d.every;
        const leave = d.every - d.fall;
        if (age > leave - 2.2 && age < leave) {
          // gathering at the tip
          const k = (age - (leave - 2.2)) / 2.2;
          const s = 1.2 + 2.2 * k * k;
          c.globalAlpha = 0.35 + 0.5 * k;
          c.drawImage(drop, d.x - s, d.tip - 1 + s * 0.4 - s, s * 2, s * 2);
        } else if (age >= leave) {
          // falling, stretched by its speed
          const f = age - leave;
          const y = d.tip + 0.5 * G * f * f;
          const v = G * f;
          const s = 2.6;
          const h = s + v * 0.012;
          c.globalAlpha = 0.85;
          c.drawImage(drop, d.x - s, y - h, s * 2, h * 2);
        } else if (age < 0.45) {
          // a splash: a flash, and droplets thrown up and falling back
          const k = age / 0.45;
          c.globalAlpha = (1 - k) * 0.7;
          const f = 4 + 6 * k;
          c.drawImage(drop, d.x - f, d.y - f * 0.6, f * 2, f * 1.2);
          for (let i = 0; i < 3; i++) {
            const vx = (i - 1) * 26 + (d.x % 7) - 3;
            const vy = 150 - Math.abs(i - 1) * 40;
            const y = d.y - (vy * age - 0.5 * G * age * age);
            if (y > d.y) continue;
            c.globalAlpha = 0.8 * (1 - k);
            c.drawImage(drop, d.x + vx * age - 1.6, y - 1.6, 3.2, 3.2);
          }
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

// ── dust in the light ──

/** Motes turning slowly in the shaft of daylight from the crack (whose
 *  direction and spread these match), brightest near the top of it and
 *  unseen outside it. */
export function beamDust(dir: number, spread: number, len: number, seed: number): Layer {
  const r = rng(seed);
  const img = speck("#eef4ff", true);
  const [ox, oy] = CAVE_CRACK;
  const motes = Array.from({ length: 34 }, () => ({ s: 0.08 + r() * 0.9, u: r() * 2 - 1, vs: (r() - 0.6) * 0.006, ph: r() * TAU, f: 0.1 + r() * 0.25, size: 0.8 + r() * 1.4 }));
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  return {
    update(dt, t) {
      for (const m of motes) {
        m.s += m.vs * dt;
        m.u += 0.03 * Math.sin(t * m.f + m.ph) * dt;
        if (m.s > 1) m.s -= 0.92;
        if (m.s < 0.08) m.s += 0.92;
        if (Math.abs(m.u) > 1) m.u = -Math.sign(m.u) * 0.98;
      }
    },
    draw(c, t, x0, x1) {
      if (ox < x0 - 200 || ox - len * 0.2 > x1) return;
      c.globalCompositeOperation = "lighter";
      for (const m of motes) {
        const d = m.s * len;
        const across = m.u * spread * d;
        const x = ox + ux * d - uy * across;
        const y = oy + uy * d + ux * across;
        // in the light only: soft at the beam's edges and fading with depth
        const a = (1 - m.u * m.u) * Math.exp(-m.s * 2.2) * (0.6 + 0.4 * Math.sin(t * m.f * 3 + m.ph));
        if (a < 0.02) continue;
        c.globalAlpha = a;
        const s = m.size * 2;
        c.drawImage(img, x - s, y - s, s * 2, s * 2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

// ── a bat ──

/** Half the wingspan, in scene units; wingbeats a second; speed. */
const BAT_HALF = 17;
const BAT_BEAT = 7.5;
const BAT_SPEED = 210;

/** One wing, the right, at `lift` (-1 down … 1 up): the arm out to the
 *  wrist, fingers spreading to the tip, the membrane scalloped between
 *  them back to the body. */
function batWing(c: Ctx, lift: number) {
  const tipY = -lift * 10;
  const wristY = -lift * 5 - 2;
  const span = BAT_HALF * (0.75 + 0.25 * Math.cos(lift * 1.3));
  c.beginPath();
  c.moveTo(1.5, -1.5);
  c.quadraticCurveTo(span * 0.3, wristY - 3, span * 0.5, wristY);
  c.lineTo(span, tipY);
  // the trailing edge: three scallops between finger tips
  const fingers: Point[] = [
    [span * 0.86, tipY + 6],
    [span * 0.62, wristY + 8],
    [span * 0.3, wristY + 7],
  ];
  let [px, py] = [span, tipY];
  for (const [fx, fy] of fingers) {
    c.quadraticCurveTo((px + fx) / 2 - 1, (py + fy) / 2 - 3, fx, fy);
    [px, py] = [fx, fy];
  }
  c.quadraticCurveTo(span * 0.12, 1, 1, 3);
  c.closePath();
  c.fill();
}

function drawBat(c: Ctx, x: number, y: number, face: number, phase: number) {
  const lift = Math.cos(phase * TAU);
  c.save();
  c.translate(x, y);
  c.scale(face, 1);
  c.fillStyle = "#0a0712";
  for (const side of [1, -1]) {
    c.save();
    c.scale(side, 1);
    batWing(c, lift);
    c.restore();
  }
  // body, head, ears
  c.beginPath();
  c.ellipse(0, 1, 2.6, 4.4, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(0.4, -3.4, 2.1, 0, TAU);
  c.moveTo(-1.2, -4.6);
  c.lineTo(-1.6, -7.6);
  c.lineTo(0, -5.2);
  c.lineTo(1.4, -7.8);
  c.lineTo(1.9, -4.4);
  c.fill();
  c.restore();
}

/** Now and then a bat flits through one strip: in past an edge, a jinking
 *  loop through the dark, and out again. */
export function bat(seed: number): Layer {
  const r = rng(seed);
  let next = 25 + r() * 30;
  let path: Point[] | null = null;
  let lengths: number[] = [];
  let total = 0;
  let flown = 0;
  let x = 0;
  let y = 0;
  let face = 1;
  /** Where along its path it is, without the jinks. */
  let px = 0;
  let clock = 0;

  /** Catmull-Rom through the waypoints, at u along segment i. */
  const along = (i: number, u: number): Point => {
    const p = path!;
    const [a, b, c2, d] = [p[Math.max(0, i - 1)], p[i], p[i + 1], p[Math.min(p.length - 1, i + 2)]];
    const f = (k: 0 | 1) => 0.5 * (2 * b[k] + (-a[k] + c2[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c2[k] - d[k]) * u * u + (-a[k] + 3 * b[k] - 3 * c2[k] + d[k]) * u * u * u);
    return [f(0), f(1)];
  };
  const start = () => {
    const [a, b] = SIDES[r() < 0.5 ? 0 : 1];
    const outer = a < 800 ? a - 60 : b + 60;
    const inner = a < 800 ? b + 60 : a - 60;
    const [from, to] = r() < 0.5 ? [outer, inner] : [inner, outer];
    const pts: Point[] = [[from, 160 + r() * 300]];
    for (let i = 0; i < 3; i++) pts.push([a + 40 + r() * (b - a - 80), 130 + r() * 380]);
    pts.push([to, 140 + r() * 300]);
    path = pts;
    lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    total = lengths.reduce((s, l) => s + l, 0);
    flown = 0;
    px = from;
  };
  return {
    update(dt, t) {
      clock += dt;
      if (!path) {
        if (clock > next) start();
        return;
      }
      flown += BAT_SPEED * dt;
      if (flown >= total) {
        path = null;
        next = clock + 50 + r() * 70;
        return;
      }
      let i = 0;
      let d = flown;
      while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
      const [nx, ny] = along(i, Math.min(1, d / lengths[i]));
      // jinking, as bats do
      const jx = 3 * Math.sin(t * 9.1) + 2 * Math.sin(t * 13.7);
      const jy = 4 * Math.sin(t * 7.3 + 1);
      if (Math.abs(nx - px) > 0.1) face = nx > px ? 1 : -1;
      px = nx;
      x = nx + jx;
      y = ny + jy;
    },
    draw(c, t, x0, x1) {
      if (!path || x < x0 - 30 || x > x1 + 30) return;
      drawBat(c, x, y, face, t * BAT_BEAT);
    },
  };
}
