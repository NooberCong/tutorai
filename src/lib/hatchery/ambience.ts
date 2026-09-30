/** Ambience: what drifts over a reader backdrop — pollen and falling
 *  leaves, embers, bubbles, snow, meteors, fireflies, crystal glints,
 *  candle flicker — in the same 1600×1000 scene space as the painting,
 *  mapped the way the reader shows it: two halves, each pinned to its own
 *  edge and cropped to cover. The painting's own big features move in
 *  living.ts.
 *
 *  Everything moves slowly and continuously (time-based, eased by sums of
 *  sines, no jumps), so it reads as calm. It runs in a worker on an
 *  OffscreenCanvas (components/hatchery/ambience.worker.ts), never on the
 *  main thread. */

import type { Element } from "./kit.ts";

const W = 1600;
const H = 1000;

type Ctx = OffscreenCanvasRenderingContext2D;
type Area = [x0: number, y0: number, x1: number, y1: number];

interface Layer {
  update(dt: number, t: number): void;
  /** Draw in scene space; [x0, x1] is the visible slice of the scene. */
  draw(c: Ctx, t: number, x0: number, x1: number): void;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

// ── sprites: soft round lights, drawn once per color ──

const sprites = new Map<string, OffscreenCanvas>();
/** A 64px soft glow in `color`; `core` adds a bright center (a speck with a
 *  halo rather than a haze). */
function sprite(color: string, core = false): OffscreenCanvas {
  const key = color + (core ? "*" : "");
  let s = sprites.get(key);
  if (!s) {
    s = new OffscreenCanvas(64, 64);
    const c = s.getContext("2d")!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (core) {
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.12, color);
      g.addColorStop(0.3, withAlpha(color, 0.35));
    } else {
      g.addColorStop(0, color);
      g.addColorStop(0.4, withAlpha(color, 0.4));
    }
    g.addColorStop(1, withAlpha(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    sprites.set(key, s);
  }
  return s;
}

function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── layers ──

interface MoteOpts {
  n: number;
  area: Area;
  /** Base velocity (scene units per second) and random spread around it. */
  v: [number, number];
  spread: [number, number];
  /** Sideways/vertical sway, units per second. */
  wander: number;
  size: [number, number];
  colors: string[];
  alpha: [number, number];
  /** Twinkle period in seconds (0 = steady). */
  twinkle?: number;
  core?: boolean;
  /** Bigger motes move faster (depth); snow, embers. */
  depth?: boolean;
  seed: number;
}

/** Drifting specks: pollen, embers, dust, snow, fireflies. They wrap around
 *  their area and fade in and out at its edges, so none pops. */
function motes(o: MoteOpts): Layer {
  const r = rng(o.seed);
  const [ax0, ay0, ax1, ay1] = o.area;
  const aw = ax1 - ax0;
  const ah = ay1 - ay0;
  const ps = Array.from({ length: o.n }, () => {
    const k = r();
    const size = o.size[0] + (o.depth ? k : r()) * (o.size[1] - o.size[0]);
    const speed = o.depth ? 0.45 + k * 0.9 : 1;
    return {
      x: ax0 + r() * aw,
      y: ay0 + r() * ah,
      vx: (o.v[0] + (r() - 0.5) * 2 * o.spread[0]) * speed,
      vy: (o.v[1] + (r() - 0.5) * 2 * o.spread[1]) * speed,
      size,
      img: sprite(o.colors[Math.floor(r() * o.colors.length)], o.core),
      a: o.alpha[0] + r() * (o.alpha[1] - o.alpha[0]),
      ph: r() * TAU,
      f: 0.15 + r() * 0.25,
    };
  });
  return {
    update(dt, t) {
      for (const p of ps) {
        p.x += (p.vx + o.wander * Math.sin(t * p.f + p.ph)) * dt;
        p.y += (p.vy + o.wander * 0.6 * Math.cos(t * p.f * 0.83 + p.ph * 1.7)) * dt;
        if (p.x < ax0) p.x += aw;
        else if (p.x > ax1) p.x -= aw;
        if (p.y < ay0) p.y += ah;
        else if (p.y > ay1) p.y -= ah;
      }
    },
    draw(c, t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      for (const p of ps) {
        const s = p.size * 2.5;
        if (p.x + s < x0 || p.x - s > x1) continue;
        // fade near the top and bottom of the area, where motes wrap
        const edge = Math.min(p.y - ay0, ay1 - p.y) / 60;
        let a = p.a * Math.min(1, edge);
        if (o.twinkle) a *= 0.55 + 0.45 * Math.sin((t * TAU) / o.twinkle + p.ph);
        if (a <= 0.01) continue;
        c.globalAlpha = a;
        c.drawImage(p.img, p.x - s, p.y - s, s * 2, s * 2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

/** Leaves drifting down from the canopy, fluttering as they fall. */
function leaves(n: number, spawn: Area[], colors: string[], seed: number): Layer {
  const r = rng(seed);
  const reset = (p: { x: number; y: number }, first: boolean) => {
    const [x0, y0, x1, y1] = spawn[Math.floor(r() * spawn.length)];
    p.x = x0 + r() * (x1 - x0);
    p.y = first ? y0 + r() * 900 : y0 + r() * (y1 - y0);
  };
  const ps = Array.from({ length: n }, () => {
    const p = { x: 0, y: 0, vy: 22 + r() * 18, size: 5 + r() * 4, color: colors[Math.floor(r() * colors.length)], ph: r() * TAU, f: 0.5 + r() * 0.5 };
    reset(p, true);
    return p;
  });
  return {
    update(dt, t) {
      for (const p of ps) {
        p.y += p.vy * dt;
        p.x += Math.sin(t * p.f + p.ph) * 30 * dt + 6 * dt;
        if (p.y > 980) reset(p, false);
      }
    },
    draw(c, t, x0, x1) {
      for (const p of ps) {
        if (p.x < x0 - 20 || p.x > x1 + 20) continue;
        const fade = Math.min(1, (980 - p.y) / 80);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.sin(t * p.f * 1.3 + p.ph) * 0.9);
        // flip as it turns over in the air
        c.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * p.f + p.ph)));
        c.globalAlpha = 0.75 * fade;
        c.fillStyle = p.color;
        c.beginPath();
        c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

/** Bubbles wobbling up through the water. */
function bubbles(n: number, area: Area, seed: number): Layer {
  const r = rng(seed);
  const [ax0, ay0, ax1, ay1] = area;
  const ps = Array.from({ length: n }, () => {
    const size = 2 + r() * r() * 8;
    return { x: ax0 + r() * (ax1 - ax0), y: ay0 + r() * (ay1 - ay0), vy: -(30 + size * 6 + r() * 20), size, ph: r() * TAU, f: 1 + r() * 1.5 };
  });
  return {
    update(dt) {
      for (const p of ps) {
        p.y += p.vy * dt;
        if (p.y < ay0) {
          p.y = ay1;
          p.x = ax0 + r() * (ax1 - ax0);
        }
      }
    },
    draw(c, t, x0, x1) {
      c.strokeStyle = "rgba(232,255,250,0.55)";
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 1.4;
      for (const p of ps) {
        const x = p.x + Math.sin(t * p.f + p.ph) * (2 + p.size * 0.6);
        if (x < x0 - 10 || x > x1 + 10) continue;
        c.globalAlpha = Math.min(1, (p.y - ay0) / 80, (ay1 - p.y) / 40);
        c.beginPath();
        c.arc(x, p.y, p.size, 0, TAU);
        c.stroke();
        c.beginPath();
        c.arc(x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  };
}

/** A light that breathes slowly (lava, crystals, the moon's halo), or
 *  flickers (candles). */
function pulse(x: number, y: number, radius: number, color: string, base: number, amp: number, period: number, flicker = false, seed = 1): Layer {
  const ph = rng(seed)() * TAU;
  const img = sprite(color);
  return {
    update() {},
    draw(c, t, x0, x1) {
      if (x + radius < x0 || x - radius > x1) return;
      const k = flicker
        ? Math.sin(t * 7.3 + ph) * 0.45 + Math.sin(t * 11.9 + ph * 2) * 0.3 + Math.sin(t * 2.3 + ph) * 0.25
        : Math.sin((t * TAU) / period + ph);
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = Math.max(0, base + amp * k);
      c.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

/** Occasional four-pointed glints: light catching crystal faces. */
function glints(points: Area[], n: number, color: string, seed: number): Layer {
  const r = rng(seed);
  const img = sprite(color, true);
  const gs = Array.from({ length: n }, () => {
    const [x0, y0, x1, y1] = points[Math.floor(r() * points.length)];
    return { x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), period: 4 + r() * 6, ph: r(), size: 6 + r() * 8 };
  });
  return {
    update() {},
    draw(c, t, x0, x1) {
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = color;
      for (const g of gs) {
        if (g.x < x0 - 20 || g.x > x1 + 20) continue;
        const phase = (t / g.period + g.ph) % 1;
        // a short, soft flash once per period
        const k = phase < 0.18 ? Math.sin((phase / 0.18) * Math.PI) : 0;
        if (k <= 0) continue;
        const s = g.size * (0.6 + 0.4 * k);
        c.globalAlpha = k;
        c.drawImage(img, g.x - s, g.y - s, s * 2, s * 2);
        c.globalAlpha = k * 0.8;
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(g.x - s * 1.8, g.y);
        c.lineTo(g.x + s * 1.8, g.y);
        c.moveTo(g.x, g.y - s * 1.8);
        c.lineTo(g.x, g.y + s * 1.8);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

/** Light shafts that sway and breathe. */
function shafts(ox: number, oy: number, dir: number, spread: number, n: number, len: number, color: string, strength: number, seed: number): Layer {
  const r = rng(seed);
  const rays = Array.from({ length: n }, (_, i) => ({
    a: dir + (i / (n - 1) - 0.5) * 2 * spread + (r() - 0.5) * 0.08,
    w: 0.025 + r() * 0.035,
    ph: r() * TAU,
    f: 0.05 + r() * 0.06,
  }));
  let grad: CanvasGradient | null = null;
  return {
    update() {},
    draw(c, t) {
      if (!grad) {
        grad = c.createRadialGradient(ox, oy, 0, ox, oy, len);
        grad.addColorStop(0, withAlpha(color, 0));
        grad.addColorStop(0.25, withAlpha(color, 1));
        grad.addColorStop(1, withAlpha(color, 0));
      }
      c.globalCompositeOperation = "lighter";
      c.fillStyle = grad;
      for (const ray of rays) {
        const a = ray.a + 0.035 * Math.sin(t * ray.f * TAU + ray.ph);
        c.globalAlpha = strength * (0.5 + 0.5 * Math.sin(t * ray.f * 1.7 * TAU + ray.ph * 2));
        c.beginPath();
        c.moveTo(ox, oy);
        c.lineTo(ox + Math.cos(a - ray.w) * len, oy + Math.sin(a - ray.w) * len);
        c.lineTo(ox + Math.cos(a + ray.w) * len, oy + Math.sin(a + ray.w) * len);
        c.closePath();
        c.fill();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    },
  };
}

/** Now and then, a meteor streaks across the upper sky. */
function meteors(area: Area, every: [number, number], seed: number): Layer {
  const r = rng(seed);
  let next = every[0] * 0.5 + r() * every[1] * 0.5;
  let m: { x: number; y: number; vx: number; vy: number; age: number } | null = null;
  let clock = 0;
  return {
    update(dt) {
      clock += dt;
      if (!m && clock > next) {
        const [x0, y0, x1, y1] = area;
        m = { x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), vx: -(500 + r() * 300) * (r() < 0.5 ? -1 : 1), vy: 180 + r() * 120, age: 0 };
        next = clock + every[0] + r() * (every[1] - every[0]);
      }
      if (m) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.age += dt;
        if (m.age > 1.1) m = null;
      }
    },
    draw(c) {
      if (!m) return;
      const k = Math.sin((m.age / 1.1) * Math.PI);
      const tx = m.x - m.vx * 0.18;
      const ty = m.y - m.vy * 0.18;
      const g = c.createLinearGradient(tx, ty, m.x, m.y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, `rgba(255,255,255,${0.9 * k})`);
      c.strokeStyle = g;
      c.lineWidth = 1.6;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(m.x, m.y);
      c.stroke();
    },
  };
}

/** Soft wisps of cloud drifting sideways across the sky. */
function wisps(n: number, area: Area, seed: number): Layer {
  const r = rng(seed);
  const img = sprite("#ffffff");
  const [ax0, ay0, ax1, ay1] = area;
  const ws = Array.from({ length: n }, () => ({ x: ax0 + r() * (ax1 - ax0), y: ay0 + r() * (ay1 - ay0), w: 220 + r() * 260, h: 26 + r() * 30, vx: 6 + r() * 8, a: 0.1 + r() * 0.12 }));
  return {
    update(dt) {
      for (const w of ws) {
        w.x += w.vx * dt;
        if (w.x - w.w > ax1) w.x = ax0 - w.w;
      }
    },
    draw(c, _t, x0, x1) {
      for (const w of ws) {
        if (w.x + w.w < x0 || w.x - w.w > x1) continue;
        c.globalAlpha = w.a;
        c.drawImage(img, w.x - w.w, w.y - w.h, w.w * 2, w.h * 2);
      }
      c.globalAlpha = 1;
    },
  };
}

/** A few birds gliding across now and then, wings beating slowly. */
function birds(seed: number): Layer {
  const r = rng(seed);
  let flock: { x: number; y: number; dy: number; ph: number }[] = [];
  let vx = 40;
  let next = 6;
  let clock = 0;
  return {
    update(dt) {
      clock += dt;
      if (!flock.length && clock > next) {
        const dir = r() < 0.5 ? 1 : -1;
        vx = dir * (34 + r() * 16);
        const y = 180 + r() * 200;
        const x = dir > 0 ? -60 : W + 60;
        flock = Array.from({ length: 3 + Math.floor(r() * 3) }, (_, i) => ({ x: x - dir * i * (24 + r() * 12), y: y + (i % 2 ? 1 : -1) * i * 9, dy: (r() - 0.5) * 4, ph: r() * TAU }));
        next = clock + 30 + r() * 30;
      }
      for (const b of flock) {
        b.x += vx * dt;
        b.y += b.dy * dt;
      }
      if (flock.length && flock.every((b) => b.x < -100 || b.x > W + 100)) flock = [];
    },
    draw(c, t) {
      c.strokeStyle = "rgba(62,68,112,0.85)";
      c.lineWidth = 1.8;
      c.lineCap = "round";
      for (const b of flock) {
        const lift = 5 * Math.sin(t * 5 + b.ph);
        c.beginPath();
        c.moveTo(b.x - 10, b.y - lift);
        c.quadraticCurveTo(b.x - 4, b.y - 3, b.x, b.y);
        c.quadraticCurveTo(b.x + 4, b.y - 3, b.x + 10, b.y - lift);
        c.stroke();
      }
    },
  };
}

// ── the habitats ──

const LAYERS: Record<Element, () => Layer[]> = {
  leaf: () => [
    shafts(700, -140, Math.PI / 2 + 0.05, 0.6, 7, 1100, "#fff5c8", 0.07, 1),
    motes({ n: 70, area: [0, 120, W, 880], v: [3, -5], spread: [4, 4], wander: 8, size: [1.5, 3.5], colors: ["#fff8d0", "#f0ffc0"], alpha: [0.4, 0.9], twinkle: 5, seed: 2 }),
    leaves(9, [[20, 60, 480, 260], [1120, 60, 1580, 240], [260, 300, 440, 380]], ["#6f9f48", "#8cb85a", "#a8c460", "#5a8a3e"], 3),
  ],
  ember: () => [
    pulse(1270, 345, 170, "#ffb14a", 0.14, 0.1, 6, false, 1),
    pulse(1270, 700, 260, "#ff6a20", 0.06, 0.05, 9, false, 2),
    motes({ n: 110, area: [0, 120, W, 920], v: [5, -34], spread: [6, 14], wander: 16, size: [1.2, 3.6], colors: ["#ff7a28", "#ffd27a", "#ff9a40"], alpha: [0.5, 1], twinkle: 1.3, core: true, depth: true, seed: 3 }),
  ],
  tide: () => [
    shafts(800, -420, Math.PI / 2, 0.5, 9, 1450, "#d8fff8", 0.06, 4),
    motes({ n: 90, area: [0, 100, W, 920], v: [2, 5], spread: [3, 3], wander: 5, size: [0.8, 2], colors: ["#d8f4ff"], alpha: [0.25, 0.55], seed: 5 }),
    bubbles(36, [0, 110, W, 930], 6),
  ],
  stone: () => [
    pulse(210, 820, 190, "#6fdcff", 0.1, 0.08, 7, false, 7),
    pulse(1400, 800, 210, "#b48cff", 0.1, 0.08, 8, false, 8),
    pulse(560, 840, 90, "#6fdcff", 0.08, 0.06, 5, false, 9),
    pulse(1100, 835, 100, "#b48cff", 0.08, 0.06, 6, false, 10),
    glints([[80, 640, 340, 870], [1230, 600, 1580, 860], [500, 760, 620, 860], [1040, 750, 1160, 855], [1440, 0, 1560, 110], [90, 0, 170, 100]], 14, "#e8f8ff", 11),
    motes({ n: 70, area: [0, 80, W, 880], v: [1, -2], spread: [3, 3], wander: 6, size: [0.8, 2.4], colors: ["#dff6ff", "#e8d8ff"], alpha: [0.35, 0.8], twinkle: 6, seed: 12 }),
  ],
  sky: () => [
    pulse(1180, 610, 260, "#ffe2a8", 0.05, 0.04, 10, false, 13),
    wisps(7, [-200, 70, W + 200, 460], 14),
    birds(15),
  ],
  frost: () => [
    meteors([200, 20, 1400, 200], [20, 40], 16),
    motes({ n: 170, area: [0, -20, W, 1000], v: [6, 26], spread: [5, 8], wander: 10, size: [0.8, 3.2], colors: ["#ffffff", "#e8f0ff"], alpha: [0.45, 0.95], core: true, depth: true, seed: 17 }),
  ],
  moon: () => [
    pulse(330, 220, 190, "#b8c4ff", 0.06, 0.04, 12, false, 18),
    meteors([600, 20, 1500, 220], [18, 36], 19),
    motes({ n: 34, area: [0, 470, W, 930], v: [0, -2], spread: [6, 5], wander: 14, size: [2.2, 3.8], colors: ["#e8ff9a", "#f4ffc0"], alpha: [0.6, 1], twinkle: 3.2, core: true, seed: 20 }),
  ],
  arcane: () => [
    pulse(290, 560, 70, "#ffb65a", 0.16, 0.06, 1, true, 21),
    pulse(318, 574, 55, "#ffb65a", 0.14, 0.05, 1, true, 22),
    pulse(1290, 566, 65, "#ffb65a", 0.16, 0.06, 1, true, 23),
    pulse(250, 748, 80, "#ffb65a", 0.16, 0.06, 1, true, 24),
    pulse(1350, 758, 75, "#ffb65a", 0.16, 0.06, 1, true, 25),
    motes({ n: 60, area: [0, 90, W, 880], v: [1, -8], spread: [4, 5], wander: 9, size: [1.2, 3], colors: ["#d8b8ff", "#a8e0ff", "#ffe0a8"], alpha: [0.45, 0.95], twinkle: 4, core: true, seed: 26 }),
  ],
};

export interface Ambience {
  /** Advance by dt seconds (time t) and draw into a w×h canvas. */
  frame(c: Ctx, t: number, dt: number, w: number, h: number): void;
}

export function createAmbience(el: Element): Ambience {
  const layers = LAYERS[el]();
  return {
    frame(c, t, dt, w, h) {
      for (const l of layers) l.update(dt, t);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      // the painting's two halves: each covers its half of the reader,
      // pinned to its own edge (see .reader-host.has-backdrop in styles.css)
      const half = w / 2;
      const s = Math.max(half / W, h / H);
      const oy = (h - H * s) / 2;
      const span = half / s;
      for (const side of [0, 1]) {
        const ox = side ? w - W * s : 0;
        c.save();
        c.beginPath();
        c.rect(side ? half : 0, 0, half, h);
        c.clip();
        c.setTransform(s, 0, 0, s, ox, oy);
        const x0 = side ? W - span : 0;
        const x1 = side ? W : span;
        for (const l of layers) l.draw(c, t, x0, x1);
        c.restore();
      }
    },
  };
}
