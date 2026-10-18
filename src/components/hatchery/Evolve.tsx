/** Growing up, shown: a pet brightens into a glowing outline, its old and
 *  new shapes trade places in slow pulses that quicken, and the new one
 *  settles back into colour. Every growth source (reading, trivia, repeat
 *  hatches) leaves the evolution due on the pet (see dueEvolution) until
 *  it's played: in place by the reader's corner pet, inside the hatch
 *  ceremony, or else by EvolutionHost on the library screens. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Pet } from "../../lib/hatchery/game";
import type { Stage } from "../../lib/hatchery/kit";
import { dueEvolution, sawEvolution, speciesById } from "../../lib/hatchery/game";
import { mutate, useHatchery } from "../../lib/hatchery/store";
import { useSetting } from "../../lib/settings";
import { PetSprite, PixelImg, centerOf, petUrl } from "./sprites";
import "./hatchery.css";

/** The morph itself, on still sprites so both shapes are ready at once.
 *  `onDone` fires as the new shape has settled. */
export function Evolve(props: { pet: Pet; from: Stage; to: Stage; scale: number; delay?: number; onDone: () => void }) {
  const { pet, scale } = props;
  const layer = (stage: Stage) => petUrl(pet.species, stage, "idle", pet.shiny, pet.wear);
  const from = layer(props.from);
  const to = layer(props.to);
  const style = { animationDelay: `${props.delay ?? 0}ms` };
  return (
    <span className="evolve" style={{ ...centerOf(pet.species, props.to), width: 32 * scale, height: 32 * scale }}>
      <i className="evo-glow" style={style} />
      <span className="evo-from" style={style}>
        <PixelImg src={from.src} dressed={from.dressed} scale={scale} />
      </span>
      <span className="evo-to" style={style} onAnimationEnd={props.onDone}>
        <PixelImg src={to.src} dressed={to.dressed} scale={scale} />
      </span>
    </span>
  );
}

/** Lets the result sink in before the ceremony starts — trivia's results
 *  screen shows the reward first. */
const START_MS = 1200;

/** Plays any evolution still due while the reader isn't open (the reader's
 *  pet plays its own in place). */
export function EvolutionHost(props: { paused: boolean }) {
  const s = useHatchery();
  const on = useSetting("hatchery");
  const pet = s.pets.find((p) => dueEvolution(p));
  const [playing, setPlaying] = useState<{ pet: Pet; from: Stage; to: Stage } | null>(null);
  const [settled, setSettled] = useState(false);
  const nice = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (playing) mutate((st) => sawEvolution(st, playing.pet.id), true);
    setPlaying(null);
    setSettled(false);
  };

  useEffect(() => {
    if (!on || props.paused || playing || !pet) return;
    const t = window.setTimeout(() => {
      const due = dueEvolution(pet);
      if (due) setPlaying({ pet, ...due });
    }, START_MS);
    return () => window.clearTimeout(t);
  }, [on, props.paused, playing, pet]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (settled) nice.current?.focus();
  }, [settled]);

  if (!playing) return null;
  const sp = speciesById(playing.pet.species);

  return createPortal(
    <div className="hatch-veil" onClick={close}>
      <div className={`hatch-stage tier-${sp?.tier ?? "common"}`} onClick={(e) => e.stopPropagation()}>
        <div className="hatch-born">
          <div className="evo-creature">
            <div className="hatch-light on-pet" style={centerOf(playing.pet.species, playing.to)} />
            {settled ? (
              <PetSprite pet={playing.pet} scale={6} />
            ) : (
              <Evolve {...playing} scale={6} delay={400} onDone={() => setSettled(true)} />
            )}
          </div>
          <div className={settled ? "hatch-card" : "hatch-card waiting"}>
            <h2>{sp?.stages[playing.to]}</h2>
            <p className="hatch-sub">Your {sp?.stages[playing.from]} grew up</p>
            <div className="hatch-actions">
              <button className="btn primary" ref={nice} onClick={close}>
                Nice!
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
