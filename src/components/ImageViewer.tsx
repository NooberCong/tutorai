/** A picture opened full screen, to zoom into and pan around (after Lumen).
 *
 *  It lifts off from the thumbnail that was clicked — hidden meanwhile — and
 *  glides to fit as the backdrop fades in; closing flies it back. The wheel or a
 *  trackpad pinch zooms about the pointer, letting the picture spill past the
 *  edges; a drag pans at any zoom, an unzoomed picture included, as far as the
 *  leash in `lib/zoom` allows; a click on the picture toggles between fitted and
 *  its own pixels, and a click beside it, Escape or the close button closes.
 *
 *  The geometry is pure (`lib/zoom`); the transform is written straight to the
 *  layer rather than through state, so a gesture never waits on a render, and
 *  every glide is a CSS transition. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IDENTITY, cover, keepOnScreen, leash, panBy, toCss, zoomAround, type Rect, type Zoom } from "../lib/zoom";
import { Close } from "./Icons";

/** The furthest a picture may be magnified, however small it was drawn. */
const MAX_ZOOM = 16;
/** The smallest it may shrink to, against fitted. */
const MIN_ZOOM = 0.4;
/** Px of a picture that must stay on screen, however far it is dragged. */
const LEASH_PX = 120;
/** A glide into or out of a zoom, and the flight in. */
const GLIDE_MS = 320;
/** The flight back out, as the backdrop fades. */
const EXIT_MS = 240;
/** Wheel `deltaMode` (pixels, lines, pages) to pixels. */
const WHEEL_PX = [1, 16, 400];

