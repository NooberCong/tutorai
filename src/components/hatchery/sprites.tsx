/** Sprite → <img> plumbing: rasterized sprites become cached data URLs, drawn
 *  with nearest-neighbor scaling so pixels stay crisp at any size. */

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Sprite } from "../../lib/hatchery/pixel";
import type { Element, Pose, Stage } from "../../lib/hatchery/kit";
import type { Egg, Pet } from "../../lib/hatchery/game";
import { speciesById, stageOf } from "../../lib/hatchery/game";
import {
  DRESSED_H,
  DRESSED_PAD,
  DRESSED_W,
  renderDressed,
  renderItem,
  renderSpecies,
  wearKey,
} from "../../lib/hatchery/catalog";
import type { AccessoryId, Wear } from "../../lib/hatchery/accessories";
import { drawEgg } from "../../lib/hatchery/eggs";
import { MOTES, SCENE_H, SCENE_W, STAGE, motes, renderScene } from "../../lib/hatchery/scenes";

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

const dressedKey = (id: string, stage: Stage, pose: Pose, shiny: boolean, wear: Wear) =>
  `pet/${id}/${stage}/${pose}/${shiny ? 1 : 0}/${wearKey(wear)}`;

const isDressed = (wear?: Wear): wear is Wear => !!wear && Object.values(wear).some(Boolean);

/** A creature as a given pet wears it: the plain sprite, or the dressed
 *  one on its padded canvas (then `dressed` tells PixelImg to overflow). */
export function petUrl(
  id: string,
  stage: Stage,
  pose: Pose,
  shiny: boolean,
  wear?: Wear,
): { src: string; dressed: boolean } {
  if (!isDressed(wear)) return { src: speciesUrl(id, stage, pose, shiny), dressed: false };
  const sp = speciesById(id);
  if (!sp) return { src: "", dressed: false };
  const src = toUrl(dressedKey(id, stage, pose, shiny, wear), () => renderDressed(sp, stage, pose, shiny, wear));
  return { src, dressed: true };
}

/** An accessory on its own, for the wardrobe. */
export function itemUrl(id: AccessoryId): string {
  return toUrl(`item/${id}`, () => renderItem(id));
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
  /** A dressed sprite: drawn on the padded canvas, but laid out as the
   *  creature's own 32×32 box — hats and tails overflow it. */
  dressed?: boolean;
}) {
  const k = props.scale;
  if (props.dressed) {
    return (
      <img
        className={`pixel ${props.className ?? ""}`}
        src={props.src}
        width={DRESSED_W * k}
        height={DRESSED_H * k}
        style={{ margin: `${-DRESSED_PAD.top * k}px ${-DRESSED_PAD.x * k}px 0` }}
        alt={props.alt ?? ""}
        draggable={false}
      />
    );
  }
  return (
    <img
      className={`pixel ${props.className ?? ""}`}
      src={props.src}
      width={32 * k}
      height={32 * k}
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
  /** A pet's accessories (grids of your own pets). */
  wear?: Wear;
  scale: number;
}) {
  const { id, stage, shiny = false, hidden = false, scale, wear } = props;
  const dressed = !hidden && isDressed(wear);
  const key = dressed ? dressedKey(id, stage, "idle", shiny, wear) : speciesKey(id, stage, "idle", shiny, hidden);
  const [ready, setReady] = useState<{ key: string; url: string } | null>(null);
  const cached = urls.get(key);
  useEffect(() => {
    if (urls.has(key)) return;
    let live = true;
    whenIdle(() => {
      const url = dressed ? petUrl(id, stage, "idle", shiny, wear).src : speciesUrl(id, stage, "idle", shiny, hidden);
      if (live) setReady({ key, url });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const url = cached ?? (ready?.key === key ? ready.url : null);
  if (!url) return <span className="pixel-slot" style={{ width: 32 * scale, height: 32 * scale }} />;
  return <PixelImg src={url} scale={scale} dressed={dressed} />;
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
  const { src, dressed } = petUrl(pet.species, stageOf(pet), pose, pet.shiny, pet.wear);
  return (
    <PixelImg
      src={src}
      dressed={dressed}
      scale={scale}
      className={`${props.className ?? ""} ${asleep ? "asleep" : "awake"}`}
      alt={pet.name ?? name}
    />
  );
}

export function sceneUrl(el: Element): string {
  return toUrl(`scene/${el}`, () => renderScene(el));
}

/** A creature (or egg) standing in its habitat. `children` is its 32×32
 *  sprite at the same `scale`; it's placed on the scene's floor. Motes —
 *  embers, snow, bubbles — drift over the scene when `live`. */
export function Habitat(props: {
  element: Element;
  scale: number;
  live?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { element, scale: k } = props;
  return (
    <span
      className={`habitat ${props.className ?? ""}`}
      style={{ width: SCENE_W * k, height: SCENE_H * k, backgroundImage: `url(${sceneUrl(element)})`, "--k": `${k}px` } as CSSProperties}
    >
      <span className="habitat-stage" style={{ left: STAGE.x * k, top: STAGE.y * k, width: 32 * k, height: 32 * k }}>
        {props.children}
      </span>
      {props.live && (
        <span className={`motes motes-${MOTES[element].kind}`} aria-hidden>
          {motes(element).map((m, i) => (
            <i
              key={i}
              style={{
                left: m.x * k,
                top: m.y * k,
                background: m.color,
                color: m.color,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.dur}s`,
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
