/** Per-document session: extraction pipeline, artifact persistence, and the
 *  cross-component surface (page jumps, "ask about selection", model choice). */

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
import type {
  Artifacts,
  DocMeta,
  DoneEvent,
  JobEvent,
  JobSpec,
  RegisteredDoc,
} from "./types";
import { emptyArtifacts } from "./types";
import {
  buildChapterFiles,
  extractPages,
  figureFileName,
  outlineChapters,
  pageHasFigures,
  renderPageJpegBase64,
  wholeDocChapter,
  type PdfDoc,
} from "./pdf";
import {
  readDocText,
  runJob,
  upsertLibraryEntry,
  writeDocBytes,
  writeDocText,
} from "./tauri";

export type PanelTab = "summary" | "quiz" | "chat" | "project";

export interface PanelRequest {
  tab: PanelTab;
  chatDraft?: string;
  autoSend?: boolean;
  nonce: number;
}

interface SessionValue {
  reg: RegisteredDoc;
  pdf: PdfDoc;
  meta: DocMeta | null;
  extractProgress: { done: number; total: number } | null;
  applyChapters: (chapters: { title: string; startPage: number }[]) => Promise<void>;

  artifacts: Artifacts;
  updateArtifacts: (fn: (a: Artifacts) => Artifacts) => void;

  model: string;
  setModel: (m: string) => void;

  currentPage: number;
  /** 1-based page texts from the extraction cache (lazy-loaded, memoized). */
  getPageTexts: (pages: number[]) => Promise<{ page: number; text: string }[]>;
  /** Report the visible page, optionally with the scroll offset within it
   *  (fraction of page height) so the exact position can be restored. */
  reportPage: (page: number, scroll?: number) => void;
  jumpToPage: (page: number) => void;
  registerJumper: (fn: (page: number) => void) => void;