function glide(ms: number): string {
  if (!ms || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "none";
  return `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`;
}

export function ImageViewer(props: {
  /** Shown at once — usually the copy already on screen, so there's no wait. */
  src: string;
  /** A sharper copy to swap in once it is ready, for zooming into detail: a URL,
   *  or rendered bytes, whose object URL the viewer owns. */
  sharp?: string | Promise<Blob>;
  /** The thumbnail it opens from: the flight starts and ends on it, and it
   *  carries `.imgv-source` (hidden) while the viewer is up. */
  from?: HTMLElement | null;
  alt: string;
  caption?: string;
  /** A credit line's button (e.g. the file's page on Commons). */
  credit?: { label: string; title?: string; onClick: () => void };
  onClose: () => void;
}) {
  const { sharp, from } = props;
  const [src, setSrc] = useState(props.src);
  useEffect(() => {
    if (!sharp) return;
    let live = true;
    let owned: string | null = null;
    (async () => {
      let url = sharp;
      if (typeof url !== "string") {
        const blob = await url;
        if (!live) return;
        url = owned = URL.createObjectURL(blob);
      }
      const img = new Image();
      img.src = url;
      await img.decode(); // swap only once it can paint without a blank frame
      if (live) setSrc(url);
    })().catch(() => {}); // the first copy stays
    return () => {
      live = false;
      if (owned) URL.revokeObjectURL(owned);
    };
  }, [sharp]);

  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const zoom = useRef<Zoom>(IDENTITY);
  // The picture's fitted rect when last measured, to hold it still on screen
  // when a sharper copy lands with a different laid-out size.
  const fitted = useRef<Rect | null>(null);
  // Whether the user has zoomed or panned: until then a sharper copy settles to
  // the new fit, after that it keeps the view they made.
  const touched = useRef(false);
  const closing = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Where the gesture began, and whether it has since moved: one that never did
  // is a click.
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  /** Size the picture to fill the frame's padded box, keeping its shape — scaled
   *  up as well as down, so a small picture (or the small first copy of one)
   *  still opens filling the screen, and every copy of it lays out the same. */
  const fitPicture = () => {
    const box = layer.current;
    const pic = picture.current;
    if (!box || !pic?.naturalWidth) return;
    const pad = getComputedStyle(box);
    const w = box.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const h = box.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
    const s = Math.min(w / pic.naturalWidth, h / pic.naturalHeight);
    pic.style.width = `${Math.round(pic.naturalWidth * s)}px`;
    pic.style.height = `${Math.round(pic.naturalHeight * s)}px`;
  };

  /** The frame's size, and the picture's fitted rect within it; null until laid out. */
  const measure = () => {
    const box = frame.current;
    const pic = picture.current;
    if (!box || !pic?.offsetWidth) return null;
    const content = { x: pic.offsetLeft, y: pic.offsetTop, w: pic.offsetWidth, h: pic.offsetHeight };
    fitted.current = content;
    return { w: box.clientWidth, h: box.clientHeight, content, own: pic.naturalWidth / pic.offsetWidth };
  };
  const maxZoom = (own: number) => Math.min(MAX_ZOOM, Math.max(4, own * 2));

  /** Put the layer at `z` as given, gliding for `ms`. */
  const place = (z: Zoom, ms = 0) => {
    const el = layer.current;
    if (!el) return;
    zoom.current = z;
    el.style.transition = glide(ms);
    el.style.transform = toCss(z);
  };

  /** `place`, leashed so the picture can't be lost. */
  const apply = (next: Zoom, ms = 0) => {
    const g = measure();
    if (g) place(leash(next, g.w, g.h, g.content, MIN_ZOOM, maxZoom(g.own), LEASH_PX), ms);
  };

  /** Where the layer is drawn right now — mid-glide, that is not `zoom`. */
  const rendered = (): Zoom => {
    const t = layer.current && getComputedStyle(layer.current).transform;
    if (!t || t === "none") return IDENTITY;
    const m = new DOMMatrixReadOnly(t);
    return { scale: m.a, tx: m.e, ty: m.f };
  };

  /** The thumbnail's rect in the frame's coordinates, if it is still on the page. */
  const thumbnail = (): Rect | null => {
    if (!from?.isConnected || !frame.current) return null;
    const r = from.getBoundingClientRect();
    const f = frame.current.getBoundingClientRect();
    return r.width && r.height ? { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height } : null;
  };

  const local = (x: number, y: number): [number, number] => {
    const rect = frame.current!.getBoundingClientRect();
    return [x - rect.left, y - rect.top];
  };

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    root.current?.classList.remove("on");
    const back = thumbnail();
    if (back && fitted.current) place(cover(fitted.current, back), EXIT_MS);
    window.setTimeout(props.onClose, EXIT_MS);
  };

  /** The first copy is laid out: fly in from the thumbnail. Later ones (the sharp
   *  copy) take its place without the picture moving on screen — the fit gives
   *  them the same rect, give or take rounding, which `keepOnScreen` absorbs. */
  const onLoad = () => {
    if (closing.current) return;
    const before = fitted.current;
    fitPicture();
    const g = measure();
    if (!g || !root.current || !layer.current) return;
    if (!before) {
      const start = thumbnail();
      place(start ? cover(g.content, start) : { ...IDENTITY, scale: 0.94 });
      void layer.current.offsetWidth; // commit the start, so there is something to glide from
      root.current.classList.add("on");
      place(IDENTITY, GLIDE_MS);
      return;
    }
    if (before.w === g.content.w && before.h === g.content.h) return;
    place(keepOnScreen(rendered(), before, g.content));
    void layer.current.offsetWidth;
    if (touched.current) apply(zoom.current);
    else place(IDENTITY, GLIDE_MS);
  };

  const toggleAt = (x: number, y: number) => {
    const g = measure();
    if (!g) return;
    const z = zoom.current;
    const atFit = Math.abs(z.scale - 1) < 0.01 && Math.abs(z.tx) < 1 && Math.abs(z.ty) < 1;
    touched.current = atFit;
    if (atFit) {
      const detail = Math.min(MAX_ZOOM, Math.max(2, g.own));
      apply(zoomAround(z, ...local(x, y), detail, maxZoom(g.own), MIN_ZOOM), GLIDE_MS);
    } else {
      place(IDENTITY, GLIDE_MS);
    }
  };

  // The thumbnail is marked while its picture is up here, and hidden by that
  // (see `.imgv-source`), so it reads as one picture lifted off the page rather
  // than a copy.
  useLayoutEffect(() => {
    from?.classList.add("imgv-source");
    return () => from?.classList.remove("imgv-source");
  }, [from]);

  // Every key is the viewer's while it is open — captured ahead of the page
  // underneath, where a letter would answer the question behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      if (e.key === "Escape") close();
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

  // Focus moves into the viewer and goes back where it was on close — without
  // scrolling: that is usually the figure clicked on the page, and focusing it
  // plainly would scroll the page to bring all of it into view.
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    root.current?.focus({ preventScroll: true });
    return () => before?.focus({ preventScroll: true });
  }, []);

  // The wheel zooms about the pointer: a trackpad pinch arrives as ctrl+wheel in
  // small steps, followed as they come; a mouse notch as one large step, eased so
  // it doesn't jump. Bound by hand because React's wheel listener is passive, and
  // the app must not scroll or zoom instead.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = measure();
      if (!g || closing.current) return;
      touched.current = true;
      const px = e.deltaY * (WHEEL_PX[e.deltaMode] ?? 1);
      const next = zoomAround(
        zoom.current,
        ...local(e.clientX, e.clientY),
        zoom.current.scale * Math.exp(-px * (e.ctrlKey ? 0.01 : 0.0015)),
        maxZoom(g.own),
        MIN_ZOOM,
      );
      apply(next, !e.ctrlKey && Math.abs(px) >= 50 ? 140 : 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // A resized window refits the picture: still the opening view, it stays fitted;
  // otherwise it keeps its place and size on screen, leashed to the new frame.
  useEffect(() => {
    const onResize = () => {
      const before = fitted.current;
      fitPicture();
      const g = measure();
      if (!touched.current || !before || !g) place(IDENTITY);
      else apply(keepOnScreen(zoom.current, before, g.content));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  const lift = (e: React.PointerEvent, cancelled: boolean) => {
    if (!pointers.current.delete(e.pointerId) || pointers.current.size > 0) return;
    frame.current?.classList.remove("dragging");
    const tap = press.current !== null && !press.current.moved && !cancelled;
    press.current = null;
    if (!tap || closing.current) return;
    const pic = picture.current?.getBoundingClientRect();
    const onPicture =
      pic !== undefined && e.clientX >= pic.left && e.clientX <= pic.right && e.clientY >= pic.top && e.clientY <= pic.bottom;
    if (onPicture) toggleAt(e.clientX, e.clientY);
    else close();
  };

  return createPortal(
    <div
      ref={root}
      className="imgv"
      role="dialog"
      aria-modal="true"
      aria-label={props.alt || "Image"}
      tabIndex={-1}
      // React carries a portal's events up to its owner's ancestors (the reader,
      // a trivia question), whose own click and drag handlers they aren't for.
      onPointerDown={stop}
      onPointerUp={stop}
      onMouseDown={stop}
      onMouseUp={stop}
      onClick={stop}
      onContextMenu={stop}
    >
      <div
        ref={frame}
        className="imgv-frame"
        onPointerDown={(e) => {
          if ((e.pointerType === "mouse" && e.button !== 0) || closing.current) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          // A drag that leaves the frame keeps panning until the button lifts.
          e.currentTarget.setPointerCapture(e.pointerId);
          if (pointers.current.size === 1) press.current = { x: e.clientX, y: e.clientY, moved: false };
          else if (press.current) press.current.moved = true; // two fingers are never a click
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          const now = { x: e.clientX, y: e.clientY };
          if (press.current && !press.current.moved) {
            // Still a click until it travels; once it does, it pans from where it
            // was pressed, so the picture never trails the pointer.
            if (Math.hypot(now.x - press.current.x, now.y - press.current.y) <= 4) return;
            press.current.moved = touched.current = true;
            frame.current?.classList.add("dragging");
          }
          pointers.current.set(e.pointerId, now);
          const other = [...pointers.current].find(([id]) => id !== e.pointerId)?.[1];
          if (other) {
            // Pinch: scale by how far the fingers spread, about their midpoint, and
            // follow the midpoint as it drifts — so a pinch can pan as it zooms.
            const [bx, by] = local((prev.x + other.x) / 2, (prev.y + other.y) / 2);
            const [ax, ay] = local((now.x + other.x) / 2, (now.y + other.y) / 2);
            const spread =
              Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(prev.x - other.x, prev.y - other.y));
            const z = zoomAround(zoom.current, bx, by, zoom.current.scale * spread, MAX_ZOOM, MIN_ZOOM);
            apply(panBy(z, ax - bx, ay - by));
          } else {
            // A drag is 1:1 — never eased, or the picture lags the pointer.
            apply(panBy(zoom.current, now.x - prev.x, now.y - prev.y));
          }
        }}
        onPointerUp={(e) => lift(e, false)}
        onPointerCancel={(e) => lift(e, true)}
      >
        <div ref={layer} className="imgv-layer">
          <img
            ref={picture}
            src={src}
            alt={props.alt}
            draggable={false}
            onLoad={onLoad}
            // Nothing to fly: show the viewer anyway, so it can be closed.
            onError={() => root.current?.classList.add("on")}
          />
        </div>
      </div>
      <header className="imgv-head">
        <p className="imgv-caption">{props.caption}</p>
        {props.credit && (
          <button className="imgv-credit" title={props.credit.title} onClick={props.credit.onClick}>
            {props.credit.label}
          </button>
        )}
        <button className="icon-btn imgv-close" onClick={close} aria-label="Close" title="Close (Esc)">
          <Close />
        </button>
      </header>
    </div>,
    document.body,
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
