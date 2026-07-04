/** The study panel: Summary / Quiz / Chat / Project tabs, plus the shared
 *  widgets they build on (markdown with page chips, scope picker, activity). */

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useSession, type ActivityItem, type PanelTab } from "../lib/session";
import { onCitationClick, renderMarkdown } from "../lib/markdown";
import type { Scope } from "../lib/types";
import { SummaryTab } from "./SummaryTab";
import { QuizTab } from "./QuizTab";
import { ChatTab } from "./ChatTab";
import { ProjectTab } from "./ProjectTab";
import { ChatGlyph, ProjectGlyph, QuizGlyph, Spark, SummaryGlyph } from "./Icons";
import { Dropdown } from "./Dropdown";

const TABS: { id: PanelTab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "summary", label: "Summary", icon: SummaryGlyph },
  { id: "quiz", label: "Quiz", icon: QuizGlyph },
  { id: "chat", label: "Chat", icon: ChatGlyph },
  { id: "project", label: "Project", icon: ProjectGlyph },
];

export function AiPanel() {
  const { meta, extractProgress, panelRequest, model, setModel } = useSession();
  const [tab, setTab] = useState<PanelTab>("summary");

  useEffect(() => {
    if (panelRequest) setTab(panelRequest.tab);
  }, [panelRequest]);

  return (
    <aside className="ai-panel">
      <div className="ai-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`ai-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon />
            {t.label}
          </button>
        ))}
      </div>

      <div className="ai-body">
        {!meta ? (
          <div className="ai-empty">
            <Spark />
            <p className="lede">Preparing this book for study</p>
            {extractProgress && (
              <p className="dim mono small">
                {extractProgress.done} / {extractProgress.total} pages indexed
              </p>
            )}
          </div>
        ) : (
          <>
            {tab === "summary" && <SummaryTab />}
            {tab === "quiz" && <QuizTab />}
            {tab === "chat" && <ChatTab />}
            {tab === "project" && <ProjectTab />}
          </>
        )}
      </div>

      <div className="ai-foot">
        <span className="foot-hint">cites jump the reader</span>
        <div className="model-pick">
          <span>Model</span>
          <Dropdown
            variant="ghost"
            align="right"
            ariaLabel="Model"
            value={model}
            onChange={setModel}
            options={[
              { value: "", label: "Default" },
              { value: "haiku", label: "Haiku", hint: "fastest" },
              { value: "sonnet", label: "Sonnet", hint: "balanced" },
              { value: "opus", label: "Opus", hint: "deepest" },
            ]}
          />
        </div>
      </div>
    </aside>
  );
}

// ── Shared widgets ─────────────────────────────────────────────────────

/** Markdown with [p.N] chips wired to page jumps. `streaming` shows a caret
 *  at the end of the text while it's still being generated. */
export function Md(props: { text: string; streaming?: boolean }) {
  const { jumpToPage } = useSession();
  return (
    <div
      className={`md ${props.streaming ? "streaming" : ""}`}
      onClick={(e) => onCitationClick(e, jumpToPage)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(props.text) }}
    />
  );
}

/** Whole-document / per-chapter selector. */
export function ScopePicker(props: {
  scope: Scope;
  setScope: (s: Scope) => void;
  disabled?: boolean;
}) {
  const { meta } = useSession();
  if (!meta) return null;
  const value = props.scope.kind === "full" ? "full" : String(props.scope.index);
  const options = [
    { value: "full", label: "Whole document" },
    ...(meta.chapters.length > 1
      ? meta.chapters.map((ch, i) => ({
          value: String(i),
          label: ch.title.length > 46 ? ch.title.slice(0, 45) + "…" : ch.title,
          hint: `p.${ch.startPage}`,
        }))
      : []),
  ];
  return (
    <Dropdown
      className="scope-pick"
      ariaLabel="Scope"
      value={value}
      options={options}
      disabled={props.disabled}
      onChange={(v) =>
        props.setScope(
          v === "full" ? { kind: "full" } : { kind: "chapter", index: Number(v) },
        )
      }
    />
  );
}

/** Live feed of tool calls during a run. */
export function ActivityFeed(props: { items: ActivityItem[]; compact?: boolean }) {
  const items = props.compact ? props.items.slice(-6) : props.items;
  if (!items.length) return null;
  return (
    <div className="activity">
      {items.map((item, i) => (
        <div key={i} className={`activity-row ${item.isError ? "err" : ""}`}>
          <span className={`activity-dot ${item.done ? "done" : "busy"}`} />
          <span className="activity-name">{item.name}</span>
          <span className="activity-detail">{humanizeDetail(item)}</span>
        </div>
      ))}
    </div>
  );
}

function humanizeDetail(item: ActivityItem): string {
  try {
    const input = JSON.parse(item.detail) as Record<string, unknown>;
    const path =
      input.file_path ?? input.path ?? input.pattern ?? input.command ??
      input.query ?? input.url;
    if (typeof path === "string") {
      return path.length > 60 ? "…" + path.slice(-59) : path;
    }
  } catch {
    // detail was truncated JSON — fall through
  }
  return "";
}

export function Spinner(props: { label: string }) {
  return (
    <div className="spinner-row">
      <span className="spinner" />
      <span>{props.label}</span>
    </div>
  );
}
