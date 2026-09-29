/** Hatchery rules: pure state transitions, no React, no IO.
 *
 *  The only currency is *active reading time* — minutes with the reader
 *  focused and the user actually interacting (see tracker.ts). It does three
 *  things at once:
 *    - warms the egg in the incubator until it can hatch;
 *    - grows the companion pet (hatchling → juvenile → adult);
 *    - fills a "find" meter that turns up a new egg every FIND_EVERY_MIN.
 *  Finishing a chapter or a whole book also turns up an egg, with better
 *  odds on rare tiers and shinies.
 *
 *  An egg's *element* is decided when it's found, from how the user is
 *  reading at that moment (time of day, long sessions, slow careful reading,
 *  a steady week, study tools) — the Neko Atsume idea: habits attract
 *  species, and discovering which habit attracts what is part of the game.
 *  Nothing ever dies, decays or is lost; missing a day costs nothing. */

import type { Element, Species, Stage, Tier } from "./kit.ts";
import { ELEMENTS } from "./kit.ts";
import { SPECIES, speciesById } from "./species.ts";
import type { AccessoryId, Slot, Wear } from "./accessories.ts";
import { ACCESSORIES, ACCESSORY } from "./accessories.ts";

export { speciesById };

export const INCUBATE_MIN: Record<Tier, number> = { common: 20, rare: 45, epic: 90, legendary: 180 };
/** First egg hatches fast so the loop is felt in the first session. */
export const STARTER_MIN = 8;
/** Minutes as companion to reach juvenile / adult, before the tier factor. */
const GROW_MIN: [number, number] = [45, 180];
const GROW_TIER: Record<Tier, number> = { common: 1, rare: 1.3, epic: 1.6, legendary: 2 };
export const FIND_EVERY_MIN = 25;
/** Reading finds pause while the nest is this full; chapter and book eggs
 *  are rare and earned, so they always fit. */
export const NEST_MAX = 12;
/** Pauses shorter than this don't end a sitting. */
const SITTING_GAP_MIN = 10;
/** A sitting this long (first to last activity) attracts ember. */
export const LONG_SITTING_MIN = 40;
/** Frost: this many seconds per page on average, over FROST_PAGES pages. */
export const SLOW_PAGE_S = 120;
const FROST_PAGES = 5;
/** One page's time is capped, so a page left open doesn't skew the pace. */
const PAGE_CAP_MS = 5 * 60_000;
/** A day "counts" toward the week once this much reading happened. */
export const DAY_MIN = 10;

export type EggSource = "starter" | "reading" | "chapter" | "book";

export interface Where {
  title: string;
  page: number;
}

export interface Egg {
  id: string;
  element: Element;
  tier: Tier;
  source: EggSource;
  /** Active reading ms received / needed. */
  warmth: number;
  need: number;
  foundAt: number;
  foundIn?: Where;
}

export interface Pet {
  id: string;
  species: string;
  shiny: boolean;
  name?: string;
  /** Active reading ms spent as companion. */
  xp: number;
  hatchedAt: number;
  foundIn?: Where;
  hatchedIn?: Where;
  /** Accessories it has on, one per slot. */
  wear?: Wear;
  /** The habitat it's shown in, when not its own element's. */
  home?: Element;
}

export interface DexEntry {
  first: number;
  count: number;
  shiny: number;
  /** Highest stage any pet of this species has reached. */
  best: Stage;
}

export type Habit = "highlight" | "lookup" | "quiz" | "ask";

export interface DocProgress {
  /** Pages read (dwelled on), sorted ascending. */
  pages: number[];
  /** Chapter indexes already rewarded. */
  chapters: number[];
  finished: boolean;
}

export interface HatcheryState {
  v: 1;
  createdAt: number;
  activeMs: number;
  pagesRead: number;
  /** Local date "YYYY-MM-DD" → active ms. */
  days: Record<string, number>;
  findMs: number;
  incubator: Egg | null;
  nest: Egg[];
  pets: Pet[];
  companionId: string | null;
  dex: Record<string, DexEntry>;
  /** Recent study-tool use, decaying with active reading time. */
  habits: Record<Habit, number>;
  /** Current sitting. Pauses under SITTING_GAP_MIN don't end it. */
  session: Sitting;
  docs: Record<string, DocProgress>;
  hatchedTotal: number;
  /** Accessories earned: when, and which companion was reading along. */
  wardrobe: Partial<Record<AccessoryId, { at: number; by?: string }>>;
  /** Reading-time and study counters toward accessories (the rest are
   *  counted from `days` and `docs`). */
  earn: { slowMs: number; deepMs: number; nightMs: number; dayMs: number; study: number };
}

