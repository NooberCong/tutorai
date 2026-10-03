/** The living backdrop: the habitat painting redrawn every frame by a
 *  WebGL shader, so its big features move. Aurora curtains ripple and
 *  surge, kelp sways in the swell under a moving surface, clouds billow,
 *  the volcano's plume climbs, lava creeps down its flanks and the
 *  crust drifts on the lava lake, crowns and grass stir in the wind, the
 *  moonlit oak bends in the gusts, drips ring the cavern's pool, mist
 *  drifts through the hollows, fires burn in the library's fireplaces,
 *  and the runes on the study floor turn.
 *
 *  The painter (backdrops.ts, `paintLive`) leaves the moving parts out of
 *  the painting and records where they go: masks for what sways and for
 *  where the sky shows through, and a layer for things that move over the
 *  rest (kelp) or light that changes (lava). This draws the result, dimmed
 *  and split into two edge-pinned halves exactly as the reader shows the
 *  still painting (.reader-host.has-backdrop in styles.css), so the still
 *  and the living one line up and can crossfade.
 *
 *  All motion is slow, continuous and time-based. Noise comes from a
 *  small tiling texture, a few lookups per pixel, so the shader stays
 *  cheap. It runs in the ambience worker, off the main thread. */

import type { Element } from "./kit.ts";
import { BACKDROP_H, BACKDROP_W, CAVE_WATER, CRATER, DRIPS, FIRES, FIRE_BASE, LAVA_HORIZON, LAVA_SHORE, VIGNETTE, backdropExposure, type LiveBackdrop } from "./backdrops.ts";

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Shared by every scene. P is a point in the 1600×1000 scene, t is time
 *  in seconds. N(p) is gradient noise about -1…1 with the painter's scale
 *  (a feature per unit of p); fbm is three octaves of it. */
const HEAD = `#version 300 es
precision highp float;
uniform sampler2D uBase, uMask, uLayer, uNoise;
uniform vec2 uSize;
uniform float uDpr, uScale, uOy, uT, uExpo, uVig, uDim;
out vec4 outColor;
const vec2 S = vec2(${BACKDROP_W}.0, ${BACKDROP_H}.0);
float t;
/** How much of what scene() returned is its own light (lava), 0…1: the
 *  reader dims that less, so it still glows beside the pages. */
float glow;

float N(vec2 p) { return texture(uNoise, p * (1.0 / 32.0)).r * 2.0 - 1.0; }
float N2(vec2 p) { return texture(uNoise, p * (1.0 / 32.0)).g * 2.0 - 1.0; }
float fbm(vec2 p) {
  float s = N(p) * 0.571;
  p = p * 2.03 + vec2(17.1, 3.7);
  s += N(p) * 0.286;
  p = p * 2.03 + vec2(17.1, 3.7);
  return s + N(p) * 0.143;
}
vec3 base(vec2 P) { return texture(uBase, P / S).rgb; }
vec4 mask(vec2 P) { return texture(uMask, P / S); }
vec4 layer(vec2 P) { return texture(uLayer, P / S); }
/** The painting's corner darkening and exposure, for what's drawn here. */
float lit(vec2 P) {
  vec2 d = vec2((P.x - 800.0) / 800.0, (P.y - 450.0) / 600.0);
  return (1.0 - uVig * smoothstep(0.5, 1.6, dot(d, d))) * uExpo;
}
/** A patchy horizontal band of mist between y0 and y1, drifting. */
float mist(vec2 P, float y0, float y1, float a, float drift) {
  float mid = (y0 + y1) * 0.5;
  float band = 1.0 - pow((P.y - mid) / (mid - y0), 2.0);
  if (band <= 0.0) return 0.0;
  float spot = smoothstep(-0.35, 0.45, fbm(vec2(P.x * 0.003 - t * drift, P.y * 0.012 + t * drift * 0.2)));
  return a * band * band * spot;
}
vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
/** Stars are the white specks on a blue night sky: each one twinkles as a
 *  whole (the noise is coarser than a star). */
vec3 twinkle(vec3 col, vec2 P, float sky) {
  float lo = min(col.r, min(col.g, col.b));
  float star = smoothstep(0.12, 0.4, lo) * smoothstep(0.6, 0.85, lo / max(col.r, max(col.g, col.b)));
  return col * (1.0 + sky * star * 0.7 * N2(vec2(P.x * 0.08 + t * 0.7, P.y * 0.08 - t * 0.55)));
}
`;

const TAIL = `
void main() {
  t = uT;
  glow = 0.0;
  vec2 c = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  float half_ = uSize.x * 0.5;
  bool right = c.x >= half_;
  float ox = right ? uSize.x - S.x * uScale : 0.0;
  vec2 P = vec2((c.x - ox) / uScale, (c.y - uOy) / uScale);
  vec3 col = scene(P);
  // over-bright light keeps its hue, as in the painter
  float m = max(col.r, max(col.g, col.b));
  if (m > 1.0) col /= m;
  // the reader's dimming: darkest toward the pages
  float k = right ? (uSize.x - c.x) / half_ : c.x / half_;
  col = mix(col, vec3(5.0, 8.0, 7.0) / 255.0, mix(0.45, 0.85, k) * uDim * (1.0 - 0.45 * glow));
  // a whisper of dither so dimmed gradients don't band
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outColor = vec4(col + (d - 0.5) / 255.0, 1.0);
}`;

