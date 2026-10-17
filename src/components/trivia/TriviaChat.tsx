/** Talking about a trivia question: a box to ask Claude, always at hand,
 *  the reader's selection pill (Translate, Explain, Ask), and the thread
 *  they start. The thread belongs to the question on screen and is gone once
 *  the player moves on — the story is the keepsake, not the chat. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { explainTriviaMessage, triviaAnsweredNote, triviaChatPreamble } from "../../lib/ai";
import { useClaudeJob } from "../../lib/session";
import { getSetting } from "../../lib/settings";
import { triviaDir } from "../../lib/tauri";
import type { TriviaQuestion } from "../../lib/trivia/game";
import { Spinner } from "../AiPanel";
import { ChatGlyph, DictionaryGlyph, Send, Spark, Stop } from "../Icons";
import { TranslatePopup, type DictQuery } from "../TranslatePopup";
import { Prose } from "./Prose";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export type TriviaChatState = ReturnType<typeof useTriviaChat>;

/** `picked` is the player's answer, null until they answer. */
export function useTriviaChat(q: TriviaQuestion, picked: number | null) {
  const answered = picked !== null;
  const { state, start, cancel } = useClaudeJob();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  /** Bumped by Ask, to focus the composer. */
  const [asked, setAsked] = useState(0);
  const session = useRef<string | null>(null);
  /** Whether Claude has been told the answer. */
  const knowsAnswer = useRef(false);

  // Leaving the question stops a reply nobody will read.
  useEffect(() => cancel, [cancel]);

  const send = async (shown: string, text: string) => {
    if (state.running) return;
    setMessages((m) => [...m, { role: "user", text: shown }]);
    setDraft("");
    let prompt = text;
    if (!session.current) prompt = `${triviaChatPreamble(q, picked, new Date())}

${text}`;
    else if (answered && !knowsAnswer.current) prompt = `${triviaAnsweredNote(q, picked)}

${text}`;
    knowsAnswer.current = answered;
    try {
      const done = await start({
        prompt,
        cwd: await triviaDir(),
        model: getSetting("model") || null,
        resumeSession: session.current,
      });
      session.current = done.sessionId ?? session.current;
      setMessages((m) => [...m, { role: "assistant", text: done.text }]);
    } catch {
      // shown from state.error; the question stays in the thread
    }
  };

  return {
    job: state,
    messages,
    draft,
    setDraft,
    cancel,
    send,
    asked,
    explain: (quote: string) => void send(`Explain “${clip(quote)}”`, explainTriviaMessage(quote)),
    ask: (quote: string) => {
      setDraft(`About “${clip(quote)}”: `);
      setAsked((n) => n + 1);
    },
  };
}

/** A long quote, shortened for the thread (Claude still gets all of it). */
const clip = (text: string) => (text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text);

/** The conversation so far, once there is one. */
export function TriviaThread(props: { chat: TriviaChatState }) {
  const { job, messages } = props.chat;
  const end = useRef<HTMLDivElement>(null);

  // Sending brings the thread's end into view, so the reply grows where the
  // player is looking.
  useEffect(() => {
    if (messages.at(-1)?.role === "user") end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  if (!messages.length) return null;
  return (
    <section className="trivia-chat">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="chat-msg user">
            <div className="chat-user-text">{m.text}</div>
          </div>
        ) : (
          <Prose key={i} text={m.text} className="trivia-answer" />
        ),
      )}
      {job.running &&
        (job.text ? (
          <Prose text={job.text} className="trivia-answer streaming" />
        ) : (
          <Spinner label={job.activity.length ? "Looking it up…" : "Thinking…"} />
        ))}
      {job.error && <div className="banner warn">{job.error}</div>}
      <div className="trivia-chat-end" ref={end} />
    </section>
  );
}

/** Always at hand: pinned to the bottom of the screen while the question
 *  scrolls under it. */
