/** Daily Trivia: setup (picking topics is the opt-in), today's pack, the
 *  record so far, and past packs to replay. Playing happens in TriviaPlayer. */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { dayKey } from "../../lib/hatchery/game";
import { saveSetting, useSetting } from "../../lib/settings";
import { checkTrivia, useTriviaWriter, type WriterStatus } from "../../lib/trivia/daily";
import type { TriviaPack, TriviaState } from "../../lib/trivia/game";
import { packFor, score, streak } from "../../lib/trivia/game";
import { useTrivia } from "../../lib/trivia/store";
import { MIN_TOPICS, TOPIC, TOPICS } from "../../lib/trivia/topics";
import { TriviaPlayer } from "./TriviaPlayer";
import "./trivia.css";

export function TriviaScreen() {
  const on = useSetting("trivia");
  const s = useTrivia();
  const [playing, setPlaying] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Opening the tab is a good moment to write today's pack, if it's due.
  useEffect(() => {
    if (on) void checkTrivia();
  }, [on]);

  if (!on) {
    return (
      <div className="trivia">
        <Setup />
      </div>
    );
  }
  const pack = playing && packFor(s, playing);
  if (pack) {
    return (
      <div className="trivia">
        <TriviaPlayer pack={pack} onExit={() => setPlaying(null)} />
      </div>
    );
  }

  const today = dayKey(new Date());
  const past = s.packs.filter((p) => p.day !== today);
  return (
    <div className="trivia">
      <Today s={s} today={today} onPlay={setPlaying} />
      {s.played > 0 && <Record s={s} />}
      {past.length > 0 && (
        <section className="trivia-past">
          <h2>Past days</h2>
          {past.map((p) => (
            <button key={p.day} className="past-row" onClick={() => setPlaying(p.day)}>
              <span>{dateLabel(p.day)}</span>
              <span className="past-topics">{topicList(p)}</span>
              <span className="past-score">
                {p.finishedAt ? `${score(p)}/${p.questions.length}` : "play"}
              </span>
            </button>
          ))}
        </section>
      )}
      {editing ? (
        <TopicEditor onDone={() => setEditing(false)} />
      ) : (
        <button className="link-btn trivia-edit" onClick={() => setEditing(true)}>
          Change topics
        </button>
      )}
    </div>
  );
}

/** First run: what this is, and the topics. Starting is the opt-in. */
function Setup() {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <section className="trivia-setup">
      <h1>
        Ten questions a day, <em>each with a story.</em>
      </h1>
      <p>
        Pick what you're curious about. Each day Claude looks into what's new there and writes
        ten questions — and the story behind every answer.
      </p>
      <TopicPicker picked={picked} setPicked={setPicked} />
      <div className="trivia-setup-foot">
        <span className="fine">Runs once a day on your Claude plan.</span>
        <button
          className="btn primary"
          disabled={picked.length < MIN_TOPICS}
          onClick={() => {
            saveSetting("triviaTopics", picked);
            saveSetting("trivia", true);
            void checkTrivia();
          }}
        >
          {picked.length < MIN_TOPICS ? `Pick ${MIN_TOPICS - picked.length} more` : "Start daily trivia"}
        </button>
      </div>
    </section>
  );
}

