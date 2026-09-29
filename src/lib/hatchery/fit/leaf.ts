/** Hand fits for leaf species â€” see fit.ts. Stages: [hatchling, juvenile, adult]. */

import type { FitTable } from "../fit.ts";

export const LEAF_FIT: FitTable = {
  // Hats a row higher so the nightcap cuff clears the glasses; the
  // hatchling's scarf drops below its mouth.
  sproutling: [
    { head: { y: 17 }, neck: { y: 28.5 } },
    { head: { y: 11 } },
    { head: { y: 8 } },
  ],
  // The head peeks from under the shell with its eyes near the top: hats
  // rest on the shell rim above the head, the crown back down on the brow,
  // and the wrap goes under the mouth (below the chin, between the feet).
  mossback: [
    { head: { y: 19 }, neck: { y: 29.3, w: 8 }, item: { flowercrown: { dy: 1 } } },
    { head: { y: 18 }, neck: { y: 28.5, w: 8 }, item: { flowercrown: { dy: 1 } } },
    { head: { y: 17 }, neck: { y: 27.5 }, item: { flowercrown: { dy: 1 } } },
  ],
  // Hats sit above the grumpy brows; the wrap goes under the mouth, not on it.
  mandrake: [
    { head: { y: 17 }, neck: { y: 27.5 } },
    { head: { y: 10.5 }, neck: { y: 23.5, w: 10 } },
    { head: { y: 8 }, neck: { y: 22.5, w: 11 } },
  ],
  // ¾ head: hats lean with it, the scarf wraps the real neck (measured 3px),
  // and gold frames read on brown fur where dark ones muddied the eyes.
  bloomstag: [
    { head: { y: 13.5, tilt: -6 }, neck: { x: 13.5, y: 23.8, w: 8 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 8.5, tilt: -6 }, neck: { x: 13.2, y: 19.5, w: 6 }, item: { glasses: { frame: "gold" } } },
    { head: { y: 6.5, tilt: -6 }, neck: { x: 13.5, y: 17.5, w: 7 }, item: { glasses: { frame: "gold" } } },
  ],
  // Hats above the eyes with the horns poking out beside; the crown settles
  // onto the skull instead of floating between the horns.
  yggdrake: [
    { head: { w: 11 }, neck: { y: 28 } },
    { head: { y: 9.5, w: 10 }, neck: { y: 20.5, w: 9 }, item: { flowercrown: { dy: 1.5 } } },
    { head: { y: 10.5, w: 12 }, neck: { y: 20.5, w: 10 }, item: { flowercrown: { dy: 1 } } },
  ],
  // Red squirrel: teal scarf, dark frames. The adult's neck measured 1px wide.
  nutkin: [
    { head: { y: 17 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
    { head: { y: 11 }, neck: { y: 22.5 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
    { neck: { x: 13, y: 19.8, w: 10 }, item: { scarf: { alt: true }, glasses: { frame: "dark" } } },
  ],
  // Eyes are the bumps on top, so hats rest on them; the wrap and the bow
  // go below the wide mouth.
  dewfrog: [
    { head: { y: 16 }, neck: { y: 28.5, w: 12 }, item: { bowtie: { dy: 1 } } },
    { head: { y: 13 }, neck: { y: 25.5, w: 13 }, item: { bowtie: { dy: 1 } } },
    { head: { y: 11, w: 14 }, neck: { y: 22.5, w: 16 }, item: { bowtie: { dy: 1 } } },
  ],
  // Measured head is the face mask; hats go on the bush above it instead.
  thornhog: [
    { head: { y: 19, w: 12 }, neck: { y: 29, w: 8 } },
    { head: { y: 17, w: 14 }, neck: { y: 27.8, w: 8 } },
    { head: { y: 15.5, w: 16 }, neck: { y: 27.3, w: 8 } },
  ],
  // Hollow eyes aren't standard decals, so they're set by hand; the adult's
  // head is cocked, and its hats lean with it.
  kodama: [
    { head: { w: 13 }, eyes: { l: [12, 21], r: [18, 21], w: 2, h: 2 }, neck: { y: 26, w: 9 } },
    { head: { y: 7.5, w: 13 }, eyes: { l: [12, 12], r: [18, 12], w: 2, h: 3 }, neck: { y: 19.8, w: 6 } },
    { head: { x: 15.6, y: 2, w: 13, tilt: -12 }, eyes: { l: [11, 7], r: [17, 6], w: 2, h: 3 }, neck: { x: 16, y: 14.5, w: 5 } },
  ],
  // Hats clear the glasses; the wrap goes under the muzzle.
  bramblebear: [
    { head: { y: 16.5, w: 12 }, neck: { y: 27.5 } },
    { head: { y: 9.5 }, neck: { y: 21.5 } },
    { neck: { y: 19, w: 12 } },
  ],
};
