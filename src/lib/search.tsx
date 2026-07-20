/** Document search (Ctrl+F): owns the query, the match list, the focused
 *  match, and lazily computed per-page highlight rects. SearchBar (the find
 *  UI + results panel) and SearchHighlights (per-page overlay) both render
 *  from here. Lives under SessionProvider — one search per open document.
 *
 *  Two tiers keep it light: matching runs over the folded pages.json corpus
 *  (whole document, milliseconds); highlight geometry is computed per page
 *  from pdf.js text items only for pages that need it (mounted pages and
 *  jump targets) and cached until the query changes. */

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
  DocSearcher,
  pageMatchRects,
  type SearchMatch,
  type SearchResult,
  type Snippet,
} from "./searchCore";
import { useSession } from "./session";
import type { FracRect } from "./types";

const DEBOUNCE_MS = 140;

interface SearchValue {
  open: boolean;
  /** Bumped on every openSearch so the bar refocuses even when already open. */
  focusNonce: number;
  openSearch: () => void;
  closeSearch: () => void;
  /** Live input text; the search itself runs debounced behind it. */
  query: string;
  setQuery: (q: string) => void;
  /** null while the query is empty; matches capped, total exact. */
  result: SearchResult | null;
  /** Corpus not built yet (first-open extraction may still be running). */
  indexing: boolean;
  /** The document has no extractable text at all (e.g. a scanned PDF). */
  noText: boolean;
  focusedIdx: number;
  focusedMatch: SearchMatch | null;
  /** Focus match #idx and scroll the reader to it. */
  focusMatch: (idx: number) => void;
  step: (dir: 1 | -1) => void;
  snippetFor: (m: SearchMatch) => Snippet;
  /** Does this page have matches? (Drives which pages compute geometry.) */
  pageHasMatches: (page: number) => boolean;
  /** Rects for a page's matches if already computed — render-safe read. */
  peekRects: (page: number) => FracRect[][] | undefined;
  /** Kick geometry for a page; no-op when cached or in flight. */
  ensureRects: (page: number) => void;
}

const SearchContext = createContext<SearchValue | null>(null);

export function useSearch(): SearchValue {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearch outside SearchProvider");
  return value;
}

