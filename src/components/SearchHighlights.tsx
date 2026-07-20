/** Search-match highlight overlay for one page. Mirrors PageAnnotations:
 *  fraction rects → percentage-positioned divs inside .page-inner, multiply-
 *  blended against the page canvas. Geometry is pulled lazily from the
 *  search provider the first time this page needs it, so cost tracks the
 *  pages actually visited, not the match count. */

import { memo, useEffect } from "react";
import { useSearch } from "../lib/search";

const pct = (v: number) => `${v * 100}%`;

export const SearchHighlights = memo(function SearchHighlights(props: { page: number }) {
  const { open, result, pageHasMatches, ensureRects, peekRects, focusedMatch } = useSearch();
  const active = open && result != null && pageHasMatches(props.page);

  useEffect(() => {
    if (active) ensureRects(props.page);
  }, [active, result, ensureRects, props.page]);

  if (!active) return null;
  const groups = peekRects(props.page);
  if (!groups?.length) return null;

  const focusedOrd =
    focusedMatch?.page === props.page ? focusedMatch.ord : -1;

  return (
    <div className="search-layer" aria-hidden>
      {groups.map((rects, ord) =>
        rects.map((r, i) => (
          <div
            key={`${ord}-${i}`}
            className={`search-hit ${ord === focusedOrd ? "focused" : ""}`}
            style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }}
          />
        )),
      )}
    </div>
  );
});
