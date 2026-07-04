/** Prompt builders for every job type, plus strict-JSON parsing helpers.
 *  The Rust side is pure transport; all domain knowledge lives here. */

import type { Chapter, DocMeta, QuizQuestion, Scope } from "./types";
import { chapterFileName, wholeDocChapter } from "./pdf";

/** Chapters to read for a scope, with their file names. */
function scopeFiles(meta: DocMeta, scope: Scope): { chapter: Chapter; file: string }[] {
  const chapters = meta.chapters.length
    ? meta.chapters
    : [wholeDocChapter(meta.pages)];
  if (scope.kind === "chapter" && meta.chapters[scope.index]) {
    return [
      { chapter: meta.chapters[scope.index], file: `chapters/${chapterFileName(scope.index)}` },
    ];
  }
  return chapters.map((chapter, i) => ({
    chapter,
    file: `chapters/${chapterFileName(i)}`,
  }));
}

/** Shared framing: who you are, where the text lives, how to cite. */
function docContext(meta: DocMeta, scope: Scope): string {
  const files = scopeFiles(meta, scope);
  const fileList = files
    .map(
      ({ chapter, file }) =>
        `- ${file} — "${chapter.title}" (pages ${chapter.startPage}–${chapter.endPage})`,
    )
    .join("\n");
  return [
    `You are TutorAI, a study assistant embedded in a PDF reader.`,
    `Document: "${meta.title}" (${meta.pages} pages).`,
    ``,
    `The extracted text of the relevant material is in these plain-text files (relative to the current directory):`,
    fileList,
    ``,
    `Inside the files, [[PAGE n]] markers give the physical page number of the text that follows them.`,
    `Figure-bearing pages are also rendered as images under pages/ — pages/page-0012.jpg is page 12 (pages/figures.json lists which pages have one). Text extraction drops figures, charts, diagrams, and complex tables: when the text refers to one, or a question hinges on visual content, Read that page image to actually see it.`,
    `Use the Read tool for the text files and page images (Grep/Glob are also available). WebSearch/WebFetch may add outside context when helpful, but every claim about the document itself must be grounded in the document.`,
    `Whenever you reference specific material, cite the page inline in exactly this form: [p.12] (single page) or [p.12-15] (range). Cite generously — every key claim should carry a citation.`,
  ].join("\n");
}

export function summaryPrompt(meta: DocMeta, scope: Scope): string {
  const what =
    scope.kind === "full"
      ? "the entire document (read every listed file)"
      : "this chapter";
  return [
    docContext(meta, scope),
    ``,
    `Task: write a study summary of ${what} in Markdown.`,
    ``,
    `Shape it for a learner preparing to be examined on this material:`,
    `1. Open with a 2–3 sentence plain-language overview of what this material covers and why it matters.`,
    `2. "Key concepts" — the core ideas, each with a concise explanation in your own words.`,
    `3. "Definitions & formulas" — only if the material has them; state each precisely.`,
    `4. "Connections" — how the ideas relate to each other or to earlier material, if apparent.`,
    `5. "If you remember one thing" — a single takeaway.`,
    ``,
    `Keep it tight: prefer resolution over volume. Use ## headings, short paragraphs, and [p.N] citations on every concept.`,
    `Output only the summary itself — no preamble like "Here is the summary".`,
  ].join("\n");
}

export interface QuizOptions {
  count: number;
  difficulty: "intro" | "mixed" | "exam";
}

const difficultyNote: Record<QuizOptions["difficulty"], string> = {
  intro: "Aim at first-pass comprehension: definitions, main ideas, direct recall.",
  mixed: "Mix recall questions with application questions that require combining ideas.",
  exam: "Exam-hard: application, edge cases, subtle distinctions, multi-step reasoning. No trivial recall.",
};

export function quizPrompt(meta: DocMeta, scope: Scope, opts: QuizOptions): string {
  return [
    docContext(meta, scope),
    ``,
    `Task: create a multiple-choice quiz of exactly ${opts.count} questions from this material.`,
    difficultyNote[opts.difficulty],
    ``,
    `Rules:`,
    `- Every question must be answerable from the text alone and grounded in it.`,
    `- Exactly 4 choices per question, one correct. Distractors must be plausible (common misconceptions beat nonsense).`,
    `- "page" is the physical page number (from the [[PAGE n]] markers) where the answer is found.`,
    `- "explanation" says why the answer is right AND why the strongest distractor is wrong.`,
    `- Spread questions across the whole scope, not just the beginning.`,
    ``,
    `Output ONLY a JSON object — no markdown fences, no prose before or after — matching:`,
    `{"questions":[{"question":"...","choices":["...","...","...","..."],"answer":0,"explanation":"...","page":12}]}`,
    `"answer" is the 0-based index of the correct choice.`,
  ].join("\n");
}

export function chatSystemPreamble(meta: DocMeta): string {
  return [
    docContext(meta, { kind: "full" }),
    ``,
    `You are in an ongoing chat with the reader of this document. Ground every answer in the document text — Read or Grep the chapter files before answering anything substantive, and cite pages as [p.N]. If the document does not cover something, say so plainly before answering from general knowledge.`,
    `Answer in Markdown, concise by default.`,
  ].join("\n");
}

/**
 * Wrap a chat question with what the reader is currently looking at: the
 * viewed page plus its neighbors, so "why is this true?" style questions work
 * even when the relevant sentence sits at a page boundary.
 */
