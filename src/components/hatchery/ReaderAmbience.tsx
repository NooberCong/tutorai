/** The moving part of the reader's backdrop: the living painting
 *  (lib/hatchery/living.ts), where aurora, kelp, clouds and the like move,
 *  and drifting motes, snow, bubbles and the like over it
 *  (lib/hatchery/ambience.ts). The still painting stays underneath (see
 *  backdrop.ts) and shows until the living one fades in over it; it's
 *  also what's left without WebGL2.
 *
 *  Cheap by construction:
 *  - It draws in a worker on OffscreenCanvases, so nothing here competes
 *    with the reader on the main thread. After setup, the main thread only
 *    forwards resizes and visibility.
 *  - The painting draws no finer than it was painted and only beside the
 *    pages, at about 30 frames a second (its motion is far slower than a
 *    pixel a frame); the motes at one pixel per CSS pixel, at about 60.
 *  - It runs only while the reader is on screen and the window is visible,
 *    and not at all under "reduce motion". */

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Element } from "../../lib/hatchery/kit";
import type { AmbienceMessage, AmbienceReply } from "./ambience.worker";
import { paintLiveBackdrop } from "./backdrop";

const REDUCE = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const subscribeReduce = (l: () => void) => {
  REDUCE?.addEventListener("change", l);
  return () => REDUCE?.removeEventListener("change", l);
};

/** One worker for the app. It keeps the living painting it was given, so
 *  it's kept a while after the reader closes in case it comes back. */
let shared: Worker | null = null;
let retire = 0;
const KEEP_MS = 60_000;

function acquire(): Worker {
  window.clearTimeout(retire);
  shared ??= new Worker(new URL("./ambience.worker.ts", import.meta.url), { type: "module" });
  return shared;
}

function release(w: Worker) {
  w.postMessage({ detach: true } satisfies AmbienceMessage);
  w.onmessage = null;
  retire = window.setTimeout(() => {
    w.terminate();
    if (shared === w) shared = null;
  }, KEEP_MS);
}

export function ReaderAmbience({ element }: { element: Element }) {
  const reduce = useSyncExternalStore(subscribeReduce, () => REDUCE?.matches ?? false);
  return reduce ? null : <Layer element={element} />;
}

function Layer({ element }: { element: Element }) {
  const host = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);

  // Canvases are made here rather than in JSX because control of a canvas
  // can be handed to a worker only once.
  useEffect(() => {
    const box = host.current;
    if (!box || typeof OffscreenCanvas === "undefined") return;
    const living = document.createElement("canvas");
    living.className = "living";
    const motes = document.createElement("canvas");
    motes.className = "motes";
    box.append(living, motes);
    const w = acquire();
    worker.current = w;
    const post = (m: AmbienceMessage, transfer: Transferable[] = []) => w.postMessage(m, transfer);
    w.onmessage = (e: MessageEvent<AmbienceReply>) => {
      const m = e.data;
      if ("live" in m) living.classList.toggle("on", m.live);
      else
        paintLiveBackdrop(m.need).then(
          (scene) => worker.current === w && post({ scene, el: m.need }, [scene.base.buffer, scene.mask.buffer, ...(scene.layer ? [scene.layer.buffer] : [])]),
          (err) => console.warn("living backdrop failed:", err),
        );
    };
    const size = () => ({
      w: Math.max(1, Math.round(box.clientWidth)),
      h: Math.max(1, Math.round(box.clientHeight)),
      dpr: window.devicePixelRatio || 1,
    });
    const offMotes = motes.transferControlToOffscreen();
    const offLiving = living.transferControlToOffscreen();
    post({ attach: { motes: offMotes, living: offLiving }, el: element, ...size() }, [offMotes, offLiving]);

    let onScreen = false;
    const run = () => post({ run: onScreen && document.visibilityState === "visible" });
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      run();
    });
    io.observe(box);
    document.addEventListener("visibilitychange", run);
    // The page column: nothing drawn under it is seen. Geometry is read
    // only in ResizeObserver callbacks, when layout is already done; the
    // mutation observers (direct children only, not the pages' contents)
    // just keep the first page observed as the reader fills in.
    const hostEl = box.parentElement!;
    let page: HTMLElement | null = null;
    let column = "";
    const measure = () => {
      post(size());
      const b = box.getBoundingClientRect();
      const r = page?.getBoundingClientRect();
      const cover: [number, number] | null = r?.width ? [r.left - b.left, r.right - b.left] : null;
      const key = JSON.stringify(cover);
      if (key !== column) {
        column = key;
        post({ cover });
      }
    };
    let pending = 0;
    const ro = new ResizeObserver(() => {
      // coalesce a drag's worth of resizes into one per frame
      if (!pending) pending = requestAnimationFrame(() => {
        pending = 0;
        measure();
      });
    });
    ro.observe(box);
    const watched = new Set<Node>();
    const mo = new MutationObserver(() => track());
    const track = () => {
      const reader = hostEl.querySelector(":scope > .reader");
      const pages = reader?.querySelector(":scope > .reader-pages");
      for (const el of [hostEl, reader, pages]) {
        if (el && !watched.has(el)) {
          watched.add(el);
          mo.observe(el, { childList: true });
        }
      }
      const first = pages?.querySelector<HTMLElement>(":scope > .pdf-page") ?? null;
      if (first !== page) {
        if (page) ro.unobserve(page);
        page = first;
        if (page) ro.observe(page);
      }
    };
    track();
    return () => {
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(pending);
      document.removeEventListener("visibilitychange", run);
      release(w);
      worker.current = null;
      living.remove();
      motes.remove();
    };
    // the element is sent separately below; the canvases must not be rebuilt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    worker.current?.postMessage({ el: element } satisfies AmbienceMessage);
  }, [element]);

  return <div ref={host} className="reader-ambience" aria-hidden />;
}
