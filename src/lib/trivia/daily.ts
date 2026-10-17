/** Writes today's trivia pack in the background, once a day.
 *
 *  Checked a minute after launch (clear of the boot's own work), every
 *  15 minutes (the app may stay open past midnight), and whenever the window
 *  comes back into view. A check writes only once the player has opted in
 *  (set trivia up) and today has no pack yet.
 *
 *  A run that fails is retried later, never in a storm: in an hour when
 *  Claude is out of usage or signed out (the player can fix that outside
 *  the app), in half an hour otherwise — at most MAX_ATTEMPTS of those a
 *  day.
 *  A failed day is excused, so the streak survives Claude being away. */

import { useEffect, useSyncExternalStore } from "react";
import { parseTrivia, triviaPrompt } from "../ai";
import { getSetting } from "../settings";
import { claudeVersion, runJob, triviaDir } from "../tauri";
import { dayKey } from "../hatchery/game";
import { MIN_QUESTIONS, addPack, excuse, packFor, recentFacts, spendFreezes } from "./game";
import { verifyMedia } from "./media";
import { getTrivia, mutateTrivia } from "./store";
import { MIN_TOPICS, TOPIC } from "./topics";

const BOOT_DELAY_MS = 60_000;
const CHECK_MS = 15 * 60_000;
const MAX_ATTEMPTS = 3;

export type WriterStatus =
  | { kind: "idle" }
  /** `last` is what it's looking up right now. */
  | { kind: "writing"; searches: number; last: string }
  | { kind: "failed"; reason: FailReason; retryAt: number | null };

/** Why a run failed: no CLI, signed out, out of usage, or anything else. */
export type FailReason = "nocli" | "signin" | "usage" | "error";

let status: WriterStatus = { kind: "idle" };
const listeners = new Set<() => void>();
let running = false;
let retryAt = 0;
let attempts = { day: "", n: 0 };
let settledDay = "";

function setStatus(next: WriterStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function useTriviaWriter(): WriterStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

function classify(message: string): FailReason {
  if (/usage limit|limit reached|hit your limit|rate limit|out of (extra )?usage|credit balance/i.test(message)) {
    return "usage";
  }
  if (/\/login|log ?in|logged out|authenticat|api key|oauth/i.test(message)) return "signin";
  return "error";
}

class NoCli extends Error {}

/** Write today's pack if it's due. `force` skips the retry wait — the
 *  player asked. */
export async function checkTrivia(force = false): Promise<void> {
  const topics = getSetting("triviaTopics").filter((id) => TOPIC[id]);
  if (running || !getSetting("trivia") || topics.length < MIN_TOPICS) return;
  const now = new Date();
  const today = dayKey(now);
  if (settledDay !== today) {
    settledDay = today;
    mutateTrivia((s) => spendFreezes(s, today));
  }
  if (packFor(getTrivia(), today)) return;
  if (attempts.day !== today) attempts = { day: today, n: 0 };
  if (!force && (Date.now() < retryAt || attempts.n >= MAX_ATTEMPTS)) return;

  running = true;
  setStatus({ kind: "writing", searches: 0, last: "" });
  try {
    if (!(await claudeVersion().catch(() => null))) throw new NoCli();
    let searches = 0;
    const { result } = runJob(
      {
        prompt: triviaPrompt(topics, now, recentFacts(getTrivia())),
        cwd: await triviaDir(),
        model: getSetting("model") || null,
      },
      (e) => {
        if (e.type !== "tool" || (e.name !== "WebSearch" && e.name !== "WebFetch")) return;
        searches++;
        setStatus({ kind: "writing", searches, last: lookup(e.name, e.detail) });
      },
    );
    const done = await result;
    const parsed = parseTrivia(done.text, topics);
    if (parsed.length < MIN_QUESTIONS) throw new Error(`only ${parsed.length} usable questions`);
    const questions = await verifyMedia(parsed);
    mutateTrivia((s) => addPack(s, today, questions));
    setStatus({ kind: "idle" });
  } catch (e) {
    const reason = e instanceof NoCli ? "nocli" : classify(String((e as Error)?.message ?? e));
    console.warn("[trivia] writing today's pack failed:", reason, e);
    // Only runs that spent quota count toward the day's attempts; being
    // signed out or out of usage just waits for the player to sort it.
    if (reason === "error") attempts.n++;
    const wait = reason === "error" ? 30 * 60_000 : 60 * 60_000;
    const final = attempts.n >= MAX_ATTEMPTS;
    retryAt = Date.now() + wait;
    mutateTrivia((s) => excuse(s, today));
    setStatus({ kind: "failed", reason, retryAt: final ? null : retryAt });
  } finally {
    running = false;
  }
}

/** The query or site behind a web tool call, from its (maybe truncated)
 *  JSON input. */
function lookup(tool: string, detail: string): string {
  const field = tool === "WebSearch" ? "query" : "url";
  const m = detail.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)`));
  if (!m) return "";
  if (tool === "WebSearch") return m[1];
  try {
    return new URL(m[1]).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Mount once for the app's lifetime. */
export function useDailyTrivia() {
  useEffect(() => {
    const boot = window.setTimeout(() => void checkTrivia(), BOOT_DELAY_MS);
    const timer = window.setInterval(() => void checkTrivia(), CHECK_MS);
    const onShow = () => document.visibilityState === "visible" && void checkTrivia();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
}
