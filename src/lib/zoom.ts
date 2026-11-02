// Zoom and pan as pure geometry, for the image viewer (the model is ditto's,
// with Lumen's leash). The viewer lays a CSS `transform` over a picture fitted in
// its frame; this maps content coordinates to box (viewport) coordinates as
//   box = translate + scale * content
// with `transform-origin: 0 0`. The DOM wiring lives in components/ImageViewer.

export interface Zoom {
  /** Magnification. 1 = fitted; below 1 is smaller than fitted. */
  scale: number;
  /** Translation in box (CSS) pixels, applied before the scale. */
  tx: number;
  ty: number;
}

export const IDENTITY: Zoom = { scale: 1, tx: 0, ty: 0 };

/** Where the content sits in the box at scale 1, in box pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Keep a zoom where the picture can still be seen: scale into `[min, max]`,
 *  and the picture free to go anywhere — past the edges, off them — so long as
 *  `keep` px of it stay on screen along each axis, so it can't be lost. One rule
 *  at every size: there is no point where its edges start pinning to the box's,
 *  so a zoom about the pointer never jumps, and nothing re-centres. */
export function leash(z: Zoom, w: number, h: number, content: Rect, min: number, max: number, keep: number): Zoom {
  const scale = Math.min(max, Math.max(min, z.scale));
  const axis = (t: number, box: number, start: number, size: number) => {
    const scaled = scale * size;
    const pos = t + scale * start; // the content's leading edge on screen
    const held = Math.min(scaled, keep);
    return Math.min(box - held, Math.max(held - scaled, pos)) - scale * start;
  };
  return { scale, tx: axis(z.tx, w, content.x, content.w), ty: axis(z.ty, h, content.y, content.h) };
}

/** Rescale to `nextScale` about an anchor point (in box coordinates) so the content
 *  currently under the anchor stays under it — "zoom where the pointer is". The
 *  scale is bounded to `[min, max]` *before* the anchor is solved: bounded after,
 *  a step past the limit would slide the content away from the anchor instead of
 *  doing nothing. The translation is left to the caller to bound. */
export function zoomAround(
  z: Zoom,
  anchorX: number,
  anchorY: number,
  nextScale: number,
  max = Infinity,
  min = 1,
): Zoom {
  const scale = Math.min(max, Math.max(min, nextScale));
  const k = scale / z.scale;
  return {
    scale,
    tx: anchorX - k * (anchorX - z.tx),
    ty: anchorY - k * (anchorY - z.ty),
  };
}

/** Shift the view by a box-pixel delta. Not bounded; callers do that. */
export function panBy(z: Zoom, dx: number, dy: number): Zoom {
  return { scale: z.scale, tx: z.tx + dx, ty: z.ty + dy };
}

/** The zoom that lays `content` over `target` (both in box pixels) the way an
 *  `object-fit: cover` thumbnail shows it: filling it, centred, overflowing on
 *  the long axis — where a picture lifts off from, and lands back on. */
export function cover(content: Rect, target: Rect): Zoom {
  const scale = Math.max(target.w / content.w, target.h / content.h);
  return {
    scale,
    tx: target.x + target.w / 2 - scale * (content.x + content.w / 2),
    ty: target.y + target.h / 2 - scale * (content.y + content.h / 2),
  };
}

/** The zoom that keeps a picture exactly where it is on screen when its laid-out
 *  rect changes from `before` to `after` (a sharper copy with more pixels). */
export function keepOnScreen(z: Zoom, before: Rect, after: Rect): Zoom {
  const scale = (z.scale * before.w) / after.w;
  return {
    scale,
    tx: z.tx + z.scale * before.x - scale * after.x,
    ty: z.ty + z.scale * before.y - scale * after.y,
  };
}

/** The CSS `transform` value for a zoom. Pairs with `transform-origin: 0 0`. */
export function toCss(z: Zoom): string {
  return `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
}