/** Each scene's `vec3 scene(vec2 P)`. Mask channels are as the painter
 *  sets them for that scene (backdrops.ts). */
const SCENES: Record<Element, string> = {
  // crowns, bushes and flowers stir (0); sun-dapples drift on the meadow
  // (3). The sway is mirrored by gladeSway() below: keep them in step.
  leaf: `
vec3 scene(vec2 P) {
  vec4 m0 = mask(P);
  float gust = 0.65 + 0.35 * sin(t * 0.11 + 2.0 * sin(t * 0.05));
  float sway = (0.6 * sin(t * 0.8 + P.x * 0.012 + P.y * 0.01) + 0.8 * N(vec2(P.x * 0.004 - t * 0.09, P.y * 0.004 + t * 0.02))) * gust;
  vec2 Q = P + m0.r * vec2(5.0 * sway, 1.6 * sin(t * 1.1 + P.y * 0.03 + P.x * 0.02));
  vec3 col = base(Q);
  // leaves turning over in the breeze
  col *= 1.0 + m0.r * 0.08 * N2(vec2(P.x * 0.06 + t * 0.35, P.y * 0.06 - t * 0.2));
  float dap = smoothstep(-0.1, 0.5, fbm(vec2(P.x * 0.006 - t * 0.02, P.y * 0.018 + t * 0.008)));
  return col * (1.0 + mask(Q).a * (dap - 0.45) * 0.3);
}`,
  // the ash clouds billow (1); the plume climbs out of the crater, its
  // billows lit from below; the lava's light creeps down the rivers
  // (layer); the lake's crust (0) drifts toward you, its plates grinding
  // and its seams brightening and fading; heat shimmers over both
  ember: `
const vec2 CRATER = vec2(${CRATER[0]}.0, ${CRATER[1]}.0);
float hash(vec2 c, vec2 k) { return fract(sin(dot(c, k)) * 43758.5453); }
/** As cells() in backdrops.ts, the points wandering a little with time:
 *  the distances to the nearest and the next, and the nearest one's hash. */
vec3 cells(vec2 s, float drift) {
  vec2 i0 = floor(s);
  float f1 = 9.0, f2 = 9.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 c = i0 + vec2(i, j);
      float hx = hash(c, vec2(127.1, 311.7)), hy = hash(c, vec2(269.5, 183.3));
      vec2 d = c + 0.5 + 0.4 * sin(6.2831853 * vec2(hx, hy) + drift * vec2(hy - 0.5, hx - 0.5)) - s;
      float e = dot(d, d);
      if (e < f1) { f2 = f1; f1 = e; id = hx; } else if (e < f2) f2 = e;
    }
  return vec3(sqrt(f1), sqrt(f2), id);
}
/** crust() in backdrops.ts, drifting: the same lake at t = 0. */
float crust(vec2 P) {
  float d = P.y - ${LAVA_HORIZON}.0;
  // the surface flows slowly toward you and to the left
  vec2 s = vec2((P.x - 800.0) * 3.4 / d + t * 0.012, 2600.0 / d + t * 0.03);
  s += vec2(0.3 * sin(s.y * 1.3 + 1.7 * sin(s.x * 0.5)) + 0.2 * sin(s.x * 0.9 - s.y * 0.7),
            0.3 * sin(s.x * 1.1 + 1.3 * sin(s.y * 0.6)) + 0.2 * sin(s.y * 0.8 + s.x * 0.5));
  vec3 c = cells(s, t * 0.12);
  float edge = c.y - c.x;
  float heat = smoothstep(-0.6, 0.9, sin(s.x * 0.35 + 1.5 * sin(s.y * 0.3) + t * 0.05) + 0.6 * sin(s.y * 0.55 - s.x * 0.2 - t * 0.04));
  float seam = exp(-pow(edge / (0.035 + 0.05 * heat), 2.0));
  float rim = exp(-edge / 0.16);
  vec3 g = cells(s * 2.6 + vec2(7.0, 0.0), t * 0.2);
  float crack = exp(-pow((g.y - g.x) / 0.05, 2.0)) * 0.35;
  float thin = smoothstep(0.85, 1.0, c.z) * heat * 0.3;
  return clamp(seam * (0.45 + 0.55 * heat) + rim * 0.22 * heat + crack * heat + thin, 0.0, 1.0);
}
/** The lake's colour from its crust, as the painter mixes it. */
vec3 lake(vec2 P, float c) {
  float d = P.y - ${LAVA_SHORE}.0;
  float far = 1.0 - smoothstep(0.0, 36.0, d);
  vec3 col = mix(rgb(23.0, 6.0, 5.0), rgb(58.0, 18.0, 9.0), clamp(0.4 + 0.5 * N(vec2(P.x * 0.05, P.y * 0.14)), 0.0, 1.0));
  col = mix(col, rgb(184.0, 48.0, 14.0), clamp(smoothstep(0.0, 0.35, c) * 0.8 + far * 0.4, 0.0, 1.0));
  col = mix(col, rgb(255.0, 106.0, 28.0), clamp(smoothstep(0.25, 0.75, c) + far * 0.3, 0.0, 1.0));
  col = mix(col, rgb(255.0, 210.0, 122.0), smoothstep(0.65, 1.0, c) * 0.8);
  return mix(col, rgb(255.0, 210.0, 122.0), exp(-max(d, 0.0) / 4.0) * 0.5);
}
/** The plume at P: rgb and cover. Its shape is plumeAt() in backdrops.ts. */
vec4 plume(vec2 P) {
  float h = CRATER.y - P.y;
  if (h < -6.0) return vec4(0.0);
  float x = P.x - (CRATER.x - 0.0016 * h * h - 0.08 * h);
  float q = abs(x) / (22.0 + h * 0.5);
  if (q > 1.7) return vec4(0.0);
  // billows climbing with the smoke, and turning over as they go
  vec2 s = vec2(x, P.y + t * 9.0) * 0.009;
  s += 0.4 * vec2(N(s * 0.6 + vec2(0.0, t * 0.03)), N2(s * 0.6 + vec2(4.0, t * 0.025)));
  float b = fbm(s);
  float a = (1.0 - smoothstep(0.35, 1.1, q - b * 0.7)) * smoothstep(-6.0, 20.0, h) * (1.0 - smoothstep(200.0, 360.0, h) * 0.5);
  // lit from the crater: the low billows, and their undersides
  float under = clamp((b - fbm(s + vec2(0.0, 0.08))) * 5.0 + 0.5, 0.0, 1.0);
  vec3 c = mix(rgb(40.0, 20.0, 22.0), rgb(104.0, 52.0, 44.0), clamp(0.5 + b * 1.2, 0.0, 1.0));
  c += rgb(255.0, 132.0, 56.0) * (exp(-h / 110.0) * 0.75 + under * 0.22 * exp(-h / 320.0)) * clamp(0.7 - b, 0.2, 1.0);
  return vec4(c, a * 0.9);
}
vec3 scene(vec2 P) {
  vec4 m = mask(P);
  vec2 w = vec2(N(vec2(P.x * 0.004 + t * 0.012, P.y * 0.006 + t * 0.02)), N2(vec2(P.x * 0.004 + 13.0, P.y * 0.006 + t * 0.028)));
  vec2 Q = P + m.g * w * 16.0;
  // heat shimmer over the crater, and over the lake's far shore
  float heat = exp(-pow((P.x - CRATER.x) / 150.0, 2.0)) * smoothstep(60.0, 300.0, P.y) * (1.0 - smoothstep(CRATER.y - 20.0, CRATER.y + 30.0, P.y));
  heat += smoothstep(${LAVA_SHORE - 110}.0, ${LAVA_SHORE}.0, P.y) * (1.0 - smoothstep(${LAVA_SHORE}.0, ${LAVA_SHORE + 6}.0, P.y)) * 0.6;
  Q.x += heat * 1.5 * sin(P.y * 0.12 - t * 2.4 + 2.0 * N(vec2(P.x * 0.02, P.y * 0.01 - t * 0.3)));
  vec3 col = base(Q);
  float L = lit(P);
  if (m.r > 0.0) {
    float c = crust(P);
    col = mix(col, lake(P, c) * L, m.r);
    glow = m.r * smoothstep(0.1, 0.8, c);
  }
  // the rivers: streaks of crust sliding down them, and surges of fresh
  // lava following each other down
  vec3 e = layer(Q).rgb;
  if (e.r > 0.0) {
    float slide = smoothstep(-0.45, 0.55, N(vec2(P.x * 0.05, P.y * 0.012 - t * 0.17)));
    float skin = smoothstep(0.05, 0.5, N2(vec2(P.x * 0.07 + 3.0, P.y * 0.02 - t * 0.24)));
    float surge = 0.8 + 0.3 * sin(P.y * 0.025 - t * 0.9 + 2.0 * N2(vec2(P.x * 0.01, t * 0.05)));
    float flow = (0.25 + 0.95 * slide) * (1.0 - 0.6 * skin) * surge + 0.15 * N2(vec2(P.x * 0.1 + 5.0, P.y * 0.04 - t * 0.5));
    vec3 light = e * e * 4.0 * flow;
    col += light;
    glow = max(glow, smoothstep(0.15, 0.9, max(light.r, max(light.g, light.b))));
  }
  if (P.y < CRATER.y + 6.0) {
    vec4 s = plume(P);
    col = mix(col, s.rgb * L, s.a);
  }
  return col;
}`,
  // the surface overhead moves and refracts; caustics dance on the sand
  // (3); kelp sways in the swell (layer)
  tide: `
vec3 scene(vec2 P) {
  float L = lit(P);
  float top = 1.0 - smoothstep(0.0, 300.0, P.y);
  vec2 Q = P + top * 5.0 * vec2(N(vec2(P.x * 0.008 + t * 0.05, P.y * 0.02 - t * 0.03)), N2(vec2(P.x * 0.008 - t * 0.04, P.y * 0.02 + 7.0)));
  vec3 col = base(Q);
  if (P.y < 240.0) {
    // two wave trains crossing: a net of light that keeps re-forming
    float wx = fbm(vec2(P.x * 0.004 + t * 0.01, P.y * 0.02)) * 60.0;
    float a = 1.0 - abs(N(vec2((P.x + wx) * 0.012 + t * 0.03, P.y * 0.04 - t * 0.06)));
    float b = 1.0 - abs(N2(vec2((P.x - wx) * 0.011 - t * 0.025, P.y * 0.045 + t * 0.05)));
    float c = max(pow(a, 12.0), pow(b, 12.0) * 0.8);
    col += rgb(232.0, 255.0, 250.0) * c * (1.0 - smoothstep(0.0, 220.0, P.y)) * 0.32 * L;
  }
  float sand = mask(P).a;
  if (sand > 0.0) {
    vec2 q = vec2(P.x * 0.02 + 2.0 * fbm(vec2(P.x * 0.01 + t * 0.04, P.y * 0.03 - t * 0.03)), P.y * 0.06 + t * 0.08);
    float c = 1.0 - abs(N(q));
    col = mix(col, rgb(255.0, 244.0, 208.0) * L, pow(c, 8.0) * 0.42 * sand);
  }
  // a surge passes through; the tops lag behind the stems
  float h = clamp((900.0 - P.y) / 840.0, 0.0, 1.0);
  float sw = (sin(t * 0.42 - P.x * 0.004 - h * 1.6) * 0.7 + sin(t * 0.77 + P.x * 0.009 - h * 2.4) * 0.3) * 34.0 * pow(h, 1.5);
  vec4 k = layer(vec2(P.x - sw, P.y));
  return col * (1.0 - k.a) + k.rgb;
}`,
  // light slides across the crystal faces (3); the pool (1) swells slowly
  // and rings spread where drops from the roof land (as ambience.ts lets
  // them fall); low mist drifts over it
  stone: `
const vec4 DRIP[${DRIPS.length}] = vec4[${DRIPS.length}](${DRIPS.map((d) => `vec4(${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.every.toFixed(2)}, ${d.at.toFixed(2)})`).join(", ")});
vec3 scene(vec2 P) {
  float w = mask(P).g;
  vec2 Q = P;
  float crest = 0.0;
  if (w > 0.0) {
    float deep = clamp((P.y - ${CAVE_WATER}.0) / 128.0, 0.0, 1.0);
    vec2 d = vec2(N(vec2(P.x * 0.012 + t * 0.06, P.y * 0.08 - t * 0.1)), 0.4 * N2(vec2(P.x * 0.012 - t * 0.05, P.y * 0.08))) * (0.5 + deep);
    for (int i = 0; i < ${DRIPS.length}; i++) {
      // (x, y) where it lands, landing whenever t + at is a multiple of every
      vec4 k = DRIP[i];
      float age = mod(t + k.w, k.z);
      if (age > 4.0) continue;
      // seen from above at a slant: rings flattened into ellipses
      vec2 q = vec2(P.x - k.x, (P.y - k.y) * 3.4);
      float e = length(q);
      float fade = pow(1.0 - age / 4.0, 2.0);
      // a ring, and a fainter one following it
      for (float j = 0.0; j < 2.0; j++) {
        float x = e - 5.0 - max(0.0, age - j * 0.4) * 30.0;
        float wave = exp(-x * x / 50.0) * sin(x * 0.6) * fade * (1.0 - j * 0.5);
        d += q / max(e, 1.0) * vec2(1.0, 0.3) * wave * 2.5;
        crest += max(0.0, wave);
      }
    }
    Q += d * w;
    if (mask(Q).g < 0.5) Q = P;
  }
  vec3 col = base(Q);
  float c = mask(Q).a;
  if (c > 0.0) {
    float sweep = pow(max(0.0, sin((P.x * 0.8 - P.y * 0.55) * 0.011 - t * 0.3 + 1.5 * N(P * 0.004))), 14.0);
    float inner = 0.5 + 0.5 * N(vec2(P.x * 0.025, P.y * 0.02 - t * 0.04));
    col += col * c * (0.45 * sweep + 0.12 * inner);
  }
  float L = lit(P);
  col += rgb(190.0, 225.0, 255.0) * crest * 0.32 * w * L;
  float low = smoothstep(740.0, 900.0, P.y);
  if (low > 0.0) {
    float f = smoothstep(-0.25, 0.5, fbm(vec2(P.x * 0.0035 - t * 0.009, P.y * 0.014 + t * 0.002)));
    col = mix(col, rgb(62.0, 54.0, 88.0) * L, low * f * 0.15);
  }
  return col;
}`,
  // the clouds billow (1): two slow warps drifting different ways, so the
  // shapes change rather than slide; high wind combs the cirrus (3)
  sky: `
vec3 scene(vec2 P) {
  vec4 m = mask(P);
  vec2 w = vec2(N(vec2(P.x * 0.004 + t * 0.02, P.y * 0.006)), N2(vec2(P.x * 0.004 + 31.0, P.y * 0.006 - t * 0.017)))
         + 0.45 * vec2(N2(vec2(P.x * 0.01 - t * 0.035, P.y * 0.013 + 5.0)), N(vec2(P.x * 0.01 + 9.0, P.y * 0.013 + t * 0.03)));
  vec2 Q = P + m.g * w * 24.0;
  Q.x += m.a * 24.0 * N(vec2(P.y * 0.02, t * 0.03));
  vec3 col = base(Q);
  return col * (1.0 + m.g * 0.06 * N2(vec2(P.x * 0.004 - t * 0.012, P.y * 0.006 + t * 0.006)));
}`,
  // aurora curtains ripple and surge and stars twinkle where the sky shows
  // (2); mist drifts
  // between the ranges (1); the tall pines' tops sway (0)
  frost: `
vec3 curtain(vec2 P, float y, float amp, float fx, float seed, float s) {
  // the lower edge: slow folds, with ripples running along them
  float e = y + amp * fbm(vec2(P.x * fx + t * 0.006, seed))
          + 9.0 * sin(P.x * 0.021 - t * 0.5 + seed) * (0.5 + 0.5 * N(vec2(P.x * 0.004 + t * 0.01, seed + 3.0)));
  float dy = e - P.y;
  if (dy < -40.0) return vec3(0.0);
  // brightest in a crisp band along the bottom, fading upward
  float up = dy < 0.0 ? exp(-pow(dy / 6.0, 2.0)) : exp(-dy / 190.0) + 0.5 * exp(-pow(dy / 12.0, 2.0));
  float warp = fbm(vec2(P.x * 0.003 - t * 0.012, seed * 2.0));
  // rays: fine vertical streaks, shifting sideways
  float streak = 0.45 + 0.55 * smoothstep(-0.3, 0.7, N(vec2((P.x + warp * 80.0) * 0.045 + t * 0.05, P.y * 0.0025 + seed + 3.0)));
  float fold = 0.6 + 0.4 * sin(P.x * 0.012 + warp * 6.0 - t * 0.22);
  // brightness surging along the curtain
  float surge = 0.7 + 0.6 * smoothstep(-0.2, 0.6, N2(vec2(P.x * 0.0025 - t * 0.035, seed + 9.0)));
  vec3 c = mix(rgb(72.0, 255.0, 168.0), rgb(154.0, 106.0, 255.0), smoothstep(40.0, 300.0, dy));
  c = mix(c, rgb(255.0, 110.0, 180.0), (1.0 - smoothstep(-14.0, 16.0, dy)) * 0.3);
  return c * up * streak * fold * surge * s;
}
vec3 scene(vec2 P) {
  float sway = 0.6 * sin(t * 0.6 + P.x * 0.01) + 0.5 * N(vec2(P.x * 0.003 + t * 0.07, 5.0));
  vec2 Q = P + vec2(mask(P).r * 3.5 * sway, 0.0);
  vec4 m = mask(Q);
  vec3 col = twinkle(base(Q), P, m.b);
  float L = lit(P);
  if (P.y < 720.0 && m.b > 0.0)
    col += (curtain(P, 300.0, 90.0, 0.0018, 13.0, 0.5) + curtain(P, 230.0, 70.0, 0.0025, 14.0, 0.3)) * m.b * L;
  return mix(col, rgb(90.0, 120.0, 164.0) * L, mist(P, 560.0, 700.0, 0.35, 0.008) * m.g);
}`,
  // thin clouds drift across the moon and stars twinkle where the sky
  // shows (2); mist stirs in the hollows (1, 3); the far pines and the
  // meadow grass sway (0); the oak and the tall grass in the corners
  // (layer) bend in gusts rolling in from the left, the oak from its
  // trunk, its leaves fluttering
  moon: `
vec3 scene(vec2 P) {
  float sway = 0.6 * sin(t * 0.5 + P.x * 0.01 + P.y * 0.008) + 0.6 * N(vec2(P.x * 0.004 - t * 0.06, P.y * 0.005));
  vec2 Q = P + mask(P).r * vec2(3.5 * sway, sin(t * 0.8 + P.y * 0.03));
  vec4 m = mask(Q);
  vec3 col = base(Q);
  if (length(P - vec2(330.0, 220.0)) > 100.0) col = twinkle(col, P, m.b);
  float L = lit(P);
  if (P.y > 60.0 && P.y < 520.0 && m.b > 0.0) {
    float a = smoothstep(0.1, 0.45, fbm(vec2(P.x * 0.0018 - t * 0.007, P.y * 0.01 + t * 0.001))) * 0.5;
    vec3 cc = mix(rgb(42.0, 50.0, 112.0), rgb(200.0, 204.0, 240.0), exp(-pow((P.x - 330.0) / 360.0, 2.0) - pow((P.y - 220.0) / 220.0, 2.0)));
    col = mix(col, cc * L, a * m.b);
  }
  col = mix(col, rgb(138.0, 150.0, 216.0) * L, mist(P, 580.0, 700.0, 0.3, 0.006) * m.g);
  col = mix(col, rgb(122.0, 134.0, 200.0) * L, mist(P, 740.0, 860.0, 0.18, 0.01) * m.a);
  vec2 d = vec2(0.0);
  float rustle = 0.0;
  if (P.y > 790.0) {
    float h = pow(clamp((1008.0 - P.y) / 200.0, 0.0, 1.0), 1.6);
    float gust = 0.5 + 0.5 * smoothstep(-0.6, 0.6, sin(t * 0.21 - P.x * 0.0025 + 1.5 * sin(t * 0.07)));
    float s = 0.6 * sin(t * 0.95 - P.x * 0.011) + 0.5 * N(vec2(P.x * 0.004 - t * 0.16, 3.0));
    d.x = h * (2.0 + gust * (6.0 + 6.0 * s));
  } else if (P.x > 1000.0) {
    float h = pow(clamp((666.0 - P.y) / 420.0, 0.0, 1.0), 1.5);
    float gust = 0.5 + 0.5 * smoothstep(-0.6, 0.6, sin(t * 0.21 - 3.4 + 1.5 * sin(t * 0.07)));
    float s = 0.6 * sin(t * 0.55 + 0.5 * sin(t * 0.23)) + 0.4 * N(vec2(t * 0.12, 7.0));
    d.x = h * (2.0 + gust * (5.0 + 7.0 * s));
    d.y = abs(d.x) * 0.08;
    d += h * (0.6 + gust) * vec2(N(vec2(P.x * 0.03 + t * 0.5, P.y * 0.03)), N2(vec2(P.x * 0.03, P.y * 0.03 - t * 0.45)));
    rustle = h * N2(vec2(P.x * 0.05 + t * 0.7, P.y * 0.05 - t * 0.3)) * (0.6 + gust * 0.6);
  }
  vec4 k = layer(P - d);
  return col * (1.0 - k.a) + k.rgb * (1.0 + 0.16 * rustle);
}`,
  // a fire burns in each fireplace (its firebox in 0, the glowing log
  // cracks and coals in 1), its light wavering over the room; the candles
  // flicker; the rune circle turns and breathes
  arcane: `
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float candle(vec2 P, vec2 at, float i) {
  vec2 d = (P - at) / 240.0;
  return exp(-dot(d, d)) * (0.6 * N(vec2(t * 0.9 + i * 7.0, i * 3.1)) + 0.4 * N2(vec2(t * 2.3, i * 5.7 + 11.0)));
}
/** How bright a fire burns just now, about 0.7…1.1: slow swells with a
 *  gentle flutter on top. */
float blaze(float i) {
  return 0.9 + 0.13 * N(vec2(t * 0.35, i * 9.0)) + 0.06 * N2(vec2(t * 1.3, i * 9.0 + 4.0));
}
/** The fire's heat at P, 0…1: a tapering body frayed into tongues that
 *  lick upward, the whole swaying a little. */
float flame(vec2 P, float cx, float i) {
  vec2 q = vec2((P.x - cx) / 62.0, (${FIRE_BASE}.0 - P.y) / 130.0);
  if (q.y < -0.1 || q.y > 1.5 || abs(q.x) > 1.4) return 0.0;
  float ti = t + i * 40.0;
  vec2 w = vec2(N(vec2(q.x * 1.6, q.y * 1.4 - ti * 0.32)), N2(vec2(q.x * 1.6 + 7.3, q.y * 1.4 - ti * 0.4)));
  float sway = q.x + (0.22 * N(vec2(ti * 0.2, i * 3.0)) + 0.12 * w.x) * q.y;
  float tongues = fbm(vec2(q.x * 3.0 + w.x * 0.7, q.y * 2.2 - ti * 0.72 + w.y * 0.5));
  float h = (1.0 - q.y * 0.8 / blaze(i) - pow(abs(sway), 1.5) * 1.3 + tongues * 0.65 * (0.35 + q.y)) * 1.5 - 0.2;
  return clamp(h, 0.0, 1.0) * smoothstep(-0.1, 0.05, q.y);
}
vec3 heatColor(float h) {
  float a = smoothstep(0.0, 0.35, h), b = smoothstep(0.35, 0.7, h), c = smoothstep(0.7, 1.0, h);
  return vec3(a, a * 0.42 + b * 0.38, a * 0.1 + b * 0.12 + c * 0.4);
}
vec3 scene(vec2 P) {
  vec3 col = base(P);
  float L = lit(P);
  float cl = candle(P, vec2(290.0, 560.0), 1.0) + candle(P, vec2(318.0, 574.0), 2.0) + candle(P, vec2(1290.0, 566.0), 3.0);
  col *= 1.0 + vec3(0.3, 0.2, 0.08) * cl;
  if (P.x < 420.0 || P.x > 1180.0) {
    bool right = P.x > 800.0;
    float cx = right ? ${FIRES[1]}.0 : ${FIRES[0]}.0;
    float i = right ? 2.0 : 1.0;
    float b = blaze(i);
    // firelight on the room: brighter and dimmer with the fire, and
    // shifting a little as the flames lean
    vec2 d = (P - vec2(cx + 14.0 * N(vec2(t * 0.3, i)), 740.0)) / vec2(330.0, 260.0);
    // and over the floor in front
    vec2 fd = (P - vec2(cx, 850.0)) / vec2(250.0, 110.0);
    float near = max(exp(-dot(d, d)), exp(-dot(fd, fd)));
    col *= 1.0 + vec3(0.9, 0.5, 0.2) * near * (b - 0.9) * 2.4;
    // the fire mirrored in the polished boards in front, rippling with the
    // grain and the flames
    if (P.y > 843.0) {
      float shine = exp(-pow((P.x - cx) / 55.0, 2.0)) * exp(-(P.y - 843.0) / 55.0);
      float ripple = 0.55 + 0.45 * smoothstep(-0.4, 0.6, N(vec2(P.x * 0.06, P.y * 0.03 - t * 0.5)));
      col += vec3(1.0, 0.54, 0.22) * shine * ripple * b * 0.5 * L;
    }
    vec4 m = mask(P);
    if (m.r > 0.0) {
      float h = flame(P, cx, i);
      // the back of the firebox, lit from below
      col += vec3(0.35, 0.12, 0.03) * m.r * b * smoothstep(640.0, 800.0, P.y) * 0.5;
      col += heatColor(h) * 1.3 * m.r * L;
    }
    // coals and log cracks breathing
    if (m.g > 0.0)
      col += vec3(1.0, 0.36, 0.08) * 1.5 * m.g * L * (0.55 + 0.45 * smoothstep(-0.4, 0.6, N(vec2(P.x * 0.06 - t * 0.12, P.y * 0.1 + t * 0.07)))) * b;
  }
  if (P.y > 820.0 && P.x > 200.0 && P.x < 1400.0) {
    vec2 d = vec2((P.x - 800.0) / 520.0, (P.y - 910.0) / 70.0);
    float e = length(d);
    float ang = atan(d.y, d.x);
    float ring = exp(-pow((e - 1.0) * 60.0, 2.0)) + 0.6 * exp(-pow((e - 0.84) * 70.0, 2.0));
    // runes between the rings, a slow full turn every few minutes
    float a = (ang / 6.2831853 + t * 0.004) * 48.0;
    float slot = mod(floor(a), 48.0);
    float f = fract(a);
    float glyph = step(0.3, hash(slot)) * (exp(-pow((f - 0.3 - 0.4 * hash(slot + 50.0)) * 9.0, 2.0)) + 0.6 * exp(-pow((f - 0.7) * 11.0, 2.0)) * step(0.5, hash(slot + 90.0)));
    float band = exp(-pow((e - 0.92) * 55.0, 2.0));
    float breathe = 0.78 + 0.22 * sin(t * 0.7);
    float sweep = 0.6 + 0.8 * pow(0.5 + 0.5 * cos(ang - t * 0.25), 8.0);
    col += rgb(180.0, 140.0, 255.0) * lit(P) * ((ring * 0.45 + glyph * band * 0.35) * breathe * sweep + exp(-pow(e / 0.9, 2.0)) * 0.05 * breathe);
  }
  return col;
}`,
};

