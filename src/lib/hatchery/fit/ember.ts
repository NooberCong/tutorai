/** Hand fits for ember species — see fit.ts. Stages: [hatchling, juvenile, adult].
 *
 *  A recurring fix: many ember heads have only 2–4 rows of skull above the
 *  eyes, so at the measured hat line the nightcap's cuff sat on the glasses'
 *  top rim. Those hats are raised a pixel or so (head.y); a flame tuft or
 *  crest fills in under the raised brim. */

import type { FitTable } from "../fit.ts";

export const EMBER_FIT: FitTable = {
  // Hats up a touch so the cuff clears the glasses.
  kindlemouse: [
    { head: { y: 16.5 } },
    { head: { y: 12 } },
    { head: { y: 8 } },
  ],
  // ¾-view blob: hats up off the eyes, scarf pulled in under the chin
  // instead of spanning the whole body (and below the adult's smile).
  // Emerald wizard hat on purple skin.
  cinderling: [
    { head: { y: 17 }, neck: { x: 14, y: 26.5, w: 11 }, item: { wizardhat: { alt: true } } },
    { head: { y: 15.5 }, neck: { x: 14, y: 24.5, w: 11 }, item: { wizardhat: { alt: true } } },
    { head: { y: 14.5 }, neck: { x: 12, y: 24.5, w: 12 }, item: { wizardhat: { alt: true } } },
  ],
  // Scarf wraps where the head meets the foot, below the mouth, not across
  // the whole foot; nightcap tip and mortarboard tassel hang left, away from
  // the candle.
  candlesnail: [
    { head: { y: 18 }, neck: { x: 12, y: 27, w: 8 }, item: { nightcap: { flip: true }, mortarboard: { flip: true } } },
    { head: { y: 16 }, neck: { x: 10.5, y: 26.5, w: 9 }, item: { nightcap: { flip: true }, mortarboard: { flip: true } } },
    { head: { y: 14.5, w: 11 }, neck: { x: 10, y: 26, w: 10 }, item: { nightcap: { flip: true }, mortarboard: { flip: true } } },
  ],
  // Round ball, no neck: scarf just under the beak. Teal scarf so it reads
  // against the orange breast and flames.
  sparkfinch: [
    { head: { y: 18 }, item: { scarf: { alt: true } } },
    { head: { y: 13 }, neck: { y: 24, w: 12 }, item: { scarf: { alt: true } } },
    { head: { y: 11 }, neck: { y: 22, w: 14 }, item: { scarf: { alt: true } } },
  ],
  // Scarf below the panting tongue; the adult's sits on its collar. Wider
  // hats on the grown dogs (the skull measures narrow between the ears).
  // Teal scarf on orange fur.
  hearthhound: [
    { head: { y: 15 }, neck: { y: 25.5, w: 11 }, item: { scarf: { alt: true } } },
    { head: { y: 8.5, w: 12 }, neck: { y: 19.5, w: 10 }, item: { scarf: { alt: true } } },
    { head: { y: 5, w: 12 }, neck: { y: 18.5, w: 11 }, item: { scarf: { alt: true } } },
  ],
  // Scarf below the fang at a real neck width (measured 4–6 px); the
  // hatchling's is scaled down so its tail doesn't dangle far past the feet.
  // Teal on red skin.
  imp: [
    { head: { y: 15 }, neck: { y: 25.5, w: 11 }, item: { scarf: { alt: true, s: 0.85 } } },
    { head: { y: 8.5 }, neck: { w: 8 }, item: { scarf: { alt: true } } },
    { head: { y: 5 }, neck: { w: 9 }, item: { scarf: { alt: true } } },
  ],
  // The volcano shell sits where a skull would, right on top of the eyes:
  // measured hats swallowed the cone and sank over the eyes. Hats sit on the
  // crater's lip instead (a hat on a mountain). Scarf under the mouth, teal
  // on the red crab.
  cindercrab: [
    { head: { x: 16, y: 18, w: 8 }, neck: { y: 29, w: 9 }, item: { scarf: { alt: true } } },
    { head: { x: 16, y: 14, w: 8 }, item: { scarf: { alt: true } } },
    { head: { x: 16, y: 10, w: 9 }, neck: { y: 26.5, w: 12 }, item: { scarf: { alt: true } } },
  ],
  // Head held forward of a diagonal neck: the measured wrap landed on the
  // muzzle (adult) or measured 2 px wide (juvenile); it goes where the neck
  // leaves the head instead.
  qilin: [
    { head: { y: 13.5 } },
    { head: { w: 10 }, neck: { x: 15, y: 18.5, w: 7 } },
    { neck: { x: 14.5, y: 16, w: 7 } },
  ],
  // Hats sit on the head inside the mane; scarf below the mouth (the
  // hatchling's measured wrap covered it) and neck-wide on the older two
  // (measured 2–6 px). Teal scarf against the red-orange mane rays.
  solleo: [
    { head: { y: 17 }, neck: { y: 27.5, w: 11 }, item: { scarf: { alt: true } } },
    { head: { y: 8 }, neck: { y: 19, w: 8 }, item: { scarf: { alt: true } } },
    { head: { y: 5.5, w: 12 }, neck: { w: 9 }, item: { scarf: { alt: true }, sunhat: { alt: true } } },
  ],
  // Scarf dropped below the beak; teal on red plumage. Dark frames: gold
  // turns the adult's small face into a mask among the flames.
  phoenix: [
    { head: { y: 16 }, neck: { y: 27.5 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
    { head: { y: 12, w: 12 }, neck: { y: 23 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
    { head: { y: 4 }, neck: { y: 13.5 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
  ],
};