export interface Sitting {
  /** First and latest active moment — the sitting's length in real time. */
  start: number;
  lastActive: number;
  /** Time on each page read this sitting ("docId:page" → ms, capped),
   *  counted while the reader is on screen, not only while touched: slow
   *  readers don't scroll much. Revisits add to the same page. */
  dwell: Record<string, number>;
}

/** What a transition did, for the UI to celebrate or react to. */
export type GameEvent =
  | { kind: "habit"; habit: Habit }
  | { kind: "egg-found"; egg: Egg }
  | { kind: "nest-full" }
  | { kind: "egg-ready"; egg: Egg }
  | { kind: "grew"; pet: Pet; stage: Stage }
  | { kind: "chapter-done"; title: string }
  | { kind: "accessory"; id: AccessoryId; pet: Pet | null };

export type Rng = () => number;

const uid = () => crypto.randomUUID();

export function newState(now = Date.now(), rng: Rng = Math.random): HatcheryState {
  const starter = pick(["leaf", "sky", "tide"] as Element[], rng);
  return {
    v: 1,
    createdAt: now,
    activeMs: 0,
    pagesRead: 0,
    days: {},
    findMs: 0,
    incubator: {
      id: uid(), element: starter, tier: "common", source: "starter",
      warmth: 0, need: STARTER_MIN * 60_000, foundAt: now,
    },
    nest: [],
    pets: [],
    companionId: null,
    dex: {},
    habits: { highlight: 0, lookup: 0, quiz: 0, ask: 0 },
    session: { start: 0, lastActive: 0, dwell: {} },
    docs: {},
    hatchedTotal: 0,
    wardrobe: {},
    earn: { slowMs: 0, deepMs: 0, nightMs: 0, dayMs: 0, study: 0 },
  };
}

/** Fill in fields added after a save was written; never throws. */
export function migrate(raw: unknown, now = Date.now()): HatcheryState {
  const base = newState(now);
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<HatcheryState>;
  return {
    ...base,
    ...s,
    habits: { ...base.habits, ...(s.habits ?? {}) },
    earn: { ...base.earn, ...(s.earn ?? {}) },
    // Saves from before sittings kept real time and per-page dwell.
    session: s.session && "dwell" in s.session ? s.session : base.session,
    v: 1,
  };
}

// ── helpers ──

function pick<T>(xs: T[], rng: Rng): T {
  return xs[Math.floor(rng() * xs.length) % xs.length];
}

