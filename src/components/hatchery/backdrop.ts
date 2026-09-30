/** The reader's backdrop: the companion's habitat, painted wide
 *  (lib/hatchery/backdrops.ts), behind the pages.
 *
 *  Painting takes a second or two, so it runs in a worker, once per element
 *  per session; the reader shows its plain well until the image is ready.
 *  The result is a bitmap, so resizing the reader only rescales it. */

import { useEffect, useState } from "react";
import type { Element } from "../../lib/hatchery/kit";
import { companion, homeOf } from "../../lib/hatchery/game";
import { useHatchery } from "../../lib/hatchery/store";
import { useSetting } from "../../lib/settings";
import type { LiveBackdrop } from "../../lib/hatchery/backdrops";
import type { BackdropReply, BackdropRequest } from "./backdrop.worker";

/** Big enough for a maximized window; the art is soft, so it upscales well
 *  past this on high-DPI screens. */
const RENDER_W = 1920;
const RENDER_H = 1200;

let worker: Worker | null = null;
const cache = new Map<Element, Promise<string>>();

function paint(el: Element, live: boolean): Promise<BackdropReply> {
  worker ??= new Worker(new URL("./backdrop.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  const kind = live ? "live" : "still";
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<BackdropReply>) => {
      if (e.data.el !== el || e.data.kind !== kind) return;
      w.removeEventListener("message", onMessage);
      if ("error" in e.data) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ el, w: RENDER_W, h: RENDER_H, live } satisfies BackdropRequest);
  });
}

function backdropUrl(el: Element): Promise<string> {
  let url = cache.get(el);
  if (url) return url;
  url = paint(el, false).then((r) => URL.createObjectURL((r as { blob: Blob }).blob));
  url.catch(() => cache.delete(el));
  cache.set(el, url);
  return url;
}

/** What the living backdrop draws from (ReaderAmbience hands it to its
 *  worker, which keeps it). Painted fresh each call: queued behind the
 *  still painting, so that shows first. */
export function paintLiveBackdrop(el: Element): Promise<LiveBackdrop> {
  return paint(el, true).then((r) => (r as { scene: LiveBackdrop }).scene);
}

/** The reader's backdrop, its image and element, or null for the plain
 *  well: off in settings, the hatchery off, or not painted yet. Before the
 *  first pet hatches, the egg's element stands in. */
export function useReaderBackdrop(hatcheryOn: boolean): { el: Element; url: string } | null {
  const s = useHatchery();
  const enabled = useSetting("hatcheryBackdrop");
  const pet = companion(s);
  const el = hatcheryOn && enabled ? (pet ? homeOf(pet) : (s.incubator?.element ?? null)) : null;
  const [shown, setShown] = useState<{ el: Element; url: string } | null>(null);
  useEffect(() => {
    if (!el) return;
    let live = true;
    backdropUrl(el).then(
      (url) => live && setShown({ el, url }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [el]);
  return el && shown?.el === el ? shown : null;
}
