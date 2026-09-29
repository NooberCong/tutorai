/** Hand fits for sky species — see fit.ts. Stages: [hatchling, juvenile, adult].
 *
 *  Sky creatures are mostly chibi birds with their eyes two or three rows
 *  under the skull top, so the nightcap's deep cuff would sit on the
 *  glasses' top rim: most stages lift just the nightcap (`dy`). Blue
 *  creatures get the crimson nightcap / bow tie. */

import type { FitTable } from "../fit.ts";

export const SKY_FIT: FitTable = {
  // Round blob, then a sheep with a wool tuft (hats sit on the tuft, between
  // the adult's curled horns). The hatchling's mouth is low on the blob, so
  // the scarf and a small bow go at its very bottom.
  cloudlamb: [
    { head: { y: 15 }, neck: { y: 26.5, w: 14 }, item: { bowtie: { s: 0.6 } } },
    { head: { y: 11, w: 9 }, neck: { y: 21.5, w: 8 }, item: { bowtie: { dy: 1 }, nightcap: { dy: -0.5 } } },
    { head: { y: 11, w: 9 }, neck: { y: 23.5, w: 9 }, item: { bowtie: { dy: 1 } } },
  ],
  // Blue bird with a feather curl on top (hats cover it). Head and body are
  // one blob, so the measured neck lands at the feet on the older stages.
  zephyrin: [
    { head: { y: 16.5 }, neck: { y: 27.5, w: 10 }, item: { nightcap: { alt: true }, bowtie: { alt: true, dy: 1 } } },
    { head: { y: 11.5 }, neck: { y: 22, w: 10 }, item: { nightcap: { alt: true }, bowtie: { alt: true } } },
    { head: { y: 7.5 }, neck: { y: 18, w: 9 }, item: { nightcap: { alt: true }, bowtie: { alt: true } } },
  ],
  // The hatchling/juvenile heads were measured on the beak. Bows drop clear
  // of the beak tip.
  griffin: [
    { head: { x: 16, y: 16, w: 10 }, neck: { y: 25, w: 10 }, item: { nightcap: { dy: -1 }, bowtie: { s: 0.8, dy: 1 } } },
    { head: { x: 16, y: 10, w: 9 }, neck: { y: 20, w: 10 }, item: { nightcap: { dy: -1.5 }, bowtie: { dy: 1 } } },
    { neck: { y: 17, w: 10 }, item: { nightcap: { dy: -0.5 }, bowtie: { dy: 1 } } },
  ],
  // Grey-blue bird with a lightning crest: hats sit on the skull and the
  // bolt pokes up behind them. Measured head/neck landed on the beak.
  // Crimson cap/bow and brown mortarboard against the blue-grey plumage.
  thunderbird: [
    { head: { x: 16, y: 18, w: 11 }, neck: { y: 26.5, w: 12 }, item: { nightcap: { alt: true, dy: -1.5 }, bowtie: { alt: true, dy: 1 }, mortarboard: { alt: true } } },
    { head: { x: 16, y: 12, w: 11 }, neck: { y: 21.5, w: 11 }, item: { nightcap: { alt: true, dy: -1.5 }, bowtie: { alt: true, dy: 1 }, mortarboard: { alt: true } } },
    { neck: { y: 16.5, w: 9 }, item: { nightcap: { alt: true, dy: -1.5 }, bowtie: { alt: true }, mortarboard: { alt: true } } },
  ],
  // Dark green serpent head under a plume crest: gold frames; the scarf
  // wraps the jaw's underside, clear of the rainbow wing band behind it.
  quetzal: [
    { head: { w: 10 }, neck: { w: 7 }, item: { glasses: { frame: "gold" }, scarf: { alt: "gold" }, bowtie: { alt: "gold" }, nightcap: { dy: -1.5 } } },
    { head: { y: 8.5, w: 10 }, neck: { y: 17.5, w: 7 }, item: { glasses: { frame: "gold" }, scarf: { alt: "gold" }, bowtie: { alt: "gold" }, nightcap: { dy: -1 } } },
    { head: { y: 3.5 }, neck: { y: 12.5, w: 7 }, item: { glasses: { frame: "gold" }, scarf: { alt: "gold" }, bowtie: { alt: "gold" }, nightcap: { dy: -1 } } },
  ],
  // Pink pig: the crown's pink flowers swap to lilac. Scarves go under the
  // snout (the measured neck wrapped the snout itself).
  flutterpig: [
    { neck: { y: 27.5, w: 10 }, item: { flowercrown: { alt: true }, nightcap: { dy: -2 } } },
    { neck: { y: 23, w: 11 }, item: { flowercrown: { alt: true }, nightcap: { dy: -2 } } },
    { head: { w: 14 }, neck: { y: 23.5, w: 13 }, item: { flowercrown: { alt: true }, nightcap: { dy: -0.5 } } },
  ],
  // Hummingbird with eyes at the very top of the head.
  zipwing: [
    { head: { w: 10 }, neck: { y: 25.5, w: 9 }, item: { nightcap: { dy: -0.5 } } },
    { head: { x: 16.4, y: 11 }, item: { nightcap: { dy: -1.5 } } },
    { head: { x: 16.6, y: 7 }, neck: { y: 16 }, item: { nightcap: { dy: -1.5 } } },
  ],
  // Blue wings and mane: crimson bow tie.
  pegasus: [
    { neck: { y: 24, w: 8 }, item: { nightcap: { dy: -1 }, bowtie: { alt: true } } },
    { neck: { y: 17, w: 6 }, item: { nightcap: { dy: -1 }, bowtie: { alt: true } } },
    { neck: { y: 15, w: 6 }, item: { nightcap: { dy: -1 }, bowtie: { alt: true } } },
  ],
  // Manta: eyes sit on top of the disc, so hats rest between the cephalic
  // fins just above it; the measured skull spanned the whole wing disc.
  // Blue body: crimson cap/bow, brown mortarboard.
  skyray: [
    { head: { y: 18, w: 9 }, neck: { y: 25.5, w: 10 }, item: { nightcap: { alt: true, dy: -1 }, bowtie: { alt: true, s: 0.8 }, mortarboard: { alt: true } } },
    { head: { y: 13, w: 10 }, neck: { w: 10 }, item: { nightcap: { alt: true, dy: -1 }, bowtie: { alt: true, s: 0.8 }, mortarboard: { alt: true } } },
    { head: { y: 7, w: 12 }, neck: { y: 17.5, w: 11 }, item: { nightcap: { alt: true, dy: -1 }, bowtie: { alt: true }, mortarboard: { alt: true } } },
  ],
  // Cyan dragon: crimson bow tie; the scarf sits below the jaw.
  galewyrm: [
    { neck: { y: 24.5, w: 7 }, item: { nightcap: { dy: -1.5 }, bowtie: { alt: true } } },
    { neck: { y: 17, w: 6 }, item: { nightcap: { dy: -1.5 }, bowtie: { alt: true } } },
    { neck: { y: 13.5, w: 5 }, item: { nightcap: { dy: -1.5 }, bowtie: { alt: true } } },
  ],
};
