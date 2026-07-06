import { useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { projectPrompt } from "../lib/ai";
import { useClaudeJob, useSession } from "../lib/session";
import { ensureProjectDir, removeDocPath } from "../lib/tauri";
import { scopeLabel, type ProjectInfo, type Scope } from "../lib/types";
import { ActivityFeed, Md, ScopePicker, Spinner } from "./AiPanel";
import { ChevronLeft, Close, FolderOpen } from "./Icons";

export function ProjectTab() {
  const { meta, reg, model, artifacts, updateArtifacts } = useSession();
  const [scope, setScope] = useState<Scope>({ kind: "full" });
  const [idea, setIdea] = useState("");
  const [viewing, setViewing] = useState<ProjectInfo | null>(null);
  const { state, start, cancel } = useClaudeJob();

  if (!meta) return null;

  if (viewing) {
    return (
      <div className="tab-pane">
        <div className="quiz-progress">
          <button className="chip" onClick={() => setViewing(null)}>
            <ChevronLeft />
            projects
          </button>
          <button className="chip" onClick={() => revealItemInDir(viewing.path)}>
            <FolderOpen />
            Open folder
          </button>
        </div>
        <div className="project-title">{viewing.title}</div>
        <Md text={viewing.report || "*No report was produced.*"} />
      </div>
    );
  }

  const build = async () => {
    const slug = `p${Date.now().toString(36)}`;
    const title = idea.trim() || `Project · ${scopeLabel(scope, meta)}`;
    const path = await ensureProjectDir(reg.docId, slug);
    const project: ProjectInfo = {
      slug,
      title,
      path,
      createdAt: Date.now(),
      report: "",
      status: "running",
    };
    updateArtifacts((a) => ({ ...a, projects: [project, ...a.projects] }));
    const settle = (patch: Partial<ProjectInfo>) =>
      updateArtifacts((a) => ({
        ...a,
        projects: a.projects.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
      }));
    try {
      const done = await start({
        prompt: projectPrompt(meta, scope, `${reg.docDir}\\chapters`, idea.trim()),
        cwd: path,
        agentic: true,
        model: model || null,
      });
      settle({ status: "done", report: done.text });
    } catch {
      settle({ status: "failed" });
    }
  };

  return (
    <div className="tab-pane">
      {!state.running && (
        <div className="quiz-form">
          <ScopePicker scope={scope} setScope={setScope} />
          <textarea
            className="idea-input"
            rows={2}
            value={idea}
            placeholder="Optional: what should the project be? (left blank, the tutor picks the most instructive idea)"
            onChange={(e) => setIdea(e.target.value)}
          />
          <button className="btn primary wide" onClick={() => void build()}>
            Build a coding project
          </button>
          <p className="dim small">
            An agent writes a runnable project into a dedicated workspace folder,
            verifies it runs, and maps each part back to pages in the document.
          </p>
        </div>
      )}

      {state.running && (
        <>
          <Spinner label="Building the project — this can take several minutes…" />
          <ActivityFeed items={state.activity} />
          <button className="btn ghost wide" onClick={cancel}>
            Stop
          </button>
        </>
      )}
      {state.error && <div className="banner warn">{state.error}</div>}

      {artifacts.projects.length > 0 && (
        <div className="quiz-list">
          <span className="list-label">Projects</span>
          {artifacts.projects.map((project) => (
            <div
              key={project.slug}
              className="item-card"
              role="button"
              tabIndex={0}
              onClick={() => project.status !== "running" && setViewing(project)}
              onKeyDown={(e) => e.key === "Enter" && setViewing(project)}
            >
              <span className="item-title">{project.title}</span>
              <span className="item-meta">
                <span className={`status-dot ${project.status}`} />
                {project.status === "done"
                  ? new Date(project.createdAt).toLocaleDateString()
                  : project.status}
              </span>
              <button
                className="card-remove"
                title="Delete project and its files"
                onClick={(e) => {
                  e.stopPropagation();
                  // A running agent has its cwd in there — leave the files to
                  // it and only drop the list entry.
                  if (project.status !== "running") {
                    removeDocPath(reg.docId, `projects/${project.slug}`).catch(() => {});
                  }
                  updateArtifacts((a) => ({
                    ...a,
                    projects: a.projects.filter((p) => p.slug !== project.slug),
                  }));
                }}
              >
                <Close />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
