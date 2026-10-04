# Hatchery art guide

Every creature and egg is drawn in code by `pixel.ts` from shape primitives —
never as hand-typed pixel grids. Author shapes, render, look, adjust.

## Pipeline

```
node scripts/sprite-sheet.ts <out.png> <element-or-id> [scale=5]
```

Renders one row per species: egg · hatchling · juvenile · adult · shiny
adult · blink · sleep, on the app's dark ink. Open the PNG and look at it —
every species gets at least three render → critique → fix rounds. Critique
like an art director: silhouette first, then face, then color, then detail.

Node runs the TS directly (type stripping): imports need the `.ts`
extension, type-only imports need `import type`, no enums/namespaces.

## Canvas & staging

- 32×32, x grows right, y grows down, pixel centers at `n + 0.5`.
  The vertical center line is **x = 16**; `both(prim)` mirrors across it, and
  mirrored eye pairs sit at `[16 - d - w, y]` / `[16 + d, y]` (e.g. 2-wide eyes
  at `[12, y]` and `[18, y]`).
- Grounded creatures stand on **y ≈ 30** (lowest body pixel row 29–30, the
  outline lands on 31). Floaters (wisps, jellies, whales, clouds) hover with
  their lowest pixel around y 26–28; the UI bobs them.
- Face the viewer (front or ¾). Both eyes visible — the face is the product.
- **Growth reads as size + proportion + features**, all three:
  - **Hatchling (stage 0)** — fits ≈16×15 px, sits low. One round blob or big
    head on a tiny body, oversized `tall` eyes, stubby or no limbs. Signature
    features only as buds (a nub horn, one leaf, a spark).
  - **Juvenile (stage 1)** — ≈22×22. Proportions lengthen, limbs appear, the
    signature feature is clearly there but small.
  - **Adult (stage 2)** — up to ≈30×30, uses the canvas. Full signature
    features, the silhouette someone would recognize from the outline alone.
  A player must see at a glance that the three are the same creature: keep
  palette, eye style and the signature feature consistent across stages.

## Tier = visual richness

Each element has ten species: 4 common, 3 rare, 2 epic, 1 legendary.

| tier | materials | feel |
|---|---|---|
| common | 2–3 | simple, round, one idea |
| rare | 3–4 | one striking signature feature |
| epic | 4–5 | ornament, a `glow` accent (crystal, flame, rune) |
| legendary | 5–6 | majestic adult silhouette filling the canvas, `glow` parts, `sparkle` decals on the adult |

## Parts (see pixel.ts)

- Parts draw back-to-front: list far limbs / wings / tails first (mark them
  `back: true` — shaded a step darker, reads as depth), then body, then head,
  then front limbs and ornaments.
- Primitives inside one part smooth-union (`blend`, default 1). Put things
  that should read as one mass in one part; head and body usually belong
  together (`blend: 3–5`) for chibi creatures.
- A part over another casts a dark 1-px separation line onto it. That's what
  makes an ear read in front of a head — but over-splitting a body into many
  same-colored parts makes a web of dark lines. Merge, or `line: false` for
  small decorations.
- `paint` recolors a region of a part but keeps its shading: bellies, masks,
  stripes, spots, socks.
- `glow: true` lights a part from its core (flames, crystals, runes, halo).
- Minimum primitive radius ≈ 0.8; thinner features vanish or flicker.
- Shading is automatic from the shape (light from the top-left); don't try
  to paint shading by hand.

## Faces & decals (kit.ts)

- `eyes(l, r, pose, style)` — `tall` (2×3) for hatchlings and cute juveniles,
  `round` (2×2) for older/sleeker adults, `big` (3×3) for owl-like faces,
  `dot` for tiny/stern. Always pass `pose` so blink/sleep work.
- `blush(l, r)` under the eyes on cute commons/hatchlings; optional on adults.
- `stamp(x, y, rows, inks)` for mouths (`["k.k", ".k."]`), fangs, gems,
  spots, glyphs. Inks: `"mat:level"` (0 outline … 3 base … 5 shine) or `#hex`.
- Sleep pose: add `zzz(x, y)` above-right of the head (stay in-canvas).
- Keep pixels off the outline: decals sit inside the body.

## Color

- Pick each material's **mid-tone** as its palette value; the ramp (outline,
  dark, shadow, base, light, shine) is generated with hue shifting.
- Mid-tones: not too dark (the app is dark green-black; a dark body loses its
  outline). Aim for base lightness ≥ ~55% except deliberate night creatures,
  which then need a bright accent.
- One accent color that pops per creature; don't use pure saturated primaries.
- `shiny` overrides must feel like a rare variant: a real hue change
  (e.g. teal→gold, pink→midnight), not a nudge. Keep eye readability.

## Tricks the first 40 species taught us

- Pale paints (cream bellies, muzzles) shade into grey-brown on the shadow
  side; give them `level: 4` for a flat light fill.
