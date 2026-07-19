/** The reading companion: opt-in proactive analysis of whatever the reader is
 *  looking at, producing margin notes (see PageInsights).
 *
 *  Spend discipline — every run costs the user's own Claude quota:
 *  chapters are split into spans of ≤ 8 pages; a span runs only after the
 *  reader dwells on it (plus one span of read-ahead); one job in flight at a
 *  time; results and empty verdicts are cached in artifacts.json forever, so
 *  no span is ever paid for twice. Failed spans are skipped for the session. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  insightsPrompt,
  NOTES_FILE,
  notesFileContent,
  parseInsights,
  type InsightSpan,
} from "./ai";
import { wholeDocChapter } from "./pdf";
import { useSession } from "./session";
import { getSetting, saveSetting } from "./settings";
import { readDocText, runJob, writeDocText } from "./tauri";
import type { DocMeta, Insight } from "./types";

const SPAN_PAGES = 8;
const DWELL_MS = 8_000;

/** Chapter-aligned page spans of at most SPAN_PAGES, evenly cut. */
function buildSpans(meta: DocMeta): InsightSpan[] {
  const chapters = meta.chapters.length ? meta.chapters : [wholeDocChapter(meta.pages)];
  const spans: InsightSpan[] = [];
  for (const ch of chapters) {
    const len = ch.endPage - ch.startPage + 1;
    const parts = Math.max(1, Math.ceil(len / SPAN_PAGES));
    const per = Math.ceil(len / parts);
    for (let start = ch.startPage; start <= ch.endPage; start += per) {
      spans.push({
        startPage: start,
        endPage: Math.min(start + per - 1, ch.endPage),
        title: ch.title,
      });
    }
  }
  return spans;
}

const spanKey = (s: InsightSpan) => `p${s.startPage}-${s.endPage}`;

interface InsightsValue {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Span currently being analyzed, if any — the "companion is reading" signal. */
  reading: InsightSpan | null;
  notesByPage: Map<number, Insight[]>;
  dismiss: (id: string) => void;
  /** Hand a note to the chat tab as a conversation seed. */
  discuss: (note: Insight) => void;
}

const InsightsContext = createContext<InsightsValue | null>(null);

export function useInsights(): InsightsValue {
  const value = useContext(InsightsContext);
  if (!value) throw new Error("useInsights outside InsightsProvider");
  return value;
}

export function InsightsProvider(props: { children: ReactNode }) {
  const { reg, meta, artifacts, updateArtifacts, model, currentPage, getPageTexts, openPanel } =
    useSession();
  const insights = artifacts.insights;
  // The switch is an app-wide preference; mirrored in state for reactivity.
  const [enabled, setEnabledState] = useState(() => getSetting("companion"));
  const [reading, setReading] = useState<InsightSpan | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const failedRef = useRef(new Set<string>());

  const spans = useMemo(() => (meta ? buildSpans(meta) : []), [meta]);
  const spanIdx = useMemo(
    () => spans.findIndex((s) => currentPage >= s.startPage && currentPage <= s.endPage),
    [spans, currentPage],
  );

  // Snapshot for the async runner, so it reads current values without being
  // re-created (and re-triggering the scheduler) on every artifacts change.
  const latest = useRef({ meta, model, insights });
  latest.current = { meta, model, insights };

  const runSpan = useCallback(
    async (span: InsightSpan) => {
      const { meta, model, insights } = latest.current;
      if (!meta) return;
      setReading(span);
      try {
        const pages = Array.from(
          { length: span.endPage - span.startPage + 1 },
          (_, i) => span.startPage + i,
        );
        const texts = await getPageTexts(pages);
        if (!texts.length) return; // extraction not on disk yet; dwell re-arms
        const figurePages = await readDocText(reg.docId, "figures.json")
          .then((t): number[] => (t ? (JSON.parse(t) as { pages: number[] }).pages : []))
          .catch(() => [])
          .then((all) => all.filter((p) => p >= span.startPage && p <= span.endPage));
        const handle = runJob({
          prompt: insightsPrompt(
            meta,
            span,
            texts,
            figurePages,
            insights.notes.map((n) => n.title),
          ),
          cwd: reg.docDir,
          model: model || null,
        });
        cancelRef.current = handle.cancel;
        const done = await handle.result;
        const notes = parseInsights(done.text, span, texts);
        updateArtifacts((a) => ({
          ...a,
          insights: {
            ...a.insights,
            notes: [...a.insights.notes, ...notes],
            sections: {
              ...a.insights.sections,
              [spanKey(span)]: notes.length ? "done" : "empty",
            },
          },
        }));
      } catch (e) {
        // Cancelled = the reader toggled off / left; anything else is a real
        // failure — skip the span for this session rather than retry-storm.
        if (!String(e).includes("cancelled")) {
          console.error("insights run failed", e);
          failedRef.current.add(spanKey(span));
        }
      } finally {
        cancelRef.current = null;
        setReading(null);
      }
    },
    [reg, getPageTexts, updateArtifacts],
  );

  // Dwell scheduler: after the reader settles on a span, analyze it, then the
  // one after it (read-ahead), then rest. Keyed on the span index — page
  // turns within a span don't reset the clock; leaving a span does.
  useEffect(() => {
    if (!enabled || spanIdx < 0 || reading) return;
    const target = [spans[spanIdx], spans[spanIdx + 1]].find(
      (s) => s && !insights.sections[spanKey(s)] && !failedRef.current.has(spanKey(s)),
    );
    if (!target) return;
    const timer = window.setTimeout(() => void runSpan(target), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, insights.sections, spans, spanIdx, reading, runSpan]);

  // Kill the in-flight job when the document closes.
  useEffect(() => () => cancelRef.current?.(), []);

  // Mirror the notes into the doc dir so the chat agent can Read them
  // (chatSystemPreamble points it at this file). artifacts.json stays the
  // source of truth; this is a projection, refreshed on every add/dismiss
  // and on mount (which backfills docs annotated before the file existed).
  useEffect(() => {
    writeDocText(reg.docId, NOTES_FILE, notesFileContent(insights.notes)).catch((e) =>
      console.error("notes mirror failed", e),
    );
  }, [reg.docId, insights.notes]);

  const setEnabled = useCallback((on: boolean) => {
    if (!on) cancelRef.current?.();
    saveSetting("companion", on);
    setEnabledState(on);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      updateArtifacts((a) => ({
        ...a,
        insights: { ...a.insights, notes: a.insights.notes.filter((n) => n.id !== id) },
      }));
    },
    [updateArtifacts],
  );

  const discuss = useCallback(
    (note: Insight) => {
      openPanel(
        "chat",
        `Your margin note on page ${note.page} says:\n"${note.title} — ${note.body}"\n\n`,
        false,
      );
    },
    [openPanel],
  );

  const notesByPage = useMemo(() => {
    const map = new Map<number, Insight[]>();
    for (const note of insights.notes) {
      const list = map.get(note.page);
      if (list) list.push(note);
      else map.set(note.page, [note]);
    }
    for (const list of map.values()) list.sort((a, b) => a.y - b.y);
    return map;
  }, [insights.notes]);

  const value = useMemo<InsightsValue>(
    () => ({ enabled, setEnabled, reading, notesByPage, dismiss, discuss }),
    [enabled, setEnabled, reading, notesByPage, dismiss, discuss],
  );

  return <InsightsContext.Provider value={value}>{props.children}</InsightsContext.Provider>;
}
