import { useState } from "react";
import { detectChaptersPrompt, parseChapters } from "../lib/ai";
import { useAnnotations } from "../lib/annotations";
import { useClaudeJob, useSession } from "../lib/session";
import { AnnotationSidebar } from "./AnnotationSidebar";

export function Sidebar() {
  const { meta, reg, model, currentPage, jumpToPage, applyChapters } = useSession();
  const { annotations } = useAnnotations();
  const { state, start } = useClaudeJob();
  const [tab, setTab] = useState<"contents" | "marks">("contents");
  // The chapter the user last clicked. Several chapters can start on the same
  // page (the earlier ones get an empty page range), so the reading position
  // alone can't tell them apart — an explicit pick wins while it still covers
  // the current page.
  const [picked, setPicked] = useState<number | null>(null);

  if (!meta) return <aside className="sidebar" />;

  let activeIndex = -1;
  for (let i = 0; i < meta.chapters.length; i++) {
    if (meta.chapters[i].startPage <= currentPage) activeIndex = i;
  }
  if (picked !== null) {
    const ch = meta.chapters[picked];
    if (
      ch &&
      currentPage >= ch.startPage &&
      currentPage <= Math.max(ch.endPage, ch.startPage)
    ) {
      activeIndex = picked;
    }
  }

  const detect = async () => {
    try {
      const done = await start({
        prompt: detectChaptersPrompt(meta),
        cwd: reg.docDir,
        model: model || null,
      });
      const chapters = parseChapters(done.text, meta.pages);
      setPicked(null);
      await applyChapters(chapters);
    } catch {
      // state.error rendered below
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head sidebar-tabs">
        <button
          className={`sidebar-tab ${tab === "contents" ? "active" : ""}`}
          aria-pressed={tab === "contents"}
          onClick={() => setTab("contents")}
        >
          Contents
        </button>
        <button
          className={`sidebar-tab ${tab === "marks" ? "active" : ""}`}
          aria-pressed={tab === "marks"}
          onClick={() => setTab("marks")}
        >
          Marks
          {annotations.length > 0 && <span className="sidebar-count">{annotations.length}</span>}
        </button>
      </div>
      {tab === "marks" && <AnnotationSidebar />}
      <nav className="chapter-list" hidden={tab !== "contents"}>
        {meta.chapters.map((ch, i) => {
          return (
            <button
              key={i}
              className={`chapter-item ${i === activeIndex ? "active" : ""}`}
              onClick={() => {
                setPicked(i);
                jumpToPage(ch.startPage);
              }}
            >
              <span className="chapter-title">{ch.title}</span>
              <span className="chapter-page">{ch.startPage}</span>
            </button>
          );
        })}
      </nav>
      {tab === "contents" && meta.chaptersSource === "none" && (
        <div className="sidebar-detect">
          <p className="dim small">
            This PDF has no bookmark outline, so chapter-level AI features are
            limited to the whole document.
          </p>
          <button className="btn ghost wide" onClick={detect} disabled={state.running}>
            {state.running ? "Detecting…" : "Detect chapters with AI"}
          </button>
          {state.error && <p className="dim small">{state.error}</p>}
        </div>
      )}
      {tab === "contents" && meta.chaptersSource === "ai" && (
        <div className="sidebar-note">Chapters reconstructed by AI</div>
      )}
    </aside>
  );
}
