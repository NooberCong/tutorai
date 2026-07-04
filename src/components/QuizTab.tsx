import { useState } from "react";
import { parseQuizQuestions, quizPrompt, type QuizOptions } from "../lib/ai";
import { useClaudeJob, useSession } from "../lib/session";
import { scopeLabel, type Quiz, type Scope } from "../lib/types";
import { ActivityFeed, Md, ScopePicker, Spinner } from "./AiPanel";
import { Check, ChevronLeft, ChevronRight, Close } from "./Icons";

export function QuizTab() {
  const { meta, reg, model, artifacts, updateArtifacts } = useSession();
  const [scope, setScope] = useState<Scope>({ kind: "full" });
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<QuizOptions["difficulty"]>("mixed");
  const [taking, setTaking] = useState<Quiz | null>(null);
  const { state, start, cancel } = useClaudeJob();

  if (!meta) return null;

  if (taking) {
    return <QuizPlayer quiz={taking} onExit={() => setTaking(null)} />;
  }

  const generate = async () => {
    try {
      const done = await start({
        prompt: quizPrompt(meta, scope, { count, difficulty }),
        cwd: reg.docDir,
        model: model || null,
      });
      const questions = parseQuizQuestions(done.text, meta.pages);
      const quiz: Quiz = {
        id: `quiz-${Date.now().toString(36)}`,
        title: scopeLabel(scope, meta),
        scopeLabel: scopeLabel(scope, meta),
        difficulty,
        createdAt: Date.now(),
        questions,
      };
      updateArtifacts((a) => ({ ...a, quizzes: [quiz, ...a.quizzes] }));
      setTaking(quiz);
    } catch {
      // state.error rendered below; parse errors land there via the throw
    }
  };

  return (
    <div className="tab-pane">
      <div className="quiz-form">
        <ScopePicker scope={scope} setScope={setScope} disabled={state.running} />
        <div className="quiz-form-row">
          <div className="seg">
            {[5, 10, 15].map((n) => (
              <button
                key={n}
                className={count === n ? "active" : ""}
                disabled={state.running}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="seg">
            {(["intro", "mixed", "exam"] as const).map((d) => (
              <button
                key={d}
                className={difficulty === d ? "active" : ""}
                disabled={state.running}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {state.running ? (
          <button className="btn ghost wide" onClick={cancel}>
            Stop
          </button>
        ) : (
          <button className="btn primary wide" onClick={generate}>
            New quiz
          </button>
        )}
      </div>

      {state.running && (
        <>
          <Spinner label="Writing questions from the text…" />
          <ActivityFeed items={state.activity} compact />
        </>
      )}
      {state.error && <div className="banner warn">{state.error}</div>}

      {artifacts.quizzes.length > 0 && (
        <div className="quiz-list">
          <span className="list-label">Past quizzes</span>
          {artifacts.quizzes.map((quiz) => {
            const total = quiz.questions.length;
            const done = quiz.answers?.filter((a) => a !== null).length ?? 0;
            const score = quiz.questions.filter(
              (q, i) => quiz.answers?.[i] === q.answer,
            ).length;
            return (
            <div key={quiz.id} className="item-card" role="button" tabIndex={0}
              onClick={() => setTaking(quiz)}
              onKeyDown={(e) => e.key === "Enter" && setTaking(quiz)}
            >
              <span className="item-title">{quiz.scopeLabel}</span>
              <span className="item-meta">
                {total} questions · {quiz.difficulty}
                {done === total && ` · scored ${score}/${total}`}
                {done > 0 && done < total && ` · ${done}/${total} answered`}
              </span>
              <button
                className="card-remove"
                title="Delete quiz"
                onClick={(e) => {
                  e.stopPropagation();
                  updateArtifacts((a) => ({
                    ...a,
                    quizzes: a.quizzes.filter((q) => q.id !== quiz.id),
                  }));
                }}
              >
                <Close />
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Player ─────────────────────────────────────────────────────────────

function QuizPlayer(props: { quiz: Quiz; onExit: () => void }) {
  const { jumpToPage, updateArtifacts } = useSession();
  const { quiz } = props;
  // Resume saved progress: restore recorded answers and land on the first
  // unanswered question (or the results if the quiz was completed).
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    quiz.answers?.length === quiz.questions.length
      ? [...quiz.answers]
      : quiz.questions.map(() => null),
  );
  const [step, setStep] = useState(() => {
    const saved =
      quiz.answers?.length === quiz.questions.length ? quiz.answers : null;
    if (!saved) return 0;
    const firstOpen = saved.findIndex((a) => a === null);
    return firstOpen === -1 ? quiz.questions.length : firstOpen;
  });

  const record = (next: (number | null)[]) => {
    setAnswers(next);
    updateArtifacts((a) => ({
      ...a,
      quizzes: a.quizzes.map((q) =>
        q.id === quiz.id ? { ...q, answers: next } : q,
      ),
    }));
  };

  const finished = step >= quiz.questions.length;
  const score = answers.filter((a, i) => a === quiz.questions[i].answer).length;

  if (finished) {
    return (
      <div className="tab-pane">
        <div className="quiz-result">
          <div className="quiz-score">
            {score}
            <span className="of"> / {quiz.questions.length}</span>
          </div>
          <p className="dim small">{quiz.scopeLabel} · {quiz.difficulty}</p>
          <div className="quiz-review">
            {quiz.questions.map((q, i) => {
              const right = answers[i] === q.answer;
              return (
                <div key={i} className={`review-row ${right ? "ok" : "bad"}`}>
                  <span className="review-mark">{right ? <Check /> : <Close />}</span>
                  <div>
                    <div>{q.question}</div>
                    {!right && (
                      <div className="dim small">
                        Correct: {q.choices[q.answer]}{" "}
                        <button className="cite" onClick={() => jumpToPage(q.page)}>
                          p.{q.page}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="tab-controls">
            <button
              className="btn primary"
              onClick={() => {
                record(quiz.questions.map(() => null));
                setStep(0);
              }}
            >
              Retake
            </button>
            <button className="btn ghost" onClick={props.onExit}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = quiz.questions[step];
  const picked = answers[step];
  const answered = picked !== null;
  const isLast = step === quiz.questions.length - 1;
  const allAnswered = answers.every((a) => a !== null);
  const firstOpen = answers.findIndex((a) => a === null);

  return (
    <div className="tab-pane">
      <div className="quiz-progress">
        <button className="chip" onClick={props.onExit}>
          <ChevronLeft />
          quizzes
        </button>
        <span className="step">{step + 1} / {quiz.questions.length}</span>
        <div className="quiz-nav">
          <button
            className="icon-btn"
            title="Previous question"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="icon-btn"
            title={
              isLast && !allAnswered
                ? "Answer the remaining questions to finish"
                : "Next question"
            }
            disabled={isLast && !allAnswered}
            onClick={() => setStep((s) => s + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="progress-track">
        <i
          style={{
            width: `${(answers.filter((a) => a !== null).length / quiz.questions.length) * 100}%`,
          }}
        />
      </div>

      <div className="quiz-question">{q.question}</div>

      <div className="quiz-choices">
        {q.choices.map((choice, i) => {
          let cls = "choice";
          if (answered) {
            if (i === q.answer) cls += " correct";
            else if (i === picked) cls += " wrong";
            else cls += " off";
          }
          return (
            <button
              key={i}
              className={cls}
              disabled={answered}
              onClick={() =>
                record(answers.map((a, j) => (j === step ? i : a)))
              }
            >
              <span className="choice-key">{String.fromCharCode(65 + i)}</span>
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`quiz-feedback ${picked === q.answer ? "ok" : "bad"}`}>
          <div className="feedback-head">
            {picked === q.answer ? "Correct" : "Not quite"}
            <button className="cite" onClick={() => jumpToPage(q.page)}>
              p.{q.page}
            </button>
          </div>
          {q.explanation && <Md text={q.explanation} />}
          <button
            className="btn primary wide"
            onClick={() =>
              setStep((s) => (isLast && !allAnswered ? firstOpen : s + 1))
            }
          >
            {!isLast
              ? "Next"
              : allAnswered
                ? "See results"
                : `Answer skipped question ${firstOpen + 1}`}
          </button>
        </div>
      )}
    </div>
  );
}
