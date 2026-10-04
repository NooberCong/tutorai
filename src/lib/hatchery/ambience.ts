/** Ambience: what drifts over a reader backdrop — pollen and falling
 *  leaves, butterflies and songbirds (wildlife.ts), sparks, ash, lava
 *  bubbles and the volcano's coughs (ember.ts), bubbles, fish, snow,
 *  meteors, fireflies, crystal glints, glowworms and drips (cave.ts),
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
import { CAVE_CRACK, CAVE_SHROOMS, CRATER, FIRES, LAVA_SHORE, SUN } from "./backdrops.ts";
import { bat, beamDust, drips, glowworms } from "./cave.ts";
import { ash, eruptions, lavaBubbles, sparks } from "./ember.ts";
import { butterflies, songbirds } from "./wildlife.ts";

const W = 1600;
const H = 1000;

type Ctx = OffscreenCanvasRenderingContext2D;
type Area = [x0: number, y0: number, x1: number, y1: number];

export interface Layer {
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
  /** Twinkle as a firefly does: a soft glow, then dark for a while. */
  blink?: boolean;
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
        if (o.blink && o.twinkle) a *= Math.max(0, Math.sin((t * TAU) / (o.twinkle * (0.8 + p.f)) + p.ph)) ** 3;
        else if (o.twinkle) a *= 0.55 + 0.45 * Math.sin((t * TAU) / o.twinkle + p.ph);
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

interface Species {
  /** Half the body's height, as a fraction of its half-length. */
  h: number;
  /** How pointed the snout is: 1 blunt … 0.2 sharp. */
  snout: number;
  tail: "fork" | "round" | "lyre";
  back: string;
  mid: string;
  belly: string;
  fin: string;
  /** The tail, when it differs from the fins. */
  tailFin?: string;
  /** Fin edges, eye ring. */
  edge: string;
  iris: string;
  /** Markings over the body, drawn clipped to it. */
  mark?: (c: Ctx, s: number, h: number) => void;
}

const SPECIES: Record<string, Species> = {
  // white bands edged in black
  clown: {
    h: 0.46, snout: 0.75, tail: "round", back: "#d8500a", mid: "#ff7a1a", belly: "#ffb46a", fin: "#ff8a2a", edge: "#1a0a06", iris: "#ffb040",
    mark(c, s, h) {
      c.lineWidth = 0.07 * s;
      c.strokeStyle = "#1a0a06";
      c.fillStyle = "#fffaf0";
      for (const [x, w] of [[0.42, 0.16], [-0.08, 0.2], [-0.66, 0.1]]) {
        c.beginPath();
        c.ellipse(x * s, 0, w * s, h * 1.1, 0, 0, TAU);
        c.fill();
        c.stroke();
      }
    },
  },
  // the palette mark sweeping from eye to tail, a yellow tail
  blueTang: {
    h: 0.58, snout: 0.6, tail: "fork", back: "#1c3c9c", mid: "#2e62d8", belly: "#6aa4f4", fin: "#2850c0", tailFin: "#ffd030", edge: "#0a0a1a", iris: "#f0f0ff",
    mark(c, s, h) {
      c.fillStyle = "#0a0c1e";
      c.beginPath();
      c.moveTo(0.62 * s, -0.25 * h);
      c.bezierCurveTo(0.2 * s, -0.9 * h, -0.5 * s, -0.7 * h, -0.85 * s, -0.1 * h);
      c.bezierCurveTo(-0.5 * s, -0.25 * h, -0.2 * s, 0.2 * h, -0.5 * s, 0.35 * h);
      c.bezierCurveTo(-0.1 * s, 0.25 * h, 0.1 * s, -0.4 * h, 0.62 * s, -0.25 * h);
      c.fill();
    },
  },
  // a tall disc with a pointed snout
  yellowTang: {
    h: 0.72, snout: 0.25, tail: "round", back: "#e0a800", mid: "#ffd21a", belly: "#fff07a", fin: "#ffc810", edge: "#b08000", iris: "#2a2a2a",
    mark(c, s, h) {
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.beginPath();
      c.ellipse(-0.6 * s, 0.05 * h, 0.06 * s, 0.03 * s, -0.3, 0, TAU);
      c.fill();
    },
  },
  // slender and pink, an orange streak below the eye, a lyre tail
  anthias: {
    h: 0.4, snout: 0.5, tail: "lyre", back: "#d8407a", mid: "#ff6a9a", belly: "#ffc0d4", fin: "#ff7aa6", edge: "#c02a60", iris: "#ffd060",
    mark(c, s, h) {
      c.strokeStyle = "#ffb03a";
      c.lineWidth = 0.06 * s;
      c.beginPath();
      c.moveTo(0.62 * s, 0.05 * h);
      c.quadraticCurveTo(0.45 * s, 0.4 * h, 0.15 * s, 0.55 * h);
      c.stroke();
    },
  },
  chromis: {
    h: 0.48, snout: 0.6, tail: "fork", back: "#2a8a8e", mid: "#5ad0c8", belly: "#d0fff2", fin: "#6ad8d0", edge: "#1a6a6e", iris: "#e0fff8",
  },
  // the school: silvery sardines with a blue back
  sardine: {
    h: 0.3, snout: 0.45, tail: "fork", back: "#2a5a7a", mid: "#8ab4c8", belly: "#e8f4f8", fin: "#9ac0d0", edge: "#2a5a7a", iris: "#101820",
    mark(c, s, h) {
      c.strokeStyle = "rgba(220,240,255,0.55)";
      c.lineWidth = 0.08 * s;
      c.beginPath();
      c.moveTo(0.5 * s, -0.1 * h);
      c.lineTo(-0.75 * s, -0.05 * h);
      c.stroke();
    },
  },
};

