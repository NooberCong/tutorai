/** The companion's corner of the reader: the pet (asleep whenever you stop
 *  reading — an honest picture of what the tracker counts), the egg you're
 *  warming, and a speech bubble for finds, growth and ready eggs. The pet
 *  reacts to what you do — wakes when you come back, hops when you
 *  highlight or look something up — but nothing ever interrupts: bubbles
 *  fade on their own and hatching waits until you click the egg.
 *
 *  With the reading companion on, the pet also talks: now and then it says
 *  a one-line aside about the page you're on, written by the companion's own
 *  runs (see insightsPrompt) — no extra Claude calls.
 *
 *  Mounted only while the hatchery is on (App's DocScreen), so turning it
 *  off removes the tracker too. Hiding it from the reader keeps tracking. */

import { useEffect, useRef, useState } from "react";
import type { GameEvent, HatcheryState } from "../../lib/hatchery/game";
import { ACCESSORY } from "../../lib/hatchery/accessories";
import { FIND_EVERY_MIN, companion, eggReady, growth, keptSmall, speciesById, stageOf } from "../../lib/hatchery/game";
import { flushHatchery, onHatcheryEvent, useHatchery, useReaderActive } from "../../lib/hatchery/store";
import { useReadingTracker } from "../../lib/hatchery/tracker";
import { useInsights } from "../../lib/insights";
import { useSession } from "../../lib/session";
import { anchorFracs } from "../../lib/anchor";
import { saveSetting, useSetting } from "../../lib/settings";
import { HatchModal } from "./HatchModal";
import { Meter } from "./Meter";
import { StagePicker } from "./StagePicker";
import { ELEMENT_LABEL, STAGE_LABEL, TIER_LABEL, minutes } from "./labels";
import { PetSprite, PixelImg, crackOf, eggUrl } from "./sprites";
import "./hatchery.css";

export function ReaderCompanion(props: { onOpenHatchery: () => void }) {
  useReadingTracker();
  const shown = useSetting("hatcheryInReader");
  return shown ? <Den onOpenHatchery={props.onOpenHatchery} /> : null;
}

/** Bubbles queue so simultaneous events (a chapter done *and* an egg found)
 *  each get their moment; repeats of a line already waiting are dropped. */
const MAX_QUEUED = 3;

/** The pet speaks up at most this often, just after the reader has read
 *  the spot the aside is about: once it scrolls up past the reading line,
 *  this far down the view. */
const QUIP_GAP_MS = 3 * 60_000;
const READ_LINE = 0.25;
let lastQuipAt = 0;

type Reaction = { kind: "hop" | "love" | "grow"; n: number };
type Bubble = { text: string; id: number; speaker?: string };

function describe(e: GameEvent): string | null {
  switch (e.kind) {
    case "egg-found":
      return `Found ${e.egg.tier === "epic" ? "an" : "a"} ${TIER_LABEL[e.egg.tier].toLowerCase()} ${ELEMENT_LABEL[e.egg.element]} egg!`;
    case "egg-ready":
      return "The egg is ready — click it to hatch!";
    case "grew": {
      const sp = speciesById(e.pet.species);
      return sp ? `${sp.stages[e.stage - 1]} grew into a ${sp.stages[e.stage]}!` : null;
    }
    case "chapter-done":
      return e.title ? `Chapter finished: ${e.title}` : "Chapter finished!";
    case "nest-full":
      return "The nest is full — new finds wait until you hatch one.";
    case "accessory": {
      const a = ACCESSORY[e.id];
      const sp = e.pet && speciesById(e.pet.species);
      const who = e.pet && sp ? sp.stages[stageOf(e.pet)] : "You";
      const worn = e.pet?.wear?.[a.slot] === e.id;
      return `${who} earned ${a.name.toLowerCase()}!${worn ? "" : " It's in the wardrobe."}`;
    }
    case "habit":
      return null;
  }
}

/** A line for the very first minutes, before the loop has been felt. */
function intro(s: HatcheryState): string | null {
  const egg = s.incubator;
  if (s.hatchedTotal > 0 || !egg || egg.source !== "starter" || egg.warmth > 60_000) return null;
  return `An egg! Keep reading and it hatches in about ${minutes(egg.need - egg.warmth)}.`;
}

