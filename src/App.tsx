import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Home } from "./components/Home";
import { Reader } from "./components/Reader";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { AiPanel } from "./components/AiPanel";
import { MarkupRail } from "./components/MarkupRail";
import { SelectionPopover } from "./components/SelectionPopover";
import { Undo } from "./components/Icons";
import { AnnotationsProvider, useAnnotations } from "./lib/annotations";
import { InsightsProvider, useInsights } from "./lib/insights";
import { SessionProvider, useSession } from "./lib/session";
import { loadPdf, renderCoverDataUrl, type PdfDoc } from "./lib/pdf";
import { listen } from "@tauri-apps/api/event";
import {
  getLibrary,
  initialFile,
  pdfUrl,
  readDocText,
  registerPdf,
  writeDocText,
} from "./lib/tauri";
import type { RegisteredDoc } from "./lib/types";
import { getSetting, saveSetting, SETTINGS_DEFAULTS } from "./lib/settings";

type View =
  | { kind: "home" }
  | {
      kind: "doc";
      reg: RegisteredDoc;
      pdf: PdfDoc;
      fileName: string;
      initialPage: number;
      initialScroll: number;
    };

/** Fade out and remove the boot splash from index.html. Holds it on screen
 *  for a minimum beat so warm starts get a smooth reveal instead of a flash
 *  (performance.now() ≈ time since navigation). Idempotent — StrictMode
 *  double-fires effects. */
function dismissSplash() {
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("done")) return;
  window.setTimeout(() => {
    el.classList.add("done");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    window.setTimeout(() => el.remove(), 700); // in case transitionend is missed
  }, Math.max(0, 550 - performance.now()));
}

export default function App() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [opening, setOpening] = useState<string | null>(null);

  const openPath = useCallback(async (path: string) => {
    setOpening(path);
    try {
      const reg = await registerPdf(path);
      const pdf = await loadPdf(pdfUrl(path));
      const fileName = path.split(/[\\/]/).pop() ?? "document.pdf";
      // Resume where the reader left off last time (from the library index).
      const entry = await getLibrary()
        .then((lib) => lib.find((e) => e.docId === reg.docId))
        .catch(() => undefined);
      const initialPage = Math.min(Math.max(entry?.lastPage ?? 1, 1), pdf.numPages);
      const initialScroll = entry?.lastScroll ?? 0;
      setView((prev) => {
        // A doc may already be open (e.g. double-clicking another PDF).
        if (prev.kind === "doc") prev.pdf.destroy().catch(() => {});
        return { kind: "doc", reg, pdf, fileName, initialPage, initialScroll };
      });
      ensureCover(reg.docId, pdf);
    } catch (e) {
      console.error("failed to open PDF", e);
      alert(`Could not open this PDF.\n${e}`);
    } finally {
      setOpening(null);
    }
  }, []);

  // PDFs arriving from the OS: the file this process was launched with
  // (file association), and files handed over by later launches while the
  // app is already running (single-instance plugin emits "open-file").
  // The boot splash stays up until this settles — through the document load
  // when we were launched with a file — so cold starts never show a bare shell.
  useEffect(() => {
    initialFile()
      .then(async (path) => {
        if (path) await openPath(path);
      })
      .catch(() => {})
      .finally(dismissSplash);
    const unlisten = listen<string>("open-file", (e) => openPath(e.payload));
    return () => {
      unlisten.then((f) => f());
    };
  }, [openPath]);

  const goHome = useCallback(() => {
    if (view.kind === "doc") view.pdf.destroy().catch(() => {});
    setView({ kind: "home" });
  }, [view]);

  if (view.kind === "home") {
    return <Home onOpen={openPath} opening={opening} />;
  }

  return (
    <SessionProvider
      key={view.reg.docId}
      reg={view.reg}
      pdf={view.pdf}
      fileName={view.fileName}
    >
      <InsightsProvider>
        <AnnotationsProvider>
          <DocScreen
            onHome={goHome}
            initialPage={view.initialPage}
            initialScroll={view.initialScroll}
          />
        </AnnotationsProvider>
      </InsightsProvider>
    </SessionProvider>
  );
}

/** Render a library cover from page 1 the first time a document is opened. */
function ensureCover(docId: string, pdf: PdfDoc) {
  readDocText(docId, "cover.txt")
    .then(async (existing) => {
      if (existing) return;
      const dataUrl = await renderCoverDataUrl(pdf);
      await writeDocText(docId, "cover.txt", dataUrl);
    })
    .catch(() => {});
}

// Panel widths are user-resizable within sane bounds and remembered.
interface PanelSpec {
  key: "sidebarWidth" | "panelWidth";
  def: number;
  min: number;
  max: number;
}
const SIDEBAR: PanelSpec = {
  key: "sidebarWidth", def: SETTINGS_DEFAULTS.sidebarWidth, min: 200, max: 420,
};
const PANEL: PanelSpec = {
  key: "panelWidth", def: SETTINGS_DEFAULTS.panelWidth, min: 330, max: 640,
};

function loadWidth(spec: PanelSpec): number {
  return clampWidth(spec, getSetting(spec.key));
}
function clampWidth(spec: PanelSpec, w: number): number {
  return Math.min(Math.max(w, spec.min), spec.max);
}

