/** App-wide Daily Trivia state: load/save (trivia.json in app data, like
 *  hatchery.json) and the React binding. Rules live in game.ts.
 *
 *  Changes come at the pace of a player answering questions, so every one
 *  is saved straight away — no throttle to flush. */

import { useSyncExternalStore } from "react";
import { getSetting } from "../settings";
import { readTrivia, writeTrivia } from "../tauri";
import { dayKey, triviaBonus } from "../hatchery/game";
import { mutate as mutateHatchery } from "../hatchery/store";
import type { TriviaReward, TriviaState } from "./game";
import { finish, migrate, newState } from "./game";

let state: TriviaState = newState();
let version = 0;
let loaded = false;
const listeners = new Set<() => void>();

/** Runs once before the UI mounts (main.tsx). A missing or unreadable file
 *  starts fresh; an unparseable one is left alone until the next change. */
export async function loadTrivia(): Promise<void> {
  try {
    const text = await readTrivia();
    if (text) state = migrate(JSON.parse(text));
  } catch {
    // fresh state
  }
  loaded = true;
}

export function mutateTrivia<T>(fn: (s: TriviaState) => T): T {
  const out = fn(state);
  version++;
  listeners.forEach((l) => l());
  if (loaded) writeTrivia(JSON.stringify(state)).catch(() => {});
  return out;
}

export function getTrivia(): TriviaState {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The live state; re-renders on every change. Treat as read-only — change
 *  it through `mutateTrivia`. */
export function useTrivia(): TriviaState {
  useSyncExternalStore(subscribe, () => version);
  return state;
}

/** Close a fully answered pack and pay its reward into the hatchery (when
 *  reading pets are on). Null if it was already closed. */
export function finishPack(day: string): TriviaReward | null {
  const now = new Date();
  const reward = mutateTrivia((s) => finish(s, day, dayKey(now), now.getTime()));
  if (reward && getSetting("hatchery")) {
    mutateHatchery((h) => triviaBonus(h, reward.minutes * 60_000, reward.egg, now), true);
  }
  return reward;
}
