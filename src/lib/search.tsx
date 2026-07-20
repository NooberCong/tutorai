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

  // Refs for values read inside stable callbacks.
  const pageRef = useRef(currentPage);
  pageRef.current = currentPage;
  const resultRef = useRef(result);
  resultRef.current = result;
  const focusedRef = useRef(focusedIdx);
  focusedRef.current = focusedIdx;
  const openRef = useRef(open);
  openRef.current = open;

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
    (idx: number) => {
      const m = resultRef.current?.matches[idx];
      if (!m) return;
      setFocusedIdx(idx);
      const gen = generation.current;
      void ensureRectsFor(m.page)?.then((groups) => {
        if (generation.current !== gen) return;
        const rect = groups[m.ord]?.[0];
        // Land the match about a third of a page below the viewport top.
        jumpToPage(m.page, rect ? Math.max(0, rect.y - 0.3) : undefined);
      });
    },
    [ensureRectsFor, jumpToPage],
  );

  // Debounced search execution. Focus starts at the first match at or after
  // the page being read, so Ctrl+F lands on the closest hit, not page 1.
  useEffect(() => {
    if (!searcher || !open) return;
    const timer = window.setTimeout(() => {
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
      let idx = res.matches.findIndex((m) => m.page >= pageRef.current);
      if (idx < 0) idx = 0;
      focusMatch(idx);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, searcher, open, focusMatch]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const n = resultRef.current?.matches.length ?? 0;
      if (!n) return;
      focusMatch((Math.max(focusedRef.current, 0) + dir + n) % n);
    },
    [focusMatch],
  );

  const openSearch = useCallback(() => {
    // A live text selection seeds the query, like browser find.
    const sel = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
    if (sel && sel.length <= 120) setQuery(sel);
    setOpen(true);
    setFocusNonce((n) => n + 1);
  }, []);
  const closeSearch = useCallback(() => setOpen(false), []);

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
      setQuery,
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
    [open, focusNonce, openSearch, closeSearch, query, result, searcher, focusedIdx,
     focusMatch, step, snippetFor, pageHasMatches, peekRects, ensureRects, rectsVersion],
  );

  return <SearchContext.Provider value={value}>{props.children}</SearchContext.Provider>;
}