function TopicPicker(props: { picked: string[]; setPicked: Dispatch<SetStateAction<string[]>> }) {
  const { picked, setPicked } = props;
  return (
    <div className="topic-grid" role="group" aria-label="Topics">
      {TOPICS.map((t) => {
        const on = picked.includes(t.id);
        return (
          <button
            key={t.id}
            className={`topic ${on ? "on" : ""}`}
            aria-pressed={on}
            title={t.angle}
            onClick={() =>
              setPicked((ids) => (ids.includes(t.id) ? ids.filter((id) => id !== t.id) : [...ids, t.id]))
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function TopicEditor(props: { onDone: () => void }) {
  const saved = useSetting("triviaTopics");
  const [picked, setPicked] = useState(saved);
  return (
    <section className="trivia-topics">
      <h2>Topics</h2>
      <TopicPicker picked={picked} setPicked={setPicked} />
      <div className="trivia-setup-foot">
        <span className="fine">Changes apply from the next day's questions.</span>
        <button className="btn" onClick={props.onDone}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={picked.length < MIN_TOPICS}
          onClick={() => {
            saveSetting("triviaTopics", picked);
            props.onDone();
          }}
        >
          {picked.length < MIN_TOPICS ? `Pick ${MIN_TOPICS - picked.length} more` : "Save"}
        </button>
      </div>
    </section>
  );
}

function Today(props: { s: TriviaState; today: string; onPlay: (day: string) => void }) {
  const { s, today } = props;
  const pack = packFor(s, today);
  const days = streak(s, today);
  const answered = pack?.answers.filter((a) => a !== null).length ?? 0;
  return (
    <section className="trivia-today">
      <div className="today-head">
        <span className="today-date">{dateLabel(today)}</span>
        {days > 0 && (
          <span className="streak" title="Days in a row with the day's questions finished">
            <b>{days}</b> day streak
            {s.freezes > 0 && (
              <span
                className="freezes"
                title={`${s.freezes} freeze${s.freezes > 1 ? "s" : ""}: covers a missed day. You earn one every 7 days of streak.`}
              >
                {Array.from({ length: s.freezes }, (_, i) => (
                  <Snowflake key={i} />
                ))}
              </span>
            )}
          </span>
        )}
      </div>
      {!pack ? (
        <Writer />
      ) : pack.finishedAt ? (
        <div className="today-body">
          <div className="today-score">
            {score(pack)}
            <span className="of">/{pack.questions.length}</span>
          </div>
          <p className="today-sub">Done for today. New questions tomorrow.</p>
          <button className="btn" onClick={() => props.onPlay(today)}>
            Read the stories again
          </button>
        </div>
      ) : (
        <div className="today-body">
          <p className="today-topics">{topicList(pack)}</p>
          <p className="today-sub">
            {answered
              ? `${answered} of ${pack.questions.length} answered`
              : `${pack.questions.length} questions, each with the story behind it`}
          </p>
          <button className="btn primary" onClick={() => props.onPlay(today)}>
            {answered ? "Continue" : "Start"}
          </button>
        </div>
      )}
    </section>
  );
}

const FAILED: Record<Exclude<WriterStatus, { kind: "idle" | "writing" }>["reason"], string> = {
  nocli: "Claude Code wasn't found, so today's questions couldn't be written.",
  signin: "Claude Code is signed out. Run claude in a terminal to sign in.",
  usage: "Your Claude usage has run out for now.",
  error: "Today's questions didn't come out right.",
};

/** Today's pack is still being written, or couldn't be. */
function Writer() {
  const w = useTriviaWriter();
  if (w.kind === "writing") {
    return (
      <div className="today-body">
        <div className="spinner-row">
          <span className="spinner" />
          Researching today's questions…
        </div>
        <p className="writer-trail">
          {w.searches > 0 ? `${w.searches} lookups${w.last ? ` · ${w.last}` : ""}` : " "}
        </p>
      </div>
    );
  }
  if (w.kind === "failed") {
    const at = w.retryAt && new Date(w.retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return (
      <div className="today-body">
        <p className="today-sub">
          {FAILED[w.reason]} {at ? `Trying again at ${at}.` : ""}
        </p>
        <button className="btn" onClick={() => void checkTrivia(true)}>
          Try now
        </button>
      </div>
    );
  }
  return (
    <div className="today-body">
      <p className="today-sub">Today's questions are on their way.</p>
    </div>
  );
}

function Record(props: { s: TriviaState }) {
  const { s } = props;
  const topics = Object.entries(s.topics)
    .filter(([id, t]) => TOPIC[id] && t.answered > 0)
    .sort((a, b) => b[1].answered - a[1].answered);
  const answered = topics.reduce((n, [, t]) => n + t.answered, 0);
  const correct = topics.reduce((n, [, t]) => n + t.correct, 0);
  return (
    <section className="trivia-record">
      <div className="record-stats">
        <Stat value={String(s.played)} label="days played" />
        <Stat value={String(s.best)} label="best streak" />
        <Stat value={answered ? `${Math.round((correct / answered) * 100)}%` : "–"} label="correct" />
      </div>
      <ul className="record-topics">
        {topics.map(([id, t]) => (
          <li key={id}>
            <span>{TOPIC[id].label}</span>
            <i className="record-bar">
              <i style={{ width: `${(t.correct / t.answered) * 100}%` }} />
            </i>
            <span className="record-n">
              {t.correct}/{t.answered}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <div className="record-stat">
      <b>{props.value}</b>
      <span>{props.label}</span>
    </div>
  );
}

function Snowflake() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path
        d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5M4.6 1.8 6 3.1l1.4-1.3M4.6 10.2 6 8.9l1.4 1.3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function topicList(pack: TriviaPack): string {
  return [...new Set(pack.questions.map((q) => TOPIC[q.topic]?.label ?? q.topic))].join(" · ");
}

function dateLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
