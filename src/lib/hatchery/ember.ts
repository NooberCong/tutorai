/** The ember crags' life, over its reader backdrop (ambience.ts): sparks
 *  spiralling up off the lava and winking out as they cool, ash drifting
 *  down, bubbles swelling and breaking on the lava lake, and now and then
 *  the volcano coughing up a puff of smoke and a spray of cinders that
 *  fall back onto its flanks.
 *
 *  Bubbles break at LAVA_BUBBLES, cinders land on volcanoAt(): both are
 *  the painting's own (backdrops.ts). Everything is drawn in its
 *  1600×1000 scene space from stamped sprites, so it stays cheap. */

import type { Layer } from "./ambience.ts";
import { CRATER, LAVA_BUBBLES, rng, volcanoAt } from "./backdrops.ts";
import { speck } from "./speck.ts";

type Area = [x0: number, y0: number, x1: number, y1: number];

const TAU = Math.PI * 2;
const W = 1600;
/** Heat, hot to cold: what a spark or a cinder looks like as it cools. */
const COOLING = ["#fff2c4", "#ffc464", "#ff8a30", "#e0501c", "#a8301a"];
/** Scene units per second², for cinders: heavy, but slowed by the air. */
const G = 320;

/** The cooling sprites, painted once per layer. */
const cooling = () => COOLING.map((c) => speck(c, true));
/** Heat 1 … 0 as a sprite from `imgs`. */
const heated = (imgs: OffscreenCanvas[], heat: number) => imgs[Math.min(imgs.length - 1, Math.floor((1 - heat) * imgs.length))];

interface Spark {
  x: number;
  y: number;
  age: number;
  life: number;
  vx: number;
  vy: number;
  /** How wide it spirals, how fast and which way, and where it starts. */
  turn: number;
  w: number;
  ph: number;
  size: number;
}

/** Sparks lifting off the lava in `areas`, `n` aloft at once: each rises
 *  in a slow spiral on the hot air, drifting with the wind, cooling from
 *  white-gold to a dull red, and winks out. */
