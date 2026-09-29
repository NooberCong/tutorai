/** Hand fits for arcane species â€” see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

/** Purple/blue items vanish on the violet ink creatures. */
const INKY = { nightcap: { alt: true }, wizardhat: { alt: true }, bowtie: { alt: true } };

/** Blue/violet/navy items vanish on lapis stripes and blue smoke. */
const LAPIS = { nightcap: { alt: true }, wizardhat: { alt: true }, mortarboard: { alt: true }, bowtie: { alt: true } };

/** Mimic: gold rims on the violet lid; the bow tie sits left of the tongue
 *  on the cream page edge, where the blue one shows. */
const MIMIC = {
  nightcap: { alt: true }, wizardhat: { alt: true }, glasses: { frame: "gold" as const }, bowtie: { dx: -4 },
};

/** Djinn: LAPIS colorways plus gold rims, which read on the blue smoke. */
const DJINN = { ...LAPIS, glasses: { frame: "gold" as const } };

export const ARCANE_FIT: FitTable = {
  // An ink drop: the measured "skull" is the drop's needle tip. Hats sit
  // lower and wider so they swallow the tip; no neck, so scarf and bow tie
  // go just under the mouth instead of over it.
  inkling: [
    { head: { x: 16.5, y: 17, w: 9 }, neck: { y: 28, w: 13 }, item: { ...INKY, nightcap: { alt: true, dy: -1 } } },
    { head: { x: 16.5, y: 13, w: 10 }, neck: { y: 25, w: 13 }, item: INKY },
    { head: { x: 17, y: 8, w: 10 }, neck: { y: 21, w: 13 }, item: { ...INKY, flowercrown: { dy: 2 } } },
  ],
  // The book over the head is its ears: hats sit on the skull under the
  // spine. The measured neck lands on the tongue; the wrap goes on the
  // collar (juvenile/adult) or under the chin (hatchling); the teal scarf
  // reads against the red cover collar.
  tomepup: [
    { neck: { y: 25, w: 9 }, item: { scarf: { alt: true } } },
    { neck: { y: 20.5, w: 9 }, item: { scarf: { alt: true } } },
    { neck: { y: 19.5, w: 10 }, item: { scarf: { alt: true } } },
  ],
  // Lilac fur: violet/blue items get their second colorway. The neck was
  // measured on the chin (juvenile/adult: a 4px sliver); the wrap goes
  // where the head meets the body. Hats up a row so the cuff clears the glasses.
  babelfox: [
    { head: { y: 14, w: 11 }, neck: { y: 24.5, w: 10 }, item: INKY },
    { head: { y: 8 }, neck: { y: 19, w: 9 }, item: INKY },
    { head: { y: 6 }, neck: { y: 17, w: 10 }, item: INKY },
  ],
  // The measured head is the face inside the nemes; hats sit on top of the
  // headdress instead (covering the uraeus gem). Blue/dark items vanish on
  // the lapis stripes. The measured neck lands on the mouth.
  sphinx: [
    { head: { y: 13, w: 11 }, neck: { y: 25, w: 8 }, item: LAPIS },
    { head: { y: 8.5, w: 11 }, neck: { y: 21, w: 8 }, item: LAPIS },
    { head: { y: 3.5, w: 12 }, neck: { y: 17.5, w: 9 }, item: LAPIS },
  ],
  // ¾ view facing left. Hats sit back on the crown behind the horn (it
  // pokes out in front) with a slight backward lean; the measured neck was
  // the muzzle, so the wrap moves back onto the neck. Crimson bow tie: the blue one
  // vanishes into the sky-blue mane.
  unicorn: [
    { head: { x: 14.5, y: 13, w: 10 }, neck: { x: 15.5, y: 23, w: 8 }, item: { bowtie: { alt: true } } },
    { head: { x: 13.5, y: 7.5, w: 9, tilt: 6 }, neck: { x: 15, y: 18.5, w: 8, tilt: -10 }, item: { bowtie: { alt: true } } },
    { head: { x: 11.5, y: 6, w: 8, tilt: 10 }, neck: { x: 14.5, y: 16, w: 9, tilt: -10 }, item: { bowtie: { alt: true } } },
  ],
  // Already wears gold spectacles: the accessory frames go gold too so they
  // read as one bigger pair. The measured neck hit the book (hatchling) or
  // the mouth; the wrap goes under the chin where the body curls away. The
  // adult has its own violet cap and tassel (left): a worn mortarboard hangs
  // its tassel on the same side, the wizard hat goes emerald, and hats sit
  // lower and wider so they swallow the built-in cap instead of stacking.
  bookworm: [
    { neck: { y: 23, w: 9 }, item: { glasses: { frame: "gold" } } },
    { neck: { x: 15.5, y: 18.5, w: 8 }, item: { glasses: { frame: "gold" } } },
    {
      head: { y: 7, w: 12 },
      neck: { x: 14.5, y: 17.5, w: 9 },
      item: { glasses: { frame: "gold" }, mortarboard: { flip: true }, wizardhat: { alt: true } },
    },
  ],
  // Origami head: a diamond with a crest on its peak. Hats perch on the
  // peak (covering the crest), low enough to sit, high enough to clear the
  // glasses. The measured neck was a 3px sliver at the head's bottom point;
  // the wrap goes where head meets the kite body.
  paperbird: [
    { head: { x: 11.4, y: 11, w: 8 }, neck: { x: 12.5, y: 20.5, w: 7 } },
    { head: { x: 9.4, y: 7.5, w: 8 }, neck: { x: 10.5, y: 16.5, w: 7 } },
    { head: { x: 8.2, y: 5.5, w: 8 }, neck: { x: 9.5, y: 13.5, w: 7 } },
  ],
  // A grimoire opened like a jaw: the "head" is the lid, which tilts up to
  // the right, with the eyes (on two different rows) right under its top
  // edge. Hats lean with the lid and ride ~2px high on it so their bands
  // clear the eyes; the wrap goes round the lower block under the teeth.
  mimic: [
    {
      head: { x: 16, y: 11, w: 13, tilt: -5 },
      eyes: { l: [12, 15], r: [18, 14], w: 2, h: 3 },
      neck: { x: 16, y: 25, w: 14 },
      item: { ...MIMIC, nightcap: { alt: true, dy: -1 }, mortarboard: { dy: -1 } },
    },
    {
      head: { x: 16, y: 5.5, w: 15, tilt: -6 },
      eyes: { l: [10, 9], r: [18, 8], w: 2, h: 3 },
      neck: { x: 16, y: 22.5, w: 18 },
      item: MIMIC,
    },
    {
      head: { x: 16, y: 1, w: 16, tilt: -6 },
      eyes: { l: [9, 5], r: [18, 4], w: 2, h: 3 },
      neck: { x: 16, y: 21, w: 22 },
      item: MIMIC,
    },
  ],
  // Floating hewn blocks. The measured neck sat on the mouth; the wrap goes
  // in the air gap under the head stone (the hatchling is one block: under
  // its mouth).
  runegolem: [
    { neck: { y: 26, w: 12 } },
    { neck: { y: 15.5, w: 8 } },
    { neck: { y: 10, w: 8 } },
  ],
  // Blue smoke over a lamp. Hats sit over the turban (juvenile/adult),
  // covering it; blue/violet/navy items get their second colorway and gold
  // rims read better than dark ones on the blue. The
  // measured neck was the wisp (hatchling) or the mouth; the wrap goes
  // where the head meets the smoky torso.
  djinn: [
    { head: { w: 10 }, neck: { x: 18, y: 21, w: 8 }, item: DJINN },
    { head: { y: 4.5, w: 11 }, neck: { y: 15, w: 8 }, item: DJINN },
    { head: { y: 2.5, w: 12 }, neck: { y: 13, w: 9 }, item: DJINN },
  ],
};
