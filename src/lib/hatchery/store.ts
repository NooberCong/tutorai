/** App-wide hatchery state: load/save (hatchery.json in app data, like
 *  settings.json — see settings.ts for why not localStorage), React binding,
 *  and the event feed the UI turns into toasts and celebrations.
 *
 *  Game rules live in game.ts; this module only owns the single live state
 *  object, applies transitions to it, and persists the result. */

import { useSyncExternalStore } from "react";
import type { PetPersona } from "../ai";
import { getSetting } from "../settings";
import { readHatchery, writeHatchery } from "../tauri";
import type { GameEvent, HatcheryState } from "./game";
import { companion, migrate, newState, speciesById, stageOf } from "./game";

let state: HatcheryState = newState();
let version = 0;
let loaded = false;
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: GameEvent) => void>();

/** Runs once before the UI mounts (main.tsx). A missing or unreadable file
 *  starts a fresh hatchery — it must never block the app. An unparseable
 *  file is left alone on disk (not overwritten) until the next change. */
export async function loadHatchery(): Promise<void> {
  try {
    const text = await readHatchery();
    if (text) state = migrate(JSON.parse(text));
  } catch {
    // fresh state
  }
  loaded = true;
}

// Saves are throttled, not debounced: reading ticks every few seconds, so a
// debounce would never fire mid-session. At most SAVE_MS of progress is
// ever at risk, and hiding or closing the window flushes immediately.
const SAVE_MS = 15_000;
let saveTimer: number | undefined;
function scheduleSave() {
  if (!loaded || saveTimer !== undefined) return;
  saveTimer = window.setTimeout(flushHatchery, SAVE_MS);
}

export function flushHatchery() {
  window.clearTimeout(saveTimer);
  saveTimer = undefined;
  writeHatchery(JSON.stringify(state)).catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => saveTimer !== undefined && flushHatchery());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && saveTimer !== undefined) flushHatchery();
  });
}

/** Apply a transition. `urgent` saves now (hatching, renaming) instead of
 *  on the debounce. */
export function mutate(fn: (s: HatcheryState) => GameEvent[] | void, urgent = false) {
  const events = fn(state) ?? [];
  version++;
  listeners.forEach((l) => l());
  events.forEach((e) => eventListeners.forEach((l) => l(e)));
  if (urgent) flushHatchery();
  else scheduleSave();
}

export function getHatchery(): HatcheryState {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The live state; re-renders on every change. Treat as read-only — change
 *  it through `mutate`. */
export function useHatchery(): HatcheryState {
  useSyncExternalStore(subscribe, () => version);
  return state;
}

export function onHatcheryEvent(l: (e: GameEvent) => void): () => void {
  eventListeners.add(l);
  return () => eventListeners.delete(l);
}

/** The companion pet as the reading companion should voice it — or null
 *  when there's no pet in the reader to say anything (hatchery off, hidden
 *  from the reader, or nothing hatched yet), so no quip is ever asked for. */
export function talkingPet(): PetPersona | null {
  if (!getSetting("hatchery") || !getSetting("hatcheryInReader")) return null;
  const pet = companion(state);
  const sp = pet && speciesById(pet.species);
  if (!pet || !sp) return null;
  const stage = stageOf(pet);
  const age = ["a baby", "a young", "a grown"][stage];
  const future = stage < 2 ? `, one day a ${sp.name}` : "";
  return {
    name: pet.name ?? sp.stages[stage],
    kind: `${age} ${sp.element}-element creature${pet.name ? ` (a ${sp.stages[stage]})` : ""}${future}`,
    about: sp.lore,
  };
}

// ── transient: is the reader being actively read right now? ──

let readerActive = false;
const activeListeners = new Set<() => void>();

export function setReaderActive(v: boolean) {
  if (v === readerActive) return;
  readerActive = v;
  activeListeners.forEach((l) => l());
}

function subscribeActive(l: () => void) {
  activeListeners.add(l);
  return () => activeListeners.delete(l);
}

export function useReaderActive(): boolean {
  return useSyncExternalStore(subscribeActive, () => readerActive);
}