interface Fish {
  x: number;
  y: number;
  /** Heading, -1 or 1, and facing, which follows it smoothly: a turn. */
  dir: number;
  face: number;
  speed: number;
  size: number;
  sp: Species;
  alpha: number;
  ph: number;
  /** The stretch it patrols, and its cruising depth. */
  lo: number;
  hi: number;
  depth: number;
  /** Its gradients, made once per canvas (they're in its own coordinates). */
  g?: { c: Ctx; body: CanvasGradient; shade: CanvasGradient };
}

function bodyPath(c: Ctx, s: number, h: number, snout: number) {
  c.beginPath();
  c.moveTo(s, 0.08 * h);
  c.bezierCurveTo(s, -h * snout, 0.4 * s, -h, -0.15 * s, -h * 0.88);
  c.quadraticCurveTo(-0.6 * s, -h * 0.55, -0.84 * s, -h * 0.2);
  c.lineTo(-0.84 * s, h * 0.2);
  c.quadraticCurveTo(-0.6 * s, h * 0.55, -0.15 * s, h * 0.88);
  c.bezierCurveTo(0.4 * s, h, s, h * snout, s, 0.08 * h);
  c.closePath();
}

/** A fin as a filled shape with a few rays running through it. */
function fin(c: Ctx, f: Fish, outline: () => void, rays: [number, number, number, number][], color = f.sp.fin) {
  outline();
  c.fillStyle = color;
  c.fill();
  c.save();
  c.clip();
  c.strokeStyle = f.sp.edge;
  c.globalAlpha *= 0.35;
  c.lineWidth = Math.max(0.5, f.size * 0.03);
  c.beginPath();
  for (const [x0, y0, x1, y1] of rays) {
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
  }
  c.stroke();
  c.restore();
  // a darker rim
  outline();
  c.strokeStyle = f.sp.edge;
  c.globalAlpha *= 0.3;
  c.lineWidth = Math.max(0.5, f.size * 0.025);
  c.stroke();
  c.globalAlpha /= 0.3;
}