function DocScreen(props: {
  onHome: () => void;
  initialPage: number;
  initialScroll: number;
}) {
  const { extractProgress, panelRequest, jumpToPage } = useSession();
  const { reading } = useInsights();
  const { railOpen, tool, toggleRail, undoToast } = useAnnotations();
  const [scale, setScale] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => getSetting("sidebarOpen"));
  const [panelOpen, setPanelOpen] = useState(() => getSetting("panelOpen"));

  // Remember panel visibility across restarts (covers every way they change,
  // including panel requests force-opening the tutor).
  useEffect(() => {
    saveSetting("sidebarOpen", sidebarOpen);
  }, [sidebarOpen]);
  useEffect(() => {
    saveSetting("panelOpen", panelOpen);
  }, [panelOpen]);
  const [sidebarW, setSidebarW] = useState(() => loadWidth(SIDEBAR));
  const [panelW, setPanelW] = useState(() => loadWidth(PANEL));
  const [resizing, setResizing] = useState<"sidebar" | "panel" | null>(null);
  const [snipMode, setSnipMode] = useState(false);
  const exitSnip = useCallback(() => setSnipMode(false), []);
  const readerHostRef = useRef<HTMLDivElement>(null);

  // Snip and markup are both "act on the page" modes — mutually exclusive.
  // Each effect only acts when its own mode just became active, so they
  // can't fight: the newcomer wins.
  useEffect(() => {
    if (snipMode && railOpen) toggleRail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snipMode]);
  useEffect(() => {
    if (railOpen || tool) setSnipMode(false);
  }, [railOpen, tool]);

  // A panel request (e.g. "Explain selection") force-opens the panel.
  useEffect(() => {
    if (panelRequest) setPanelOpen(true);
  }, [panelRequest]);

  const startResize =
    (which: "sidebar" | "panel") => (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const spec = which === "sidebar" ? SIDEBAR : PANEL;
      const set = which === "sidebar" ? setSidebarW : setPanelW;
      let last = which === "sidebar" ? sidebarW : panelW;
      const startW = last;
      setResizing(which);
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        last = clampWidth(spec, which === "sidebar" ? startW + dx : startW - dx);
        set(last);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        setResizing(null);
        saveSetting(spec.key, last);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: true });
    };

  const nudgeResize =
    (which: "sidebar" | "panel") => (e: ReactKeyboardEvent) => {
      const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      const spec = which === "sidebar" ? SIDEBAR : PANEL;
      const set = which === "sidebar" ? setSidebarW : setPanelW;
      set((w) => {
        const next = clampWidth(spec, w + dir * (which === "sidebar" ? 16 : -16));
        saveSetting(spec.key, next);
        return next;
      });
    };

  const resetResize = (which: "sidebar" | "panel") => () => {
    const spec = which === "sidebar" ? SIDEBAR : PANEL;
    (which === "sidebar" ? setSidebarW : setPanelW)(spec.def);
    saveSetting(spec.key, spec.def);
  };

  return (
    <div className="doc-screen">
      <Toolbar
        onHome={props.onHome}
        scale={scale}
        setScale={setScale}
        sidebarOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen((v) => !v)}
        panelOpen={panelOpen}
        togglePanel={() => setPanelOpen((v) => !v)}
        snipMode={snipMode}
        toggleSnip={() => setSnipMode((v) => !v)}
      />
      <div className="doc-body">
        <div
          className={`slide slide-left ${sidebarOpen ? "open" : ""} ${resizing === "sidebar" ? "no-anim" : ""}`}
          style={{ "--panel-w": `${sidebarW}px` } as CSSProperties}
          inert={!sidebarOpen}
        >
          <Sidebar />
          <div
            className={`panel-resizer ${resizing === "sidebar" ? "active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize contents"
            tabIndex={0}
            onPointerDown={startResize("sidebar")}
            onKeyDown={nudgeResize("sidebar")}
            onDoubleClick={resetResize("sidebar")}
          />
        </div>
        <div className="reader-host" ref={readerHostRef}>
          <Reader
            scale={scale}
            initialPage={props.initialPage}
            initialScroll={props.initialScroll}
            snipMode={snipMode}
            exitSnip={exitSnip}
          />
          <SelectionPopover hostRef={readerHostRef} />
          <MarkupRail />
          {undoToast && (
            <button
              key={undoToast.nonce}
              className="extract-pill undo-pill"
              onClick={() => jumpToPage(undoToast.page)}
              title={`Jump to page ${undoToast.page}`}
            >
              <Undo />
              <span>{undoToast.label}</span>
              <span className="count">p.{undoToast.page}</span>
            </button>
          )}
          {extractProgress && (
            <div className="extract-pill">
              <span>Indexing for AI</span>
              <span className="count">
                {extractProgress.done}/{extractProgress.total}
              </span>
            </div>
          )}
          {reading && (
            <div className="companion-pill" aria-live="polite">
              <span className="companion-dot" />
              reading p.{reading.startPage}–{reading.endPage}
            </div>
          )}
        </div>
        <div
          className={`slide slide-right ${panelOpen ? "open" : ""} ${resizing === "panel" ? "no-anim" : ""}`}
          style={{ "--panel-w": `${panelW}px` } as CSSProperties}
          inert={!panelOpen}
        >
          <div
            className={`panel-resizer ${resizing === "panel" ? "active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize tutor panel"
            tabIndex={0}
            onPointerDown={startResize("panel")}
            onKeyDown={nudgeResize("panel")}
            onDoubleClick={resetResize("panel")}
          />
          <AiPanel />
        </div>
      </div>
      {resizing && <div className="resize-veil" />}
    </div>
  );
}
