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
} from "react";
import { TextLayer } from "pdfjs-dist";
import type { PdfDoc } from "../lib/pdf";
import { useSession } from "../lib/session";

/** Distance beyond the viewport at which pages mount/unmount. */
const OVERSCAN = "900px";
const PAGE_GAP = 20;

interface PageDims {
  width: number;
  height: number;
}

export function Reader(props: { scale: number | null; initialPage?: number }) {
  const { pdf, reportPage, registerJumper } = useSession();
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
  useLayoutEffect(() => {
    if (!baseDims || restoredRef.current) return;
    restoredRef.current = true;
    const target = Math.min(Math.max(props.initialPage ?? 1, 1), pdf.numPages);
    if (target <= 1) return;
    const el = pageRefs.current.get(target);
    const container = containerRef.current;
    if (el && container) {
      container.scrollTop = Math.max(0, el.offsetTop - 24);
      reportPage(target);
    }
  }, [baseDims, props.initialPage, pdf.numPages, reportPage]);

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

  // Current page = the page occupying the vertical center of the viewport.
  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const center = container.scrollTop + container.clientHeight / 2;
    let best = 1;
    for (const [num, el] of pageRefs.current) {
      if (el.offsetTop <= center) best = Math.max(best, num);
    }
    reportPage(best);
  }, [reportPage]);

  // Expose page jumps to the rest of the app (citations, chapter list).
  useEffect(() => {
    registerJumper((page: number) => {
      const el = pageRefs.current.get(Math.min(Math.max(1, page), pdf.numPages));
      const container = containerRef.current;
      if (el && container) {
        container.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
      }
    });
  }, [registerJumper, pdf.numPages]);

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

  return (
    <div className="reader" ref={containerRef} onScroll={onScroll}>
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