/** A fish facing right at the origin, its tail beating by `beat`. */
function drawFish(c: Ctx, f: Fish, beat: number) {
  const s = f.size;
  const sp = f.sp;
  const h = sp.h * s;
  if (f.g?.c !== c) {
    const body = c.createLinearGradient(0, -h, 0, h);
    body.addColorStop(0, sp.back);
    body.addColorStop(0.45, sp.mid);
    body.addColorStop(1, sp.belly);
    // rounder toward the head, in shade toward the tail
    const shade = c.createLinearGradient(s, 0, -0.84 * s, 0);
    shade.addColorStop(0, "rgba(255,255,255,0.12)");
    shade.addColorStop(0.45, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,10,30,0.3)");
    f.g = { c, body, shade };
  }
  const a = c.globalAlpha;
  // fins behind the body: dorsal, anal, then the tail
  c.globalAlpha = a * 0.85;
  const dh = sp.tail === "lyre" ? 0.55 : 0.4;
  fin(c, f, () => {
    c.beginPath();
    c.moveTo(0.38 * s, -0.86 * h);
    c.quadraticCurveTo(0.1 * s, -h - dh * s * 1.2, -0.62 * s, -0.5 * h - 0.12 * s);
    c.lineTo(-0.66 * s, -0.4 * h);
    c.closePath();
  }, [0.25, 0.05, -0.15, -0.35, -0.55].map((x) => [x * s, -0.6 * h, (x - 0.2) * s, -h - dh * s * 2]) as [number, number, number, number][]);
  fin(c, f, () => {
    c.beginPath();
    c.moveTo(-0.05 * s, 0.85 * h);
    c.quadraticCurveTo(-0.3 * s, h + 0.32 * s, -0.66 * s, 0.4 * h + 0.06 * s);
    c.lineTo(-0.66 * s, 0.35 * h);
    c.closePath();
  }, [-0.15, -0.35, -0.55].map((x) => [x * s, 0.6 * h, (x - 0.15) * s, h + 0.5 * s]) as [number, number, number, number][]);
  c.save();
  c.translate(-0.8 * s, 0);
  c.rotate(Math.sin(beat) * 0.36);
  const tl = 0.6 * s;
  const ts = Math.max(h * 1.05, 0.42 * s);
  const r0 = 0.2 * h;
  fin(c, f, () => {
    c.beginPath();
    c.moveTo(0.06 * s, -r0);
    if (sp.tail === "round") {
      c.quadraticCurveTo(-0.3 * tl, -ts, -tl, -0.7 * ts);
      c.quadraticCurveTo(-1.2 * tl, 0, -tl, 0.7 * ts);
      c.quadraticCurveTo(-0.3 * tl, ts, 0.06 * s, r0);
    } else {
      const deep = sp.tail === "lyre" ? 0.4 : 0.6;
      const reach = sp.tail === "lyre" ? 1.3 : 1;
      c.quadraticCurveTo(-0.35 * tl, -0.4 * ts, -tl * reach, -ts * reach);
      c.quadraticCurveTo(-0.75 * tl, -0.3 * ts, -deep * tl, 0);
      c.quadraticCurveTo(-0.75 * tl, 0.3 * ts, -tl * reach, ts * reach);
      c.quadraticCurveTo(-0.35 * tl, 0.4 * ts, 0.06 * s, r0);
    }
    c.closePath();
  }, [-0.8, -0.4, 0, 0.4, 0.8].map((k) => [0, k * r0, -tl * 1.4, k * ts * 1.4]) as [number, number, number, number][], sp.tailFin);
  c.restore();
  // the body, its markings, shading toward the tail
  c.globalAlpha = a;
  bodyPath(c, s, h, sp.snout);
  c.fillStyle = f.g.body;
  c.fill();
  if (sp.mark) {
    c.save();
    c.clip();
    sp.mark(c, s, h);
    c.restore();
    bodyPath(c, s, h, sp.snout);
  }
  c.fillStyle = f.g.shade;
  c.fill();
  // a soft highlight along the back
  c.fillStyle = "rgba(255,255,255,0.16)";
  c.beginPath();
  c.ellipse(0.12 * s, -0.42 * h, 0.55 * s, 0.14 * h, -0.04, 0, TAU);
  c.fill();
  // gill
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.lineWidth = Math.max(0.5, s * 0.035);
  c.beginPath();
  c.arc(0.78 * s, 0.05 * h, 0.36 * s, Math.PI * 0.72, Math.PI * 1.22);
  c.stroke();
  // eye: ring, iris, pupil, a glint
  const ex = 0.66 * s;
  const ey = -0.18 * h;
  const er = Math.max(1, 0.1 * s);
  c.fillStyle = sp.edge;
  c.beginPath();
  c.arc(ex, ey, er * 1.15, 0, TAU);
  c.fill();
  c.fillStyle = sp.iris;
  c.beginPath();
  c.arc(ex, ey, er, 0, TAU);
  c.fill();
  c.fillStyle = "#06080c";
  c.beginPath();
  c.arc(ex + er * 0.12, ey, er * 0.6, 0, TAU);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.beginPath();
  c.arc(ex + er * 0.35, ey - er * 0.35, er * 0.25, 0, TAU);
  c.fill();
  // the side fin, paddling
  c.globalAlpha = a * 0.55;
  c.save();
  c.translate(0.4 * s, 0.25 * h);
  c.rotate(0.5 + Math.sin(beat * 0.7) * 0.35);
  fin(c, f, () => {
    c.beginPath();
    c.moveTo(0, -0.05 * s);
    c.quadraticCurveTo(-0.16 * s, -0.13 * s, -0.3 * s, 0);
    c.quadraticCurveTo(-0.16 * s, 0.08 * s, 0, 0.05 * s);
    c.closePath();
  }, [[0, 0, -0.32 * s, -0.02 * s], [0, 0, -0.28 * s, 0.05 * s]]);
  c.restore();
  c.globalAlpha = a;
}