function Den(props: { onOpenHatchery: () => void }) {
  const s = useHatchery();
  const backdrop = useSetting("hatcheryBackdrop");
  const active = useReaderActive();
  const { meta, currentPage } = useSession();
  const { enabled: companionOn, quips, markQuipSaid } = useInsights();
  const [bubbles, setBubbles] = useState<Bubble[]>(() => {
    const text = intro(s);
    return text ? [{ text, id: 0 }] : [];
  });
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [eggNudge, setEggNudge] = useState(0);
  const [open, setOpen] = useState(false);
  const [hatching, setHatching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const counter = useRef(1);

  const react = (kind: Reaction["kind"]) => setReaction({ kind, n: counter.current++ });
  const say = (text: string, speaker?: string) =>
    setBubbles((q) =>
      q.some((b) => b.text === text) || q.length >= MAX_QUEUED
        ? q
        : [...q, { text, speaker, id: counter.current++ }],
    );

  useEffect(
    () =>
      onHatcheryEvent((e) => {
        if (e.kind === "habit") react("love");
        if (e.kind === "grew" || e.kind === "accessory") react("grow");
        if (e.kind === "chapter-done") react("hop");
        if (e.kind === "egg-found") setEggNudge((n) => n + 1);
        const text = describe(e);
        if (text) say(text);
      }),
    [],
  );

  const pet = companion(s);
  const sp = pet ? speciesById(pet.species) : undefined;
  const stage = pet ? stageOf(pet) : 0;
  const petName = pet && sp ? sp.stages[stage] : "";

  // The pet's aside, said just after you've read the spot it's about: when
  // that spot, first seen below the reading line, scrolls up past it. The
  // scroll is itself the sign of reading, so this doesn't wait on `active`.
  const armed = useRef(new Set<string>());
  const talk = companionOn && pet ? quips.filter((q) => !q.said) : [];
  const talkKey = talk.map((q) => q.id).join();
  useEffect(() => {
    if (!talk.length) return;
    let pending = 0;
    const check = () => {
      pending = 0;
      const reader = rootRef.current?.closest(".reader-host")?.querySelector<HTMLElement>(".reader");
      if (!reader) return;
      const view = reader.clientHeight;
      const line = reader.scrollTop + view * READ_LINE;
      const atEnd = reader.scrollTop + view >= reader.scrollHeight - 2;
      for (const q of talk) {
        const pageEl = reader.querySelector<HTMLElement>(`.pdf-page[data-page="${q.page}"]`);
        if (!pageEl) continue;
        let at = pageEl.offsetTop + (q.y ?? 0.5) * pageEl.offsetHeight;
        // near the view, the text layer knows where the quote really is
        if (Math.abs(at - line) < 2 * view) {
          const frac = anchorFracs(pageEl, [q.anchor], "end")[0];
          if (frac !== undefined) at = pageEl.offsetTop + frac * pageEl.offsetHeight;
        }
        // the last page can't scroll its end past the line; seeing it counts
        const passed = at <= line || (atEnd && at <= reader.scrollTop + view);
        if (!passed) {
          armed.current.add(q.id);
          continue;
        }
        // a spot flicked far past on the way elsewhere stays unsaid
        const near = at >= reader.scrollTop - view;
        if (!armed.current.has(q.id) || !near || Date.now() - lastQuipAt < QUIP_GAP_MS) continue;
        lastQuipAt = Date.now();
        armed.current.delete(q.id);
        markQuipSaid(q.id);
        say(q.text, petName);
        react("hop");
        return;
      }
    };
    const onScroll = (e: Event) => {
      if (!pending && (e.target as Element).classList?.contains("reader")) pending = requestAnimationFrame(check);
    };
    check();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      cancelAnimationFrame(pending);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkKey, petName]);

  // Waking up when you come back to the page.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) react("hop");
    wasActive.current = active;
  }, [active]);

  // The card closes on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const egg = s.incubator;
  const ready = eggReady(s);
  const grow = pet ? growth(pet) : null;
  const bubble = bubbles[0];

  return (
    <div className={open ? "den open" : "den"} ref={rootRef}>
      {bubble && !open && (
        <div
          className={bubble.speaker ? "den-bubble quip" : "den-bubble"}
          key={bubble.id}
          role="status"
          title="Dismiss"
          onClick={() => setBubbles((q) => q.slice(1))}
          onAnimationEnd={(e) => e.animationName === "bubble-out" && setBubbles((q) => q.slice(1))}
        >
          {bubble.speaker && <b className="den-speaker">{bubble.speaker}</b>}
          {bubble.text}
        </div>
      )}
      {open && (
        <div className="den-card" role="dialog" aria-label="Reading companion">
          {pet && sp && (
            <div className={`den-row tier-${sp.tier}`}>
              <div className="den-title">
                <b>{petName}</b>
                <span>{STAGE_LABEL[stage]}</span>
              </div>
              {keptSmall(pet) ? (
                <div className="den-note">Kept small — not growing</div>
              ) : grow ? (
                <Meter
                  value={grow.done}
                  max={grow.span}
                  label={`grows up in ${minutes(grow.left)} of reading`}
                />
              ) : (
                <div className="den-note">Fully grown</div>
              )}
              <StagePicker pet={pet} />
            </div>
          )}
          {egg && (
            <div className={`den-row tier-${egg.tier}`}>
              <div className="den-title">
                <b>{ELEMENT_LABEL[egg.element]} egg</b>
                <span className="tier-text">{TIER_LABEL[egg.tier]}</span>
              </div>
              <Meter
                value={egg.warmth}
                max={egg.need}
                label={ready ? "ready to hatch" : `hatches in ${minutes(egg.need - egg.warmth)} of reading`}
              />
              {s.nest.length > 0 && (
                <div className="den-note">
                  {s.nest.length} more {s.nest.length === 1 ? "egg" : "eggs"} waiting in the nest
                </div>
              )}
            </div>
          )}
          {!egg && (
            <div className="den-note">
              The next egg turns up in {minutes(FIND_EVERY_MIN * 60_000 - s.findMs)} of reading.
            </div>
          )}
          <div className={active ? "den-live on" : "den-live"}>
            {active ? "Reading — time counts" : "Paused — scroll or turn a page to resume"}
          </div>
          <div className="den-actions">
            <button className="btn" onClick={props.onOpenHatchery}>
              Open hatchery
            </button>
            <span className="den-quiet">
              <button
                className="link-btn"
                title={backdrop ? "Plain dark background behind the pages" : "Show the habitat behind the pages"}
                onClick={() => saveSetting("hatcheryBackdrop", !backdrop)}
              >
                {backdrop ? "Plain background" : "Habitat background"}
              </button>
              <button
                className="link-btn"
                title="Hide the pet from the reader. Reading still warms eggs and grows pets."
                onClick={() => saveSetting("hatcheryInReader", false)}
              >
                Hide
              </button>
              <button
                className="link-btn"
                title="Turn reading pets off entirely. Your eggs and pets are kept."
                onClick={() => {
                  flushHatchery();
                  saveSetting("hatchery", false);
                }}
              >
                Turn off
              </button>
            </span>
          </div>
        </div>
      )}
      <div className="den-floor">
        {pet && sp && (
          <button
            className={`den-pet tier-${sp.tier} ${pet.wear?.head ? "hatted" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${petName} — ${active ? "reading with you" : "asleep"}`}
            title={active ? `${petName} is reading with you` : `${petName} is asleep — reading time is paused`}
          >
            <span key={reaction?.n} className={reaction ? `den-react react-${reaction.kind}` : "den-react"}>
              <PetSprite pet={pet} scale={2} asleep={!active} />
            </span>
            {grow && !keptSmall(pet) && (
              <i className="den-bar">
                <i style={{ width: `${(grow.done / grow.span) * 100}%` }} />
              </i>
            )}
            {reaction?.kind === "love" && <Heart key={`heart-${reaction.n}`} />}
          </button>
        )}
        {egg && (
          <button
            key={eggNudge}
            className={`den-egg tier-${egg.tier} ${ready ? "ready" : ""} ${eggNudge ? "nudge" : ""}`}
            onClick={() => (ready ? setHatching(true) : setOpen((v) => !v))}
            aria-label={ready ? "Hatch the egg" : `${ELEMENT_LABEL[egg.element]} egg`}
            title={ready ? "Ready — click to hatch!" : `${ELEMENT_LABEL[egg.element]} egg — warms while you read`}
          >
            <PixelImg src={eggUrl(egg, crackOf(egg))} scale={2} />
            <i className="den-bar">
              <i style={{ width: `${Math.min(100, (egg.warmth / egg.need) * 100)}%` }} />
            </i>
          </button>
        )}
      </div>
      {hatching && (
        <HatchModal
          where={meta ? { title: meta.title, page: currentPage } : undefined}
          onClose={() => setHatching(false)}
        />
      )}
    </div>
  );
}

/** A little pixel heart that floats up from the pet. */
const HEART = [".kk.kk.", "kpLkppk", "kpppppk", ".kpppk.", "..kpk..", "...k..."];
const HEART_INK: Record<string, string> = { k: "#7a2941", p: "#ff8aa6", L: "#ffe1e8" };

function Heart() {
  return (
    <svg className="den-heart" width="14" height="12" viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden>
      {HEART.flatMap((row, y) =>
        [...row].map((c, x) =>
          HEART_INK[c] ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={HEART_INK[c]} /> : null,
        ),
      )}
    </svg>
  );
}
