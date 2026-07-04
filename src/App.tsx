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
import { SelectionPopover } from "./components/SelectionPopover";
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
  useEffect(() => {
    initialFile()
      .then((path) => {
        if (path) openPath(path);
      })
      .catch(() => {});
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
      <DocScreen
        onHome={goHome}
        initialPage={view.initialPage}
        initialScroll={view.initialScroll}
      />
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
const SIDEBAR = { key: "tutorai.sidebar-w", def: 256, min: 200, max: 420 };
const PANEL = { key: "tutorai.panel-w", def: 400, min: 330, max: 640 };
type PanelSpec = typeof SIDEBAR;

function loadWidth(spec: PanelSpec): number {
  const n = Number(localStorage.getItem(spec.key));
  return Number.isFinite(n) ? clampWidth(spec, n) : spec.def;
}
function clampWidth(spec: PanelSpec, w: number): number {
  return Math.min(Math.max(w, spec.min), spec.max);
}

function DocScreen(props: {
  onHome: () => void;
  initialPage: number;
  initialScroll: number;
}) {
  const { extractProgress, panelRequest } = useSession();
  const [scale, setScale] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("tutorai.sidebar-open") !== "0",
  );
  const [panelOpen, setPanelOpen] = useState(
    () => localStorage.getItem("tutorai.panel-open") !== "0",
  );

  // Remember panel visibility across restarts (covers every way they change,
  // including panel requests force-opening the tutor).
  useEffect(() => {
    localStorage.setItem("tutorai.sidebar-open", sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);
  useEffect(() => {
    localStorage.setItem("tutorai.panel-open", panelOpen ? "1" : "0");
  }, [panelOpen]);
  const [sidebarW, setSidebarW] = useState(() => loadWidth(SIDEBAR));
  const [panelW, setPanelW] = useState(() => loadWidth(PANEL));
  const [resizing, setResizing] = useState<"sidebar" | "panel" | null>(null);
  const readerHostRef = useRef<HTMLDivElement>(null);

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
        localStorage.setItem(spec.key, String(last));
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
        localStorage.setItem(spec.key, String(next));
        return next;
      });
    };

  const resetResize = (which: "sidebar" | "panel") => () => {
    const spec = which === "sidebar" ? SIDEBAR : PANEL;
    (which === "sidebar" ? setSidebarW : setPanelW)(spec.def);
    localStorage.setItem(spec.key, String(spec.def));
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
          />
          <SelectionPopover hostRef={readerHostRef} />
          {extractProgress && (
            <div className="extract-pill">
              <span>Indexing for AI</span>
              <span className="count">
                {extractProgress.done}/{extractProgress.total}
              </span>
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
