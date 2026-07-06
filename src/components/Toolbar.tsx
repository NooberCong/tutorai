import { useSession } from "../lib/session";
import {
  ChevronLeft,
  FitWidth,
  Minus,
  PanelLeft,
  Plus,
  Snip,
  Spark,
} from "./Icons";

export function Toolbar(props: {
  onHome: () => void;
  scale: number | null;
  setScale: (s: number | null) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  panelOpen: boolean;
  togglePanel: () => void;
  snipMode: boolean;
  toggleSnip: () => void;
}) {
  const { meta, pdf, currentPage, jumpToPage } = useSession();

  const zoom = (dir: 1 | -1) => {
    const current = props.scale ?? 1;
    const next = Math.min(Math.max(current * (dir > 0 ? 1.15 : 1 / 1.15), 0.4), 3);
    props.setScale(Number(next.toFixed(2)));
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button className="icon-btn" onClick={props.onHome} title="Back to library">
          <ChevronLeft />
        </button>
        <button
          className={`icon-btn ${props.sidebarOpen ? "active" : ""}`}
          onClick={props.toggleSidebar}
          title="Contents"
          aria-pressed={props.sidebarOpen}
        >
          <PanelLeft />
        </button>
        <span className="doc-title">{meta?.title ?? "…"}</span>
      </div>

      <form
        className="page-nav"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("page") as HTMLInputElement;
          const page = parseInt(input.value, 10);
          if (!Number.isNaN(page)) jumpToPage(page);
          input.blur();
        }}
      >
        <input
          name="page"
          key={currentPage}
          defaultValue={currentPage}
          inputMode="numeric"
          aria-label="Page"
        />
        <span className="page-total">/ {pdf.numPages}</span>
      </form>

      <div className="toolbar-group end">
        <button className="icon-btn" onClick={() => zoom(-1)} title="Zoom out">
          <Minus />
        </button>
        <button className="icon-btn" onClick={() => zoom(1)} title="Zoom in">
          <Plus />
        </button>
        <button
          className={`icon-btn ${props.scale === null ? "active" : ""}`}
          onClick={() => props.setScale(null)}
          title="Fit to width"
          aria-pressed={props.scale === null}
        >
          <FitWidth />
        </button>
        <span className="toolbar-sep" />
        <button
          className={`icon-btn ${props.snipMode ? "active" : ""}`}
          onClick={props.toggleSnip}
          title="Ask about a figure — drag a box around anything on the page (Esc to cancel)"
          aria-pressed={props.snipMode}
        >
          <Snip />
        </button>
        <button
          className={`ai-toggle ${props.panelOpen ? "active" : ""}`}
          onClick={props.togglePanel}
          title="AI study panel"
          aria-pressed={props.panelOpen}
        >
          <Spark />
          Tutor
        </button>
      </div>
    </header>
  );
}
