/** Daily Trivia rules: pure state transitions, no React, no IO.
 *
 *  One pack of ten questions a day, written by Claude in the background (see
 *  daily.ts). Answers lock once picked. Finishing a pack pays out once:
 *  warmth for the hatchery egg and growth for the companion, more for a
 *  good score and a running streak, and an egg at streak milestones.
 *
 *  The streak counts days whose pack was finished — whenever it was played,
 *  so yesterday's pack can still be caught up today. Two things bridge a
 *  day without breaking it: the app having been unable to write a pack that
 *  day (Claude unavailable, out of usage), and a freeze, earned every seven
 *  days of streak and spent automatically on a missed day. */

import type { Element } from "../hatchery/kit";
import { dayKey } from "../hatchery/game";
import { TOPIC } from "./topics";

export interface TriviaSource {
  title: string;
  url: string;
}

/** A Wikimedia Commons file, by name (see media.ts). */
export interface TriviaImage {
  file: string;
  caption: string;
}

/** A YouTube video, by id. */
export interface TriviaVideo {
  id: string;
  title: string;
}

export interface TriviaQuestion {
  topic: string;
  /** 1 = most people get it, 3 = a real stretch. Packs are ordered by it. */
  difficulty: 1 | 2 | 3;
  /** The recent news the question hangs on, one short line. */
  hook: string;
  question: string;
  choices: string[];
  answer: number;
  /** The fact tested, one sentence — fed back to the writer to avoid repeats. */
  fact: string;
  /** The story behind the answer (Markdown), read after answering. */
  story: string;
  /** Why the most tempting wrong choice tempts. */
  whyNot: string;
  sources: TriviaSource[];
  image?: TriviaImage;
  video?: TriviaVideo;
}

export interface TriviaReward {
  /** Minutes of warmth and growth paid to the hatchery. */
  minutes: number;
  streak: number;
  egg: Element | null;
  freeze: boolean;
}

export interface TriviaPack {
  /** Local "YYYY-MM-DD" the pack was written for. */
  day: string;
  questions: TriviaQuestion[];
  answers: (number | null)[];
  finishedAt?: number;
  reward?: TriviaReward;
}

export interface TriviaState {
  v: 1;
  /** Newest first, at most KEEP_PACKS. */
  packs: TriviaPack[];
  /** Days the app tried and failed to write a pack. */
  excused: string[];
  /** Missed days a freeze covered. */
  frozen: string[];
  freezes: number;
  best: number;
  played: number;
  /** Lifetime answers per topic id. */
  topics: Record<string, { answered: number; correct: number }>;
}

export const QUESTIONS = 10;
/** A pack with fewer valid questions than this is rejected and rewritten. */
export const MIN_QUESTIONS = 8;
const KEEP_PACKS = 60;
const MAX_FREEZES = 2;
const FREEZE_EVERY = 7;
/** Reward, in minutes of reading-equivalent warmth. */
const BASE_MIN = 5;
const STREAK_MIN_CAP = 5;
const PERFECT_MIN = 3;

export function newState(): TriviaState {
  return { v: 1, packs: [], excused: [], frozen: [], freezes: 0, best: 0, played: 0, topics: {} };
}

/** Fill in fields added after a save was written; never throws. */
export function migrate(raw: unknown): TriviaState {
  const base = newState();
  if (!raw || typeof raw !== "object") return base;
  return { ...base, ...(raw as Partial<TriviaState>), v: 1 };
}

export function packFor(s: TriviaState, day: string): TriviaPack | undefined {
  return s.packs.find((p) => p.day === day);
}

export function score(pack: TriviaPack): number {
  return pack.questions.filter((q, i) => pack.answers[i] === q.answer).length;
}

function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + by));
}

const finished = (s: TriviaState, day: string) => !!packFor(s, day)?.finishedAt;

/** A day that keeps the streak alive without adding to it. An excuse only
 *  holds while there is no pack for that day — once one exists, play it. */
const bridged = (s: TriviaState, day: string) =>
  s.frozen.includes(day) || (s.excused.includes(day) && !packFor(s, day));

