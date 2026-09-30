/** The moving layer of the reader's backdrop: drifting motes, snow, bubbles
 *  and the like over the still painting (lib/hatchery/ambience.ts).
 *
 *  Cheap by construction:
 *  - It draws in a worker on an OffscreenCanvas, so nothing here competes
 *    with the reader on the main thread. After setup, the main thread only
 *    forwards resizes and visibility.
 *  - It renders at one pixel per CSS pixel: soft lights don't need more.
 *  - It runs only while the reader is on screen and the window is visible,
 *    and not at all under "reduce motion". */

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Element } from "../../lib/hatchery/kit";
import type { AmbienceMessage } from "./ambience.worker";

const REDUCE = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const subscribeReduce = (l: () => void) => {
  REDUCE?.addEventListener("change", l);
  return () => REDUCE?.removeEventListener("change", l);
};

export function ReaderAmbience({ element }: { element: Element }) {
  const reduce = useSyncExternalStore(subscribeReduce, () => REDUCE?.matches ?? false);
  return reduce ? null : <Layer element={element} />;
}

function Layer({ element }: { element: Element }) {
  const host = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);

  // One canvas and worker per mount. The canvas is made here rather than in
  // JSX because control of a canvas can be handed to a worker only once.
  useEffect(() => {
    const box = host.current;
    if (!box || typeof OffscreenCanvas === "undefined") return;
    const canvas = document.createElement("canvas");
    box.append(canvas);
    const w = new Worker(new URL("./ambience.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    const post = (m: AmbienceMessage, transfer: Transferable[] = []) => w.postMessage(m, transfer);
    const size = () => ({ w: Math.max(1, Math.round(box.clientWidth)), h: Math.max(1, Math.round(box.clientHeight)) });
    const off = canvas.transferControlToOffscreen();
    post({ canvas: off, el: element, ...size() }, [off]);

    let onScreen = false;
    const run = () => post({ run: onScreen && document.visibilityState === "visible" });
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      run();
    });
    io.observe(box);
    document.addEventListener("visibilitychange", run);
    let pending = 0;
    const ro = new ResizeObserver(() => {
      // coalesce a drag's worth of resizes into one per frame
      if (!pending) pending = requestAnimationFrame(() => {
        pending = 0;
        post(size());
      });
    });
    ro.observe(box);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(pending);
      document.removeEventListener("visibilitychange", run);
      w.terminate();
      worker.current = null;
      canvas.remove();
    };
    // the element is sent separately below; the canvas must not be rebuilt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    worker.current?.postMessage({ el: element } satisfies AmbienceMessage);
  }, [element]);

  return <div ref={host} className="reader-ambience" aria-hidden />;
}
