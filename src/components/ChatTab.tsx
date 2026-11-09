import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  chatSystemPreamble,
  questionWithImages,
  questionWithReadingContext,
} from "../lib/ai";
import {
  isImagePath,
  saveClipboardImage,
  saveImageFile,
} from "../lib/chatImages";
import { useClaudeJob, useSession } from "../lib/session";
import { docFileUrl, removeDocPath } from "../lib/tauri";
import { ActivityFeed, Md, Spinner } from "./AiPanel";
import { approvalKey, PermissionPrompt } from "./PermissionPrompt";
import { ImageViewer } from "./ImageViewer";
import { ChatGlyph, Close, PageMark, Send, Stop } from "./Icons";
import { recordHabit } from "../lib/hatchery/tracker";
import type { PermissionEvent } from "../lib/types";

export function ChatTab() {
  const {
    meta, reg, model, artifacts, updateArtifacts,
    currentPage, getPageTexts, panelRequest,
  } = useSession();
  const { state, start, cancel, answer } = useClaudeJob();
  const [input, setInput] = useState("");
  const [withContext, setWithContext] = useState(true);
  /** Attached to the next question: doc-relative paths, already on disk. */
  const [images, setImages] = useState<string[]>([]);
  /** Image files are being dragged over the chat. */
  const [dropping, setDropping] = useState(false);
  /** The attached image opened full screen, which flies out of it and back. */
  const [opened, setOpened] = useState<HTMLImageElement | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handledRequest = useRef(0);
  // Follow the stream unless the reader has deliberately scrolled up.
  const pinnedRef = useRef(true);

  const { messages, sessionId } = artifacts.chat;
  // Read when a request arrives mid-run, after the closure that started it.
  const approvedRef = useRef(artifacts.chat.approved);
  approvedRef.current = artifacts.chat.approved;

  // Keep the transcript pinned to the bottom as text streams in and
  // activity entries (tool calls) are appended.
  useEffect(() => {
    const el = logRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, state.text, state.activity, state.permissions]);

  // Grow the input with its content; the CSS max-height caps it.
  useLayoutEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  const send = async (displayText: string, sendText: string, attached: string[] = []) => {
    if (!meta || state.running) return;
    pinnedRef.current = true;
    recordHabit("ask");
    updateArtifacts((a) => ({
      ...a,
      chat: {
        ...a.chat,
        messages: [
          ...a.chat.messages,
          {
            role: "user",
            text: displayText,
            page: currentPage,
            ...(attached.length ? { images: attached } : {}),
          },
        ],
      },
    }));
    const prompt = sessionId
      ? sendText
      : `${chatSystemPreamble(meta)}\n\n${sendText}`;
    try {
      const done = await start({
        prompt,
        cwd: reg.docDir,
        askPermission: true,
        model: model || null,
        resumeSession: sessionId,
      }, (request) => !!approvedRef.current?.includes(approvalKey(request)));
      updateArtifacts((a) => ({
        ...a,
        chat: {
          ...a.chat,
          sessionId: done.sessionId ?? a.chat.sessionId,
          messages: [...a.chat.messages, { role: "assistant", text: done.text }],
        },
      }));
    } catch {
      // error banner rendered from state.error; the question stays in the log
    }
  };

  const answerPermission = (request: PermissionEvent, allow: boolean, remember = false) => {
    answer(request, allow);
    if (!remember) return;
    const key = approvalKey(request);
    approvedRef.current = [...(approvedRef.current ?? []), key];
    updateArtifacts((a) => ({
      ...a,
      chat: { ...a.chat, approved: [...(a.chat.approved ?? []), key] },
    }));
  };
  const asking = state.permissions[0];

  const sendTyped = async () => {
    const question = input.trim();
    const attached = images;
    if (!question && attached.length === 0) return;
    setInput("");
    setImages([]);
    const asked = questionWithImages(question, attached);
    if (withContext) {
      const pages = await getPageTexts([currentPage - 1, currentPage, currentPage + 1]);
      await send(question, questionWithReadingContext(asked, currentPage, pages), attached);
    } else {
      await send(question, asked, attached);
    }
  };

  const attachFiles = async (paths: string[]) => {
    try {
      const rels = await Promise.all(
        paths.filter(isImagePath).map((p) => saveImageFile(reg.docId, p)),
      );
      setImages((prev) => [...prev, ...rels]);
    } catch (e) {
      console.error("attach image failed", e);
    }
  };

  const removeImage = (rel: string) => {
    setImages((prev) => prev.filter((r) => r !== rel));
    removeDocPath(reg.docId, rel).catch(() => {});
  };

  // Alt+V attaches the image on the clipboard (Ctrl+V stays text paste).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyV" || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      if (e.repeat) return;
      saveClipboardImage(reg.docId)
        .then((rel) => {
          if (!rel) return;
          setImages((prev) => [...prev, rel]);
          inputRef.current?.focus();
        })
        .catch((err) => console.error("clipboard image failed", err));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reg.docId]);

  // Image files dropped anywhere on the chat are attached. The webview owns
  // file drops (HTML drop events never fire), so hit-test its positions.
  useEffect(() => {
    let carryingImages = false;
    const overPane = ({ x, y }: { x: number; y: number }) => {
      const r = paneRef.current?.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      return !!r && x / dpr >= r.left && x / dpr <= r.right && y / dpr >= r.top && y / dpr <= r.bottom;
    };
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter") carryingImages = payload.paths.some(isImagePath);
      if (!carryingImages) return;
      if (payload.type === "leave") {
        setDropping(false);
      } else if (payload.type === "drop") {
        setDropping(false);
        if (overPane(payload.position)) void attachFiles(payload.paths);
      } else {
        setDropping(overPane(payload.position));
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg.docId]);

  // Selection popover requests ("Explain" auto-sends, "Ask" prefills).
  useEffect(() => {
    const req = panelRequest;
    if (!req || req.tab !== "chat" || !req.chatDraft) return;
    if (req.nonce === handledRequest.current) return;
    handledRequest.current = req.nonce;
    if (req.autoSend) {
      void send(req.chatDraft, req.chatDraft);
    } else {
      setInput(req.chatDraft);
      // Focus after React commits the value, cursor at the end.
      requestAnimationFrame(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRequest]);

  return (
    <div className="tab-pane chat-pane" ref={paneRef}>
      <div
        className="chat-log"
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {messages.length === 0 && !state.running && (
          <div className="ai-empty">
            <ChatGlyph />
            <p className="lede">Ask about what you're reading</p>
            <p>
              Answers are grounded in the book and cite their pages. With reading
              context on, the tutor also sees the page you're on. Selecting text
              in the PDF offers "Explain" right where you are — and the
              viewfinder in the toolbar lets you draw a box around a figure to
              ask about it.
            </p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="chat-msg user">
              {m.images && (
                <div className="chat-images">
                  {m.images.map((rel) => (
                    <img
                      key={rel}
                      src={docFileUrl(reg.docDir, rel)}
                      alt=""
                      className="zoomable"
                      onClick={(e) => setOpened(e.currentTarget)}
                      // Swept with the stale snips once the chat is old.
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                  ))}
                </div>
              )}
              {m.text && <div className="chat-user-text">{m.text}</div>}
              {m.page ? <span className="chat-page-tag">at p.{m.page}</span> : null}
            </div>
          ) : (
            <div key={i} className="chat-msg assistant">
              <Md text={m.text} />
            </div>
          ),
        )}
        {state.running && (
          <div className="chat-msg assistant">
            {state.text ? (
              <Md text={state.text} streaming />
            ) : (
              !asking && <Spinner label="Reading…" />
            )}
            <ActivityFeed items={state.activity} compact />
            {asking && (
              <PermissionPrompt
                key={asking.requestId}
                request={asking}
                onAnswer={(allow, remember) => answerPermission(asking, allow, remember)}
              />
            )}
          </div>
        )}
        {state.error && <div className="banner warn">{state.error}</div>}
      </div>

      <div className="chat-composer">
        <div className={`composer-box ${dropping ? "dropping" : ""}`}>
          {images.length > 0 && (
            <div className="composer-images">
              {images.map((rel) => (
                <div key={rel} className="composer-image">
                  <img
                    src={docFileUrl(reg.docDir, rel)}
                    alt=""
                    className="zoomable"
                    onClick={(e) => setOpened(e.currentTarget)}
                  />
                  <button
                    onClick={() => removeImage(rel)}
                    title="Remove"
                    aria-label="Remove image"
                  >
                    <Close width={9} height={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            rows={2}
            placeholder="Ask about what you're reading…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendTyped();
              }
            }}
          />
          <div className="composer-row">
            <div className="composer-chips">
              <button
                className={`chip ${withContext ? "active" : ""}`}
                onClick={() => setWithContext((v) => !v)}
                aria-pressed={withContext}
                title="Attach the text of the page you're reading (and its neighbors) to your question"
              >
                <PageMark />
                p.{currentPage}
              </button>
              {messages.length > 0 && !state.running && (
                <button
                  className="chip"
                  onClick={() => {
                    updateArtifacts((a) => ({
                      ...a,
                      chat: { sessionId: null, messages: [] },
                    }));
                    // Snips and images only exist as attachments of this
                    // conversation.
                    setImages([]);
                    removeDocPath(reg.docId, "snips").catch(() => {});
                  }}
                >
                  New conversation
                </button>
              )}
            </div>
            {state.running ? (
              <button className="send-btn stop" onClick={cancel} title="Stop">
                <Stop width={13} height={13} />
              </button>
            ) : (
              <button
                className="send-btn"
                disabled={!input.trim() && images.length === 0}
                onClick={() => void sendTyped()}
                title="Send (Enter)"
              >
                <Send width={14} height={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      {opened && <ImageViewer src={opened.src} from={opened} alt="" onClose={() => setOpened(null)} />}
    </div>
  );
}