export function questionWithReadingContext(
  question: string,
  currentPage: number,
  pageTexts: { page: number; text: string }[],
): string {
  const context = pageTexts
    .map(({ page, text }) => `[[PAGE ${page}]]\n${text}`)
    .join("\n\n");
  return [
    `I am currently reading page ${currentPage}. For context, here is the text of the page I'm looking at and its neighbors:`,
    ``,
    `<<<`,
    context,
    `>>>`,
    ``,
    `Answer with this context first; Read/Grep the chapter files if you need material beyond these pages. My question:`,
    question,
  ].join("\n");
}

export function explainSelectionMessage(text: string, page: number): string {
  return `Explain this passage from page ${page}:\n\n"${text.trim()}"\n\nExplain what it means in plain language, add the context I need to understand it, and note anything subtle or easily misread.`;
}

export function detectChaptersPrompt(meta: DocMeta): string {
  return [
    docContext(meta, { kind: "full" }),
    ``,
    `This document has no usable bookmark outline. Task: reconstruct its chapter structure.`,
    `Look for a table of contents near the start, and/or scan for chapter headings (Grep for heading-like lines). Use the [[PAGE n]] markers to find the physical start page of each chapter — beware that printed page numbers in a TOC usually differ from physical pages; verify against the markers.`,
    ``,
    `Output ONLY a JSON object — no fences, no prose — matching:`,
    `{"chapters":[{"title":"...","startPage":1}]}`,
    `startPage is the 1-based physical page. List chapters in order. If the document genuinely has no chapter structure, output {"chapters":[]}.`,
  ].join("\n");
}

export function projectPrompt(
  meta: DocMeta,
  scope: Scope,
  chaptersDirAbs: string,
  idea: string,
): string {
  const files = scopeFiles(meta, scope)
    .map(({ chapter, file }) => `- ${chaptersDirAbs}\\${file.replace("/", "\\")} — "${chapter.title}"`)
    .join("\n");
  return [
    `You are TutorAI. Build a hands-on coding project that teaches the concepts from the document "${meta.title}".`,
    ``,
    `Source material (plain text with [[PAGE n]] page markers), read it first:`,
    files,
    ``,
    idea
      ? `The learner asked for: ${idea}`
      : `Pick the most instructive project idea yourself — something a learner can extend.`,
    ``,
    `Requirements:`,
    `- Create the entire project in the current working directory (it is a dedicated empty workspace).`,
    `- Keep the stack simple and dependencies minimal; prefer what the document itself uses, if it uses anything.`,
    `- Write a README.md with: what the project is, setup/run instructions, and a "Concept map" section linking each part of the code to the document with [p.N] page citations.`,
    `- Verify your work: actually run the project (or its tests) with Bash and fix what breaks before finishing.`,
    `- Structure the code so each concept is visible, not clever: a learner should read it top to bottom.`,
    ``,
    `Finish your final message with a short report: what you built, how to run it, and 2–3 suggested extension exercises for the learner. This report is shown in the app.`,
  ].join("\n");
}

// ── JSON extraction ────────────────────────────────────────────────────

/** Pull the first JSON object out of model text (tolerates fences/prose). */
export function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export function parseQuizQuestions(text: string, maxPage: number): QuizQuestion[] {
  const raw = extractJson<{ questions?: unknown }>(text);
  if (!Array.isArray(raw.questions)) throw new Error("quiz JSON missing questions[]");
  const questions: QuizQuestion[] = [];
  for (const q of raw.questions as Record<string, unknown>[]) {
    if (
      typeof q?.question !== "string" ||
      !Array.isArray(q.choices) ||
      q.choices.length < 2 ||
      typeof q.answer !== "number"
    ) {
      continue;
    }
    const choices = (q.choices as unknown[]).map(String).slice(0, 4);
    const answer = Math.min(Math.max(0, Math.floor(q.answer)), choices.length - 1);
    // Models put the correct choice first far more often than chance —
    // shuffle every question's choices so the answer key is actually random.
    const shuffled = shuffleChoices(choices, answer);
    questions.push({
      question: q.question,
      choices: shuffled.choices,
      answer: shuffled.answer,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
      page: clampPage(q.page, maxPage),
    });
  }
  if (!questions.length) throw new Error("quiz JSON contained no valid questions");
  return questions;
}

/** Fisher–Yates over the choices, tracking where the correct one lands. */
function shuffleChoices(
  choices: string[],
  answer: number,
): { choices: string[]; answer: number } {
  const order = choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    choices: order.map((i) => choices[i]),
    answer: order.indexOf(answer),
  };
}

export function parseChapters(text: string, maxPage: number): { title: string; startPage: number }[] {
  const raw = extractJson<{ chapters?: unknown }>(text);
  if (!Array.isArray(raw.chapters)) throw new Error("chapters JSON missing chapters[]");
  return (raw.chapters as Record<string, unknown>[])
    .filter((c) => typeof c?.title === "string" && typeof c.startPage === "number")
    .map((c) => ({ title: c.title as string, startPage: clampPage(c.startPage, maxPage) }))
    .sort((a, b) => a.startPage - b.startPage);
}

function clampPage(value: unknown, maxPage: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1;
  return Math.min(Math.max(1, n), maxPage);
}
