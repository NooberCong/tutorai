/** Docked find panel (Ctrl+F), at the reader's right edge. The wrapper's
 *  width animates while the panel inside keeps its natural width — the same
 *  slide pattern as the side panels — so pages reflow beside the search UI
 *  instead of underneath it, and a match can never be hidden by it. The
 *  all-matches list fills the panel height, virtualized over a fixed row
 *  height, so five thousand matches render as a dozen DOM rows. */

import { useEffect, useRef, useState } from "react";
import { useSearch } from "../lib/search";
import { useSession } from "../lib/session";
import type { SearchMatch } from "../lib/searchCore";
import { ChevronDown, ChevronUp, Close, SearchGlyph } from "./Icons";

const ROW_H = 56;

export function SearchBar() {
  const search = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [search.open, search.focusNonce]);

  const { result, focusedIdx } = search;
  const count = search.indexing
    ? "indexing…"
    : result
      ? `${result.total ? focusedIdx + 1 : 0}/${result.total.toLocaleString()}`
      : "";

  return (
    <div className={`search-dock ${search.open ? "open" : ""}`} inert={!search.open}>
      <div className="search-panel" role="search" aria-label="Find in document">
        <div className="search-bar-row">
          <SearchGlyph className="search-bar-glyph" />
          <input
            ref={inputRef}
            value={search.query}
            placeholder="Find in document"
            spellCheck={false}
            aria-label="Search text"
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search.step(e.shiftKey ? -1 : 1);
              }
            }}
          />
          <span className={`search-count ${result && !result.total ? "none" : ""}`}>{count}</span>
          <button
            className="icon-btn"
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
            disabled={!result?.total}
            onClick={() => search.step(-1)}
          >
            <ChevronUp />
          </button>
          <button
            className="icon-btn"
            title="Next match (Enter)"
            aria-label="Next match"
            disabled={!result?.total}
            onClick={() => search.step(1)}
          >
            <ChevronDown />
          </button>
          <button className="icon-btn" title="Close (Esc)" aria-label="Close search" onClick={search.closeSearch}>
            <Close />
          </button>
        </div>
        {search.noText && (
          <div className="search-hint">This document has no selectable text to search.</div>
        )}
        {result?.capped && (
          <div className="search-hint">
            Listing the first {result.matches.length.toLocaleString()} of{" "}
            {result.total.toLocaleString()} matches — refine the search to see the rest.
          </div>
        )}
        {result != null && result.total > 0 && <ResultsList />}
      </div>
    </div>
  );
}

function ResultsList() {
  const { result, focusedIdx, focusMatch, snippetFor } = useSearch();
  const { meta } = useSession();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // The list fills whatever height the panel gives it; virtualization needs
  // the actual viewport height, so track it.
  const [viewH, setViewH] = useState(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewH(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const matches = result?.matches ?? [];
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 3);
  const last = Math.min(matches.length, Math.ceil((scrollTop + viewH) / ROW_H) + 3);

  // Keep the focused row in view as Enter/F3 walk the matches.
  useEffect(() => {
    const el = listRef.current;
    if (!el || focusedIdx < 0) return;
    const top = focusedIdx * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_H - el.clientHeight;
    }
  }, [focusedIdx]);

  // Chapters are sorted by startPage; the last one at/before the page wins.
  // Suppressed for single-chapter docs, where it's just noise.
  const chapterOf = (page: number): string | null => {
    const chapters = meta?.chapters ?? [];
    if (chapters.length < 2) return null;
    let title: string | null = null;
    for (const ch of chapters) {
      if (ch.startPage > page) break;
      title = ch.title;
    }
    return title;
  };

  return (
    <div
      className="search-results"
      ref={listRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="search-results-space" style={{ height: matches.length * ROW_H }}>
        {matches.slice(first, last).map((m: SearchMatch, i: number) => {
          const idx = first + i;
          const snip = snippetFor(m);
          const chapter = chapterOf(m.page);
          return (
            <button
              key={idx}
              className={`search-row ${idx === focusedIdx ? "focused" : ""}`}
              style={{ top: idx * ROW_H, height: ROW_H }}
              onClick={() => focusMatch(idx)}
            >
              <span className="search-row-snippet">
                {snip.before}
                <mark>{snip.hit}</mark>
                {snip.after}
              </span>
              <span className="search-row-meta">
                <span className="search-row-page">p.{m.page}</span>
                {chapter && <span className="search-row-chapter">{chapter}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
