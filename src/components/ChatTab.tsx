import { useEffect, useRef, useState } from "react";
import {
  chatSystemPreamble,
  questionWithReadingContext,
} from "../lib/ai";
import { useClaudeJob, useSession } from "../lib/session";
import { ActivityFeed, Md, Spinner } from "./AiPanel";
import { ChatGlyph, PageMark, Send, Stop } from "./Icons";

export function ChatTab() {
  const {
    meta, reg, model, artifacts, updateArtifacts,
    currentPage, getPageTexts, panelRequest,
  } = useSession();
  const { state, start, cancel } = useClaudeJob();
  const [input, setInput] = useState("");
  const [withContext, setWithContext] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const handledRequest = useRef(0);

  const { messages, sessionId } = artifacts.chat;

  // Keep the transcript pinned to the bottom while streaming.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, state.text]);

  const send = async (displayText: string, sendText: string) => {
    if (!meta || state.running) return;
    updateArtifacts((a) => ({
      ...a,
      chat: {
        ...a.chat,
        messages: [...a.chat.messages, { role: "user", text: displayText, page: currentPage }],
      },
    }));
    const prompt = sessionId
      ? sendText
      : `${chatSystemPreamble(meta)}\n\n${sendText}`;
    try {
      const done = await start({
        prompt,
        cwd: reg.docDir,
        model: model || null,
        resumeSession: sessionId,
      });
      updateArtifacts((a) => ({
        ...a,
        chat: {
          sessionId: done.sessionId ?? a.chat.sessionId,
          messages: [...a.chat.messages, { role: "assistant", text: done.text }],
        },
      }));
    } catch {
      // error banner rendered from state.error; the question stays in the log
    }
  };

  const sendTyped = async () => {
    const question = input.trim();
    if (!question) return;
    setInput("");
    if (withContext) {
      const pages = await getPageTexts([currentPage - 1, currentPage, currentPage + 1]);
      await send(question, questionWithReadingContext(question, currentPage, pages));
    } else {
      await send(question, question);
    }
  };

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRequest]);

  return (
    <div className="tab-pane chat-pane">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && !state.running && (
          <div className="ai-empty">
            <ChatGlyph />
            <p className="lede">Ask about what you're reading</p>
            <p>
              Answers are grounded in the book and cite their pages. With reading
              context on, the tutor also sees the page you're on — and selecting
              text in the PDF offers "Explain" right where you are.
            </p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="chat-msg user">
              <div className="chat-user-text">{m.text}</div>
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
            {state.text ? <Md text={state.text} /> : <Spinner label="Reading…" />}
            <ActivityFeed items={state.activity} compact />
          </div>
        )}
        {state.error && <div className="banner warn">{state.error}</div>}
      </div>

      <div className="chat-composer">
        <div className="composer-box">
          <textarea
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
                  onClick={() =>
                    updateArtifacts((a) => ({
                      ...a,
                      chat: { sessionId: null, messages: [] },
                    }))
                  }
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
                disabled={!input.trim()}
                onClick={() => void sendTyped()}
                title="Send (Enter)"
              >
                <Send width={14} height={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