/** Days of streak as of `today`. Today not yet played doesn't break it. */
export function streak(s: TriviaState, today: string): number {
  let n = 0;
  let day = finished(s, today) ? today : shiftDay(today, -1);
  for (let i = 0; i < 3660; i++, day = shiftDay(day, -1)) {
    if (finished(s, day)) n++;
    else if (!bridged(s, day)) break;
  }
  return n;
}

export function addPack(s: TriviaState, day: string, questions: TriviaQuestion[]): void {
  if (packFor(s, day)) return;
  s.packs.unshift({ day, questions, answers: questions.map(() => null) });
  s.packs.length = Math.min(s.packs.length, KEEP_PACKS);
}

export function excuse(s: TriviaState, day: string): void {
  if (!s.excused.includes(day)) s.excused.push(day);
  // Only the recent past can matter to a streak worth keeping.
  s.excused = s.excused.slice(-KEEP_PACKS);
}

/** Cover a run of missed days before `today` with freezes — only when they
 *  cover all of it and there is a streak on the far side to save. */
export function spendFreezes(s: TriviaState, today: string): void {
  const missed: string[] = [];
  let day = shiftDay(today, -1);
  while (!finished(s, day) && !bridged(s, day)) {
    missed.push(day);
    if (missed.length > s.freezes) return;
    day = shiftDay(day, -1);
  }
  if (!missed.length || streak(s, day) === 0) return;
  s.frozen.push(...missed);
  s.frozen = s.frozen.slice(-KEEP_PACKS);
  s.freezes -= missed.length;
}

/** Lock in an answer; returns whether it was right. Answered stays answered. */
export function answer(s: TriviaState, day: string, index: number, choice: number): boolean {
  const pack = packFor(s, day);
  const q = pack?.questions[index];
  if (!pack || !q || pack.answers[index] !== null) return false;
  pack.answers[index] = choice;
  const t = (s.topics[q.topic] ??= { answered: 0, correct: 0 });
  t.answered++;
  if (choice === q.answer) t.correct++;
  return choice === q.answer;
}

/** Close a fully answered pack and work out its reward, once. The caller
 *  pays the minutes and egg into the hatchery. */
export function finish(s: TriviaState, day: string, today: string, now: number): TriviaReward | null {
  const pack = packFor(s, day);
  if (!pack || pack.finishedAt || pack.answers.some((a) => a === null)) return null;
  pack.finishedAt = now;
  s.played++;
  // Finishing a day a freeze had covered gives the freeze back.
  const thawed = s.frozen.indexOf(day);
  if (thawed >= 0) {
    s.frozen.splice(thawed, 1);
    s.freezes = Math.min(MAX_FREEZES, s.freezes + 1);
  }
  const days = streak(s, today);
  s.best = Math.max(s.best, days);
  const right = score(pack);
  const freeze = days > 0 && days % FREEZE_EVERY === 0 && s.freezes < MAX_FREEZES;
  if (freeze) s.freezes++;
  const milestone = days === 7 || days === 30 || days === 100 || (days > 100 && days % 50 === 0);
  pack.reward = {
    minutes:
      BASE_MIN + right + Math.min(days, STREAK_MIN_CAP) + (right === pack.questions.length ? PERFECT_MIN : 0),
    streak: days,
    egg: milestone ? favoriteElement(s) : null,
    freeze,
  };
  return pack.reward;
}

/** The element of the topic answered most — what a streak egg is made of. */
function favoriteElement(s: TriviaState): Element {
  const top = Object.entries(s.topics)
    .filter(([id]) => TOPIC[id])
    .sort((a, b) => b[1].answered - a[1].answered)[0];
  return top ? TOPIC[top[0]].element : "arcane";
}

/** Facts asked in recent packs, so the writer doesn't repeat itself. */
export function recentFacts(s: TriviaState, days = 45): string[] {
  return s.packs.slice(0, days).flatMap((p) => p.questions.map((q) => q.fact));
}
