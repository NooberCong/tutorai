/** The hatchery: the incubator, your companion, the nest of found eggs, the
 *  week at a glance, field notes on what attracts which eggs, and the
 *  collection — every species, discovered or still a silhouette. */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Element, Species, Stage } from "../../lib/hatchery/kit";
import { ELEMENTS, TIERS } from "../../lib/hatchery/kit";
import { SPECIES } from "../../lib/hatchery/species";
import type { HatcheryState, Pet } from "../../lib/hatchery/game";
import { ACCESSORIES } from "../../lib/hatchery/accessories";
import {
  DAY_MIN,
  FIND_EVERY_MIN,
  NEST_MAX,
  accessoryProgress,
  attractions,
  companion,
  dress,
  dayKey,
  eggReady,
  growth,
  incubate,
  renamePet,
  setCompanion,
  speciesById,
  stageOf,
} from "../../lib/hatchery/game";
import { flushHatchery, mutate, useHatchery } from "../../lib/hatchery/store";
import { saveSetting, useSetting } from "../../lib/settings";
import { EggHelp } from "./EggHelp";
import { HatchModal } from "./HatchModal";
import { Meter } from "./Meter";
import { ELEMENT_LABEL, STAGE_LABEL, TIER_LABEL, minutes } from "./labels";
import { PetSprite, PixelImg, SpeciesImg, crackOf, eggUrl, itemUrl, petUrl, speciesUrl } from "./sprites";
import "./hatchery.css";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HatcheryScreen(props: { onTurnOff: () => void }) {
  const s = useHatchery();
  const [hatching, setHatching] = useState(false);
  const [detail, setDetail] = useState<Species | null>(null);
  const inReader = useSetting("hatcheryInReader");
  const now = new Date();
  const pet = companion(s);
  const egg = s.incubator;
  const ready = eggReady(s);

  const discovered = Object.keys(s.dex).length;
  const shinies = s.pets.filter((p) => p.shiny).length;

  const week: { label: string; ms: number; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    week.push({ label: WEEKDAY[d.getDay()], ms: s.days[dayKey(d)] ?? 0, today: i === 0 });
  }
  const weekMax = Math.max(DAY_MIN * 60_000 * 3, ...week.map((d) => d.ms));

  return (
    <div className="hatchery">
      <div className="hatchery-hero">
        <section className={`incubator tier-${egg?.tier ?? "common"}`}>
          <div className="card-label">Incubator</div>
          {egg ? (
            <>
              <button
                className={`incubator-egg ${ready ? "ready" : ""}`}
                disabled={!ready}
                onClick={() => setHatching(true)}
                title={ready ? "Hatch!" : "Warms while you read"}
              >
                <span className="pedestal" />
                <PixelImg src={eggUrl(egg, crackOf(egg))} scale={5} />
              </button>
              <div className="incubator-meta">
                <h3>
                  {ELEMENT_LABEL[egg.element]} egg{" "}
                  <span className={`tier-badge tier-${egg.tier}`}>{TIER_LABEL[egg.tier]}</span>
                </h3>
                {ready ? (
                  <button className="btn primary hatch-btn" onClick={() => setHatching(true)}>
                    Hatch it
                  </button>
                ) : (
                  <Meter
                    value={egg.warmth}
                    max={egg.need}
                    label={`${minutes(egg.warmth)} of ${minutes(egg.need)} reading`}
                  />
                )}
                {egg.foundIn && (
                  <p className="fine">
                    Found on p.{egg.foundIn.page} of <i>{egg.foundIn.title}</i>
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="empty-note">
              No egg warming. Keep reading — you find one every {FIND_EVERY_MIN} minutes, and
              for finishing chapters.
            </p>
          )}
        </section>

        <section className="companion-card">
          <div className="card-label">Reading companion</div>
          {pet ? (
            <CompanionDetail pet={pet} />
          ) : (
            <p className="empty-note">
              Your first hatchling will keep you company while you read, and grow as you do.
            </p>
          )}
        </section>
      </div>

      <Wardrobe s={s} pet={pet} />

      <section className="nest">
        <div className="section-head">
          <h2>Nest</h2>
          <span className="count">
            {s.nest.length > NEST_MAX ? `${s.nest.length} eggs` : `${s.nest.length}/${NEST_MAX}`} ·{" "}
            {s.nest.length >= NEST_MAX
              ? "full — reading finds wait until you hatch one"
              : `next find in ${minutes(FIND_EVERY_MIN * 60_000 - s.findMs)} of reading`}
          </span>
        </div>
        {s.nest.length ? (
          <div className="nest-row">
            {s.nest.map((e) => (
              <button
                key={e.id}
                className={`nest-egg tier-${e.tier}`}
                onClick={() => mutate((st) => incubate(st, e.id), true)}
                title={`${TIER_LABEL[e.tier]} ${ELEMENT_LABEL[e.element]} egg · ${minutes(e.need)} to hatch — click to warm this one instead`}
              >
                <PixelImg src={eggUrl(e, crackOf(e))} scale={2} />
                <span>{ELEMENT_LABEL[e.element]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-note">Eggs you find wait here. Click one to move it into the incubator.</p>
        )}
      </section>

      <div className="hatchery-split">
        <section className="week">
          <div className="section-head">
            <h2>This week</h2>
            <span className="count">{minutes(week.reduce((a, d) => a + d.ms, 0))}</span>
          </div>
          <div className="week-bars">
            {week.map((d) => (
              <div key={d.label} className={`week-day ${d.today ? "today" : ""}`}>
                <i
                  className={d.ms >= DAY_MIN * 60_000 ? "met" : ""}
                  style={{ height: `${Math.max(3, (d.ms / weekMax) * 100)}%` }}
                  title={minutes(d.ms)}
                />
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          <div className="stats">
            <Stat value={minutes(s.activeMs)} label="read" />
            <Stat value={String(s.pagesRead)} label="pages" />
            <Stat value={String(s.hatchedTotal)} label="hatched" />
            <Stat value={String(shinies)} label="shiny" />
          </div>
        </section>

        <section className="field-notes">
          <div className="section-head">
            <h2>Field notes</h2>
            <span className="count">what the next egg is drawn to</span>
          </div>
          <ul>
            {attractions(s, now).map((a) => (
              <li key={a.element} className={a.active ? "on" : ""}>
                <span className="egg-crop">
                  <PixelImg src={eggUrl({ element: a.element, tier: "common" })} scale={1} />
                </span>
                <b>{ELEMENT_LABEL[a.element]}</b>
                <span>{a.why}</span>
                <span className="fn-end">
                  {a.active && <em>now</em>}
                  <EggHelp element={a.element} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="collection">
        <div className="section-head">
          <h2>Collection</h2>
          <span className="count">
            {discovered}/{SPECIES.length} discovered
          </span>
        </div>
        {ELEMENTS.map((el) => (
          <ElementRow key={el} element={el} dex={s.dex} onOpen={setDetail} />
        ))}
      </section>

      {s.pets.length > 0 && (
        <section className="pets">
          <div className="section-head">
            <h2>Your pets</h2>
            <span className="count">{s.pets.length} · pick who reads with you</span>
          </div>
          <div className="pet-grid">
            {[...s.pets].reverse().map((p) => {
              const sp = speciesById(p.species);
              const st = stageOf(p);
              return (
                <button
                  key={p.id}
                  className={`pet-cell ${p.id === s.companionId ? "current" : ""}`}
                  onClick={() => mutate((st2) => setCompanion(st2, p.id), true)}
                  title={p.id === s.companionId ? "Your reading companion" : "Make companion"}
                >
                  <SpeciesImg id={p.species} stage={st} shiny={p.shiny} wear={p.wear} scale={2} />
                  <b>{p.name ?? sp?.stages[st] ?? p.species}</b>
                  <span>
                    {p.shiny ? "✦ " : ""}
                    {p.id === s.companionId ? "reading with you" : STAGE_LABEL[st]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="hatchery-prefs">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={inReader}
            onChange={(e) => saveSetting("hatcheryInReader", e.target.checked)}
          />
          <span>
            Show my pet in the reader
            <small>When hidden, reading still warms eggs and grows pets.</small>
          </span>
        </label>
        <button
          className="link-btn"
          onClick={() => {
            flushHatchery();
            saveSetting("hatchery", false);
            props.onTurnOff();
          }}
        >
          Turn off reading pets
          <small>Stops all tracking. Your eggs and pets are kept.</small>
        </button>
      </section>

      {hatching && <HatchModal onClose={() => setHatching(false)} />}
      {detail && <SpeciesDetail species={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

const UNIT: Record<string, string> = { min: "min", days: "days", uses: "uses", chapters: "chapters", books: "book" };

/** Accessories: earned by reading habits, worn by any pet. Click one to put
 *  it on your companion (or take it off); locked ones show what earns them. */
function Wardrobe(props: { s: HatcheryState; pet: Pet | null }) {
  const { s, pet } = props;
  const progress = accessoryProgress(s);
  const earned = ACCESSORIES.filter((a) => s.wardrobe[a.id]).length;
  const petName = (p: Pet) => p.name ?? speciesById(p.species)?.stages[stageOf(p)] ?? "your pet";
  return (
    <section className="wardrobe">
      <div className="section-head">
        <h2>Wardrobe</h2>
        <span className="count">
          {earned}/{ACCESSORIES.length} earned
          {pet && earned > 0 ? ` · click to dress ${petName(pet)}` : " · earned by how you read"}
        </span>
      </div>
      <div className="wardrobe-grid">
        {ACCESSORIES.map((a) => {
          const got = s.wardrobe[a.id];
          const on = !!pet && pet.wear?.[a.slot] === a.id;
          const by = got?.by ? s.pets.find((p) => p.id === got.by) : undefined;
          const tip = got
            ? `${a.blurb}
Earned ${new Date(got.at).toLocaleDateString()}${by ? ` with ${petName(by)}` : ""}.`
            : `${a.how} — ${Math.min(progress[a.id], a.goal)} of ${a.goal} ${UNIT[a.unit]}`;
          return (
            <button
              key={a.id}
              className={`wardrobe-item ${got ? "got" : "locked"} ${on ? "on" : ""}`}
              disabled={!got || !pet}
              title={tip}
              onClick={() => pet && mutate((st) => dress(st, pet.id, a.slot, on ? null : a.id), true)}
            >
              <span className="wardrobe-icon">
                <PixelImg src={itemUrl(a.id)} scale={3} />
              </span>
              <b>{a.name}</b>
              {got ? (
                <span className="wardrobe-state">{on ? "wearing" : pet ? "put on" : "earned"}</span>
              ) : (
                <>
                  <Meter
                    value={Math.min(progress[a.id], a.goal)}
                    max={a.goal}
                    label={`${Math.min(progress[a.id], a.goal)} / ${a.goal} ${UNIT[a.unit]}`}
                  />
                  <span className="wardrobe-how">{a.how}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <div className="stat">
      <b>{props.value}</b>
      <span>{props.label}</span>
    </div>
  );
}

function CompanionDetail(props: { pet: Pet }) {
  const { pet } = props;
  const sp = speciesById(pet.species);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name ?? "");
  useEffect(() => setName(pet.name ?? ""), [pet.id, pet.name]);
  if (!sp) return null;
  const st = stageOf(pet);
  const grow = growth(pet);
  const save = () => {
    mutate((s) => renamePet(s, pet.id, name), true);
    setEditing(false);
  };
  return (
    <div className="companion-detail">
      <div className="companion-stage">
        <span className="pedestal" />
        <PetSprite pet={pet} scale={5} className="bob" />
      </div>
      <div className="companion-meta">
        {editing ? (
          <input
            className="rename"
            value={name}
            autoFocus
            maxLength={24}
            placeholder={sp.stages[st]}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <h3 onClick={() => setEditing(true)} title="Rename">
            {pet.name ?? sp.stages[st]}
            {pet.shiny && <span className="shiny-star" title="Shiny">✦</span>}
          </h3>
        )}
        <p className="sub">
          {STAGE_LABEL[st]} · {ELEMENT_LABEL[sp.element]} ·{" "}
          <span className={`tier-text tier-${sp.tier}`}>{TIER_LABEL[sp.tier]}</span>
          {pet.name && <> · {sp.stages[st]}</>}
        </p>
        {grow ? (
          <Meter
            value={grow.done}
            max={grow.span}
            label={`grows into ${sp.stages[(st + 1) as Stage]} in ${minutes(grow.left)} of reading`}
          />
        ) : (
          <p className="fine">Fully grown.</p>
        )}
        {pet.hatchedIn && (
          <p className="fine">
            Hatched on p.{pet.hatchedIn.page} of <i>{pet.hatchedIn.title}</i>
          </p>
        )}
      </div>
    </div>
  );
}

function ElementRow(props: {
  element: Element;
  dex: Record<string, { best: Stage; count: number; shiny: number }>;
  onOpen: (s: Species) => void;
}) {
  const list = SPECIES.filter((s) => s.element === props.element).sort(
    (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier),
  );
  if (!list.length) return null;
  const found = list.filter((s) => props.dex[s.id]).length;
  return (
    <div className="element-row">
      <div className="element-head">
        <span className="egg-crop">
          <PixelImg src={eggUrl({ element: props.element, tier: "common" })} scale={1} />
        </span>
        <b>{ELEMENT_LABEL[props.element]}</b>
        <span>
          {found}/{list.length}
        </span>
        <EggHelp element={props.element} />
      </div>
      <div className="species-row">
        {list.map((sp) => {
          const d = props.dex[sp.id];
          return (
            <button
              key={sp.id}
              className={`species-cell tier-${sp.tier} ${d ? "found" : "unknown"}`}
              onClick={() => props.onOpen(sp)}
              title={d ? sp.name : sp.hint}
            >
              <SpeciesImg id={sp.id} stage={d ? d.best : 0} hidden={!d} scale={3} />
              <b>{d ? sp.name : "???"}</b>
              <span className={`tier-text tier-${sp.tier}`}>{TIER_LABEL[sp.tier]}</span>
              {d && d.shiny > 0 && <i className="shiny-star">✦</i>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpeciesDetail(props: { species: Species; onClose: () => void }) {
  const s = useHatchery();
  const sp = props.species;
  const d = s.dex[sp.id];
  const mine = s.pets.filter((p) => p.species === sp.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return createPortal(
    <div className="hatch-veil" onClick={props.onClose}>
      <div className={`species-detail tier-${sp.tier}`} onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <span className={`tier-badge tier-${sp.tier}`}>{TIER_LABEL[sp.tier]}</span>
          <span className="element-tag">{ELEMENT_LABEL[sp.element]}</span>
        </div>
        <h2>{d ? sp.name : "Undiscovered"}</h2>
        <div className="detail-stages">
          {([0, 1, 2] as Stage[]).map((st) => {
            const seen = d && d.best >= st;
            return (
              <figure key={st}>
                <PixelImg src={speciesUrl(sp.id, st, "idle", false, !seen)} scale={4} />
                <figcaption>
                  <b>{seen ? sp.stages[st] : "???"}</b>
                  <span>{STAGE_LABEL[st]}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
        <p className="detail-lore">{d ? sp.lore : `“${sp.hint}”`}</p>
        {d && (
          <p className="fine">
            {d.count} hatched{d.shiny ? ` · ${d.shiny} shiny` : ""} · first on{" "}
            {new Date(d.first).toLocaleDateString()}
          </p>
        )}
        {mine.length > 0 && (
          <div className="detail-pets">
            {mine.map((p) => (
              <button
                key={p.id}
                className={`pet-cell ${p.id === s.companionId ? "current" : ""}`}
                onClick={() => mutate((st) => setCompanion(st, p.id), true)}
              >
                <PixelImg {...petUrl(p.species, stageOf(p), "idle", p.shiny, p.wear)} scale={2} />
                <b>{p.name ?? sp.stages[stageOf(p)]}</b>
                <span>{p.id === s.companionId ? "companion" : "read together"}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn wide" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
