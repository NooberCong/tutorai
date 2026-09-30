/** Paints a reader backdrop off the main thread (it takes a second or two):
 *  the still painting as an encoded image, or what the living backdrop
 *  draws from (lib/hatchery/living.ts). */

import type { Element } from "../../lib/hatchery/kit";
import { paintLive, renderBackdrop, type LiveBackdrop } from "../../lib/hatchery/backdrops";

export interface BackdropRequest {
  el: Element;
  w: number;
  h: number;
  live?: boolean;
}

export type BackdropReply =
  | { el: Element; kind: "still"; blob: Blob }
  | { el: Element; kind: "live"; scene: LiveBackdrop }
  | { el: Element; kind: "still" | "live"; error: string };

self.onmessage = async (e: MessageEvent<BackdropRequest>) => {
  const { el, w, h, live } = e.data;
  const kind = live ? "live" : "still";
  try {
    if (live) {
      const scene = paintLive(el, w, h);
      const transfer = [scene.base.buffer, scene.mask.buffer, ...(scene.layer ? [scene.layer.buffer] : [])];
      self.postMessage({ el, kind: "live", scene } satisfies BackdropReply, { transfer });
      return;
    }
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d")!.putImageData(new ImageData(renderBackdrop(el, w, h), w, h), 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
    self.postMessage({ el, kind: "still", blob } satisfies BackdropReply);
  } catch (err) {
    self.postMessage({ el, kind, error: String(err) } satisfies BackdropReply);
  }
};
