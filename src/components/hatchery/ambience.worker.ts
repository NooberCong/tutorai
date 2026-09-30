/** Runs the reader backdrop's motion off the main thread, on canvases
 *  handed over by ReaderAmbience: the living painting (lib/hatchery/
 *  living.ts, WebGL) and the drifting particles over it (lib/hatchery/
 *  ambience.ts, 2D). The reader, PDF rendering and input stay unaffected.
 *
 *  The loop runs on the worker's own requestAnimationFrame, in step with
 *  the display, at about 60 frames a second: on faster displays it draws
 *  every second or third frame, evenly, rather than every one. The
 *  painting, whose motion is far slower than a pixel a frame, redraws at
 *  half that, and only beside the pages. Nothing runs while the reader is
 *  out of sight, or zoomed in so far the pages leave no margins.
 *
 *  The worker outlives a reader: it keeps the last painting it was given,
 *  so coming back to the reader doesn't paint it again. */

import type { Element } from "../../lib/hatchery/kit";
import type { LiveBackdrop } from "../../lib/hatchery/backdrops";
import { createAmbience, type Ambience } from "../../lib/hatchery/ambience";
import { createLiving, type Living } from "../../lib/hatchery/living";

export type AmbienceMessage =
  | { attach: { motes: OffscreenCanvas; living: OffscreenCanvas | null }; el: Element; w: number; h: number; dpr: number }
  | { detach: true }
  | { el: Element }
  | { scene: LiveBackdrop; el: Element }
  | { w: number; h: number; dpr: number }
  | { cover: [number, number] | null }
  | { run: boolean };

/** To the main thread: paint me this element's living backdrop; or, the
 *  living backdrop is (or stopped being) on screen. */
export type AmbienceReply = { need: Element } | { live: boolean };

let motes: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let glCanvas: OffscreenCanvas | null = null;
let living: Living | null = null;
let amb: Ambience | null = null;
let el: Element | null = null;
let size = { w: 1, h: 1, dpr: 1 };
/** The page column, in CSS px: nothing there is seen. */
let cover: [number, number] | null = null;
let cached: { el: Element; scene: LiveBackdrop } | null = null;
let asked: Element | null = null;
let shown = false;
let running = false;
let frame = 0;
let last = 0;

const post = (m: AmbienceReply) => self.postMessage(m);

// ── pacing: ~60 fps, evenly spaced ──

let prevTick = 0;
let interval = 1000 / 60;
let count = 0;

const raf: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === "function" ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

function tick(now: number) {
  frame = 0;
  if (!running || !amb || !ctx || !motes) return;
  frame = raf(tick);
  if (prevTick) interval += (Math.min(now - prevTick, 50) - interval) * 0.05;
  prevTick = now;
  const stride = Math.max(1, Math.round(1000 / 60 / interval));
  if (++count % stride) return;
  // a long gap (tab switch, hidden reader) resumes gently rather than jumping
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
  last = now;
  const t = now / 1000;
  const [x0, x1] = cover ?? [0, 0];
  if (x0 <= 0 && x1 >= size.w) return;
  if (living && (count / stride) % 2 < 1) {
    living.draw(t, x0, x1);
    if (!shown) {
      shown = true;
      post({ live: true });
    }
  }
  amb.frame(ctx, t, dt, motes.width, motes.height);
}

function schedule() {
  if (running && !frame) frame = raf(tick);
  if (!running) {
    last = 0;
    prevTick = 0;
  }
}

// ── the living painting ──

function dropLiving() {
  living?.dispose();
  living = null;
  if (shown) post({ live: false });
  shown = false;
}

/** Build the living painting when there's a canvas, an element and its
 *  painting; ask for the painting if it's missing. */
function buildLiving() {
  if (living || !glCanvas || !el) return;
  if (cached?.el !== el) {
    if (asked !== el) post({ need: el });
    asked = el;
    return;
  }
  try {
    living = createLiving(glCanvas, el, cached.scene);
  } catch (err) {
    console.warn("living backdrop unavailable:", err);
    living = null;
  }
  living?.resize(size.w, size.h, size.dpr);
}

self.onmessage = (e: MessageEvent<AmbienceMessage>) => {
  const m = e.data;
  if ("attach" in m) {
    motes = m.attach.motes;
    ctx = motes.getContext("2d");
    glCanvas = m.attach.living;
    size = { w: m.w, h: m.h, dpr: m.dpr };
    motes.width = m.w;
    motes.height = m.h;
    el = m.el;
    amb = createAmbience(el);
    buildLiving();
  } else if ("detach" in m) {
    dropLiving();
    motes = ctx = glCanvas = null;
    amb = null;
    running = false;
  } else if ("scene" in m) {
    cached = { el: m.el, scene: m.scene };
    if (asked === m.el) asked = null;
    buildLiving();
  } else if ("el" in m) {
    if (m.el !== el) {
      el = m.el;
      amb = createAmbience(el);
      dropLiving();
      buildLiving();
    }
  } else if ("w" in m) {
    size = { w: m.w, h: m.h, dpr: m.dpr };
    if (motes) {
      motes.width = m.w;
      motes.height = m.h;
    }
    living?.resize(m.w, m.h, m.dpr);
    // resizing clears a canvas: redraw now rather than show a blank frame
    if (running && amb && ctx && motes) {
      const t = performance.now() / 1000;
      living?.draw(t, ...(cover ?? [0, 0]));
      amb.frame(ctx, t, 0, motes.width, motes.height);
    }
  } else if ("cover" in m) {
    cover = m.cover;
  } else if ("run" in m) {
    running = m.run;
  }
  schedule();
};
