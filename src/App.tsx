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
import { TabStrip } from "./components/TabStrip";
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

/** One open document. `page`/`scroll` are where the reader resumes when the
 *  tab (re)activates — seeded from the library index on open, refreshed by the
 *  session's final flush whenever the tab is switched away from. */
interface DocTab {
  reg: RegisteredDoc;
  pdf: PdfDoc;
  fileName: string;
  title: string;
  page: number;
  scroll: number;
}

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
  // Open documents, one tab each; a null activeId shows the library. Every
  // document lives in at most one tab: opening it again focuses the existing
  // tab (docId is a content hash, so the same file under two paths dedups too).
  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // docIds with a tab, updated synchronously — `tabs` itself lags a just-run
  // open by one render, which would let a queued duplicate slip through.
  const openIds = useRef(new Set<string>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const doOpen = useCallback(async (
    path: string,
    opts?: { activate?: boolean; quiet?: boolean },
  ): Promise<string | null> => {
    const activate = opts?.activate ?? true;
    setOpening(path);
    try {
      const reg = await registerPdf(path);
      if (openIds.current.has(reg.docId)) {
        if (activate) setActiveId(reg.docId);
        return reg.docId;
      }
      const pdf = await loadPdf(pdfUrl(path));
      const fileName = path.split(/[\\/]/).pop() ?? "document.pdf";
      // Resume where the reader left off last time (from the library index).
      const entry = await getLibrary()
        .then((lib) => lib.find((e) => e.docId === reg.docId))
        .catch(() => undefined);
      const tab: DocTab = {
        reg,
        pdf,
        fileName,
        title: entry?.title ?? fileName.replace(/\.pdf$/i, ""),
        page: Math.min(Math.max(entry?.lastPage ?? 1, 1), pdf.numPages),
        scroll: entry?.lastScroll ?? 0,
      };
      openIds.current.add(reg.docId);
      setTabs((prev) => [...prev, tab]);
      if (activate) setActiveId(reg.docId);
      ensureCover(reg.docId, pdf);
      return reg.docId;
    } catch (e) {
      console.error("failed to open PDF", e);
      if (!opts?.quiet) alert(`Could not open this PDF.\n${e}`);
      return null;
    } finally {
      setOpening(null);
    }
  }, []);

  // Opens are serialized: a burst of requests (double click, several OS
  // "open with" files at once) runs one at a time, so each sees the tabs the
  // previous one created and focuses them instead of racing to duplicates.
  const openQueue = useRef<Promise<unknown>>(Promise.resolve());
  const openPath = useCallback(
    (path: string, opts?: { activate?: boolean; quiet?: boolean }) => {
      const run = openQueue.current.then(() => doOpen(path, opts));
      openQueue.current = run;
      return run;
    },
    [doOpen],
  );

  // Boot: reopen last session's tabs, then any PDF the OS launched us with
  // (file association). The saved set is captured at first render, before the
  // save effect below can overwrite it. Restores are enqueued synchronously so
  // they precede the OS file in the open queue and tab order stays stable;
  // a vanished file just drops its tab (quiet). The OS file activates itself
  // when it opens; otherwise the saved active tab is focused once everything
  // lands — unless something else (e.g. the user) claimed focus meanwhile.
  // The splash stays up until both settle so cold starts never flash a bare
  // shell. Later launches while the app runs hand their file over via the
  // single-instance plugin's "open-file" event.
  const [savedTabs] = useState(() => getSetting("openTabs"));
  useEffect(() => {
    const restore = Promise.all(
      savedTabs.paths.map((path) =>
        openPath(path, { activate: false, quiet: true }).then((docId) => ({ path, docId })),
      ),
    ).then((results) => {
      const saved = results.find((r) => r.path === savedTabs.activePath)?.docId;
      if (saved) setActiveId((prev) => prev ?? saved);
    });
    const osFile = initialFile()
      .then(async (path) => {
        if (path) await openPath(path);
      })
      .catch(() => {});
    Promise.allSettled([restore, osFile]).then(dismissSplash);
    const unlisten = listen<string>("open-file", (e) => openPath(e.payload));
    return () => {
      unlisten.then((f) => f());
    };
  }, [openPath, savedTabs]);

  // Remember the open tabs (membership, order, active) across restarts.
  useEffect(() => {
    saveSetting("openTabs", {
      paths: tabs.map((t) => t.reg.path),
      activePath: tabs.find((t) => t.reg.docId === activeId)?.reg.path ?? null,
    });
  }, [tabs, activeId]);

  // "Back to library" keeps every tab alive — the strip stays visible on the
  // library screen, so open documents remain one click away.
  const goHome = useCallback(() => setActiveId(null), []);

  const closeTab = useCallback((docId: string) => {
    const idx = tabsRef.current.findIndex((t) => t.reg.docId === docId);
    if (idx < 0) return;
    tabsRef.current[idx].pdf.destroy().catch(() => {});
    openIds.current.delete(docId);
    const remaining = tabsRef.current.filter((t) => t.reg.docId !== docId);
    setTabs(remaining);
    // Closing the active tab lands on its right neighbor (else the new last).
    setActiveId((prev) =>
      prev === docId
        ? (remaining[Math.min(idx, remaining.length - 1)]?.reg.docId ?? null)
        : prev,
    );
  }, []);

  const moveTab = useCallback((from: number, to: number) => {
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const rememberPosition = useCallback(
    (docId: string, page: number, scroll: number) => {
      setTabs((prev) =>
        prev.map((t) => (t.reg.docId === docId ? { ...t, page, scroll } : t)),
      );
    },
    [],
  );

  const active = tabs.find((t) => t.reg.docId === activeId) ?? null;

  return (
    <div className="app-shell">
      {tabs.length > 0 && (
        <TabStrip
          tabs={tabs.map((t) => ({ docId: t.reg.docId, title: t.title }))}
          activeId={active?.reg.docId ?? null}
          onSelect={setActiveId}
          onClose={closeTab}
          onMove={moveTab}
          onNewTab={goHome}
        />
      )}
      {active ? (
        <SessionProvider
          key={active.reg.docId}
          reg={active.reg}
          pdf={active.pdf}
          fileName={active.fileName}
          initialPage={active.page}
          initialScroll={active.scroll}
          onDeactivate={(page, scroll) =>
            rememberPosition(active.reg.docId, page, scroll)
          }
        >
          <InsightsProvider>
            <AnnotationsProvider>
              <DocScreen
                onHome={goHome}
                initialPage={active.page}
                initialScroll={active.scroll}
              />
            </AnnotationsProvider>
          </InsightsProvider>
        </SessionProvider>
      ) : (
        <Home onOpen={openPath} opening={opening} />
      )}
    </div>
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
