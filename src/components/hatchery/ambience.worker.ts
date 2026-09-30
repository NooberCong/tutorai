/** Runs a habitat's ambience (lib/hatchery/ambience.ts) on an OffscreenCanvas
 *  handed over by ReaderAmbience, so the animation never touches the main
 *  thread: the reader, PDF rendering and input stay unaffected. The loop
 *  runs on the worker's own requestAnimationFrame, in step with the display,
 *  and stops entirely while the reader is out of sight. */

import type { Element } from "../../lib/hatchery/kit";
import { createAmbience, type Ambience } from "../../lib/hatchery/ambience";

export type AmbienceMessage =
  | { canvas: OffscreenCanvas; el: Element; w: number; h: number }
  | { el: Element }
  | { w: number; h: number }
  | { run: boolean };

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let amb: Ambience | null = null;
let running = false;
let frame = 0;
let last = 0;

const raf: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === "function" ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

function tick(now: number) {
  frame = 0;
  if (!running || !ctx || !amb || !canvas) return;
  // a long gap (tab switch, hidden reader) resumes gently rather than jumping
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
  last = now;
  amb.frame(ctx, now / 1000, dt, canvas.width, canvas.height);
  frame = raf(tick);
}

function schedule() {
  if (running && !frame) frame = raf(tick);
  if (!running) last = 0;
}

self.onmessage = (e: MessageEvent<AmbienceMessage>) => {
  const m = e.data;
  if ("canvas" in m) {
    canvas = m.canvas;
    ctx = canvas.getContext("2d");
  }
  if ("el" in m) amb = createAmbience(m.el);
  if ("w" in m && canvas) {
    canvas.width = m.w;
    canvas.height = m.h;
  }
  if ("run" in m) running = m.run;
  schedule();
};
