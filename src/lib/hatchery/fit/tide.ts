/** Hand fits for tide species — see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

export const TIDE_FIT: FitTable = {
  // Pale-blue jelly: blue items swap colorway. The scarf rings the bell's
  // rim, measured across the flared skirt — pulled in to the bell itself.
  bubblet: [
    { item: { nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true } } },
    { neck: { w: 14 }, item: { nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true } } },
    { neck: { w: 21 }, item: { nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true } } },
  ],
  // Hatchling is a round blob: measured neck was a 2px sliver at the feet.
  kappa: [
    { neck: { y: 27.5, w: 10 }, item: { bowtie: { s: 0.9 } } },
    {},
    { neck: { y: 18, w: 10 } },
  ],
  // Pup: scarf/bow drop off the whisker puffs. Adult: bow under the nose,
  // over the coral necklace.
  selkie: [
    { neck: { y: 27, w: 11 } },
    {},
    { neck: { y: 16.5 }, item: { bowtie: { dy: 1 } } },
  ],
  // ¾ whale, one blob: the "skull" is the front third (eyes + horn root),
  // not the whole back up to the tail. No neck — the wrap goes under the
  // mouth across the throat. Blue-on-blue items swap colorway; the young
  // stages' close-set eyes read as a dark mask in dark frames, so gold.
  narwhal: [
    {
      head: { x: 13.5, y: 18, w: 9 }, neck: { x: 13.5, y: 26, w: 9 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true }, glasses: { frame: "gold" } },
    },
    {
      head: { x: 13, y: 14, w: 11 }, neck: { x: 13, y: 24.5, w: 12 },
      item: { glasses: { frame: "gold" }, nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true } },
    },
    {
      head: { x: 12.5, y: 12, w: 13 }, neck: { x: 12.5, y: 23.5, w: 14 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, mortarboard: { alt: true } },
    },
  ],
  // Teal serpent: dark frames vanish into the eyes; blue bow into the scales;
  // a purple wizard brim into the purple crest fins.
  leviathan: [
    { item: { glasses: { frame: "gold" }, bowtie: { alt: true } } },
    { item: { glasses: { frame: "gold" }, bowtie: { alt: true }, wizardhat: { alt: true } } },
    { item: { glasses: { frame: "gold" }, bowtie: { alt: true }, wizardhat: { alt: true } } },
  ],
  // Blob hatchling: scarf below the smile. Juvenile: measured neck sat on
  // the belly; the head/body seam is higher.
  axolittle: [
    { neck: { y: 27, w: 11 } },
    { neck: { y: 22.5, w: 11 } },
    {},
  ],
  // Floating otter: the measured neck spanned the water ring (hatchling);
  // the wrap goes on the chin, above the book. Eyes sit high, so hats ride a
  // pixel up to clear the glasses; adult rims sit on the cream face (dark).
  otterpop: [
    { head: { y: 13.5 }, neck: { y: 22, w: 11 }, item: { bowtie: { s: 0.8 } } },
    { head: { y: 9 }, neck: { y: 18, w: 9 } },
    { head: { y: 5.5 }, neck: { y: 16.5, w: 10 }, item: { glasses: { frame: "dark" } } },
  ],
  // No neck: the wrap sits where the tentacle fringe meets the face.
  nautilus: [
    { neck: { x: 13.8, y: 26, w: 8 }, item: { glasses: { frame: "gold" } } },
    { neck: { x: 12.6, y: 25, w: 10 } },
    { neck: { x: 11.4, y: 24.8, w: 12 } },
  ],
  // ¾ sea-horse: measured neck landed on the muzzle; the real neck is the
  // column behind it. Dark frames merged with the eyes into a mask.
  hippocamp: [
    { neck: { x: 16, y: 20.5, w: 6 }, item: { glasses: { frame: "gold" }, bowtie: { alt: true } } },
    { neck: { x: 16, y: 15, w: 6 }, item: { glasses: { frame: "gold" }, bowtie: { alt: true } } },
    { neck: { x: 16, y: 12, w: 7 }, item: { glasses: { frame: "gold" }, bowtie: { alt: true } } },
  ],
  // Egg-shaped mantle: measured skull was its pointed crest tip — hats go
  // lower and wider on the dome. Wrap where the arms leave the mantle.
  kraken: [
    { head: { w: 11 }, neck: { y: 23, w: 8 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 8.5, w: 11 }, neck: { y: 20.5, w: 9 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 3.5, w: 11 }, neck: { y: 17, w: 10 }, item: { glasses: { frame: "gold" } } },
  ],
};
