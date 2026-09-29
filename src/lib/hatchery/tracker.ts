/** Counts *active* reading time and pages actually read, for the hatchery.
 *
 *  Time only accrues while the window is visible and focused and the user
 *  has touched the reader recently (scroll, wheel, keys, pointer, selection)
 *  — leaving a book open overnight earns nothing. A page only counts once the
 *  reader has dwelled on it for PAGE_DWELL_MS of that active time, the same
 *  idea as Pokémon GO's walking-speed cap: flicking through a book doesn't
 *  hatch eggs.
 *
 *  Pace is the exception: a slow reader may sit on a page for minutes without
 *  touching anything, so time on a page already read keeps counting toward
 *  the sitting's pace while the reader is on screen (with some input in the
 *  last few minutes) — that's what frost measures. */

import { useEffect, useRef } from "react";
import { useSession } from "../session";
import { noteDwell, noteHabit, pageRead, tick } from "./game";
import type { Habit } from "./game";
import { getSetting } from "../settings";
import { mutate, setReaderActive } from "./store";

const TICK_MS = 5000;
/** No input for this long = not reading. */
const IDLE_MS = 90_000;
/** Still "on the page" for pace, without input, for this long. */
const LOOKING_MS = 5 * 60_000;
const PAGE_DWELL_MS = 8000;

let lastInput = 0;
const touch = () => {
  lastInput = Date.now();
};

/** Record a study habit (highlight, dictionary lookup, correct quiz answer,
 *  question to the tutor). Also counts as reader activity. A no-op with the
 *  hatchery turned off. */
export function recordHabit(habit: Habit) {
  if (!getSetting("hatchery")) return;
  touch();
  mutate((s) => noteHabit(s, habit));
}

/** Mount once inside a document session, only while the hatchery is on —
 *  unmounted, it costs nothing: no listeners, no timer. */
export function useReadingTracker() {
  const { reg, meta, currentPage } = useSession();
  const ctx = useRef({ docId: reg.docId, meta, currentPage });
  ctx.current = { docId: reg.docId, meta, currentPage };
  // `ms` is active time (decides when the page counts as read), `seen` is
  // time on screen (the page's share of the sitting's pace).
  const dwell = useRef({ page: currentPage, ms: 0, seen: 0, counted: false });

  // A page change is itself activity, and restarts the dwell clock.
  useEffect(() => {
    touch();
    dwell.current = { page: currentPage, ms: 0, seen: 0, counted: false };
  }, [currentPage]);

  useEffect(() => {
    const opts = { passive: true, capture: true } as const;
    const kinds = ["wheel", "keydown", "pointerdown", "scroll", "selectionchange"] as const;
    kinds.forEach((k) => document.addEventListener(k, touch, opts));
    // Pointer movement is noisy; sample it.
    let lastMove = 0;
    const move = () => {
      const now = Date.now();
      if (now - lastMove > 2000) {
        lastMove = now;
        touch();
      }
    };
    document.addEventListener("pointermove", move, opts);
    touch();

    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      // Clamp: a suspended laptop must not credit the whole sleep.
      const ms = Math.min(now - last, TICK_MS * 2);
      last = now;
      const onScreen = document.visibilityState === "visible" && document.hasFocus();
      const active = onScreen && now - lastInput < IDLE_MS;
      const looking = onScreen && now - lastInput < LOOKING_MS;
      setReaderActive(active);
      if (!looking) return;
      const { docId, meta, currentPage } = ctx.current;
      const d = dwell.current;
      const key = `${docId}:${d.page}`;
      d.seen += ms;
      if (!active) {
        if (d.counted) mutate((s) => noteDwell(s, key, ms));
        return;
      }
      const where = meta ? { title: meta.title, page: currentPage } : undefined;
      d.ms += ms;
      const readNow = !d.counted && d.ms >= PAGE_DWELL_MS && meta;
      const wasCounted = d.counted;
      if (readNow) d.counted = true;
      mutate((s) => {
        const events = tick(s, ms, new Date(now), where);
        // tick() may have started a new sitting; record the page after it.
        if (readNow) noteDwell(s, key, d.seen);
        else if (wasCounted) noteDwell(s, key, ms);
        if (readNow && meta) {
          events.push(
            ...pageRead(s, docId, d.page, {
              title: meta.title, pages: meta.pages, chapters: meta.chapters,
            }, new Date(now)),
          );
        }
        return events;
      });
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
      kinds.forEach((k) => document.removeEventListener(k, touch, opts));
      document.removeEventListener("pointermove", move, opts);
      setReaderActive(false);
    };
  }, []);
}
