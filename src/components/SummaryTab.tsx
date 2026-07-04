import { useState } from "react";
import { summaryPrompt } from "../lib/ai";
import { useClaudeJob, useSession } from "../lib/session";
import { scopeKey, scopeLabel, type Scope } from "../lib/types";
import { ActivityFeed, Md, ScopePicker, Spinner } from "./AiPanel";
import { SummaryGlyph } from "./Icons";

export function SummaryTab() {
  const { meta, reg, model, artifacts, updateArtifacts } = useSession();
  const [scope, setScope] = useState<Scope>({ kind: "full" });
  const { state, start, cancel } = useClaudeJob();

  if (!meta) return null;
  const key = scopeKey(scope);
  const cached = artifacts.summaries[key];

  const generate = async () => {
    try {
      const done = await start({
        prompt: summaryPrompt(meta, scope),
        cwd: reg.docDir,
        model: model || null,
      });
      updateArtifacts((a) => ({
        ...a,
        summaries: { ...a.summaries, [key]: done.text },
      }));
    } catch {
      // state.error is rendered below
    }
  };

  return (
    <div className="tab-pane">
      <div className="tab-controls">
        <ScopePicker scope={scope} setScope={setScope} disabled={state.running} />
        {state.running ? (
          <button className="btn ghost" onClick={cancel}>
            Stop
          </button>
        ) : (
          <button className="btn primary" onClick={generate}>
            {cached ? "Regenerate" : "Summarize"}
          </button>
        )}
      </div>

      {state.running && (
        <>
          <Spinner label={`Summarizing ${scopeLabel(scope, meta).toLowerCase()}…`} />
          <ActivityFeed items={state.activity} compact />
        </>
      )}

      {state.error && <div className="banner warn">{state.error}</div>}

      {state.running && state.text ? (
        <Md text={state.text} streaming />
      ) : cached ? (
        <Md text={cached} />
      ) : (
        !state.running && (
          <div className="ai-empty">
            <SummaryGlyph />
            <p className="lede">Distill this book</p>
            <p>
              A study summary of the whole document or a single chapter —
              key concepts, definitions, and page-cited takeaways.
            </p>
          </div>
        )
      )}
    </div>
  );
}