export function SearchProvider(props: { children: ReactNode }) {
  const { meta, pdf, getPageTexts, jumpToPage, currentPage } = useSession();
  const [open, setOpen] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [searcher, setSearcher] = useState<DocSearcher | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  // Bumped when a page's rects land; a context-value dep, so peekRects
  // readers re-render even though the rect map itself lives in a ref.
  const [rectsVersion, setRectsVersion] = useState(0);

  const rects = useRef(new Map<number, FracRect[][]>());
  const rectJobs = useRef(new Map<number, Promise<FracRect[][]>>());
  // Bumped per search run; in-flight geometry from a stale query is dropped.
  const generation = useRef(0);

  // Where the seeding selection sat, in page fractions. The first search
  // after a selection-seeded Ctrl+F focuses the occurrence under it — the
  // page can hold several matches, and "first hit on the page" would focus
  // a different one than the text the user selected.
  const seedRef = useRef<{ page: number; x: number; y: number } | null>(null);

  // Raw query of the last executed search run. Re-running the same query
  // (the panel re-opening bumps the effect) would rebuild rects and re-jump
  // for an identical result — skip it and keep focus where it was.
  const ranQueryRef = useRef<string | null>(null);

  // Document position the next search run picks its focus from: the spot of
  // the currently focused match, moved only by explicit navigation and by
  // opening the panel. Never the live scroll position — each run's jump
  // animates the scroll, and choosing focus from mid-animation samples sent
  // the view lurching in a fresh direction on every keystroke.
  const focusAnchorRef = useRef<{ page: number; start: number }>({ page: 1, start: 0 });

  // Refs for values read inside stable callbacks.
  const pageRef = useRef(currentPage);
  pageRef.current = currentPage;
  const resultRef = useRef(result);
  resultRef.current = result;
  const focusedRef = useRef(focusedIdx);
  focusedRef.current = focusedIdx;
  const openRef = useRef(open);
  openRef.current = open;
  const queryRef = useRef(query);
  queryRef.current = query;

  // Corpus: built once, on the first search after extraction has produced
  // pages.json (`meta` set ⇒ pages.json exists). Folding a big book costs
  // tens of ms, paid on the first Ctrl+F, never per keystroke.
  useEffect(() => {
    if (!open || !meta || searcher) return;
    let stale = false;
    const all = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
    getPageTexts(all)
      .then((texts) => {
        if (stale) return;
        const byPage = new Array<string>(pdf.numPages).fill("");
        for (const t of texts) byPage[t.page - 1] = t.text;
        setSearcher(new DocSearcher(byPage));
      })
      .catch((e) => console.error("search corpus failed", e));
    return () => {
      stale = true;
    };
  }, [open, meta, searcher, pdf, getPageTexts]);

  const ensureRectsFor = useCallback(
    (page: number): Promise<FracRect[][]> | null => {
      const res = resultRef.current;
      if (!res) return null;
      const hit = rects.current.get(page);
      if (hit) return Promise.resolve(hit);
      const running = rectJobs.current.get(page);
      if (running) return running;
      const gen = generation.current;
      const job = pageMatchRects(pdf, page, res.query)
        .then((groups) => {
          if (generation.current === gen) {
            rectJobs.current.delete(page);
            rects.current.set(page, groups);
            setRectsVersion((v) => v + 1);
          }
          return groups;
        })
        .catch(() => {
          rectJobs.current.delete(page);
          return [] as FracRect[][];
        });
      rectJobs.current.set(page, job);
      return job;
    },
    [pdf],
  );

  const focusMatch = useCallback(
    (idx: number, scroll = true) => {
      const m = resultRef.current?.matches[idx];
      if (!m) return;
      setFocusedIdx(idx);
      focusedRef.current = idx; // sync now — the rect job below races the re-render
      focusAnchorRef.current = { page: m.page, start: m.start };
      if (!scroll) return;
      const gen = generation.current;
      void ensureRectsFor(m.page)?.then((groups) => {
        // Jump only if this is still the focused match: rect jobs for
        // different pages resolve out of order, and a slow one must not
        // yank the view back to a match the user has already moved past.
        if (generation.current !== gen || focusedRef.current !== idx) return;
        const rect = groups[m.ord]?.[0];
        // Land the match about a third of a page below the viewport top.
        jumpToPage(m.page, rect ? Math.max(0, rect.y - 0.3) : undefined);
      });
    },
    [ensureRectsFor, jumpToPage],
  );

  // Debounced search execution. Focus starts at the first match at or after
  // the focus anchor: the reading position when the panel opens, then the
  // focused match itself while the query is being refined.
  useEffect(() => {
    if (!searcher || !open) return;
    const timer = window.setTimeout(() => {
      const seed = seedRef.current;
      seedRef.current = null;
      // Selection-seeded: focus the occurrence whose rect is nearest to
      // where the selection sat (for the selected one, distance ≈ 0).
      // Without scrolling — the seed is text the user just selected, so it
      // is already on screen, and a jump aimed while the panel is still
      // sliding open visibly overshoots and comes back.
      const focusSeeded = (res: SearchResult, s: NonNullable<typeof seed>) => {
        if (!res.matches.some((m) => m.page === s.page)) return false;
        const gen = generation.current;
        void ensureRectsFor(s.page)?.then((groups) => {
          if (generation.current !== gen) return;
          let best = -1;
          let bestD = Infinity;
          res.matches.forEach((m, i) => {
            if (m.page !== s.page) return;
            const r = groups[m.ord]?.[0];
            if (!r) return;
            const d = (r.x - s.x) ** 2 + (r.y - s.y) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          if (best < 0) best = res.matches.findIndex((m) => m.page === s.page);
          focusMatch(best, false);
        });
        return true;
      };
      // Same query as the last run (panel reopened): result, rects and
      // focus are all still valid — at most a seed retargets focus.
      if (ranQueryRef.current === query && resultRef.current) {
        if (seed) focusSeeded(resultRef.current, seed);
        return;
      }
      ranQueryRef.current = query;
      generation.current++;
      rects.current = new Map();
      rectJobs.current = new Map();
      const res = searcher.search(query);
      resultRef.current = res; // focusMatch below runs before the re-render
      setResult(res);
      setRectsVersion((v) => v + 1);
      if (!res?.matches.length) {
        setFocusedIdx(-1);
        return;
      }
      if (seed && focusSeeded(res, seed)) return;
      // First match at or after the anchor. Extending the query keeps the
      // focused occurrence in place (its start doesn't change), so refining
      // a search never moves the view until the occurrence stops matching.
      const a = focusAnchorRef.current;
      let idx = res.matches.findIndex(
        (m) => m.page > a.page || (m.page === a.page && m.start >= a.start),
      );
      if (idx < 0) idx = 0;
      focusMatch(idx);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, searcher, open, focusMatch, ensureRectsFor]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const n = resultRef.current?.matches.length ?? 0;
      if (!n) return;
      focusMatch((Math.max(focusedRef.current, 0) + dir + n) % n);
    },
    [focusMatch],
  );

  const openSearch = useCallback(() => {
    // A live text selection seeds the query, like browser find — and anchors
    // the initial focus to that exact occurrence via seedRef.
    seedRef.current = null;
    focusAnchorRef.current = { page: pageRef.current, start: 0 };
    const selection = window.getSelection();
    const sel = selection?.toString().replace(/\s+/g, " ").trim();
    if (selection && sel && sel.length <= 120) {
      setQuery(sel);
      if (sel !== queryRef.current) {
        // Seeding replaces the query outright — drop the old one's overlays
        // now, or they flash on the previous word and hop to the new one
        // when the debounced run lands.
        generation.current++;
        rects.current = new Map();
        rectJobs.current = new Map();
        resultRef.current = null;
        setResult(null);
        setFocusedIdx(-1);
        setRectsVersion((v) => v + 1);
      }
      const start = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const node = start?.startContainer;
      const el = node instanceof Element ? node : (node?.parentElement ?? null);
      const pageEl = el?.closest<HTMLElement>("[data-page]");
      // Fractions are measured against .page-inner — the box match rects
      // are relative to (the [data-page] wrapper can be larger).
      const inner = el?.closest<HTMLElement>(".page-inner");
      if (start && pageEl && inner) {
        const r = start.getBoundingClientRect();
        const p = inner.getBoundingClientRect();
        if (r.width > 0 && p.width > 0 && p.height > 0) {
          seedRef.current = {
            page: Number(pageEl.dataset.page),
            x: (r.left - p.left) / p.width,
            y: (r.top - p.top) / p.height,
          };
        }
      }
    }
    setOpen(true);
    setFocusNonce((n) => n + 1);
  }, []);
  const closeSearch = useCallback(() => setOpen(false), []);

  // Typing a query by hand retargets focus to the reading position — a
  // selection anchor from an earlier Ctrl+F must not hijack it.
  const setQueryFromInput = useCallback((q: string) => {
    seedRef.current = null;
    setQuery(q);
  }, []);

  // Shortcuts. Capture phase so an open search consumes Escape before the
  // annotation layer's window listener sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (!openRef.current) return;
      if (e.key === "F3" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g")) {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === "Escape") {
        const t = e.target;
        const el = t instanceof HTMLElement ? t : null;
        const editing =
          el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
        // Escape inside another editor (chat box, note card…) is theirs.
        if (editing && !el.closest(".search-panel")) return;
        e.preventDefault();
        e.stopPropagation();
        closeSearch();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openSearch, step, closeSearch]);

  const matchPages = useMemo(() => {
    const pages = new Set<number>();
    for (const m of result?.matches ?? []) pages.add(m.page);
    return pages;
  }, [result]);
  const pageHasMatches = useCallback(
    // Past the cap the match list goes silent, but geometry is independent —
    // let every page probe (capped queries are single-letter noise anyway).
    (page: number) => matchPages.has(page) || (result?.capped ?? false),
    [matchPages, result],
  );

  const snippetFor = useCallback(
    (m: SearchMatch): Snippet =>
      searcher ? searcher.snippet(m) : { before: "", hit: "", after: "" },
    [searcher],
  );
  const peekRects = useCallback((page: number) => rects.current.get(page), []);
  const ensureRects = useCallback(
    (page: number) => {
      void ensureRectsFor(page);
    },
    [ensureRectsFor],
  );

  const value = useMemo<SearchValue>(
    () => ({
      open,
      focusNonce,
      openSearch,
      closeSearch,
      query,
      setQuery: setQueryFromInput,
      result,
      indexing: !searcher,
      noText: searcher ? !searcher.hasText : false,
      focusedIdx,
      focusedMatch: result?.matches[focusedIdx] ?? null,
      focusMatch,
      step,
      snippetFor,
      pageHasMatches,
      peekRects,
      ensureRects,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rectsVersion
    // invalidates peekRects reads (the rect map lives in a ref).
    [open, focusNonce, openSearch, closeSearch, query, setQueryFromInput, result, searcher,
     focusedIdx, focusMatch, step, snippetFor, pageHasMatches, peekRects, ensureRects,
     rectsVersion],
  );

  return <SearchContext.Provider value={value}>{props.children}</SearchContext.Provider>;
}
