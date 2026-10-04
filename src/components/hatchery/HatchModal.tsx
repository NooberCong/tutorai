/** The hatch ceremony: the egg rocks and cracks, bursts, and the hatchling
 *  pops out with its card — or, for a species you already have, your pet
 *  appears with the growth the egg gave it. The hatch itself is committed (and saved)
 *  the moment the ceremony starts, so closing early never loses a pet; a
 *  click skips straight to the reveal. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Egg, Hatched, Where } from "../../lib/hatchery/game";
import { hatch, setCompanion, speciesById, stageOf } from "../../lib/hatchery/game";
import { getHatchery, mutate } from "../../lib/hatchery/store";
import { PixelImg, PetSprite, eggUrl } from "./sprites";
import { TIER_LABEL, minutes } from "./labels";
import "./hatchery.css";

type Phase = "rock" | "burst" | "reveal";

export function HatchModal(props: { where?: Where; onClose: () => void }) {
  const [egg] = useState<Egg | null>(() => getHatchery().incubator);
  const [result, setResult] = useState<(Hatched & { count: number }) | null>(null);
  const [phase, setPhase] = useState<Phase>("rock");
  const [crack, setCrack] = useState(1);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let out: Hatched | null = null;
    mutate((s) => {
      out = hatch(s, new Date(), props.where);
    }, true);
    if (!out) {
      props.onClose();
      return;
    }
    const r = out as Hatched;
    setResult({ ...r, count: getHatchery().dex[r.pet.species]?.count ?? 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate from the commit above so StrictMode's effect replay restarts
  // the animation without hatching twice.
  useEffect(() => {
    if (!result) return;
    const timers = [
      window.setTimeout(() => setCrack(2), 750),
      window.setTimeout(() => setCrack(3), 1500),
      window.setTimeout(() => setPhase((p) => (p === "reveal" ? p : "burst")), 2300),
      window.setTimeout(() => setPhase("reveal"), 2650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [!!result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = () => props.onClose();

  if (!egg || !result) return null;
  const sp = speciesById(result.pet.species);
  const isCompanion = getHatchery().companionId === result.pet.id;

  return createPortal(
    <div className="hatch-veil" onClick={phase === "reveal" ? finish : () => setPhase("reveal")}>
      <div
        className={`hatch-stage tier-${egg.tier}`}
        onClick={(e) => {
          e.stopPropagation();
          if (phase !== "reveal") setPhase("reveal");
        }}
      >
        <div className="hatch-light" />
        {phase !== "reveal" ? (
          <div className={`hatch-egg ${phase === "rock" ? `rock-${crack}` : "pop"}`}>
            <PixelImg src={eggUrl(egg, crack)} scale={6} />
          </div>
        ) : (
          <div className="hatch-born">
            <div className="hatch-creature">
              <PetSprite pet={result.pet} scale={6} />
            </div>
            {(result.isNew ? result.pet.shiny : result.shinyNow) && (
              <div className="shiny-tag">{result.isNew ? "✦ Shiny" : "✦ Now shiny"}</div>
            )}
            <div className="hatch-card">
              <span className={`tier-badge tier-${sp?.tier}`}>{TIER_LABEL[sp?.tier ?? "common"]}</span>
              <h2>{sp?.stages[stageOf(result.pet)]}</h2>
              <p className="hatch-sub">
                {result.isNew
                  ? "New to your collection"
                  : result.boost > 0
                    ? `Another ${sp?.name} egg — yours grew by ${minutes(result.boost)} of reading`
                    : `Another ${sp?.name} egg — yours is already fully grown`}
                {!result.isNew && ` · ${result.count} hatched`}
                {isCompanion && " · reading with you"}
              </p>
              {sp && result.isNew && <p className="hatch-lore">{sp.lore}</p>}
              <div className="hatch-actions">
                {!isCompanion && (
                  <button
                    className="btn"
                    onClick={() => {
                      mutate((s) => setCompanion(s, result.pet.id), true);
                      finish();
                    }}
                  >
                    Read with this one
                  </button>
                )}
                <button className="btn primary" autoFocus onClick={finish}>
                  {result.isNew ? "Welcome!" : "Nice!"}
                </button>
              </div>
            </div>
          </div>
        )}
        {phase === "burst" && <div className="hatch-flash" />}
      </div>
    </div>,
    document.body,
  );
}
