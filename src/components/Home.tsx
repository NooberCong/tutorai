/** Library screen: open a PDF, resume recent documents. */

import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { LibraryEntry } from "../lib/types";
import { claudeVersion, getLibrary, readDocText, removeLibraryEntry } from "../lib/tauri";
import { Close, LogoMark, Plus } from "./Icons";

export function Home(props: { onOpen: (path: string) => void; opening: string | null }) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [claude, setClaude] = useState<string | null | undefined>(undefined);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    getLibrary()
      .then((entries) => {
        setLibrary(entries);
        for (const entry of entries) {
          readDocText(entry.docId, "cover.txt")
            .then((url) => {
              if (url?.startsWith("data:image/")) {
                setCovers((prev) => ({ ...prev, [entry.docId]: url }));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    claudeVersion().then(setClaude).catch(() => setClaude(null));
  }, []);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") setDragging(true);
      else if (event.payload.type === "leave") setDragging(false);
      else if (event.payload.type === "drop") {
        setDragging(false);
        const pdf = event.payload.paths.find((p) => p.toLowerCase().endsWith(".pdf"));
        if (pdf) props.onOpen(pdf);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async () => {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (typeof path === "string") props.onOpen(path);
  };

  const remove = async (docId: string) => {
    await removeLibraryEntry(docId).catch(() => {});
    setLibrary((prev) => prev.filter((e) => e.docId !== docId));
  };

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-brand">
          <LogoMark size={26} />
          <span className="wordmark">TutorAI</span>
        </div>
        <button className="btn primary" onClick={pick} disabled={!!props.opening}>
          <Plus width={13} height={13} />
          {props.opening ? "Opening…" : "Open PDF"}
        </button>
      </nav>

      <div className="home-scroll">
        <div className="home-inner">
          {claude === null && (
            <div className="banner warn">
              The <code>claude</code> CLI was not found on PATH. Install and sign in
              to Claude Code, then restart TutorAI — every AI feature runs through it.
            </div>
          )}

          {library.length === 0 ? (
            <header className="home-hero">
              <h1>
                Every book, with a <em>tutor</em> inside.
              </h1>
              <p>
                Read any PDF. Get page-cited summaries, quizzes, answers about the
                page you're on — even a coding project built from its chapters.
              </p>
              <button className="drop-zone" onClick={pick}>
                <span className="drop-title">
                  {props.opening ? "Opening…" : "Open your first PDF"}
                </span>
                <span className="drop-sub">click to browse, or drop a file anywhere</span>
              </button>
            </header>
          ) : (
            <section className="library">
              <div className="library-head">
                <h2>Library</h2>
                <span className="library-count">
                  {library.length} {library.length === 1 ? "book" : "books"}
                </span>
              </div>
              <div className="library-grid">
                {library.map((entry) => (
                  <div
                    key={entry.docId}
                    className="book"
                    role="button"
                    tabIndex={0}
                    onClick={() => props.onOpen(entry.path)}
                    onKeyDown={(e) => e.key === "Enter" && props.onOpen(entry.path)}
                  >
                    <div className="book-cover">
                      {covers[entry.docId] ? (
                        <img src={covers[entry.docId]} alt="" draggable={false} />
                      ) : (
                        <div className="spine">
                          <span className="spine-title">{entry.title}</span>
                          <span className="spine-rule" />
                        </div>
                      )}
                      {entry.lastPage > 1 && (
                        <div className="book-progress">
                          <i
                            style={{
                              width: `${Math.min(100, (entry.lastPage / entry.pages) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                      <button
                        className="book-remove"
                        title="Remove from library"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(entry.docId);
                        }}
                      >
                        <Close width={12} height={12} />
                      </button>
                    </div>
                    <span className="book-title">{entry.title}</span>
                    <span className="book-meta">
                      {entry.lastPage > 1
                        ? `p.${entry.lastPage} of ${entry.pages}`
                        : `${entry.pages} pages`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {claude && <footer className="home-foot">{claude} · local · no api keys</footer>}
        </div>
      </div>

      {dragging && <div className="drop-veil">Drop to open</div>}
    </div>
  );
}