- White fur reads icy rather than grey when tinted slightly blue.
- Flames: `glow` parts with `round` ≈ 1.3–1.5 and `blend` ≈ 0.4 keep a hot
  core and separate tongues. Alternate feathers/tongues in separate parts so
  each casts a thin line on its neighbour — a fan then reads as feathers.
- Thin parts (legs) shade mostly to shadow; keep them a touch thicker or
  lighter than feels right.
- Review every pose at every stage, not just the sheet's default columns —
  a local preview script that renders all 9 frames per species pays off.
- `round` works backwards from what it sounds like: values *smaller* than a
  part's thickness (≈1.5–2.5) give a flat lit face with a bevelled edge;
  larger values slope the whole part into shadow. Small `round` is the fix
  for grey-looking pale parts and for striped limbs.
- Rows of same-depth legs read as a comb. Show two legs, push the far pair
  back (`back: true`, shorter, or hidden by fur), or merge legs into the
  body and show only paws or hooves.
- Pale fills (paper, bellies, white fur) stay clean with a full-coverage
  paint at a fixed `level`.
- ¾ views read better than front views for long-bodied animals (deer,
  rhino, raven, stegosaurus).
- Crystals read as gems, not flames, when the facet away from the light is
  painted a step darker than a `glow` core.
- Orphan cleanup only merges a pixel into same-part, same-material
  neighbours, so 1px paint marks in another material survive.

## Words

- `stages`: three names, hatchling → adult, e.g. ["Sproutling", "Sprigling",
  "Bloomhare"]. The adult name is the headline.
- `lore`: one or two sentences, playful, and about reading/books/study where
  it lands naturally. No lore dumps.
- `hint`: one short cryptic line shown under an undiscovered silhouette.

## Checklist before done

- [ ] Silhouettes are distinct from every other species on the sheet.
- [ ] Hatchling → adult clearly the same creature, clearly grown.
- [ ] Nothing clipped at the canvas edge; grounded creatures sit on y≈30.
- [ ] Blink and sleep frames look right (eyes are decals, not parts).
- [ ] Animated: every clip at every stage reviewed on `motion-sheet.ts`, calm and seamless.
- [ ] Shiny looks special.
- [ ] `npx tsc --noEmit` passes.

## Animation

A species with `motion` is animated (`motion.ts`). Its `draw` marks the parts
that move with `Move`s, and every frame re-renders the creature as pixel art
from the moved shapes. A turned wing is re-shaded and re-outlined, never a
bitmap pushed around. Mark moves with `rig(moves, ...parts | decals |
prims)`. A part's own moves apply first, then whatever carries it.

- **Moves:**
  - `turn` swings about the joint `at`.
  - `bend` + `lag` make a whip, a wave running out along a tail, fin or flame.
  - `shift` moves by whole pixels.
  - `grow` swells continuously; pair it with a `stepped` wave on big parts so their shading doesn't shimmer.
  - `pair` mirrors the move for the right half of a mirrored part.
  - `side` moves only one half.
- **Whole-pixel steps:** turns step by the angle that carries the part's far
  end one pixel, so slow swings move a pixel at a time and rigid parts stay
  rigid.
- **Clips:**
  - The idle loop (`motion.idle` seconds, waves with whole cycles per loop).
  - Blink, which runs on the same frames.
  - The sleeping breath.
  - The signature act: `draw(stage, "act", t)` with `t` the act's own time. It plays over the idle loop from its first frame and lasts `motion.act` loops, so it must match the loop at both ends.
- **Riding the head:** set `head` (and `neck`) on the drawing to the moves
  that carry the head; hats, glasses and scarves ride them.
- **Room to move:** frames render with `ROOM` around the 32×32 box (5 px
  each side, 10 above, 2 below), so a wing or tail may swing past the
  still's edges. Nothing may leave that room. `zzz()` drifts only as far as
  the canvas allows.
- **Gotchas:**
  - Put moves on a part or on its prims; a `paint` carries none of its own.
  - A wave that closes over the act's time (`() => env`) ignores `lag`. Use a wave of `u` for an act ripple that should run out along a part.
- **Subtle and relaxing:** the pet sits beside the text.
  - Use eased waves (`sine`, `rise`, `pulse`, `ease`), 1–2 px of travel and loops of 3 s or more.
  - No snaps (`twitch` is for rare, tiny accents), no big flares.
  - Acts are gentle: a yawn, a bow, a slow stretch.

```
node scripts/motion-sheet.ts <out.png> <id> [stage] [idle|blink|sleep|act|dressed] [scale] [step] [diff] [from:to]
```

Read the frames as a flipbook; `diff` dots every pixel that changed since
the frame before, which shows exactly what moves when. Check every stage and
clip, dressed too. The act's first and last frames must equal the idle
loop's.

## Accessories

Pets wear earned accessories (`accessories.ts`) drawn in the same render
pass, so they shade and outline like parts. Each is placed from a per-stage
`Fit` (`fit.ts`): the skull top and width (hats), the eye decals (glasses),
and the neck (scarf, bow tie). It's measured automatically, then corrected
by hand in `fit/<element>.ts`. Items can be nudged there too, flipped, or
switched to a second colorway where the first blends into the creature.

