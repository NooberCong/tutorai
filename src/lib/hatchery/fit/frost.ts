/** Hand fits for frost species — see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

export const FROST_FIT: FitTable = {
  // Moth: small heads with the eyes high — hats ride a pixel up so the cuff
  // and brim clear them. The adult's neck measured 2 px (a gap between fluff
  // lobes); the scarf and bow sit on the fluffy ruff under the head. The
  // pupa's scarf drops below its mouth.
  frostmoth: [
    { head: { y: 19 } },
    { neck: { y: 22.5 } },
    { head: { y: 7, w: 10 }, neck: { y: 15.5, w: 10 } },
  ],
  // Penguin: juvenile and adult already wear a knitted scarf — ours goes
  // exactly over it (teal, so it reads as a new one), the bow sits on it.
  // The chick's eyes sit on white patches under a navy cap: gold frames.
  pengwin: [
    { item: { glasses: { frame: "gold" } } },
    { head: { y: 11, w: 10 }, neck: { y: 19.6, w: 11 }, item: { scarf: { alt: true } } },
    { head: { w: 12 }, neck: { y: 15.2, w: 13 }, item: { scarf: { alt: true } } },
  ],
  // Stoat: a flat head with the eyes near its top — hats ride a pixel high
  // so the band clears the eyes; the neck is the body, not the chin tuft.
  ermine: [
    { head: { y: 16.5, w: 10 }, neck: { w: 9 } },
    { head: { y: 10 }, neck: { w: 8 } },
    { head: { y: 4 }, neck: { w: 8 } },
  ],
  // Wolf: ¾ head looking left; the juvenile/adult neck measured on the
  // muzzle — it's under the skull, on the chest ruff. Gold frames read
  // better than dark ones against the dark eyes and grey-blue fur.
  fenrir: [
    {},
    { head: { y: 9, w: 9 }, neck: { x: 13.5, y: 17, w: 7 }, item: { bowtie: { dx: -0.5 }, glasses: { frame: "gold" } } },
    { head: { y: 4.5, w: 10.5 }, neck: { x: 13.5, y: 14.5, w: 9 }, item: { glasses: { frame: "gold" } } },
  ],
  // Yeti: hats sized to the whole shaggy head; the neck measured on the
  // mouth/between the arms — it's where the head meets the body.
  yeti: [
    { head: { w: 12 }, item: { bowtie: { dy: 1 } } },
    { neck: { y: 21.5, w: 12 } },
    { head: { w: 12 }, neck: { y: 17, w: 13 } },
  ],
  // Mammoth: the measured head was the trunk (4 px wide); the real skull is
  // the woolly dome under the tuft.
  mammoth: [
    { head: { x: 16, y: 16, w: 12 }, neck: { x: 16, y: 25, w: 11 } },
    { head: { x: 16, y: 10.5, w: 11 }, neck: { x: 16, y: 20.5, w: 12 } },
    { head: { x: 16, y: 4, w: 11 }, neck: { x: 16, y: 16, w: 14 } },
  ],
  // Owl: the neck spanned the wings; the wrap goes under the beak across
  // the breast only.
  aurorowl: [
    { neck: { w: 11 } },
    { head: { w: 11 }, neck: { y: 23, w: 13 } },
    { head: { w: 12 }, neck: { y: 21.5, w: 14 } },
  ],
  // Wyrm: blue, so blue items take their second colorway. ¾ head looking
  // down-left on a neck rising from the coil; the wrap goes on that neck.
  icewyrm: [
    {
      neck: { x: 17, y: 24.5, w: 8 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "gold" } },
    },
    {
      head: { y: 9.5 }, neck: { x: 18.6, y: 17.5, w: 7, tilt: 10 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "gold" } },
    },
    {
      head: { y: 2.5 }, neck: { x: 19.3, y: 12.5, w: 8 },
      item: { nightcap: { alt: true }, bowtie: { alt: true }, glasses: { frame: "gold" } },
    },
  ],
  // Tiger: the cub's wrap drops a pixel off its mouth; juvenile neck
  // measured 2 px, adult spanned the cheek ruff.
  byakko: [
    { neck: { y: 26 } },
    { neck: { y: 20.5, w: 10 } },
    { head: { w: 13 }, neck: { y: 17, w: 12 } },
  ],
};