/** Tiling gradient noise, 32 features across 512 texels, four independent
 *  channels. Made once per worker. */
let noiseData: Uint8Array | null = null;
function noiseTexture(): Uint8Array {
  if (noiseData) return noiseData;
  const size = 512;
  const period = 32;
  const out = new Uint8Array(size * size * 4);
  for (let ch = 0; ch < 4; ch++) {
    let a = 1234 + ch * 777;
    const r = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let q = a;
      q = Math.imul(q ^ (q >>> 15), q | 1);
      q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
      return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
    };
    const gx = new Float32Array(period * period);
    const gy = new Float32Array(period * period);
    for (let i = 0; i < gx.length; i++) {
      const ang = r() * Math.PI * 2;
      gx[i] = Math.cos(ang);
      gy[i] = Math.sin(ang);
    }
    const g = (ix: number, iy: number, fx: number, fy: number) => {
      const i = (iy % period) * period + (ix % period);
      return gx[i] * fx + gy[i] * fy;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = (x / size) * period;
        const py = (y / size) * period;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const fx = px - ix;
        const fy = py - iy;
        const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const n00 = g(ix, iy, fx, fy);
        const n10 = g(ix + 1, iy, fx - 1, fy);
        const n01 = g(ix, iy + 1, fx, fy - 1);
        const n11 = g(ix + 1, iy + 1, fx - 1, fy - 1);
        const n = (n00 + u * (n10 - n00) + v * (n01 + u * (n11 - n01) - n00 - u * (n10 - n00))) * 1.4;
        out[(y * size + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round((n * 0.5 + 0.5) * 255)));
      }
    }
  }
  noiseData = out;
  return out;
}