export function sparks(n: number, areas: Area[], seed: number): Layer {
  const r = rng(seed);
  const imgs = cooling();
  const spawn = (s: Spark) => {
    const [x0, y0, x1, y1] = areas[Math.floor(r() * areas.length)];
    s.x = x0 + r() * (x1 - x0);
    s.y = y0 + r() * (y1 - y0);
    s.age = 0;
    s.life = 3 + r() * 5;
    s.vx = -5 + (r() - 0.5) * 10;
    s.vy = -(18 + r() * 26);
    s.turn = 3 + r() * 9;
    s.w = (0.9 + r() * 1.4) * (r() < 0.5 ? 1 : -1);
    s.ph = r() * TAU;
    s.size = 1 + r() * 1.6;
  };
  const ps = Array.from({ length: n }, () => {
    const s: Spark = { x: 0, y: 0, age: 0, life: 1, vx: 0, vy: 0, turn: 0, w: 0, ph: 0, size: 1 };
    spawn(s);
    s.age = r() * s.life;
    return s;
  });
  return {
    update(dt) {
      for (const s of ps) {
        s.age += dt;
        if (s.age > s.life) spawn(s);
      }
    },
    draw(c, _t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      for (const s of ps) {
        const f = s.age / s.life;
        // rising slower as it cools, and spiralling wider
        const x = s.x + s.vx * s.age + s.turn * (0.4 + f) * Math.sin(s.w * s.age + s.ph);
        const y = s.y + s.vy * s.age * (1 - f * 0.35);
        if (x < x0 - 10 || x > x1 + 10) continue;
        // in quickly; at the end a last flicker, and out
        let a = Math.min(1, s.age / 0.3);
        if (f > 0.8) a *= ((1 - f) / 0.2) * (0.6 + 0.4 * Math.sin(s.age * 31 + s.ph));
        if (a <= 0.02) continue;
        const sz = s.size * (1.6 - f * 0.7) * 2.2;
        c.globalAlpha = a;
        c.drawImage(heated(imgs, 1 - f), x - sz, y - sz, sz * 2, sz * 2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

interface Flake {
  x: number;
  y: number;
  /** Where it settles into the lake. */
  floor: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  ph: number;
}

/** Flakes of ash drifting down on the wind, tumbling, picking up the
 *  lava's glow as they sink toward it; settling into the lake, they're
 *  gone. */
export function ash(n: number, seed: number): Layer {
  const r = rng(seed);
  const spawn = (f: Flake, top: boolean) => {
    f.x = r() * (W + 200);
    f.y = top ? -10 - r() * 60 : r() * 820;
    f.floor = 800 + r() * 180;
  };
  const fs = Array.from({ length: n }, () => {
    const f: Flake = { x: 0, y: 0, floor: 0, vx: -(6 + r() * 10), vy: 7 + r() * 11, size: 1 + r() * 1.8, spin: 0.6 + r() * 1.6, ph: r() * TAU };
    spawn(f, false);
    return f;
  });
  return {
    update(dt, t) {
      for (const f of fs) {
        f.x += (f.vx + 6 * Math.sin(t * 0.4 + f.ph)) * dt;
        f.y += f.vy * dt;
        if (f.y > f.floor || f.x < -40) spawn(f, true);
      }
    },
    draw(c, t, x0, x1) {
      for (const f of fs) {
        if (f.x < x0 - 6 || f.x > x1 + 6) continue;
        // cold grey above, warmed from below near the lava
        const warm = Math.min(1, Math.max(0, (f.y - 450) / 400));
        c.fillStyle = `rgb(${58 + warm * 120},${42 + warm * 30},${42 + warm * 8})`;
        c.globalAlpha = 0.55 * Math.min(1, (f.floor - f.y) / 40, (f.y + 10) / 40 + 0.2);
        c.save();
        c.translate(f.x, f.y);
        c.rotate(f.ph + t * f.spin * 0.5);
        c.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(t * f.spin + f.ph)));
        c.beginPath();
        c.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

/** Bubbles rising through the lava lake at LAVA_BUBBLES, each on its own
 *  slow cycle: a dome of brighter lava swells through the crust, bursts
 *  with a flash and a ring spreading over the surface, and throws up a
 *  few droplets that fall back in. Drawn from the time alone. */
export function lavaBubbles(seed: number): Layer {
  const r = rng(seed);
  const imgs = cooling();
  const flash = speck("#ffd890", true);
  const SWELL = 2.6;
  const bs = LAVA_BUBBLES.map(([x, y, s]) => ({ x, y, s, every: 8 + r() * 9, at: r() * 20, seed: Math.floor(r() * 1e6) }));
  return {
    update() {},
    draw(c, t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      for (const b of bs) {
        if (b.x < x0 - 40 || b.x > x1 + 40) continue;
        const cycle = Math.floor((t + b.at) / b.every);
        const age = t + b.at - cycle * b.every;
        const s = b.s;
        if (age < SWELL) {
          // the dome, rising and brightening
          const k = age / SWELL;
          const e = k * k * (3 - 2 * k);
          const rw = (4 + 9 * e) * s;
          c.globalAlpha = 0.25 + 0.5 * e;
          c.drawImage(imgs[1], b.x - rw * 1.4, b.y - rw * 0.9, rw * 2.8, rw * 1.3);
          c.globalAlpha = 0.5 * e;
          c.drawImage(flash, b.x - rw * 0.6, b.y - rw * 0.75, rw * 1.2, rw * 0.6);
          continue;
        }
        const a = age - SWELL;
        if (a > 1.6) continue;
        // the burst
        if (a < 0.5) {
          c.globalAlpha = (1 - a / 0.5) * 0.9;
          const fw = 16 * s;
          c.drawImage(flash, b.x - fw, b.y - fw * 0.6, fw * 2, fw * 1.2);
        }
        // a ring spreading over the surface, flattened by the slant
        const rr = (8 + a * 26) * s;
        c.globalAlpha = 0.4 * (1 - a / 1.6) ** 2;
        c.strokeStyle = "#ff9a40";
        c.lineWidth = 1.1 * s;
        c.beginPath();
        c.ellipse(b.x, b.y, rr, rr * 0.28, 0, 0, TAU);
        c.stroke();
        // droplets thrown up, falling back
        const dr = rng(b.seed + cycle);
        for (let i = 0; i < 5; i++) {
          const vx = (dr() - 0.5) * 90 * s;
          const vy = -(70 + dr() * 90) * s;
          const g = 560 * s;
          const tl = (-2 * vy) / g;
          if (a > tl) continue;
          const dx = vx * a;
          const dy = vy * a + 0.5 * g * a * a;
          const sz = (1.6 + dr()) * s * 2;
          c.globalAlpha = 0.9 * (1 - (a / tl) * 0.4);
          c.drawImage(heated(imgs, 1 - (a / tl) * 0.7), b.x + dx - sz, b.y + dy - sz, sz * 2, sz * 2);
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

interface Cinder {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds since thrown (negative: not yet), and since it landed. */
  age: number;
  down: number;
  size: number;
}

interface Puff {
  age: number;
  life: number;
  dx: number;
  size: number;
}

/** Now and then the volcano coughs: its crater flares, a puff of smoke
 *  rolls up lit from beneath, and glowing cinders arc out and fall back
 *  onto its flanks, where they cool and fade. Soft, and a minute or two
 *  apart. */
export function eruptions(seed: number): Layer {
  const r = rng(seed);
  const imgs = cooling();
  const flare = speck("#ffb060", false);
  const smoke = speck("#5a302a", false);
  const under = speck("#ff7a30", false);
  const [cx, cy] = CRATER;
  let clock = 0;
  let next = 20 + r() * 25;
  let since = Infinity;
  let cinders: Cinder[] = [];
  let puffs: Puff[] = [];
  const erupt = () => {
    since = 0;
    cinders = Array.from({ length: 14 + Math.floor(r() * 10) }, () => ({
      x: cx + (r() - 0.5) * 50,
      y: cy - 2,
      vx: (r() - 0.5) * 2 * (40 + r() * 110),
      vy: -(160 + r() * 240),
      age: -r() * 1.4,
      down: -1,
      size: 1 + r() * 1.2,
    }));
    puffs = Array.from({ length: 4 }, (_, i) => ({ age: -i * 0.7, life: 9 + r() * 4, dx: (r() - 0.5) * 30, size: 30 + r() * 20 }));
  };
  return {
    update(dt) {
      clock += dt;
      since += dt;
      if (clock > next) {
        erupt();
        next = clock + 60 + r() * 80;
      }
      for (const k of cinders) {
        k.age += dt;
        if (k.age <= 0) continue;
        if (k.down >= 0) {
          k.down += dt;
          continue;
        }
        k.vy += G * dt;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        if (k.vy > 0 && k.y >= volcanoAt(k.x)) {
          k.y = volcanoAt(k.x);
          k.down = 0;
        }
      }
      cinders = cinders.filter((k) => k.down < 2.5);
      for (const p of puffs) p.age += dt;
      puffs = puffs.filter((p) => p.age < p.life);
    },
    draw(c, _t, x0, x1) {
      if (since > 14 || x1 < cx - 600 || x0 > cx + 400) return;
      // the smoke, then its underside lit by the crater
      for (const p of puffs) {
        if (p.age <= 0) continue;
        const f = p.age / p.life;
        const sz = p.size * (1 + f * 3.5);
        const x = cx + p.dx - f * f * 90;
        const y = cy - 14 - p.age * 20;
        c.globalAlpha = 0.32 * Math.min(1, p.age / 1.2) * (1 - f);
        c.drawImage(smoke, x - sz, y - sz, sz * 2, sz * 2);
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.22 * Math.max(0, 1 - f * 2.5);
        c.drawImage(under, x - sz * 0.8, y - sz * 0.2, sz * 1.6, sz);
        c.globalCompositeOperation = "source-over";
      }
      c.globalCompositeOperation = "lighter";
      // the crater flaring up, then settling over a few seconds
      const fl = Math.min(1, since / 0.4) * Math.exp(-since / 2.2);
      if (fl > 0.01) {
        c.globalAlpha = fl * 0.6;
        c.drawImage(flare, cx - 140, cy - 110, 280, 180);
      }
      for (const k of cinders) {
        if (k.age <= 0) continue;
        // hot in flight; cooling once landed
        const heat = k.down < 0 ? 1 - Math.min(0.4, k.age * 0.12) : 0.6 * (1 - k.down / 2.5);
        const img = heated(imgs, heat);
        const sz = k.size * 2.6;
        if (k.down < 0) {
          // a short trail: where it was a moment ago
          for (let j = 3; j >= 1; j--) {
            const b = j * 0.03;
            c.globalAlpha = 0.25 * (1 - j / 4);
            c.drawImage(img, k.x - k.vx * b - sz * 0.7, k.y - (k.vy - G * b * 0.5) * b - sz * 0.7, sz * 1.4, sz * 1.4);
          }
        }
        c.globalAlpha = k.down < 0 ? Math.min(1, k.age * 5) : 1 - k.down / 2.5;
        c.drawImage(img, k.x - sz, k.y - sz, sz * 2, sz * 2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}
