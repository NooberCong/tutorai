/** Paints a reader backdrop off the main thread (it takes a second or two)
 *  and hands back an encoded image. */

import type { Element } from "../../lib/hatchery/kit";
import { renderBackdrop } from "../../lib/hatchery/backdrops";

export interface BackdropRequest {
  el: Element;
  w: number;
  h: number;
}

self.onmessage = async (e: MessageEvent<BackdropRequest>) => {
  const { el, w, h } = e.data;
  try {
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d")!.putImageData(new ImageData(renderBackdrop(el, w, h), w, h), 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
    self.postMessage({ el, blob });
  } catch (err) {
    self.postMessage({ el, error: String(err) });
  }
};
