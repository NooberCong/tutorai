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
- [ ] Shiny looks special.
- [ ] `npx tsc --noEmit` passes.