```
node scripts/wardrobe-sheet.ts <out-dir> <element-or-id> [scale=4] [columns]
```

A new species isn't done until every accessory looks fitted at every stage:
hats sit on the skull, not on a crest or ear tip, and clear of the eyes;
glasses ring the real eyes; the scarf wraps where the head meets the body and
keeps the mouth visible; and nothing blends into the creature's colors.
Eyes drawn without `eyes()` need their positions set by hand.

## Habitats

`scenes.ts` paints one 56×48 scene per element, at the creature's pixel
size, with the creature's 32×32 box at `STAGE`. Review with
`node scripts/scene-sheet.ts <out.png> [element] [scale]` (each scene empty,
with three of its own creatures, a foreign one, and its egg). Keep scenes
darker and calmer than the creatures: shading lives in `tint` steps with
dithering only at step edges, and `finish()` adds the light pool and dark
edges, then grades the whole scene (`GRADE`: lightness squeezed into a dim
middle range, color muted) so any creature — even a white one on snow —
stands out. The UI adds a dark one-pixel rim around the creature.
Motes (embers, snow, bubbles) are CSS-animated in the UI from `MOTES`.

## Reader backdrops

`backdrops.ts` paints each habitat wide (a 1600×1000 scene space, rendered
at any size) for the space beside the reader's pages. It is not pixel art:
it is a small per-pixel painter. Terrain comes from fractal noise, lit by
its slope (`faceLight`) or a bump map. Foliage and rock are noise-edged
lit spheres (`ball`/`cluster`). Clouds are not (they read as wax, or as a
stack of balls): `cloud` merges a cloud's billows into one silhouette,
lights the mass as a whole, and keeps crisp gold rims only on its outline,
with faint folds inside. Distance fades into the sky through haze and mist. Light is additive (`glow`, `rays`, lava, aurora).
Keep the scenery at the left and right edges; the middle is under the
pages. The reader shows each half pinned to its own edge and dims it
(styles.css), and `EXPOSURE` evens out bright and dark habitats. Review with
`node scripts/backdrop-sheet.ts <dir> [element] [--dim] [--w=1200]`. In the
app it renders in a worker (`components/hatchery/backdrop.worker.ts`) once
per element per session.

With motion on, the painting itself moves: `living.ts` redraws it every
frame with a WebGL shader. For that the painter runs in live mode
(`paintLive`), which leaves out whatever the shader draws (aurora, the
moon's clouds, mist in the hollows, the caustic nets, the library's fires,
the rune circle) and records where things go in four mask channels per
scene. A "hide" channel starts at 1 and is covered by everything painted after it, so it says
where an effect behind the scenery shows (the aurora behind the mountains).
A "tag" channel follows `p.brush`, so it says how much a pixel belongs to
something that moves (a crown that sways), or where an effect goes (the
library's fireboxes and glowing log cracks); a sway field is blurred, since
it has to reach a little past the thing that sways. Kelp, the moonlit
oak and the meadow's near grass, and lava light go to a separate layer (`beginLayer`), moved or animated over the
rest. Each scene's comments name its channels, and its shader in `living.ts`
reads them. Motion there is slow, continuous and time-based. Review the
masks and layer with `backdrop-sheet.ts --live`.

`ambience.ts` is what drifts over the painting: pollen and falling leaves,
embers, bubbles, fish, snow, fireflies, shooting stars, crystal glints, candle
flicker and birds gliding over the cloud sea, in the same scene space and
mapped the same two-halves way. Particles that move are left out of the painting (only stars
and flowers stay baked in), so nothing looks frozen. The glade's butterflies
and songbirds live in `wildlife.ts`: they land on the painter's own flowers
(`GLADE_FLOWERS`), bush tops and ground (`gladeGround`), and ride the
plants' sway through `gladeSway` in `living.ts`, a CPU copy of the leaf
shader's that must change with it. The cavern's glowworms, drips and bat
live in `cave.ts`. Its drops fall on the `DRIPS` schedule from stalactites
the painter hangs at those tips, and `living.ts` rings the pool where and
when they land, so all three read the same constants. The ember crags'
sparks, ash, lava bubbles and eruptions live in `ember.ts`: bubbles break
at the painter's `LAVA_BUBBLES` and cinders land on its `volcanoAt`
flanks. The lake's crust is only trig and hashes (`crust` in the painter
and the shader), so the living lake starts exactly where the still one
is, and the shader's plume follows the painter's `plumeAt`. `speck.ts`
is the soft light both stamp.

Both run in `ambience.worker.ts` on OffscreenCanvases: the main thread only
forwards resizes, visibility and where the page column is. The painting
draws only beside the pages at about 30 frames a second, the particles at
about 60, and nothing runs when the reader is hidden or "reduce motion" is
set. The still painting stays underneath: it shows first, the living one
fades in over it (they line up exactly), and it's what's left without
WebGL2.
