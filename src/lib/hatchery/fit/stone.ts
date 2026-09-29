/** Hand fits for stone species — see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

/** Genbu hats hang off its forehead line; the slate board and blue cap vanish
 *  against the blue-grey shell behind, so they take their warm colorways. */
const GENBU_HATS = {
  nightcap: { alt: true },
  mortarboard: { alt: true, dy: 1 },
  flowercrown: { dy: 1 },
};

export const STONE_FIT: FitTable = {
  // Stacked stones: the neck is the seam between head stone and body stone
  // (measured as a sliver). Hatchling hats lift a pixel to clear the glasses.
  pebblit: [
    { head: { y: 18 }, neck: { y: 28.2, w: 11 }, item: { bowtie: { s: 0.8 } } },
    { neck: { w: 11 }, item: { bowtie: { dy: 1 } } },
    { neck: { y: 18.5, w: 11 }, item: { bowtie: { dy: 1 } } },
  ],
  // The face peeks out under the shell dome, which reads as the head's top:
  // hats sit on the shell (between the ears; over the adult's geode), the
  // scarf and bow tie go under the snout, not across it.
  geodillo: [
    { head: { y: 17, w: 10 }, neck: { y: 29, w: 8 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 14, w: 10 }, neck: { y: 29, w: 8 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 13.5, w: 12 }, neck: { y: 29.5, w: 9 }, item: { glasses: { frame: "gold" } } },
  ],
  // The skull part includes the pointed ears, so the measured width was far
  // too wide (adult: 24). Hats go between the horns; the wrap sits under the
  // fanged grin, on the seam between head and body.
  gargoyle: [
    { head: { w: 11 }, neck: { y: 28, w: 11 } },
    { head: { y: 11.5, w: 12 }, neck: { y: 23.2, w: 10 }, item: { nightcap: { dy: -1 } } },
    { head: { y: 9.5, w: 12 }, neck: { y: 20.8, w: 11 }, item: { nightcap: { dy: -1 } } },
  ],
  // Hats go on over the little crown (it'd lift a real hat) so their cuffs
  // clear the glasses; the adult's scarf wraps the whole throat above the gem.
  basilisk: [
    { head: { y: 15 }, item: { flowercrown: { dy: 1 } } },
    { head: { y: 11 }, item: { flowercrown: { dy: 1 } } },
    { head: { y: 7 }, neck: { w: 11 }, item: { flowercrown: { dy: 1 }, bowtie: { s: 0.8 } } },
  ],
  // A tortoise whose little head pokes out under the shell's front: hats are
  // small and sit on that forehead (never up on the mountain), lifted so the
  // cuff clears the eyes. The measured neck spanned the front feet; the wrap
  // goes just under the mouth. Close-set eyes: gold frames read, dark ones blob.
  genbu: [
    { head: { y: 18.5, w: 8 }, neck: { y: 28.6, w: 8 }, item: { ...GENBU_HATS, glasses: { frame: "gold" }, bowtie: { dy: 1 } } },
    { head: { y: 18.5, w: 8 }, neck: { y: 28.6, w: 8 }, item: { ...GENBU_HATS, glasses: { frame: "gold" }, bowtie: { dy: 1 } } },
    { head: { y: 19, w: 10 }, neck: { y: 29.6, w: 9 }, item: { ...GENBU_HATS, bowtie: { dy: 1 } } },
  ],
  // The eyes sit at the very top of the head, so hats ride a little high
  // (the nightcap's deep cuff a pixel more) to leave the glasses' rims clear.
  // Hatchling was measured on the nose gem. The neck is under the mouth, not
  // across the gem snout.
  gemmole: [
    { head: { x: 16, y: 16, w: 11 }, neck: { y: 28, w: 10 }, item: { glasses: { frame: "dark" }, nightcap: { dy: -1 }, flowercrown: { dy: 1 } } },
    { head: { y: 13 }, neck: { y: 26.5, w: 13 }, item: { nightcap: { dy: -1 }, flowercrown: { dy: 1 } } },
    { head: { y: 9, w: 14 }, neck: { y: 26.8, w: 14 }, item: { nightcap: { dy: -1 }, flowercrown: { dy: 1 } } },
  ],
  // Side-on pill bug facing left: the head wears a plate helmet over the
  // skin, so hats sit on the helmet (measured on the skin below it), with the
  // antennae poking out behind; the slate board takes brown off the plates.
  // The chin rests on the ground; the wrap goes right under the mouth.
  // Close-set eyes on pale skin: gold frames.
  rollypolly: [
    { head: { x: 12.8, y: 19.5, w: 9 }, neck: { x: 12.5, y: 28.6, w: 8 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -1 }, mortarboard: { alt: true } } },
    { head: { x: 10, y: 19, w: 10 }, neck: { x: 9.8, y: 29, w: 9 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -1 }, mortarboard: { alt: true } } },
    { head: { x: 8.8, y: 17.7, w: 11 }, neck: { x: 8.5, y: 28.6, w: 10 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -1 }, mortarboard: { alt: true }, bowtie: { s: 0.8 } } },
  ],
  // ¾ view facing left, eyes right under the crown: hats rest on the ears,
  // set back from the snout horn with a slight lean, high enough to clear the
  // glasses. The measured neck ran across the snout; the wrap belongs at the
  // throat, between jaw and body.
  rhinolith: [
    { head: { x: 15, y: 16.5, w: 9, tilt: -6 }, neck: { x: 15.5, y: 27.3, w: 8 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -0.5 } } },
    { head: { x: 13, y: 14.5, w: 10, tilt: -6 }, neck: { x: 14, y: 25.3, w: 8 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -0.5 } } },
    { head: { x: 12.5, y: 11, w: 11, tilt: -6 }, neck: { x: 13, y: 23.2, w: 9 }, item: { nightcap: { dy: -0.5 } } },
  ],
  // Measured on the big nose (the part under the eyes). Hats go on top of
  // the moss mop, the wrap under the toothy grin; arms hang free.
  mosstroll: [
    { head: { x: 16, y: 17, w: 11 }, neck: { y: 29, w: 10 }, item: { nightcap: { dy: -1 }, bowtie: { dy: 0.5 } } },
    { head: { x: 16, y: 11.5, w: 13 }, neck: { y: 26.5, w: 12 }, item: { bowtie: { dy: 1 } } },
    { head: { x: 16, y: 7, w: 14 }, neck: { y: 25, w: 14 }, item: { bowtie: { dy: 1 } } },
  ],
  // ¾ view facing left, eyes near the crown: hats sit a touch high and lean
  // with the head, clear of the back plates. The measured neck wrapped the
  // snout; the wrap goes on the throat behind the jaw.
  stegolith: [
    { head: { x: 11.5, y: 17.5, w: 10, tilt: -6 }, neck: { x: 14, y: 27, w: 8 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -0.5 }, flowercrown: { dy: 1 } } },
    { head: { x: 9, y: 16.5, w: 9, tilt: -6 }, neck: { x: 12, y: 26, w: 7 }, item: { glasses: { frame: "gold" }, nightcap: { dy: -0.5 }, flowercrown: { dy: 1 } } },
    { head: { x: 7, y: 13.5, w: 10, tilt: -6 }, neck: { x: 10.5, y: 24.5, w: 8 }, item: { nightcap: { dy: -0.5 }, flowercrown: { dy: 1.5 } } },
  ],
};