  panelRequest: PanelRequest | null;
  openPanel: (tab: PanelTab, chatDraft?: string, autoSend?: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

const MODEL_KEY = "tutorai.model";

export function SessionProvider(props: {
  reg: RegisteredDoc;
  pdf: PdfDoc;
  fileName: string;
  children: ReactNode;
}) {
  const { reg, pdf, fileName } = props;
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [artifacts, setArtifacts] = useState<Artifacts>(emptyArtifacts());
  const [artifactsLoaded, setArtifactsLoaded] = useState(false);
  const [model, setModelState] = useState(() => localStorage.getItem(MODEL_KEY) ?? "");
  const [currentPage, setCurrentPage] = useState(1);
  const [panelRequest, setPanelRequest] = useState<PanelRequest | null>(null);
  const jumperRef = useRef<(page: number) => void>(() => {});
  const persistTimer = useRef<number>(undefined);

  // ── Extraction: cached meta or full pipeline ─────────────────────────
  useEffect(() => {
    let stale = false;
    (async () => {
      const cached = await readDocText(reg.docId, "meta.json");
      if (stale) return;
      if (cached) {
        setMeta(JSON.parse(cached));
        return;
      }
      const info = (await pdf.getMetadata().catch(() => null)) as
        | { info?: { Title?: string } }
        | null;
      const title = info?.info?.Title?.trim() || fileName.replace(/\.pdf$/i, "");

      setExtractProgress({ done: 0, total: pdf.numPages });
      const [chapters, pages] = await Promise.all([
        outlineChapters(pdf),
        extractPages(pdf, (done, total) => !stale && setExtractProgress({ done, total })),
      ]);
      if (stale) return;

      const finalChapters = chapters.length ? chapters : [wholeDocChapter(pdf.numPages)];
      const newMeta: DocMeta = {
        title,
        pages: pdf.numPages,
        chapters: finalChapters,
        chaptersSource: chapters.length ? "outline" : "none",
        extractedAt: Date.now(),
      };
      await writeDocText(reg.docId, "pages.json", JSON.stringify(pages));
      for (const file of buildChapterFiles(pages, finalChapters)) {
        await writeDocText(reg.docId, file.rel, file.content);
      }
      await writeDocText(reg.docId, "meta.json", JSON.stringify(newMeta));
      if (!stale) {
        setExtractProgress(null);
        setMeta(newMeta);
      }
    })().catch((e) => console.error("extraction failed", e));
    return () => {
      stale = true;
    };
  }, [reg.docId, pdf, fileName]);

  // ── Figure images: give the AI eyes ──────────────────────────────────
  // Text extraction drops figures, charts, and diagrams. After indexing,
  // render every figure-bearing page to a JPEG in the doc cache so headless
  // Claude can Read them. One pass per document; figures.json marks it done.
  useEffect(() => {
    if (!meta) return;
    let stale = false;
    (async () => {
      if (await readDocText(reg.docId, "figures.json")) return;
      const MAX_FIGURES = 200;
      const figurePages: number[] = [];
      let truncated = false;
      for (let p = 1; p <= pdf.numPages && !stale; p++) {
        if (!(await pageHasFigures(pdf, p))) continue;
        if (figurePages.length >= MAX_FIGURES) {
          truncated = true;
          break;
        }
        const jpeg = await renderPageJpegBase64(pdf, p);
        if (stale) return;
        await writeDocBytes(reg.docId, figureFileName(p), jpeg);
        figurePages.push(p);
        // Breathe between renders; this competes with the visible reader.
        await new Promise((r) => setTimeout(r, 25));
      }
      if (!stale) {
        await writeDocText(
          reg.docId,
          "figures.json",
          JSON.stringify({ pages: figurePages, truncated }),
        );
      }
    })().catch((e) => console.error("figure rendering failed", e));
    return () => {
      stale = true;
    };
  }, [meta, reg.docId, pdf]);

  // Keep the library index fresh. The reading position (page + scroll offset
  // within it) is saved as it changes (debounced) — the app may quit without
  // ever unmounting this provider (e.g. closing the window mid-read), so
  // saving only on unmount would lose it. The unmount save is a final flush.
  // The scroll fraction lives in a ref: it changes on every scroll frame and
  // must not re-render the app the way currentPage (which is displayed) does.
  const scrollRef = useRef(0);
  const latest = useRef({ meta, currentPage });
  latest.current = { meta, currentPage };
  const savePosition = useCallback(() => {
    const { meta, currentPage } = latest.current;
    if (!meta) return;
    upsertLibraryEntry({
      docId: reg.docId,
      path: reg.path,
      title: meta.title,
      pages: meta.pages,
      addedAt: 0,
      lastOpenedAt: 0,
      lastPage: currentPage,
      lastScroll: scrollRef.current,
    }).catch(() => {});
  }, [reg.docId, reg.path]);
  const positionTimer = useRef<number>(undefined);
  const schedulePositionSave = useCallback(() => {
    window.clearTimeout(positionTimer.current);
    positionTimer.current = window.setTimeout(savePosition, 500);
  }, [savePosition]);
  useEffect(() => {
    if (meta) schedulePositionSave();
  }, [meta, currentPage, schedulePositionSave]);
  useEffect(
    () => () => {
      window.clearTimeout(positionTimer.current);
      savePosition();
    },
    [savePosition],
  );

  // ── Artifacts: load once, persist debounced ──────────────────────────
  useEffect(() => {
    let stale = false;
    readDocText(reg.docId, "artifacts.json")
      .then((text) => {
        if (stale) return;
        if (text) {
          const loaded: Artifacts = { ...emptyArtifacts(), ...JSON.parse(text) };
          // A project still "running" from a previous app session is dead.
          loaded.projects = loaded.projects.map((p) =>
            p.status === "running" ? { ...p, status: "failed" } : p,
          );
          setArtifacts(loaded);
        }
        setArtifactsLoaded(true);
      })
      .catch(() => setArtifactsLoaded(true));
    return () => {
      stale = true;
    };
  }, [reg.docId]);

  const updateArtifacts = useCallback(
    (fn: (a: Artifacts) => Artifacts) => {
      setArtifacts((prev) => {
        const next = fn(prev);
        window.clearTimeout(persistTimer.current);
        persistTimer.current = window.setTimeout(() => {
          writeDocText(reg.docId, "artifacts.json", JSON.stringify(next)).catch(() => {});
        }, 400);
        return next;
      });
    },
    [reg.docId],
  );
  void artifactsLoaded;

  // ── Chapter override (AI detection) ──────────────────────────────────
  const applyChapters = useCallback(
    async (starts: { title: string; startPage: number }[]) => {
      if (!meta) return;
      const usable = starts.filter((s) => s.startPage >= 1 && s.startPage <= meta.pages);
      const chapters = usable.length
        ? usable.map((s, i) => ({
            title: s.title,
            startPage: i === 0 ? 1 : s.startPage,
            endPage: i + 1 < usable.length ? usable[i + 1].startPage - 1 : meta.pages,
          }))
        : [wholeDocChapter(meta.pages)];
      const pagesText = await readDocText(reg.docId, "pages.json");
      if (!pagesText) return;
      const pages: string[] = JSON.parse(pagesText);
      for (const file of buildChapterFiles(pages, chapters)) {
        await writeDocText(reg.docId, file.rel, file.content);
      }
      const newMeta: DocMeta = {
        ...meta,
        chapters,
        chaptersSource: usable.length ? "ai" : "none",
      };
      await writeDocText(reg.docId, "meta.json", JSON.stringify(newMeta));
      setMeta(newMeta);
    },
    [meta, reg.docId],
  );

  // ── Cross-component plumbing ─────────────────────────────────────────
  const setModel = useCallback((m: string) => {
    localStorage.setItem(MODEL_KEY, m);
    setModelState(m);
  }, []);

  // Lazy page-text access for "what I'm reading" chat context.
  const pagesCache = useRef<string[] | null>(null);
  const getPageTexts = useCallback(
    async (pages: number[]) => {
      if (!pagesCache.current) {
        const text = await readDocText(reg.docId, "pages.json");
        pagesCache.current = text ? (JSON.parse(text) as string[]) : [];
      }
      const all = pagesCache.current;
      return pages
        .filter((p) => p >= 1 && p <= all.length)
        .map((p) => ({ page: p, text: all[p - 1] }));
    },
    [reg.docId],
  );

  const registerJumper = useCallback((fn: (page: number) => void) => {
    jumperRef.current = fn;
  }, []);
  const jumpToPage = useCallback((page: number) => jumperRef.current(page), []);
  const reportPage = useCallback(
    (page: number, scroll?: number) => {
      if (scroll !== undefined) {
        scrollRef.current = scroll;
        // Within-page scrolls don't change currentPage, so the effect above
        // won't fire — schedule the save here.
        schedulePositionSave();
      }
      setCurrentPage(page);
    },
    [schedulePositionSave],
  );

  const openPanel = useCallback((tab: PanelTab, chatDraft?: string, autoSend?: boolean) => {
    setPanelRequest({ tab, chatDraft, autoSend, nonce: Date.now() });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      reg,
      pdf,
      meta,
      extractProgress,
      applyChapters,
      artifacts,
      updateArtifacts,
      model,
      setModel,
      currentPage,
      getPageTexts,
      reportPage,
      jumpToPage,
      registerJumper,
      panelRequest,
      openPanel,
    }),
    [reg, pdf, meta, extractProgress, applyChapters, artifacts, updateArtifacts,
     model, setModel, currentPage, getPageTexts, reportPage, jumpToPage,
     registerJumper, panelRequest, openPanel],
  );

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>;
}

// ── Job hook: one in-flight Claude run with streamed state ─────────────

export interface ActivityItem {
  name: string;
  detail: string;
  done: boolean;
  isError: boolean;
}

export interface JobState {
  running: boolean;
  text: string;
  activity: ActivityItem[];
  error: string | null;
}

const idleJob: JobState = { running: false, text: "", activity: [], error: null };

export function useClaudeJob() {
  const [state, setState] = useState<JobState>(idleJob);
  const cancelRef = useRef<(() => void) | null>(null);
  // Streamed text is buffered here and revealed by a rAF ticker a few
  // characters per frame — network chunks arrive in bursts, and rendering
  // them raw makes the text jump. The reveal rate scales with the backlog
  // so display never falls behind generation.
  const streamRef = useRef({ target: "", shown: 0, raf: 0 });

  const tick = useCallback(() => {
    const s = streamRef.current;
    const backlog = s.target.length - s.shown;
    if (backlog <= 0) {
      s.raf = 0;
      return;
    }
    s.shown = Math.min(s.target.length, s.shown + Math.max(2, Math.ceil(backlog / 24)));
    const text = s.target.slice(0, s.shown);
    setState((prev) => ({ ...prev, text }));
    s.raf = requestAnimationFrame(tick);
  }, []);

  const flush = useCallback(() => {
    const s = streamRef.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.shown = s.target.length;
  }, []);

  useEffect(() => flush, [flush]);

  const start = useCallback(
    (spec: JobSpec): Promise<DoneEvent> => {
      streamRef.current = { target: "", shown: 0, raf: 0 };
      setState({ ...idleJob, running: true });
      const handle = runJob(spec, (event: JobEvent) => {
        if (event.type === "delta") {
          const s = streamRef.current;
          s.target += event.text;
          if (!s.raf) s.raf = requestAnimationFrame(tick);
          return;
        }
        setState((prev) => {
          switch (event.type) {
            case "tool":
              return {
                ...prev,
                activity: [
                  ...prev.activity,
                  { name: event.name, detail: event.detail, done: false, isError: false },
                ],
              };
            case "toolDone": {
              const activity = [...prev.activity];
              const i = activity.findLastIndex((a) => !a.done);
              if (i >= 0) activity[i] = { ...activity[i], done: true, isError: event.isError };
              return { ...prev, activity };
            }
            default:
              return prev;
          }
        });
      });
      cancelRef.current = handle.cancel;
      return handle.result
        .then((done) => {
          flush();
          setState((prev) => ({ ...prev, running: false, text: streamRef.current.target }));
          return done;
        })
        .catch((e: Error) => {
          flush();
          setState((prev) => ({
            ...prev,
            running: false,
            text: streamRef.current.target,
            error: e.message,
          }));
          throw e;
        })
        .finally(() => {
          cancelRef.current = null;
        });
    },
    [tick, flush],
  );

  const cancel = useCallback(() => cancelRef.current?.(), []);
  const reset = useCallback(() => setState(idleJob), []);

  return { state, start, cancel, reset };
}