export function TriviaComposer(props: { chat: TriviaChatState }) {
  const { job, messages, draft, setDraft, send, cancel, asked } = props.chat;
  const input = useRef<HTMLTextAreaElement>(null);

  // Grow the input with its content; the CSS max-height caps it.
  useLayoutEffect(() => {
    const ta = input.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft]);

  // Ask fills in the draft: focus it, cursor at the end.
  useEffect(() => {
    const ta = input.current;
    if (!ta || !asked) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [asked]);

  const typed = draft.trim();
  const submit = () => typed && void send(typed, typed);

  return (
    <div className="trivia-composer">
      <div className="composer-box">
        <textarea
          ref={input}
          value={draft}
          rows={1}
          placeholder={messages.length ? "Ask a follow-up…" : "Ask about this question…"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              input.current?.blur();
            }
          }}
        />
        {job.running ? (
          <button className="send-btn stop" onClick={cancel} title="Stop">
            <Stop width={13} height={13} />
          </button>
        ) : (
          <button className="send-btn" disabled={!typed} onClick={submit} title="Send (Enter)">
            <Send width={14} height={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface Selection {
  text: string;
  /** Host-relative point under the selection's last line. */
  x: number;
  y: number;
}

/** The reader's selection pill, for trivia: the dictionary and Claude, no
 *  markup (there's no page to mark). */
export function TriviaSelection(props: { hostRef: RefObject<HTMLDivElement | null>; chat: TriviaChatState }) {
  const { hostRef, chat } = props;
  const [sel, setSel] = useState<Selection | null>(null);
  const [dict, setDict] = useState<DictQuery | null>(null);
  const pill = useRef<HTMLDivElement>(null);

  const capture = useCallback(() => {
    const host = hostRef.current;
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    const typing = document.activeElement?.closest("textarea, input");
    if (!host || !selection?.rangeCount || typing || !/[\p{L}\p{N}]/u.test(text) || text.length > 4000) {
      setSel(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!host.contains(range.commonAncestorContainer)) return setSel(null);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) return;
    const box = host.getBoundingClientRect();
    setSel({ text, x: last.left - box.left + last.width / 2, y: last.bottom - box.top + 10 });
  }, [hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onUp = () => setTimeout(capture, 0);
    // Anywhere on screen, not just the column: a click in the margins
    // clears the selection too.
    const onDown = (e: Event) => {
      if (!pill.current?.contains(e.target as Node)) setSel(null);
    };
    host.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      host.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, [capture, hostRef]);

  // Centered on the selection, clamped inside the host by its real width.
  useLayoutEffect(() => {
    const el = pill.current;
    const host = hostRef.current;
    if (!el || !host || !sel) return;
    const half = el.offsetWidth / 2 + 8;
    el.style.left = `${Math.min(Math.max(sel.x, half), host.clientWidth - half)}px`;
  }, [sel, hostRef]);

  const canTranslate = !!sel && sel.text.length <= 64 && sel.text.split(/\s+/).length <= 3;
  const act = (fn: (s: Selection) => void) => {
    if (!sel) return;
    fn(sel);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };
  const translate = () => act((s) => setDict(s));
  const closeDict = useCallback(() => setDict(null), []);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") act(() => {});
      else if (e.key.toLowerCase() === "t" && canTranslate) {
        e.preventDefault();
        e.stopImmediatePropagation();
        translate();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <>
      {dict && <TranslatePopup query={dict} hostRef={hostRef} onClose={closeDict} />}
      {sel && (
        <div ref={pill} className="selection-popover" style={{ left: sel.x, top: sel.y }}>
          {canTranslate && (
            <>
              <button title="Translate (T)" onClick={translate}>
                <DictionaryGlyph />
                Translate
              </button>
              <span className="sep" />
            </>
          )}
          <button disabled={chat.job.running} onClick={() => act((s) => chat.explain(s.text))}>
            <Spark />
            Explain
          </button>
          <span className="sep" />
          <button onClick={() => act((s) => chat.ask(s.text))}>
            <ChatGlyph />
            Ask about this
          </button>
        </div>
      )}
    </>
  );
}
