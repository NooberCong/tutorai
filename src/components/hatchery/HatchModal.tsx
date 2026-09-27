/** The hatch ceremony: the egg rocks and cracks, bursts, and the hatchling
 *  pops out with its name card. The hatch itself is committed (and saved)
 *  the moment the ceremony starts, so closing early never loses a pet; a
 *  click skips straight to the reveal. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Egg, Pet, Where } from "../../lib/hatchery/game";
import { hatch, renamePet, setCompanion, speciesById } from "../../lib/hatchery/game";
import { getHatchery, mutate } from "../../lib/hatchery/store";
import { PixelImg, PetSprite, eggUrl } from "./sprites";
import { TIER_LABEL } from "./labels";
import "./hatchery.css";

type Phase = "rock" | "burst" | "reveal";

export function HatchModal(props: { where?: Where; onClose: () => void }) {
  const [egg] = useState<Egg | null>(() => getHatchery().incubator);
  const [result, setResult] = useState<{ pet: Pet; isNew: boolean; count: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("rock");
  const [crack, setCrack] = useState(1);
  const [name, setName] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let out: { pet: Pet; isNew: boolean } | null = null;
    mutate((s) => {
      out = hatch(s, new Date(), props.where);
    }, true);
    if (!out) {
      props.onClose();
      return;
    }
    const r = out as { pet: Pet; isNew: boolean };
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

  const finish = () => {
    if (result && name.trim()) mutate((s) => renamePet(s, result.pet.id, name), true);
    props.onClose();
  };

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
              <PetSprite pet={result.pet} scale={6} className="bob" />
            </div>
            {result.pet.shiny && <div className="shiny-tag">✦ Shiny</div>}
            <div className="hatch-card">
              <span className={`tier-badge tier-${sp?.tier}`}>{TIER_LABEL[sp?.tier ?? "common"]}</span>
              <h2>{sp?.stages[0]}</h2>
              <p className="hatch-sub">
                {result.isNew ? "New to your collection" : `Another ${sp?.name} · you have ${result.count}`}
                {isCompanion && " · reading with you"}
              </p>
              {sp && <p className="hatch-lore">{sp.lore}</p>}
              <input
                className="hatch-name"
                placeholder="Give it a name (optional)"
                value={name}
                maxLength={24}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && finish()}
              />
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
                <button className="btn primary" onClick={finish}>
                  Welcome!
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
