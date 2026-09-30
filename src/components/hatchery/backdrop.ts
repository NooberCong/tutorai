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
import type { BackdropRequest } from "./backdrop.worker";

/** Big enough for a maximized window; the art is soft, so it upscales well
 *  past this on high-DPI screens. */
const RENDER_W = 1920;
const RENDER_H = 1200;

let worker: Worker | null = null;
const cache = new Map<Element, Promise<string>>();

function backdropUrl(el: Element): Promise<string> {
  let url = cache.get(el);
  if (url) return url;
  worker ??= new Worker(new URL("./backdrop.worker.ts", import.meta.url), { type: "module" });
  const w = worker;
  url = new Promise<string>((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ el: Element; blob?: Blob; error?: string }>) => {
      if (e.data.el !== el) return;
      w.removeEventListener("message", onMessage);
      if (e.data.blob) resolve(URL.createObjectURL(e.data.blob));
      else reject(new Error(e.data.error ?? "backdrop failed"));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ el, w: RENDER_W, h: RENDER_H } satisfies BackdropRequest);
  });
  url.catch(() => cache.delete(el));
  cache.set(el, url);
  return url;
}

/** The backdrop image URL for the reader, or null for the plain well: off in
 *  settings, the hatchery off, or not painted yet. Before the first pet
 *  hatches, the egg's element stands in. */
export function useReaderBackdrop(hatcheryOn: boolean): string | null {
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
  return el && shown?.el === el ? shown.url : null;
}
