/** A soft round light for the ambience layers to stamp (cave.ts,
 *  ember.ts): `color` fading out from the middle, `core` adding a bright
 *  centre. Painted once per call; keep the result. */
export function speck(color: string, core: boolean): OffscreenCanvas {
  const s = new OffscreenCanvas(32, 32);
  const c = s.getContext("2d")!;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  if (core) g.addColorStop(0, "#ffffff");
  g.addColorStop(core ? 0.18 : 0, color);
  g.addColorStop(0.45, color + "55");
  g.addColorStop(1, color + "00");
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return s;
}
