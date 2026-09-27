/** Sprite → <img> plumbing: rasterized sprites become cached data URLs, drawn
 *  with nearest-neighbor scaling so pixels stay crisp at any size. */

import { useEffect, useState } from "react";
import type { Sprite } from "../../lib/hatchery/pixel";
import type { Pose, Stage } from "../../lib/hatchery/kit";
import type { Egg, Pet } from "../../lib/hatchery/game";
import { speciesById, stageOf } from "../../lib/hatchery/game";
import { renderSpecies } from "../../lib/hatchery/catalog";
import { drawEgg } from "../../lib/hatchery/eggs";

const urls = new Map<string, string>();

function toUrl(key: string, make: () => Sprite): string {
  let url = urls.get(key);
  if (!url) {
    const s = make();
    const canvas = document.createElement("canvas");
    canvas.width = s.w;
    canvas.height = s.h;
    canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(s.data), s.w, s.h), 0, 0);
    url = canvas.toDataURL("image/png");
    urls.set(key, url);
  }
  return url;
}

/** Flat silhouette of a sprite, for undiscovered creatures. */
function silhouette(s: Sprite): Sprite {
  const data = new Uint8ClampedArray(s.data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (!s.data[i + 3]) continue;
    data[i] = 0x33;
    data[i + 1] = 0x42;
    data[i + 2] = 0x3a;
    data[i + 3] = 255;
  }
  return { w: s.w, h: s.h, data };
}

const speciesKey = (id: string, stage: Stage, pose: Pose, shiny: boolean, hidden: boolean) =>
  `sp/${id}/${stage}/${pose}/${shiny ? 1 : 0}/${hidden ? 1 : 0}`;

export function speciesUrl(id: string, stage: Stage, pose: Pose = "idle", shiny = false, hidden = false) {
  const sp = speciesById(id);
  if (!sp) return "";
  return toUrl(speciesKey(id, stage, pose, shiny, hidden), () => {
    const s = renderSpecies(sp, stage, pose, shiny);
    return hidden ? silhouette(s) : s;
  });
}

export function eggUrl(egg: Pick<Egg, "element" | "tier">, crack = 0) {
  return toUrl(`egg/${egg.element}/${egg.tier}/${crack}`, () => drawEgg(egg.element, egg.tier, crack));
}

/** 0–3 cracks as the egg warms: none until halfway, all three when ready. */
export function crackOf(egg: Egg): number {
  const f = egg.warmth / egg.need;
  return f >= 1 ? 3 : f >= 0.85 ? 2 : f >= 0.5 ? 1 : 0;
}

export function PixelImg(props: {
  src: string;
  /** Rendered pixels per sprite pixel. */
  scale: number;
  className?: string;
  alt?: string;
}) {
  const size = 32 * props.scale;
  return (
    <img
      className={`pixel ${props.className ?? ""}`}
      src={props.src}
      width={size}
      height={size}
      alt={props.alt ?? ""}
      draggable={false}
    />
  );
}

// ── idle rendering for big grids ──
// A sprite rasterizes in about a millisecond; the collection shows eighty.
// Grids render them in idle slices instead, so opening the hatchery never
// stalls a frame.

const idleQueue: (() => void)[] = [];
let idleScheduled = false;

function runIdle(deadline: IdleDeadline) {
  while (idleQueue.length && deadline.timeRemaining() > 2) idleQueue.shift()!();
  if (idleQueue.length) requestIdleCallback(runIdle);
  else idleScheduled = false;
}

function whenIdle(task: () => void) {
  idleQueue.push(task);
  if (!idleScheduled) {
    idleScheduled = true;
    requestIdleCallback(runIdle);
  }
}

/** A species sprite for grids: drawn at once if already cached, otherwise
 *  an empty slot until an idle moment renders it. */
export function SpeciesImg(props: {
  id: string;
  stage: Stage;
  shiny?: boolean;
  hidden?: boolean;
  scale: number;
}) {
  const { id, stage, shiny = false, hidden = false, scale } = props;
  const key = speciesKey(id, stage, "idle", shiny, hidden);
  const [ready, setReady] = useState<{ key: string; url: string } | null>(null);
  const cached = urls.get(key);
  useEffect(() => {
    if (urls.has(key)) return;
    let live = true;
    whenIdle(() => {
      const url = speciesUrl(id, stage, "idle", shiny, hidden);
      if (live) setReady({ key, url });
    });
    return () => {
      live = false;
    };
  }, [key, id, stage, shiny, hidden]);
  const url = cached ?? (ready?.key === key ? ready.url : null);
  if (!url) return <span className="pixel-slot" style={{ width: 32 * scale, height: 32 * scale }} />;
  return <PixelImg src={url} scale={scale} />;
}

/** A pet, alive: idle with an occasional blink, or asleep. */
export function PetSprite(props: {
  pet: Pet;
  scale: number;
  asleep?: boolean;
  className?: string;
}) {
  const { pet, scale, asleep } = props;
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (asleep) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        t = window.setTimeout(() => {
          setBlink(false);
          loop();
        }, 140);
      }, 2600 + Math.random() * 3800);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [asleep]);
  const pose: Pose = asleep ? "sleep" : blink ? "blink" : "idle";
  const name = speciesById(pet.species)?.name ?? pet.species;
  return (
    <PixelImg
      src={speciesUrl(pet.species, stageOf(pet), pose, pet.shiny)}
      scale={scale}
      className={`${props.className ?? ""} ${asleep ? "asleep" : "awake"}`}
      alt={pet.name ?? name}
    />
  );
}
