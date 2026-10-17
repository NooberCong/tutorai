/** Plays one day's pack: a question, its four choices, and once answered
 *  the story behind it. Answers lock. The last answer closes the pack and
 *  pays its reward; the results show what it earned. */

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { renderMarkdown } from "../../lib/markdown";
import { useSetting } from "../../lib/settings";
import { companion, homeOf, speciesById, stageOf } from "../../lib/hatchery/game";
import { useHatchery } from "../../lib/hatchery/store";
import type { TriviaImage, TriviaPack, TriviaVideo } from "../../lib/trivia/game";
import { commonsImage, commonsPage, youtubeThumb, youtubeWatch } from "../../lib/trivia/media";
import { answer, score } from "../../lib/trivia/game";
import { finishPack, mutateTrivia } from "../../lib/trivia/store";
import { TOPIC } from "../../lib/trivia/topics";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Close } from "../Icons";
import { GrowthMeter } from "../hatchery/Meter";
import { ELEMENT_LABEL } from "../hatchery/labels";
import { Habitat, PetSprite, PixelImg, crackOf, eggUrl } from "../hatchery/sprites";

export function TriviaPlayer(props: { pack: TriviaPack; onExit: () => void }) {
  const { pack } = props;
  const total = pack.questions.length;
  const [step, setStep] = useState(() => {
    const open = pack.answers.findIndex((a) => a === null);
    return open === -1 ? total : open;
  });

  if (step >= total) {
    return <Results pack={pack} onReview={setStep} onExit={props.onExit} />;
  }

  // After a question: the next unanswered one (wrapping round), or once
  // all are answered simply the next — past the last are the results.
  const open = pack.answers.findIndex((a, i) => i > step && a === null);
  const firstOpen = pack.answers.indexOf(null);
  const target = open >= 0 ? open : firstOpen >= 0 ? firstOpen : step + 1;
  const pick = (i: number) => {
    if (pack.answers[step] !== null) return;
    mutateTrivia((s) => answer(s, pack.day, step, i));
    if (!pack.answers.includes(null)) finishPack(pack.day);
  };

  return (
    <div className="trivia-player">
      <div className="quiz-progress">
        <button className="chip" onClick={props.onExit}>
          <ChevronLeft />
          Trivia
        </button>
        <span className="step">
          {step + 1} / {total}
        </span>
        <div className="quiz-nav">
          <button className="icon-btn" title="Previous question" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronLeft />
          </button>
          <button
            className="icon-btn"
            title="Next question"
            disabled={step === total - 1 && firstOpen >= 0}
            onClick={() => setStep(step + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="progress-track">
        <i style={{ width: `${(pack.answers.filter((a) => a !== null).length / total) * 100}%` }} />
      </div>

      <Question
        key={step}
        pack={pack}
        step={step}
        onPick={pick}
        onNext={() => setStep(target)}
        nextLabel={target >= total ? "See results" : "Next"}
      />
    </div>
  );
}

function Question(props: {
  pack: TriviaPack;
  step: number;
  onPick: (i: number) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const { pack, step, onPick, onNext } = props;
  const q = pack.questions[step];
  const picked = pack.answers[step];
  const answered = picked !== null;
  const right = picked === q.answer;
  const reveal = useRef<HTMLDivElement>(null);
  const justAnswered = useRef(false);

  // When the player answers (not when revisiting), lift the story into view
  // if it starts low — to a third of the way down, so the marked choices
  // stay in sight above it.
  useEffect(() => {
    const el = reveal.current;
    if (!answered || !justAnswered.current || !el) return;
    const scroller = el.closest(".home-scroll");
    const top = el.getBoundingClientRect().top;
    if (scroller && top > window.innerHeight * 0.6) {
      // An absolute target, so running twice (or mid-scroll) lands the same.
      const y = scroller.scrollTop + top - scroller.getBoundingClientRect().top;
      scroller.scrollTo({ top: y - window.innerHeight * 0.25, behavior: "smooth" });
    }
  }, [answered]);

  // A–D / 1–4 answer; Enter moves on once answered — unless a control has
  // focus, which Enter already presses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest?.("input, textarea")) return;
      const i = "abcd".indexOf(e.key.toLowerCase()) + 1 || "1234".indexOf(e.key) + 1;
      if (!answered && i > 0) {
        justAnswered.current = true;
        onPick(i - 1);
      } else if (answered && e.key === "Enter" && !target.closest?.("button, a")) {
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, onPick, onNext]);

  return (
    <>
      <p className="trivia-hook">
        <b>{TOPIC[q.topic]?.label ?? q.topic}</b>
        {q.hook && <span>{q.hook}</span>}
      </p>
      {q.scene && <Scene key={q.scene.file} image={q.scene} />}
      <div className="quiz-question trivia-question">{q.question}</div>
      <div className="quiz-choices">
        {q.choices.map((choice, i) => {
          let cls = "choice";
          if (answered) cls += i === q.answer ? " correct" : i === picked ? " wrong" : " off";
          return (
            <button
              key={i}
              className={cls}
              disabled={answered}
              onClick={() => {
                justAnswered.current = true;
                onPick(i);
              }}
            >
              <span className="choice-key">{String.fromCharCode(65 + i)}</span>
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <div ref={reveal} className={`trivia-reveal ${right ? "ok" : "bad"}`}>
          <div className="reveal-head">{right ? "Correct" : `Not quite — it's ${String.fromCharCode(65 + q.answer)}`}</div>
          {q.image && <Figure image={q.image} />}
          <Story text={q.story} />
          {!right && q.whyNot && <p className="why-not">{q.whyNot}</p>}
          {q.video && <VideoCard video={q.video} />}
          <div className="insight-sources">
            {q.sources.map((s) => (
              <button key={s.url} className="insight-source" title={s.url} onClick={() => void openUrl(s.url)}>
                <ArrowUpRight />
                {s.title || hostname(s.url)}
              </button>
            ))}
          </div>
          <button className="btn primary wide" onClick={onNext}>
            {props.nextLabel}
          </button>
        </div>
      )}
    </>
  );
}

/** The question's scene-setter. Nothing that names it is on show — no
 *  caption, no file name (both can hint at the answer) — just the credit,
 *  on hover. */
function Scene(props: { image: TriviaImage }) {
  const { file } = props.image;
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="trivia-scene">
      <img src={commonsImage(file)} alt="" onError={() => setFailed(true)} />
      <button className="scene-credit" onClick={() => void openUrl(commonsPage(file))}>
        Wikimedia Commons
      </button>
    </figure>
  );
}

/** The story's picture, credited to Commons. Gone if it can't load
 *  (offline, or removed since the pack was written). */
function Figure(props: { image: TriviaImage }) {
  const { file, caption } = props.image;
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="trivia-figure">
      <img src={commonsImage(file)} alt={caption} onError={() => setFailed(true)} />
      <figcaption>
        <span>{caption}</span>
        <button className="link-btn" title={file} onClick={() => void openUrl(commonsPage(file))}>
          Wikimedia Commons
        </button>
      </figcaption>
    </figure>
  );
}

/** A video to watch after the story, opened on YouTube. */
function VideoCard(props: { video: TriviaVideo }) {
  const { id, title } = props.video;
  return (
    <button className="trivia-video" onClick={() => void openUrl(youtubeWatch(id))}>
      <span className="video-thumb">
        <img src={youtubeThumb(id)} alt="" />
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 7.5v9l7.5-4.5z" fill="currentColor" />
        </svg>
      </span>
      <span className="video-text">
        <b>{title || "Watch the video"}</b>
        <span>YouTube</span>
      </span>
    </button>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Story Markdown. Links open in the browser, never inside the app. */
function Story(props: { text: string }) {
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest?.("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href?.startsWith("https://")) void openUrl(href);
  };
  return (
    <div
      className="md trivia-story"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(props.text) }}
    />
  );
}

function Results(props: { pack: TriviaPack; onReview: (step: number) => void; onExit: () => void }) {
  const { pack } = props;
  const reward = pack.reward;
  const hatcheryOn = useSetting("hatchery");
  const h = useHatchery();
  const pet = companion(h);
  // The streak egg, found the moment the pack closed — while it's unhatched.
  const egg = [h.incubator, ...h.nest].find((e) => e?.source === "trivia" && e.foundAt === pack.finishedAt);
  const sp = pet && speciesById(pet.species);
  const petName = sp && sp.stages[stageOf(pet)];

  return (
    <div className="trivia-player trivia-results">
      <div className="quiz-score">
        {score(pack)}
        <span className="of"> / {pack.questions.length}</span>
      </div>
      {reward && (
        <p className="results-streak">
          {reward.streak > 0 ? `${reward.streak} day streak` : "Played"}
          {reward.freeze && " · earned a freeze"}
        </p>
      )}

      {reward && hatcheryOn && (pet || h.incubator) && (
        <div className={`results-reward tier-${sp?.tier ?? "common"}`}>
          {pet ? (
            <Habitat element={homeOf(pet)} scale={2}>
              <PetSprite pet={pet} scale={2} />
            </Habitat>
          ) : (
            h.incubator && (
              <Habitat element={h.incubator.element} scale={2}>
                <PixelImg src={eggUrl(h.incubator, crackOf(h.incubator))} scale={2} />
              </Habitat>
            )
          )}
          <div>
            <b>+{reward.minutes} min</b>
            <span>{pet ? `of growth for ${petName}` : "of warmth for your egg"}</span>
            {pet && <GrowthMeter pet={pet} />}
          </div>
        </div>
      )}
      {egg && (
        <div className={`results-reward results-egg tier-${egg.tier}`}>
          <Habitat element={egg.element} scale={2}>
            <PixelImg src={eggUrl(egg)} scale={2} />
          </Habitat>
          <div>
            <b>{ELEMENT_LABEL[egg.element]} egg</b>
            <span>found for your {reward?.streak} day streak · it's in the nest</span>
          </div>
        </div>
      )}

      <div className="quiz-review">
        {pack.questions.map((q, i) => {
          const right = pack.answers[i] === q.answer;
          return (
            <button key={i} className={`review-row ${right ? "ok" : "bad"}`} onClick={() => props.onReview(i)}>
              <span className="review-mark">{right ? <Check /> : <Close />}</span>
              <span>{q.question}</span>
            </button>
          );
        })}
      </div>
      <button className="btn primary" onClick={props.onExit}>
        Done
      </button>
    </div>
  );
}