function weighted<T extends string>(w: Record<T, number>, rng: Rng): T {
  const keys = Object.keys(w) as T[];
  const total = keys.reduce((a, k) => a + w[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= w[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Days in the last 7 (including today) with at least DAY_MIN of reading. */
export function readingDaysThisWeek(s: HatcheryState, now: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if ((s.days[dayKey(d)] ?? 0) >= DAY_MIN * 60_000) n++;
  }
  return n;
}

export function growNeedMs(sp: Species): [number, number] {
  const f = GROW_TIER[sp.tier];
  return [GROW_MIN[0] * f * 60_000, GROW_MIN[1] * f * 60_000];
}

export function stageOf(pet: Pet): Stage {
  const sp = speciesById(pet.species);
  if (!sp) return 0;
  const [j, a] = growNeedMs(sp);
  return pet.xp >= a ? 2 : pet.xp >= j ? 1 : 0;
}

/** Progress toward the next stage, or null once fully grown. */
export function growth(pet: Pet): { done: number; span: number; left: number } | null {
  const sp = speciesById(pet.species);
  if (!sp) return null;
  const [j, a] = growNeedMs(sp);
  if (pet.xp >= a) return null;
  const [from, to] = pet.xp >= j ? [j, a] : [0, j];
  return { done: pet.xp - from, span: to - from, left: to - pet.xp };
}

export function companion(s: HatcheryState): Pet | null {
  return s.pets.find((p) => p.id === s.companionId) ?? null;
}

// ── what attracts which element ──

export interface Attraction {
  element: Element;
  /** Human-readable reason, shown in the hatchery's field notes. */
  why: string;
  active: boolean;
}

/** Which habits are pulling on the next egg's element right now. */
export function attractions(s: HatcheryState, now: Date): Attraction[] {
  const h = now.getHours();
  const study = s.habits.highlight + s.habits.lookup + s.habits.quiz + s.habits.ask;
  const { long, slow } = sittingPace(s, now);
  return [
    { element: "sky", why: "Reading in the morning", active: h >= 5 && h < 12 },
    { element: "leaf", why: "Reading in the afternoon", active: h >= 12 && h < 17 },
    { element: "tide", why: "Reading in the evening", active: h >= 17 && h < 21 },
    { element: "moon", why: "Reading late at night", active: h >= 21 || h < 5 },
    { element: "ember", why: "A long, unbroken sitting", active: long },
    { element: "frost", why: "Slow, careful reading", active: slow },
    { element: "stone", why: "Reading 4+ days a week", active: readingDaysThisWeek(s, now) >= 4 },
    { element: "arcane", why: "Using the study tools", active: study >= 3 },
  ];
}

/** Whether the current sitting is long (ember) and slow-paced (frost). A
 *  sitting that ended more than SITTING_GAP_MIN ago is neither. */
export function sittingPace(s: HatcheryState, now: Date): { long: boolean; slow: boolean } {
  const se = s.session;
  if (now.getTime() - se.lastActive > SITTING_GAP_MIN * 60_000) return { long: false, slow: false };
  const times = Object.values(se.dwell);
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  return {
    long: se.lastActive - se.start >= LONG_SITTING_MIN * 60_000,
    slow: times.length >= FROST_PAGES && avg >= SLOW_PAGE_S * 1000,
  };
}

function rollElement(s: HatcheryState, now: Date, rng: Rng): Element {
  const w = Object.fromEntries(ELEMENTS.map((e) => [e, e === "arcane" ? 0.4 : 1])) as Record<Element, number>;
  for (const a of attractions(s, now)) if (a.active) w[a.element] *= a.element === "arcane" ? 10 : 4;
  return weighted(w, rng);
}

const TIER_ODDS: Record<EggSource, Record<Tier, number>> = {
  starter: { common: 1, rare: 0, epic: 0, legendary: 0 },
  reading: { common: 62, rare: 26, epic: 9, legendary: 3 },
  chapter: { common: 40, rare: 35, epic: 19, legendary: 6 },
  book: { common: 0, rare: 55, epic: 33, legendary: 12 },
};

function findEgg(s: HatcheryState, source: EggSource, now: Date, rng: Rng, where?: Where): GameEvent[] {
  const tier = weighted(TIER_ODDS[source], rng);
  const egg: Egg = {
    id: uid(),
    element: rollElement(s, now, rng),
    tier,
    source,
    warmth: 0,
    need: INCUBATE_MIN[tier] * 60_000,
    foundAt: now.getTime(),
    foundIn: where,
  };
  // An empty incubator takes the new egg straight away.
  if (!s.incubator) s.incubator = egg;
  else s.nest.push(egg);
  const events: GameEvent[] = [{ kind: "egg-found", egg }];
  if (source === "reading" && nestFull(s)) events.push({ kind: "nest-full" });
  return events;
}

/** Reading finds pause while this holds (chapter and book eggs don't). */
export function nestFull(s: HatcheryState): boolean {
  return s.nest.length >= NEST_MAX;
}

// ── transitions ──

/** Credit `ms` of active reading. Call every few seconds while active. */
export function tick(
  s: HatcheryState,
  ms: number,
  now: Date,
  where?: Where,
  rng: Rng = Math.random,
): GameEvent[] {
  const events: GameEvent[] = [];
  const t = now.getTime();

  if (t - s.session.lastActive > SITTING_GAP_MIN * 60_000) {
    s.session = { start: t - ms, lastActive: t, dwell: {} };
  }
  s.session.lastActive = t;
  s.activeMs += ms;
  const key = dayKey(now);
  s.days[key] = (s.days[key] ?? 0) + ms;

  // Habits fade with a ~30 min half-life of reading.
  const fade = Math.pow(0.5, ms / (30 * 60_000));
  for (const k of Object.keys(s.habits) as Habit[]) s.habits[k] *= fade;

  const egg = s.incubator;
  if (egg && egg.warmth < egg.need) {
    egg.warmth = Math.min(egg.need, egg.warmth + ms);
    if (egg.warmth >= egg.need) events.push({ kind: "egg-ready", egg });
  }

  const pet = companion(s);
  if (pet) {
    const before = stageOf(pet);
    pet.xp += ms;
    const after = stageOf(pet);
    if (after > before) {
      events.push({ kind: "grew", pet, stage: after });
      const d = s.dex[pet.species];
      if (d && after > d.best) d.best = after;
    }
  }

  const h = now.getHours();
  const { long, slow } = sittingPace(s, now);
  if (slow) s.earn.slowMs += ms;
  if (long) s.earn.deepMs += ms;
  if (h >= 21 || h < 5) s.earn.nightMs += ms;
  if (h >= 5 && h < 17) s.earn.dayMs += ms;
  events.push(...checkWardrobe(s, t));

  // A full nest pauses the find meter rather than throwing finds away.
  if (!nestFull(s)) {
    s.findMs += ms;
    if (s.findMs >= FIND_EVERY_MIN * 60_000) {
      s.findMs -= FIND_EVERY_MIN * 60_000;
      events.push(...findEgg(s, "reading", now, rng, where));
    }
  }
  return events;
}

export function noteHabit(s: HatcheryState, habit: Habit): GameEvent[] {
  s.habits[habit] += 1;
  s.earn.study += 1;
  return [{ kind: "habit", habit }, ...checkWardrobe(s, Date.now())];
}

/** A page the reader actually dwelled on. Rewards finished chapters and
 *  books once each. */
export function pageRead(
  s: HatcheryState,
  docId: string,
  page: number,
  info: { title: string; pages: number; chapters: { title: string; startPage: number; endPage: number }[] },
  now: Date,
  rng: Rng = Math.random,
): GameEvent[] {
  const events: GameEvent[] = [];
  const doc = (s.docs[docId] ??= { pages: [], chapters: [], finished: false });
  if (doc.pages.includes(page)) return events;
  doc.pages.push(page);
  doc.pages.sort((a, b) => a - b);
  s.pagesRead += 1;

  const read = new Set(doc.pages);
  const where = { title: info.title, page };
  info.chapters.forEach((ch, i) => {
    if (doc.chapters.includes(i) || page < ch.startPage || page > ch.endPage) return;
    const len = ch.endPage - ch.startPage + 1;
    if (len < 3) return;
    let n = 0;
    for (let p = ch.startPage; p <= ch.endPage; p++) if (read.has(p)) n++;
    if (n / len >= 0.7) {
      doc.chapters.push(i);
      events.push({ kind: "chapter-done", title: ch.title });
      events.push(...findEgg(s, "chapter", now, rng, where));
    }
  });
  if (!doc.finished && info.pages >= 20 && read.size / info.pages >= 0.85) {
    doc.finished = true;
    events.push(...findEgg(s, "book", now, rng, where));
  }
  events.push(...checkWardrobe(s, now.getTime()));
  return events;
}

/** `ms` more on a page read this sitting — feeds the sitting's pace (slow,
 *  careful reading attracts frost). */
export function noteDwell(s: HatcheryState, page: string, ms: number): void {
  const d = s.session.dwell;
  d[page] = Math.min(PAGE_CAP_MS, (d[page] ?? 0) + ms);
}

/** Swap a nest egg into the incubator (the old one keeps its warmth). */
export function incubate(s: HatcheryState, eggId: string): void {
  const i = s.nest.findIndex((e) => e.id === eggId);
  if (i < 0) return;
  const [egg] = s.nest.splice(i, 1);
  if (s.incubator) s.nest.unshift(s.incubator);
  s.incubator = egg;
}

export function eggReady(s: HatcheryState): boolean {
  return !!s.incubator && s.incubator.warmth >= s.incubator.need;
}

/** Hatch the incubator's egg. The species comes from the egg's element and
 *  tier; arcane commons lean on which study habit dominates. The next nest
 *  egg moves into the incubator. */
export function hatch(
  s: HatcheryState,
  now: Date,
  where?: Where,
  rng: Rng = Math.random,
): { pet: Pet; isNew: boolean } | null {
  const egg = s.incubator;
  if (!egg || egg.warmth < egg.need) return null;
  let pool = SPECIES.filter((sp) => sp.element === egg.element && sp.tier === egg.tier);
  if (!pool.length) pool = SPECIES.filter((sp) => sp.tier === egg.tier);
  if (!pool.length) pool = SPECIES;
  let sp = pick(pool, rng);
  // Half of arcane commons follow the study habit that dominates lately:
  // marking and looking things up hatch Inklings, asking and quizzing
  // hatch Tomepups. The other half stay a surprise.
  if (egg.element === "arcane" && egg.tier === "common" && rng() < 0.5) {
    const ink = s.habits.highlight + s.habits.lookup;
    const talk = s.habits.ask + s.habits.quiz;
    const lean = ink > talk ? "inkling" : talk > ink ? "tomepup" : null;
    sp = pool.find((p) => p.id === lean) ?? sp;
  }
  const shinyOdds = egg.source === "chapter" || egg.source === "book" ? 1 / 8 : 1 / 16;
  const pet: Pet = {
    id: uid(),
    species: sp.id,
    shiny: rng() < shinyOdds,
    xp: 0,
    hatchedAt: now.getTime(),
    foundIn: egg.foundIn,
    hatchedIn: where,
  };
  const isNew = !s.dex[sp.id];
  const d = (s.dex[sp.id] ??= { first: pet.hatchedAt, count: 0, shiny: 0, best: 0 });
  d.count += 1;
  if (pet.shiny) d.shiny += 1;
  s.pets.push(pet);
  s.hatchedTotal += 1;
  if (!s.companionId) s.companionId = pet.id;
  s.incubator = s.nest.shift() ?? null;
  return { pet, isNew };
}

export function setCompanion(s: HatcheryState, petId: string): void {
  if (s.pets.some((p) => p.id === petId)) s.companionId = petId;
}

// ── habitats ──

/** Habitats you can move a pet to: one per element you've discovered a
 *  creature of (a pet's own element is always open to it). */
export function habitats(s: HatcheryState): Set<Element> {
  const open = new Set<Element>();
  for (const id of Object.keys(s.dex)) {
    const sp = speciesById(id);
    if (sp) open.add(sp.element);
  }
  return open;
}

export function homeOf(pet: Pet): Element {
  return pet.home ?? speciesById(pet.species)?.element ?? "leaf";
}

export function setHome(s: HatcheryState, petId: string, el: Element): void {
  const pet = s.pets.find((p) => p.id === petId);
  const own = pet && speciesById(pet.species)?.element;
  if (!pet || (el !== own && !habitats(s).has(el))) return;
  pet.home = el === own ? undefined : el;
}

export function renamePet(s: HatcheryState, petId: string, name: string): void {
  const pet = s.pets.find((p) => p.id === petId);
  if (pet) pet.name = name.trim().slice(0, 24) || undefined;
}

// ── accessories ──

/** Progress toward each accessory, in its own unit (minutes, days, uses,
 *  chapters, books). Days, chapters and books count from the reading
 *  history, so what you'd already read before accessories existed counts. */
export function accessoryProgress(s: HatcheryState): Record<AccessoryId, number> {
  const min = (ms: number) => Math.floor(ms / 60_000);
  const docs = Object.values(s.docs);
  return {
    glasses: min(s.earn.slowMs),
    scarf: min(s.earn.deepMs),
    nightcap: min(s.earn.nightMs),
    sunhat: min(s.earn.dayMs),
    flowercrown: Object.values(s.days).filter((ms) => ms >= DAY_MIN * 60_000).length,
    wizardhat: s.earn.study,
    bowtie: docs.reduce((n, d) => n + d.chapters.length, 0),
    mortarboard: docs.filter((d) => d.finished).length,
  };
}

/** Award anything newly reached. The companion reading along gets the
 *  credit, and puts it on if that slot is free. */
function checkWardrobe(s: HatcheryState, at: number): GameEvent[] {
  const events: GameEvent[] = [];
  const progress = accessoryProgress(s);
  const pet = companion(s);
  for (const a of ACCESSORIES) {
    if (s.wardrobe[a.id] || progress[a.id] < a.goal) continue;
    s.wardrobe[a.id] = { at, by: pet?.id };
    if (pet && !pet.wear?.[a.slot]) pet.wear = { ...pet.wear, [a.slot]: a.id };
    events.push({ kind: "accessory", id: a.id, pet });
  }
  return events;
}

/** Put an earned accessory on a pet (replacing whatever is in that slot),
 *  or take a slot off with `id` null. */
export function dress(s: HatcheryState, petId: string, slot: Slot, id: AccessoryId | null): void {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return;
  if (id && (!s.wardrobe[id] || ACCESSORY[id].slot !== slot)) return;
  const wear = { ...pet.wear };
  if (id) wear[slot] = id;
  else delete wear[slot];
  pet.wear = Object.keys(wear).length ? wear : undefined;
}