/** The shader's N(p) on the CPU: channel 0 of the noise texture, sampled
 *  as the GPU does (bilinear, repeating). */
function noiseAt(x: number, y: number): number {
  const d = noiseTexture();
  // p / 32 across a 512-texel tile, from texel centres
  const u = x * 16 - 0.5;
  const v = y * 16 - 0.5;
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = u - ix;
  const fy = v - iy;
  const at = (i: number, j: number) => d[((j & 511) * 512 + (i & 511)) * 4];
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
  const bot = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return ((top + (bot - top) * fy) / 255) * 2 - 1;
}

/** How far the glade's breeze has moved what's painted at (x, y), for
 *  something of sway weight `m` (the painter's mask channel 0) at time t:
 *  the leaf scene's displacement, so creatures resting on its plants
 *  (wildlife.ts) move with them. */
export function gladeSway(x: number, y: number, t: number, m: number): [number, number] {
  const gust = 0.65 + 0.35 * Math.sin(t * 0.11 + 2 * Math.sin(t * 0.05));
  const sway = (0.6 * Math.sin(t * 0.8 + x * 0.012 + y * 0.01) + 0.8 * noiseAt(x * 0.004 - t * 0.09, y * 0.004 + t * 0.02)) * gust;
  // the shader shows the painting at P + d, so what's painted at B is seen
  // at B - d
  return [-m * 5 * sway, -m * 1.6 * Math.sin(t * 1.1 + y * 0.03 + x * 0.02)];
}

