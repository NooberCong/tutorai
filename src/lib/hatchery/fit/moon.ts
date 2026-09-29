/** Hand fits for moon species — see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

const WISP_ITEMS = { mortarboard: { flip: true }, bowtie: { dy: 1 } };

export const MOON_FIT: FitTable = {
  // Upper-rim collision with the nightcap cuff in the outfit: lift the hat a row.
  jackalope: [{}, {}, { head: { y: 8 } }],

  // Teardrop ghost: the measured "skull" is the wick; hats sit on the bulb
  // (flame peeks out beside them). No neck: wrap right under the mouth, bow a
  // row lower so it clears the smile; tassel hangs left, away from the flame.
  lanternwisp: [
    { head: { x: 16.5, y: 15, w: 9 }, neck: { y: 25, w: 10 }, item: WISP_ITEMS },
    { head: { x: 17, y: 9, w: 10 }, neck: { x: 16.5, y: 20.5, w: 11 }, item: WISP_ITEMS },
    { head: { x: 17, y: 8, w: 11 }, neck: { x: 17, y: 19.5, w: 12 }, item: WISP_ITEMS },
  ],

  // Tapir facing left: the wrap goes behind the trunk, where head meets body.
  // Purple hide: gold frames, emerald wizard hat, crimson bow.
  baku: [
    { neck: { x: 13, y: 24.5, w: 8 }, item: { glasses: { frame: "gold" }, wizardhat: { alt: true }, bowtie: { alt: true } } },
    { neck: { x: 13, y: 23.5, w: 9 }, item: { glasses: { frame: "gold" }, wizardhat: { alt: true }, bowtie: { alt: true } } },
    { neck: { x: 12, y: 21, w: 10 }, item: { glasses: { frame: "gold" }, wizardhat: { alt: true }, bowtie: { alt: true } } },
  ],

  // Blue whale: crimson cap and bow. Hatchling hats up a row off the glasses;
  // adult wrap stops short of the fins.
  starwhale: [
    { head: { y: 14 }, item: { nightcap: { alt: true }, bowtie: { alt: true } } },
    { item: { nightcap: { alt: true }, bowtie: { alt: true } } },
    { neck: { x: 15, w: 16 }, item: { nightcap: { alt: true }, bowtie: { alt: true } } },
  ],

  // Round head over a cloak: the measured neck is the fluff collar's pinch;
  // wrap under the head instead. Purple wizard hat → emerald.
  batling: [
    { neck: { y: 27, w: 11 }, item: { wizardhat: { alt: true } } },
    { neck: { y: 22, w: 10 }, item: { wizardhat: { alt: true } } },
    { neck: { y: 19.5, w: 11 }, item: { wizardhat: { alt: true } } },
  ],

  // Blue shell: gold frames, crimson cap and bow. Wrap the thorax, not its pinch.
  glowbug: [
    { item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { alt: true, dy: 1 } } },
    { neck: { y: 21, w: 9 }, item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { alt: true } } },
    { neck: { y: 18, w: 10 }, item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { alt: true } } },
  ],

  // Eyes are gold key-ink decals the measurement can't see: set by hand.
  // ¾ head facing left, eyes high on the skull: hats sit back and up.
  raven: [
    {
      head: { x: 15.5, y: 17, w: 10 },
      eyes: { l: [11, 20], r: [16, 20], w: 2, h: 3 },
      neck: { x: 16, y: 26, w: 11 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "silver" } },
    },
    {
      head: { x: 16, y: 7, w: 9 },
      eyes: { l: [10, 11], r: [15, 11], w: 2, h: 2 },
      neck: { x: 16, y: 18, w: 10 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "silver" } },
    },
    {
      head: { x: 16, y: 4.5, w: 11 },
      eyes: { l: [9, 8], r: [15, 8], w: 2, h: 2 },
      neck: { x: 16.5, y: 16.5, w: 11 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "silver" } },
    },
  ],

  // Already wears a blue nightcap: ours goes crimson and wide enough to cover
  // its brim. Gold frames read against the dark eye patches.
  slumbersloth: [
    { item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { dy: 1 } } },
    { head: { w: 12 }, item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { dy: 1 } } },
    { head: { w: 13 }, neck: { y: 21.5, w: 14 }, item: { glasses: { frame: "gold" }, nightcap: { alt: true } } },
  ],

  // Juvenile's skull reads wider than the abdomen pinch measured; wrap is
  // widened to the body.
  starweaver: [{}, { head: { w: 10 }, neck: { y: 24, w: 10 }, item: { bowtie: { dy: -1 } } }, {}],
};