function steer(f: Fish, dt: number, t: number) {
  f.x += f.dir * f.speed * (0.8 + 0.2 * Math.sin(t * 0.4 + f.ph)) * Math.abs(f.face) * dt + f.dir * f.speed * 0.15 * dt;
  if ((f.dir > 0 && f.x > f.hi) || (f.dir < 0 && f.x < f.lo)) f.dir = -f.dir;
  f.face += (f.dir - f.face) * Math.min(1, dt * 1.6);
}

function place(c: Ctx, f: Fish, t: number, x: number, y: number) {
  c.save();
  c.translate(x, y);
  // nose up or down a little as it rises and sinks
  c.rotate(Math.cos(t * 0.5 + f.ph) * 0.12 * Math.sign(f.face));
  c.scale(f.face, 1);
  c.globalAlpha = f.alpha;
  drawFish(c, f, t * (2.2 + f.speed * 0.06) + f.ph);
  c.restore();
}

/** Reef fish cruising back and forth by the kelp and coral, each over its
 *  own stretch, turning at the ends; and a school out in the blue, drifting
 *  across the whole scene together. */
function fishes(seed: number): Layer {
  const r = rng(seed);
  const kinds = [SPECIES.clown, SPECIES.blueTang, SPECIES.yellowTang, SPECIES.anthias, SPECIES.chromis];
  const reef: Fish[] = [];
  // a few on each side, where the margins show
  for (const [lo, hi] of [[-40, 520], [1080, 1640]] as const) {
    for (let i = 0; i < 4; i++) {
      const sp = kinds[(reef.length + (lo > 0 ? 2 : 0)) % kinds.length];
      const dir = r() < 0.5 ? -1 : 1;
      reef.push({
        x: lo + r() * (hi - lo), y: 0, dir, face: dir, speed: 14 + r() * 16, size: 17 + r() * 12, sp,
        alpha: 0.95, ph: r() * TAU, lo, hi, depth: 380 + r() * 460,
      });
    }
  }
  const school: Fish[] = Array.from({ length: 16 }, () => ({
    x: (r() - 0.5) * 240, y: (r() - 0.5) * 110, dir: -1, face: -1, speed: 0, size: 9 + r() * 4,
    sp: SPECIES.sardine, alpha: 0.6, ph: r() * TAU, lo: 0, hi: 0, depth: 0,
  }));
  const lead = { x: 1300, dir: -1, face: -1, speed: 16, ph: r() * TAU, lo: -200, hi: 1800 } as Fish;
  return {
    update(dt, t) {
      for (const f of reef) steer(f, dt, t);
      steer(lead, dt, t);
    },
    draw(c, t, x0, x1) {
      // the school, far off: small, faint, moving as one with each fish
      // weaving a little in its place
      const sy = 340 + Math.sin(t * 0.07 + lead.ph) * 60;
      for (const f of school) {
        f.face = lead.face;
        const x = lead.x + f.x * (0.8 + 0.2 * Math.sin(t * 0.3 + f.ph)) + Math.sin(t * 0.9 + f.ph) * 4;
        const y = sy + f.y + Math.sin(t * 0.7 + f.ph * 2) * 5;
        if (x + 20 < x0 || x - 20 > x1) continue;
        place(c, f, t, x, y);
      }
      for (const f of reef) {
        const y = f.depth + Math.sin(t * 0.5 + f.ph) * 10 + Math.sin(t * 0.13 + f.ph * 3) * 18;
        if (f.x + 30 < x0 || f.x - 30 > x1) continue;
        place(c, f, t, f.x, y);
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

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

/** Now and then a shooting star: it starts in one of the `areas` (the
 *  sky's visible margins) heading toward the middle and a little down
 *  (or as the area says: its heading, ±1, and steepest angle),
 *  brightens, streaks with a tapering trail and a glowing head, and burns
 *  out. Sometimes a second follows close behind. `behind` is a disc it
 *  passes behind (the moon). */
function meteors(areas: (Area | [...Area, number, number])[], every: [number, number], seed: number, behind?: [number, number, number]): Layer {
  const r = rng(seed);
  let next = every[0] * 0.4 + r() * every[0] * 0.6;
  let ms: Meteor[] = [];
  let clock = 0;
  const head = sprite("#e8eeff", true);
  const launch = (delay = 0) => {
    const [x0, y0, x1, y1, heading, steep = 0.45] = areas[Math.floor(r() * areas.length)];
    const x = x0 + r() * (x1 - x0);
    const dir = heading ?? (x < W / 2 ? 1 : -1);
    const ang = steep * (0.33 + r() * 0.67);
    const speed = 520 + r() * 300;
    ms.push({ x, y: y0 + r() * (y1 - y0), vx: Math.cos(ang) * speed * dir, vy: Math.abs(Math.sin(ang)) * speed, age: -delay, life: 0.8 + r() * 0.7, size: 0.8 + r() * 0.5 });
  };
  return {
    update(dt) {
      clock += dt;
      if (clock > next) {
        launch();
        if (r() < 0.2) launch(0.35 + r() * 0.5);
        next = clock + every[0] + r() * (every[1] - every[0]);
      }
      for (const m of ms) {
        m.age += dt;
        if (m.age > 0) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
        }
      }
      ms = ms.filter((m) => m.age < m.life);
    },
    draw(c, _t, x0, x1) {
      if (!ms.length) return;
      c.save();
      if (behind) {
        c.beginPath();
        c.rect(x0 - 50, -50, x1 - x0 + 100, H + 100);
        c.arc(behind[0], behind[1], behind[2], 0, TAU);
        c.clip("evenodd");
      }
      c.globalCompositeOperation = "lighter";
      c.lineCap = "round";
      for (const m of ms) {
        if (m.age <= 0) continue;
        const f = m.age / m.life;
        // flares up fast, fades slowly
        const k = Math.min(1, f * 5, 2.2 * (1 - f) ** 1.2);
        const tail = Math.min(m.age, 0.28);
        const tx = m.x - m.vx * tail;
        const ty = m.y - m.vy * tail;
        if (Math.max(m.x, tx) < x0 - 40 || Math.min(m.x, tx) > x1 + 40) continue;
        // a wide faint trail, then a thin bright core, both tapering away
        for (const [w, a] of [[7, 0.22], [3, 0.5], [1.4, 1]]) {
          const g = c.createLinearGradient(tx, ty, m.x, m.y);
          g.addColorStop(0, "rgba(160,180,255,0)");
          g.addColorStop(0.7, `rgba(200,214,255,${a * k * 0.5})`);
          g.addColorStop(1, `rgba(255,255,255,${a * k})`);
          c.strokeStyle = g;
          c.lineWidth = w * m.size;
          c.beginPath();
          c.moveTo(tx, ty);
          c.lineTo(m.x, m.y);
          c.stroke();
        }
        const s = 16 * m.size;
        c.globalAlpha = Math.min(1, k);
        c.drawImage(head, m.x - s, m.y - s, s * 2, s * 2);
        c.globalAlpha = 1;
      }
      c.restore();
    },
  };
}

/** Now and then a few birds crossing on a long glide: they follow their
 *  leader along a gentle rising and falling curve, banking into it, a few
 *  wingbeats and then a coast on held wings. */
function birds(seed: number): Layer {
  const r = rng(seed);
  let flock: { lag: number; dy: number; ph: number }[] = [];
  let dir = 1;
  let speed = 40;
  let y0 = 300;
  let amp = 30;
  let freq = 0.1;
  let size = 1;
  let age = 0;
  let next = 8;
  let clock = 0;
  const pathY = (s: number) => y0 + amp * Math.sin(s * freq);
  return {
    update(dt) {
      clock += dt;
      age += dt;
      if (!flock.length && clock > next) {
        dir = r() < 0.5 ? 1 : -1;
        speed = 34 + r() * 14;
        y0 = 160 + r() * 260;
        amp = 15 + r() * 30;
        freq = 0.08 + r() * 0.08;
        size = 0.75 + r() * 0.45;
        age = 0;
        flock = Array.from({ length: 3 + Math.floor(r() * 3) }, (_, i) => ({ lag: i * (0.7 + r() * 0.5), dy: (i % 2 ? 1 : -1) * i * 7 * size, ph: r() * TAU }));
        next = clock + 35 + r() * 35;
      }
      if (flock.length && speed * (age - flock[flock.length - 1].lag) > W + 200) flock = [];
    },
    draw(c) {
      c.strokeStyle = "rgba(70,60,104,0.8)";
      c.lineWidth = 1.7;
      c.lineCap = "round";
      for (const b of flock) {
        const s = age - b.lag;
        if (s < 0) continue;
        const x = dir > 0 ? -60 + speed * s : W + 60 - speed * s;
        const y = pathY(s) + b.dy;
        // bank into the turn; beat the wings for a while, then glide
        const bank = Math.atan((amp * freq * Math.cos(s * freq)) / speed) * dir;
        const beating = Math.sin(s * 0.45 + b.ph) > 0.2;
        const lift = beating ? 5 * Math.sin(s * 6 + b.ph) : 1.5;
        c.save();
        c.translate(x, y);
        c.rotate(bank);
        c.scale(size, size);
        c.beginPath();
        c.moveTo(-10, -lift);
        c.quadraticCurveTo(-4, -3, 0, 0);
        c.quadraticCurveTo(4, -3, 10, -lift);
        c.stroke();
        c.restore();
      }
    },
  };
}

// ── the habitats ──

const LAYERS: Record<Element, () => Layer[]> = {
  leaf: () => [
    shafts(700, -140, Math.PI / 2 + 0.05, 0.6, 7, 1100, "#fff5c8", 0.07, 1),
    motes({ n: 70, area: [0, 120, W, 880], v: [3, -5], spread: [4, 4], wander: 8, size: [1.5, 3.5], colors: ["#fff8d0", "#f0ffc0"], alpha: [0.4, 0.9], twinkle: 5, seed: 2 }),
    songbirds(51),
    butterflies(52),
    leaves(9, [[20, 60, 480, 260], [1120, 60, 1580, 240], [260, 300, 440, 380]], ["#6f9f48", "#8cb85a", "#a8c460", "#5a8a3e"], 3),
  ],
  ember: () => [
    // the crater and the lake breathing
    pulse(CRATER[0], CRATER[1] - 6, 110, "#ffb14a", 0.12, 0.08, 7, false, 1),
    pulse(220, 900, 260, "#ff6a20", 0.05, 0.04, 11, false, 2),
    pulse(1380, 900, 260, "#ff6a20", 0.05, 0.04, 13, false, 4),
    ash(70, 64),
    eruptions(65),
    lavaBubbles(66),
    // sparks off the lake beside the pages and out of the crater, and
    // embers high up, carried far
    sparks(46, [[0, LAVA_SHORE + 10, 420, 990], [1180, LAVA_SHORE + 10, W, 990]], 67),
    sparks(10, [[CRATER[0] - 30, CRATER[1] - 8, CRATER[0] + 30, CRATER[1]]], 68),
    motes({ n: 36, area: [0, 60, W, 700], v: [-6, -12], spread: [4, 6], wander: 10, size: [0.8, 1.8], colors: ["#ff7a28", "#ffd27a", "#ff9a40"], alpha: [0.35, 0.8], twinkle: 2.2, core: true, depth: true, seed: 3 }),
  ],
  tide: () => [
    shafts(800, -420, Math.PI / 2, 0.5, 9, 1450, "#d8fff8", 0.06, 4),
    motes({ n: 90, area: [0, 100, W, 920], v: [2, 5], spread: [3, 3], wander: 5, size: [0.8, 2], colors: ["#d8f4ff"], alpha: [0.25, 0.55], seed: 5 }),
    fishes(41),
    bubbles(36, [0, 110, W, 930], 6),
  ],
  stone: () => [
    // the crystals breathing, and light catching their faces
    ...([[258, 760, 190, "#6fdcff"], [1440, 750, 210, "#b48cff"], [560, 830, 90, "#6fdcff"], [1080, 830, 100, "#b48cff"], [1300, 845, 70, "#b48cff"], [30, 490, 110, "#6fdcff"], [1580, 440, 120, "#b48cff"], [150, 80, 90, "#b48cff"], [1478, 90, 90, "#6fdcff"]] as const).map(([x, y, r, c], i) =>
      pulse(x, y, r, c, 0.1, 0.07, 6 + i * 0.7, false, 7 + i),
    ),
    glints([[170, 620, 350, 860], [1330, 580, 1550, 850], [0, 440, 110, 560], [1500, 360, 1600, 520], [110, 40, 200, 140], [1430, 40, 1530, 140], [520, 780, 600, 860], [1040, 780, 1120, 860]], 16, "#e8f8ff", 11),
    // the mushrooms glowing, and their spores drifting up
    ...CAVE_SHROOMS.flatMap(([x, y, s], i) => [
      pulse(x, y - 20 * s, 70 * s, "#ff8fd6", 0.08, 0.06, 5 + i, false, 30 + i),
      motes({ n: 6, area: [x - 50, y - 120, x + 50, y - 10], v: [0, -5], spread: [3, 2], wander: 5, size: [0.8, 1.5], colors: ["#ffb8e6"], alpha: [0.4, 0.85], twinkle: 3, core: true, seed: 34 + i }),
    ]),
    // daylight through the crack in the roof, dust turning in it
    shafts(CAVE_CRACK[0], CAVE_CRACK[1] - 10, Math.PI / 2 + 0.15, 0.05, 5, 950, "#dfe8ff", 0.04, 60),
    beamDust(Math.PI / 2 + 0.15, 0.07, 880, 61),
    motes({ n: 40, area: [0, 80, W, 860], v: [1, -2], spread: [3, 3], wander: 6, size: [0.8, 2.2], colors: ["#dff6ff", "#e8d8ff"], alpha: [0.3, 0.7], twinkle: 6, seed: 12 }),
    glowworms(62),
    drips(),
    bat(63),
  ],
  sky: () => [
    pulse(SUN[0], SUN[1], 300, "#ffe2a8", 0.05, 0.04, 10, false, 13),
    // dust turning gold in the sun's shafts
    motes({ n: 20, area: [1000, 240, W, 600], v: [-3, -2], spread: [3, 3], wander: 5, size: [1.5, 3.5], colors: ["#ffe6b0", "#fff2d0"], alpha: [0.2, 0.5], twinkle: 6, seed: 14 }),
    birds(15),
  ],
  frost: () => [
    meteors([[120, 20, 560, 220], [1040, 20, 1480, 220]], [20, 40], 16),
    motes({ n: 170, area: [0, -20, W, 1000], v: [6, 26], spread: [5, 8], wander: 10, size: [0.8, 3.2], colors: ["#ffffff", "#e8f0ff"], alpha: [0.45, 0.95], core: true, depth: true, seed: 17 }),
  ],
  moon: () => [
    pulse(330, 220, 190, "#b8c4ff", 0.06, 0.04, 12, false, 18),
    // (on the right they run outward, above the oak)
    meteors([[30, 20, 420, 120], [1190, 15, 1300, 60, 1, 0.16]], [9, 20], 19, [330, 220, 80]),
    // fireflies over the grass, and dandelion seeds and a leaf or two
    // from the oak riding the breeze
    motes({ n: 44, area: [0, 640, W, 990], v: [0, -2], spread: [6, 5], wander: 14, size: [2.2, 3.8], colors: ["#e8ff9a", "#f4ffc0"], alpha: [0.7, 1], twinkle: 2.6, blink: true, core: true, seed: 20 }),
    motes({ n: 14, area: [-40, 560, W + 40, 960], v: [11, -3], spread: [4, 3], wander: 9, size: [1, 1.7], colors: ["#e4eaff"], alpha: [0.35, 0.65], core: true, seed: 27 }),
    leaves(3, [[1220, 240, 1560, 440]], ["#3a4690", "#4a58a8", "#2e3878"], 28),
  ],
  arcane: () => [
    pulse(290, 560, 70, "#ffb65a", 0.16, 0.06, 1, true, 21),
    pulse(318, 574, 55, "#ffb65a", 0.14, 0.05, 1, true, 22),
    pulse(1290, 566, 65, "#ffb65a", 0.16, 0.06, 1, true, 23),
    // the fireplaces: a slow glow, and sparks lifting off the logs
    ...FIRES.flatMap((x, k) => [
      pulse(x, 740, 150, "#ff9a48", 0.07, 0.03, 5, false, 24 + k),
      motes({ n: 7, area: [x - 40, 650, x + 40, 800], v: [0, -26], spread: [6, 8], wander: 10, size: [0.8, 1.8], colors: ["#ffb060", "#ffd890"], alpha: [0.5, 0.9], twinkle: 0.9, core: true, seed: 40 + k }),
    ]),
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
