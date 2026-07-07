/** Shared domain types. The Rust side mirrors LibraryEntry/RegisteredDoc/JobEvent. */

export interface LibraryEntry {
  docId: string;
  path: string;
  title: string;
  pages: number;
  addedAt: number;
  lastOpenedAt: number;
  lastPage: number;
  /** Scroll offset within lastPage, as a fraction of the page height. */
  lastScroll: number;
}

export interface RegisteredDoc {
  docId: string;
  path: string;
  docDir: string;
}

/** A chapter of the document; pages are 1-based and inclusive. */
export interface Chapter {
  title: string;
  startPage: number;
  endPage: number;
}

export interface DocMeta {
  title: string;
  pages: number;
  chapters: Chapter[];
  chaptersSource: "outline" | "ai" | "none";
  extractedAt: number;
}

/** What a job or artifact covers: the whole document or one chapter. */
export type Scope = { kind: "full" } | { kind: "chapter"; index: number };

export function scopeKey(scope: Scope): string {
  return scope.kind === "full" ? "full" : `ch-${scope.index}`;
}

export function scopeLabel(scope: Scope, meta: DocMeta): string {
  return scope.kind === "full"
    ? "Whole document"
    : meta.chapters[scope.index]?.title ?? `Chapter ${scope.index + 1}`;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  page: number;
}

export interface Quiz {
  id: string;
  title: string;
  scopeLabel: string;
  difficulty: string;
  createdAt: number;
  questions: QuizQuestion[];
  /** Saved progress: the picked choice per question (null = unanswered). */
  answers?: (number | null)[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** For user messages: the page being read when the question was asked. */
  page?: number;
}

/** What a margin note adds that the document doesn't have. */
export type InsightKind = "example" | "gotcha" | "context" | "update";

export interface InsightSource {
  title: string;
  url: string;
}

/** One proactive margin note, anchored to a page. */
export interface Insight {
  id: string;
  page: number;
  kind: InsightKind;
  /** Punchy headline, ≤ ~60 chars. */
  title: string;
  /** 2–4 sentence Markdown body. */
  body: string;
  /** Verbatim short quote from the page the note attaches to. */
  anchor?: string;
  /** Vertical anchor position as a fraction of the page height. */
  y: number;
  /** Web citations — required for "update" (currency) notes. */
  sources: InsightSource[];
  createdAt: number;
}

/** Proactive companion output for one document (the on/off switch is an
 *  app-wide setting). `sections` records analyzed page spans
 *  (key `p<start>-<end>`) so a span is never paid for twice. */
export interface InsightsState {
  notes: Insight[];
  sections: Record<string, "done" | "empty">;
}

export interface ProjectInfo {
  slug: string;
  title: string;
  path: string;
  createdAt: number;
  report: string;
  status: "running" | "done" | "failed";
}

/** Everything AI-derived for one document, persisted as artifacts.json. */
export interface Artifacts {
  summaries: Record<string, string>;
  quizzes: Quiz[];
  chat: { sessionId: string | null; messages: ChatMessage[] };
  projects: ProjectInfo[];
  insights: InsightsState;
}

export const emptyArtifacts = (): Artifacts => ({
  summaries: {},
  quizzes: [],
  chat: { sessionId: null, messages: [] },
  projects: [],
  insights: { notes: [], sections: {} },
});

// ── Claude job protocol (mirrors src-tauri/src/claude.rs) ─────────────

export interface JobSpec {
  prompt: string;
  cwd: string;
  agentic?: boolean;
  model?: string | null;
  resumeSession?: string | null;
}

export type JobEvent =
  | { type: "started"; sessionId: string }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "toolDone"; isError: boolean }
  | {
      type: "done";
      ok: boolean;
      status: string;
      text: string;
      sessionId: string | null;
      durationMs: number;
      totalTokens: number;
    }
  | { type: "failed"; message: string };

export type DoneEvent = Extract<JobEvent, { type: "done" }>;
