/** Virtualized pdf.js viewer: pages render to canvas (plus a selectable text
 *  layer) only while near the viewport, and are torn down when they leave. */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TextLayer } from "pdfjs-dist";
import { renderRegionJpegBase64, type PdfDoc } from "../lib/pdf";
import { askRegionMessage, explainRegionMessage } from "../lib/ai";
import { clientToFrac, hitTest, selectionToMarkups } from "../lib/annotGeometry";
import { useAnnotations } from "../lib/annotations";
import { writeDocBytes } from "../lib/tauri";
import { useSession } from "../lib/session";
import { ChatGlyph, Spark } from "./Icons";
import { PageAnnotations } from "./PageAnnotations";
import { PageInsights } from "./PageInsights";

/** Distance beyond the viewport at which pages mount/unmount. */
const OVERSCAN = "900px";
const PAGE_GAP = 20;

interface PageDims {
  width: number;
  height: number;
}

/** A dragged region of one page, in fractions of the page size. */
interface SnipBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function Reader(props: {
  scale: number | null;
  initialPage?: number;
  /** Scroll offset within initialPage, as a fraction of the page height. */
  initialScroll?: number;
  /** Snip mode: drag a box over a figure to ask the tutor about it. */
  snipMode?: boolean;
  exitSnip?: () => void;
}) {
  const { pdf, reg, reportPage, registerJumper, openPanel } = useSession();
  const { tool, byPage, addMarkups, hlColor, select } = useAnnotations();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  // Seed visibility around the restored page so first paint shows content
  // there instead of blank pages waiting on the IntersectionObserver.
  const [visible, setVisible] = useState<Set<number>>(() => {
    const start = Math.max(1, props.initialPage ?? 1);
    return new Set([start, start + 1]);
  });
  const [baseDims, setBaseDims] = useState<PageDims | null>(null);
  // Fit-width tracks resizes at two speeds: `liveFitScale` follows every frame
  // of a panel slide or drag (pages reflow via cheap CSS scaling of the
  // existing canvases), while `fitScale` settles shortly after and triggers
  // one crisp re-render at the final size.
  const [fitScale, setFitScale] = useState(1);
  const [liveFitScale, setLiveFitScale] = useState(1);
  // Per-page real dims at scale 1 (PDFs can mix page sizes); discovered lazily.
  const [pageDims, setPageDims] = useState<Map<number, PageDims>>(new Map());

  const scale = props.scale ?? fitScale;
  const layoutScale = props.scale ?? liveFitScale;

  // Measure page 1 to establish the base layout size and the fit-width scale.
  useEffect(() => {
    let stale = false;
    pdf.getPage(1).then((page) => {
      if (stale) return;
      const vp = page.getViewport({ scale: 1 });
      setBaseDims({ width: vp.width, height: vp.height });
      const container = containerRef.current;
      if (container) {
        const usable = container.clientWidth - 96;
        const fit = Math.min(Math.max(usable / vp.width, 0.4), 2.2);
        setFitScale(fit);
        setLiveFitScale(fit);
      }
    });
    return () => {
      stale = true;
    };
  }, [pdf]);

  // Keep fit-width in sync with resizes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !baseDims) return;
    const fit = () => {
      const usable = container.clientWidth - 96;
      return Math.min(Math.max(usable / baseDims.width, 0.4), 2.2);
    };
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      setLiveFitScale(fit());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFitScale(fit()), 160);
    });
    observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [baseDims]);

  // Restore the saved reading position once the page layout exists (page
  // wrappers are laid out from baseDims immediately, before any rendering).
  // Layout effect: the scroll lands before first paint, so page 1 never
  // flashes on screen before the jump.
  const restoredRef = useRef(false);
  // Last known reading position in document-relative terms: the page under
  // the viewport's top edge plus the fraction of it scrolled past. Pixel
  // offsets die in reflows; this survives them. (Distinct from the
  // center-based "current page" that reportPage tracks.)
  const anchorRef = useRef<{ page: number; frac: number } | null>(null);
  useLayoutEffect(() => {
    if (!baseDims || restoredRef.current) return;
    restoredRef.current = true;
    const target = Math.min(Math.max(props.initialPage ?? 1, 1), pdf.numPages);
    const frac = props.initialScroll ?? 0;
    if (target <= 1 && frac <= 0) return;
    const el = pageRefs.current.get(target);
    const container = containerRef.current;
    if (el && container) {
      // frac is measured against the page's height, so the exact spot comes
      // back regardless of how the window/zoom changed between sessions.
      container.scrollTop = Math.max(
        0,
        frac ? el.offsetTop + frac * el.offsetHeight : el.offsetTop - 24,
      );
      anchorRef.current = { page: target, frac };
      reportPage(target, frac);
    }
  }, [baseDims, props.initialPage, props.initialScroll, pdf.numPages, reportPage]);

  // Virtualization: observe every page wrapper.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !baseDims) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const num = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(num);
            else next.delete(num);
          }
          return next;
        });
      },
      { root: container, rootMargin: `${OVERSCAN} 0px` },
    );
    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [baseDims, pdf.numPages]);

  // Current page = the page occupying the vertical center of the viewport;
  // the anchor tracks the page at the viewport's top edge.
  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const center = container.scrollTop + container.clientHeight / 2;
    let best = 1;
    let top = 1;
    for (const [num, el] of pageRefs.current) {
      if (el.offsetTop <= center) best = Math.max(best, num);
      if (el.offsetTop <= container.scrollTop) top = Math.max(top, num);
    }
    const topEl = pageRefs.current.get(top);
    if (topEl && topEl.offsetHeight > 0) {
      anchorRef.current = {
        page: top,
        frac: (container.scrollTop - topEl.offsetTop) / topEl.offsetHeight,
      };
    }
    // Scroll offset within the current page, as a fraction of its height.
    // Can be slightly negative (the page starts mid-viewport) — that's fine,
    // restoring reproduces the same scrollTop.
    const el = pageRefs.current.get(best);
    const frac =
      el && el.offsetHeight > 0
        ? (container.scrollTop - el.offsetTop) / el.offsetHeight
        : 0;
    reportPage(best, frac);
  }, [reportPage]);

  // Pin the reading position through layout reflows. All page geometry
  // derives from layoutScale and pageDims, so re-applying the anchor when
  // they change keeps the same content under the viewport top through
  // panel slides/drags, window resizes, zoom changes, and lazily
  // discovered page sizes. Deliberately a layout effect, not a
  // ResizeObserver: the write lands in the same commit that moved the
  // pages, before paint and before any scroll event can sample the
  // drifted position back into the anchor.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    const el = anchor && pageRefs.current.get(anchor.page);
    if (el && container) {
      container.scrollTop = el.offsetTop + anchor.frac * el.offsetHeight;
    }
  }, [layoutScale, pageDims]);

  // Expose page jumps to the rest of the app (citations, chapter list,
  // annotation cards — the optional yFrac lands on a spot within the page).
  useEffect(() => {
    registerJumper((page: number, yFrac?: number) => {
      const el = pageRefs.current.get(Math.min(Math.max(1, page), pdf.numPages));
      const container = containerRef.current;
      if (el && container) {
        const top =
          yFrac !== undefined ? el.offsetTop + yFrac * el.offsetHeight : el.offsetTop - 24;
        container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    });
  }, [registerJumper, pdf.numPages]);

  // ── Annotations: markup creation + click-to-select ───────────────────
  // Drag-highlighter: while the tool is armed, releasing a text selection
  // turns it into a highlight (per page spanned) and clears the selection —
  // which also keeps the AI popover away.
  useEffect(() => {
    if (tool !== "highlight") return;
    const onUp = () => {
      // Defer a tick so the selection has settled (mirrors SelectionPopover).
      setTimeout(() => {
        const sel = window.getSelection();
        const host = containerRef.current;
        if (!sel || sel.isCollapsed || !host) return;
        const markups = selectionToMarkups(sel, host);
        if (markups.length) {
          addMarkups(markups, "highlight", hlColor);
          sel.removeAllRanges();
        }
      }, 0);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [tool, addMarkups, hlColor]);

  // In browse/select mode a plain click (not a drag, not on interactive UI)
  // hit-tests the page's annotations — highlights and ink keep
  // pointer-events:none so text selection over them still works.
  const clickStart = useRef<{ x: number; y: number } | null>(null);
  const onReaderPointerDown = (e: ReactPointerEvent) => {
    clickStart.current = { x: e.clientX, y: e.clientY };
    if (props.snipMode) startSnip(e);
  };
  const onReaderClick = (e: React.MouseEvent) => {
    if (props.snipMode || (tool && tool !== "select")) return;
    const start = clickStart.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
    const target = e.target as Element;
    if (
      target.closest?.(
        ".annot-obj, .annot-popup, .annot-rail, .selection-popover, .insight-layer",
      )
    ) {
      return;
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const pageEl = target.closest?.("[data-page]") as HTMLElement | null;
    if (!pageEl) {
      select(null);
      return;
    }
    const page = Number(pageEl.dataset.page);
    const annots = byPage.get(page);
    const dims = pageDims.get(page) ?? baseDims;
    if (!annots?.length || !dims) {
      select(null);
      return;
    }
    const pt = clientToFrac(pageEl, e.clientX, e.clientY);
    const hit = hitTest(annots, pt, dims.width, dims.height, 6 / scale);
    select(hit ? hit.id : null);
  };

  // ── Snip: drag a box over a page, render the region to a JPEG the
  //    headless CLI can Read, and hand it to the chat tab. ──────────────
  const [snipDraft, setSnipDraft] = useState<SnipBox | null>(null); // live drag
  const [snipSel, setSnipSel] = useState<SnipBox | null>(null); // awaiting action
  const [snipBusy, setSnipBusy] = useState(false);

  // Leaving snip mode (toolbar toggle or Escape) discards any selection.
  useEffect(() => {
    if (props.snipMode) return;
    setSnipDraft(null);
    setSnipSel(null);
  }, [props.snipMode]);
  useEffect(() => {
    if (!props.snipMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.exitSnip?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.snipMode, props.exitSnip]);

  const startSnip = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    // Popover / margin-note / annotation-UI clicks pass through instead of
    // starting a snip.
    if (target.closest?.(".selection-popover, .insight-layer, .annot-popup, .annot-rail")) return;
    setSnipSel(null);
    const pageEl = target.closest?.("[data-page]") as HTMLElement | null;
    if (!pageEl) return;
    e.preventDefault();
    const rect = pageEl.getBoundingClientRect();
    const page = Number(pageEl.dataset.page);
    const fx = (cx: number) => Math.min(Math.max((cx - rect.left) / rect.width, 0), 1);
    const fy = (cy: number) => Math.min(Math.max((cy - rect.top) / rect.height, 0), 1);
    let box: SnipBox = { page, x0: fx(e.clientX), y0: fy(e.clientY), x1: fx(e.clientX), y1: fy(e.clientY) };
    setSnipDraft(box);
    const move = (ev: PointerEvent) => {
      box = { ...box, x1: fx(ev.clientX), y1: fy(ev.clientY) };
      setSnipDraft(box);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      setSnipDraft(null);
      // Ignore accidental clicks; keep real boxes and show the popover.
      if (
        Math.abs(box.x1 - box.x0) * rect.width >= 12 &&
        Math.abs(box.y1 - box.y0) * rect.height >= 12
      ) {
        setSnipSel({
          page,
          x0: Math.min(box.x0, box.x1),
          y0: Math.min(box.y0, box.y1),
          x1: Math.max(box.x0, box.x1),
          y1: Math.max(box.y0, box.y1),
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const snipAction = async (kind: "explain" | "ask") => {
    const box = snipSel;
    if (!box || snipBusy) return;
    setSnipBusy(true);
    try {
      const jpeg = await renderRegionJpegBase64(pdf, box.page, {
        x: box.x0,
        y: box.y0,
        w: box.x1 - box.x0,
        h: box.y1 - box.y0,
      });
      const rel = `snips/snip-p${box.page}-${Date.now()}.jpg`;
      await writeDocBytes(reg.docId, rel, jpeg);
      openPanel(
        "chat",
        kind === "explain"
          ? explainRegionMessage(rel, box.page)
          : askRegionMessage(rel, box.page),
        kind === "explain",
      );
      setSnipSel(null);
      props.exitSnip?.();
    } catch (e) {
      console.error("snip failed", e);
    } finally {
      setSnipBusy(false);
    }
  };

  const onPageDims = useCallback((num: number, dims: PageDims) => {
    setPageDims((prev) => {
      const cur = prev.get(num);
      if (cur && cur.width === dims.width && cur.height === dims.height) return prev;
      const next = new Map(prev);
      next.set(num, dims);
      return next;
    });
  }, []);

  const pageNumbers = useMemo(
    () => Array.from({ length: pdf.numPages }, (_, i) => i + 1),
    [pdf.numPages],
  );

  if (!baseDims) return <div className="reader" ref={containerRef} />;

  const snipBox = snipDraft ?? snipSel;

  return (
    <div
      className={`reader ${props.snipMode ? "snip-mode" : ""} ${tool ? `tool-${tool}` : ""}`}
      ref={containerRef}
      onScroll={onScroll}
      onPointerDown={onReaderPointerDown}
      onClick={onReaderClick}
    >
      <div className="reader-pages" style={{ gap: PAGE_GAP }}>
        {pageNumbers.map((num) => {
          const dims = pageDims.get(num) ?? baseDims;
          return (
            <div
              key={num}
              data-page={num}
              className="pdf-page"
              style={{
                width: dims.width * layoutScale,
                height: dims.height * layoutScale,
              }}
              ref={(el) => {
                if (el) pageRefs.current.set(num, el);
                else pageRefs.current.delete(num);
              }}
            >
              {visible.has(num) && (
                <div
                  className="page-inner"
                  style={{
                    width: dims.width * scale,
                    height: dims.height * scale,
                    transform:
                      layoutScale === scale
                        ? undefined
                        : `scale(${layoutScale / scale})`,
                  }}
                >
                  <PageContent
                    pdf={pdf}
                    num={num}
                    scale={scale}
                    onDims={onPageDims}
                  />
                  <PageAnnotations page={num} dims={dims} scale={scale} />
                </div>
              )}
              <PageInsights page={num} heightPx={dims.height * layoutScale} />
              {snipBox?.page === num && (
                <div
                  className="snip-rect"
                  style={{
                    left: `${Math.min(snipBox.x0, snipBox.x1) * 100}%`,
                    top: `${Math.min(snipBox.y0, snipBox.y1) * 100}%`,
                    width: `${Math.abs(snipBox.x1 - snipBox.x0) * 100}%`,
                    height: `${Math.abs(snipBox.y1 - snipBox.y0) * 100}%`,
                  }}
                />
              )}
              {snipSel?.page === num && !snipDraft && (
                <div
                  className="selection-popover snip-pop"
                  style={{
                    left: `${((snipSel.x0 + snipSel.x1) / 2) * 100}%`,
                    top: `calc(${snipSel.y1 * 100}% + 10px)`,
                  }}
                >
                  <button disabled={snipBusy} onClick={() => void snipAction("explain")}>
                    <Spark />
                    {snipBusy ? "Snipping…" : "Explain"}
                  </button>
                  <span className="sep" />
                  <button disabled={snipBusy} onClick={() => void snipAction("ask")}>
                    <ChatGlyph />
                    Ask about this
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PageContent = memo(function PageContent(props: {
  pdf: PdfDoc;
  num: number;
  scale: number;
  onDims: (num: number, dims: PageDims) => void;
}) {
  const { pdf, num, scale, onDims } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: TextLayer | null = null;

    (async () => {
      const page = await pdf.getPage(num);
      if (cancelled) return;
      const vp1 = page.getViewport({ scale: 1 });
      onDims(num, { width: vp1.width, height: vp1.height });

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textDiv = textRef.current;
      if (!canvas || !textDiv) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const task = page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      renderTask = task;
      try {
        await task.promise;
      } catch {
        return; // cancelled mid-render
      }
      if (cancelled) return;

      textDiv.replaceChildren();
      textDiv.style.setProperty("--scale-factor", String(viewport.scale));
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport,
      });
      await textLayer.render().catch(() => {});
      if (cancelled) return;

      // Sentinel the official viewer adds: while dragging a selection it
      // covers the page, so the caret anchors to it past the last glyph
      // instead of the selection snapping around whole paragraphs.
      const end = document.createElement("div");
      end.className = "endOfContent";
      textDiv.append(end);
    })();

    const textEl = textRef.current;
    const stopSelecting = () => textEl?.classList.remove("selecting");
    const startSelecting = () => {
      textEl?.classList.add("selecting");
      window.addEventListener("pointerup", stopSelecting, { once: true });
    };
    textEl?.addEventListener("pointerdown", startSelecting);

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      textEl?.removeEventListener("pointerdown", startSelecting);
      window.removeEventListener("pointerup", stopSelecting);
    };
  }, [pdf, num, scale, onDims]);

  return (
    <>
      <canvas ref={canvasRef} />
      <div className="textLayer" ref={textRef} />
    </>
  );
});
