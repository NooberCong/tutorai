/** Anchored dictionary card, opened from the selection pill's Translate
 *  action. Its state lives beside the pill's, not inside it — the pill
 *  tears down on the click that opens this card, and the card then owns its
 *  own dismissal (Esc, outside pointerdown, reader scroll). Entry HTML from
 *  dictionaries is untrusted and always passes through DOMPurify. */

import DOMPurify from "dompurify";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { anyEnabled, lookup } from "../lib/dictionary";
import type { DictHit } from "../lib/types";
import { Close } from "./Icons";
import { recordHabit } from "../lib/hatchery/tracker";

export interface DictQuery {
  text: string;
  /** Host-relative anchor, from the selection the pill captured. */
  x: number;
  y: number;
}

type Result =
  | { kind: "loading" }
  | { kind: "hits"; hits: DictHit[] }
  | { kind: "none" }
  | { kind: "no-dicts" }
  | { kind: "error"; message: string };

/** Consecutive hits from one dictionary render under one provenance label. */
function groupByDict(hits: DictHit[]) {
  const groups: { id: string; name: string; hits: DictHit[] }[] = [];
  for (const hit of hits) {
    const last = groups[groups.length - 1];
    if (last && last.id === hit.dictId) last.hits.push(hit);
    else groups.push({ id: hit.dictId, name: hit.dictName, hits: [hit] });
  }
  return groups;
}

export function TranslatePopup(props: {
  query: DictQuery;
  hostRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { query, hostRef, onClose } = props;
  const cardRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<Result>({ kind: "loading" });

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        if (!(await anyEnabled())) {
          if (!stale) setResult({ kind: "no-dicts" });
          return;
        }
        const hits = await lookup(query.text);
        if (stale) return;
        setResult(hits.length ? { kind: "hits", hits } : { kind: "none" });
        if (hits.length) recordHabit("lookup");
      } catch (e) {
        if (!stale) setResult({ kind: "error", message: String(e) });
      }
    })();
    return () => {
      stale = true;
    };
  }, [query]);

  // Clamp inside the host using the measured size (the pill's idiom), and
  // again whenever the result changes the card's height.
  useLayoutEffect(() => {
    const el = cardRef.current;
    const host = hostRef.current;
    if (!el || !host) return;
    const { width, height } = host.getBoundingClientRect();
    const half = el.offsetWidth / 2 + 8;
    el.style.left = `${Math.min(Math.max(query.x, half), width - half)}px`;
    el.style.top = `${Math.max(8, Math.min(query.y, height - el.offsetHeight - 10))}px`;
  }, [query, result, hostRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) onClose();
    };
    // Capture-phase, so page scrolling under the card dismisses it — but the
    // card's own definition list must stay scrollable.
    const onScroll = (e: Event) => {
      if (!cardRef.current?.contains(e.target as Node)) onClose();
    };
    const host = hostRef.current;
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    host?.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      host?.removeEventListener("scroll", onScroll, true);
    };
  }, [hostRef, onClose]);

  const hits = result.kind === "hits" ? result.hits : [];
  const headWord = hits[0]?.word ?? query.text.trim();
  const showQuery =
    hits.length > 0 && hits[0].word.toLowerCase() !== query.text.trim().toLowerCase();

  return (
    <section
      ref={cardRef}
      className="translate-card"
      role="dialog"
      aria-label="Dictionary lookup"
      style={{ left: query.x, top: query.y }}
    >
      <header className="translate-head">
        <span className="translate-word">{headWord}</span>
        {showQuery && <span className="translate-for">for “{query.text.trim()}”</span>}
        <button className="translate-close" title="Close (Esc)" aria-label="Close" onClick={onClose}>
          <Close />
        </button>
      </header>

      {result.kind === "loading" && <div className="translate-status">Looking up…</div>}
      {result.kind === "none" && <div className="translate-status">No entry found.</div>}
      {result.kind === "error" && <div className="translate-status">{result.message}</div>}
      {result.kind === "no-dicts" && (
        <div className="translate-status">
          No dictionaries are enabled.
          <span className="translate-hint">Manage dictionaries on the library screen.</span>
        </div>
      )}

      {hits.length > 0 && (
        <div className="translate-body">
          {groupByDict(hits).map((group) => (
            <div key={group.id}>
              <div className="translate-dict">{group.name}</div>
              {group.hits.map((hit, i) => (
                <div key={i}>
                  {hit.word !== headWord && (
                    <div className="translate-subword">{hit.word}</div>
                  )}
                  {hit.definitions.map((def, j) =>
                    def.format === "html" ? (
                      <div
                        key={j}
                        className="translate-defs"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(def.body) }}
                      />
                    ) : (
                      <div key={j} className="translate-defs plain">
                        {def.body}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