export interface Living {
  /** Draw the scene at time t (seconds), except over [x0, x1] (CSS px),
   *  the page column, which is left clear: nobody sees it. */
  draw(t: number, x0?: number, x1?: number): void;
  /** The reader's size in CSS pixels and the display's pixel ratio. */
  resize(w: number, h: number, dpr: number): void;
  dispose(): void;
}

/** Set up the shader for an element on a canvas; null without WebGL2.
 *  `dim: false` leaves out the reader's dimming (for looking at it). */
export function createLiving(canvas: OffscreenCanvas | HTMLCanvasElement, el: Element, scene: LiveBackdrop, dim = true): Living | null {
  const gl = (canvas as OffscreenCanvas).getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, HEAD + SCENES[el] + TAIL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());

  const texture = (unit: number, name: string, w: number, h: number, data: ArrayBufferView, repeat = false) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
    return tex;
  };
  const u8 = (a: Uint8ClampedArray) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const textures = [
    texture(0, "uBase", scene.w, scene.h, u8(scene.base)),
    texture(1, "uMask", scene.w, scene.h, u8(scene.mask)),
    scene.layer ? texture(2, "uLayer", scene.w, scene.h, u8(scene.layer)) : texture(2, "uLayer", 1, 1, new Uint8Array(4)),
    texture(3, "uNoise", 512, 512, noiseTexture(), true),
  ];

  const at = (name: string) => gl.getUniformLocation(prog, name);
  const uT = at("uT");
  gl.uniform1f(at("uExpo"), backdropExposure(el));
  gl.uniform1f(at("uVig"), VIGNETTE[el]);
  gl.uniform1f(at("uDim"), dim ? 1 : 0);

  let css = 1;
  return {
    draw(t, x0 = 0, x1 = 0) {
      gl.uniform1f(uT, t);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      const a = Math.max(0, Math.floor(x0 * css));
      const b = Math.min(canvas.width, Math.ceil(x1 * css));
      for (const [from, to] of b > a ? [[0, a], [b, canvas.width]] : [[0, canvas.width]]) {
        if (to <= from) continue;
        gl.scissor(from, 0, to - from, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    },
    resize(w, h, dpr) {
      const half = w / 2;
      const s = Math.max(half / BACKDROP_W, h / BACKDROP_H);
      // no finer than the painting itself: it holds scene.w pixels across
      // the scene's width
      const r = Math.max(0.5, Math.min(dpr, scene.w / BACKDROP_W / s));
      canvas.width = Math.max(1, Math.round(w * r));
      canvas.height = Math.max(1, Math.round(h * r));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(at("uSize"), w, h);
      css = canvas.width / w;
      gl.uniform1f(at("uDpr"), css);
      gl.uniform1f(at("uScale"), s);
      gl.uniform1f(at("uOy"), (h - BACKDROP_H * s) / 2);
    },
    dispose() {
      for (const tex of textures) gl.deleteTexture(tex);
      gl.deleteProgram(prog);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
