/** Color ramps for the hatchery's pixel art.
 *
 *  Every material is one base color expanded into a six-step ramp in OKLCH
 *  (perceptually even lightness steps). The ramp is hue-shifted the way pixel
 *  artists do it by hand: shadows rotate toward blue-violet and gain a little
 *  chroma, highlights rotate toward warm yellow and lose some — so a red
 *  creature's shadow reads crimson and its shine reads coral, instead of the
 *  muddy "same hue, darker" look of naive shading.
 *
 *  Pure math, no DOM: shared by the app and the node sprite-sheet script. */

/** Ramp indices. 0 is reserved for outlines. */
export const OUTLINE = 0;
export const DARK = 1;
export const SHADOW = 2;
export const BASE = 3;
export const LIGHT = 4;
export const SHINE = 5;

export type Rgb = [number, number, number];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** sRGB (0–255) → OKLCH as [L 0–1, C, H degrees]. */
export function rgbToOklch([r8, g8, b8]: Rgb): [number, number, number] {
  const r = srgbToLinear(r8 / 255);
  const g = srgbToLinear(g8 / 255);
  const b = srgbToLinear(b8 / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), (H + 360) % 360];
}

/** OKLCH → linear-ish sRGB floats, unclamped (may be out of gamut). */
function oklchToSrgbFloat(L: number, C: number, H: number): Rgb {
  const hr = (H * Math.PI) / 180;
  const A = C * Math.cos(hr);
  const B = C * Math.sin(hr);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = (c: Rgb) => c.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH → sRGB 0–255, pulling chroma in until the color fits the gamut
 *  (keeps lightness and hue, which is what the eye tracks on a ramp). */
export function oklchToRgb(L: number, C: number, H: number): Rgb {
  let c = C;
  let rgb = oklchToSrgbFloat(L, c, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 18; i++) {
      c = (lo + hi) / 2;
      if (inGamut(oklchToSrgbFloat(L, c, H))) lo = c;
      else hi = c;
    }
    rgb = oklchToSrgbFloat(L, lo, H);
  }
  return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as Rgb;
}

/** Rotate hue `h` toward `target` along the shortest arc by at most `deg`. */
function hueToward(h: number, target: number, deg: number): number {
  const d = ((target - h + 540) % 360) - 180;
  const step = Math.sign(d) * Math.min(Math.abs(d), deg); // never overshoot
  return (h + step + 360) % 360;
}

const SHADOW_HUE = 285; // blue-violet
const LIGHT_HUE = 95; // warm yellow

// Per ramp step: lightness offset, hue shift (toward shadow/light hue),
// chroma multiplier. Index = OUTLINE..SHINE.
const STEPS: { dL: number; shift: number; cMul: number }[] = [
  { dL: -0.4, shift: 34, cMul: 0.85 },
  { dL: -0.22, shift: 20, cMul: 1.08 },
  { dL: -0.11, shift: 10, cMul: 1.06 },
  { dL: 0, shift: 0, cMul: 1 },
  { dL: 0.085, shift: 8, cMul: 0.92 },
  { dL: 0.16, shift: 16, cMul: 0.7 },
];

/** Six-step hue-shifted ramp from one base color: [outline, dark, shadow,
 *  base, light, shine]. Near-white and near-black bases get their steps
 *  squeezed so every step stays distinct. */
export function makeRamp(base: string): string[] {
  const [L0, C0, H0] = rgbToOklch(hexToRgb(base));
  // Keep shine ≤ 0.97 and outline ≥ 0.16 by squeezing the offsets.
  const top = Math.min(1, (0.975 - L0) / STEPS[SHINE].dL);
  const bottom = Math.min(1, (L0 - 0.17) / -STEPS[OUTLINE].dL);
  // Achromatic bases (white fur, grey stone) still get a whisper of tint
  // from the hue shift, which keeps them from reading as flat grey.
  const chroma = Math.max(C0, 0.012);
  return STEPS.map(({ dL, shift, cMul }, i) => {
    const L = L0 + dL * (dL > 0 ? Math.max(0.25, top) : Math.max(0.35, bottom));
    const target = i < BASE ? SHADOW_HUE : LIGHT_HUE;
    const H = i === BASE ? H0 : hueToward(H0, target, shift * (C0 < 0.03 ? 0.6 : 1));
    const C = i === OUTLINE ? Math.max(chroma * cMul, 0.035) : chroma * cMul;
    return rgbToHex(oklchToRgb(L, C, H));
  });
}

/** Shift a base color's hue/lightness/chroma — used to derive shiny
 *  palettes and tier tints from a species' normal palette. */
export function adjust(base: string, opts: { dH?: number; dL?: number; cMul?: number }): string {
  const [L, C, H] = rgbToOklch(hexToRgb(base));
  return rgbToHex(
    oklchToRgb(
      Math.min(0.97, Math.max(0.1, L + (opts.dL ?? 0))),
      C * (opts.cMul ?? 1),
      (H + (opts.dH ?? 0) + 360) % 360,
    ),
  );
}
