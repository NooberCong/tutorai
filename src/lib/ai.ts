/** Prompt builders for every job type, plus strict-JSON parsing helpers.
 *  The Rust side is pure transport; all domain knowledge lives here. */

import type {
  Chapter,
  DocMeta,
  Insight,
  InsightKind,
  InsightSource,
  PetQuip,
  QuizQuestion,
  Scope,
} from "./types";
import { chapterFileName, figureFileName, wholeDocChapter } from "./pdf";
import { squashText } from "./anchor";
import type { Recent, TriviaImage, TriviaQuestion } from "./trivia/game";
import { QUESTIONS } from "./trivia/game";
import { TOPIC } from "./trivia/topics";
import { commonsFile, youtubeId } from "./trivia/media";

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

/** Math notation the renderer understands. It tells `$…$` math from a price by
 *  shape, so the one thing worth asking for is an escaped dollar inside math. */
const MATH_DELIMITERS = `Write mathematical notation as LaTeX: $$…$$ or \\[…\\] for a displayed formula, $…$ or \\(…\\) for inline math. Inside math, write a literal dollar sign as \\$.`;

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
    MATH_DELIMITERS,
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

/** File in the doc's working directory that mirrors the companion's margin
 *  notes, so the chat agent can Read them. InsightsProvider keeps it current;
 *  chatSystemPreamble points the agent at it. */
export const NOTES_FILE = "notes.json";

/** Agent-facing projection of the margin notes: content and provenance only,
 *  no UI fields (id, y, createdAt). */
export function notesFileContent(notes: Insight[]): string {
  const entries = [...notes]
    .sort((a, b) => a.page - b.page)
    .map((n) => ({
      page: n.page,
      kind: n.kind,
      title: n.title,
      body: n.body,
      anchor: n.anchor ?? "",
      sources: n.sources,
    }));
  return JSON.stringify({ notes: entries }, null, 2);
}

export function chatSystemPreamble(meta: DocMeta): string {
  return [
    docContext(meta, { kind: "full" }),
    ``,
    `You also work as this book's reading companion: in background passes you write margin notes into it — real-world examples, gotchas, missing context, post-publication updates. The reader sees those notes in the margins but did not write them; any margin note they mention is one of yours. The current notes (each with its page, kind, anchor quote, and source URLs) are mirrored in ${NOTES_FILE} — Read it whenever the conversation involves a margin note. If the file is missing, you have not written any notes yet.`,
    ``,
    `You are in an ongoing chat with the reader of this document. Ground every answer in the document text — Read or Grep the chapter files before answering anything substantive, and cite pages as [p.N]. If the document does not cover something, say so plainly before answering from general knowledge.`,
    `Answer in Markdown, concise by default.`,
    MATH_DELIMITERS,
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

/** Same intent, but the selection came from a companion margin note — don't
 *  present it as document text the tutor could go looking for. */
export function explainNoteSelectionMessage(text: string, page: number): string {
  return `Your margin note on page ${page} includes this:\n\n"${text.trim()}"\n\nUnpack it for me: what does it mean, where does it come from, and how does it relate to what I'm reading on that page?`;
}

/** A region of a page the reader snipped to an image (figure, chart, equation…). */
export function explainRegionMessage(rel: string, page: number): string {
  return [
    `Explain what I've marked on page ${page}. I snipped that region of the page to an image file: ${rel}`,
    ``,
    `Read that image file first so you can see exactly what I marked — likely a figure, chart, diagram, equation, or table. Then explain it in plain language, connect it to the surrounding text on that page, and note anything subtle or easily misread.`,
  ].join("\n");
}

export function askRegionMessage(rel: string, page: number): string {
  return `About the region I marked on page ${page} (snipped to ${rel} — Read that image first):\n`;
}

/** A page span the companion analyzes as one unit. */
export interface InsightSpan {
  startPage: number;
  endPage: number;
  /** Chapter the span belongs to, for framing. */
  title: string;
}

/** The reader's hatchery pet, as the companion should voice it. */
export interface PetPersona {
  /** What the reader calls it (its own name, or its stage name). */
  name: string;
  /** e.g. "a young leaf-element creature, one day a Bloomstag". */
  kind: string;
  about: string;
}

/** The pet's quip rides along on an insights run. It may be about any page
 *  from `fromPage` on — the reader's current page, or a read-ahead span's
 *  start — never one they've already passed, since the pet says it when
 *  the reader reaches that page. */
export interface QuipRequest {
  pet: PetPersona;
  fromPage: number;
}

export function insightsPrompt(
  meta: DocMeta,
  span: InsightSpan,
  pageTexts: { page: number; text: string }[],
  figurePages: number[],
  deliveredTitles: string[],
  quipFor: QuipRequest | null,
): string {
  const text = pageTexts
    .map(({ page, text }) => `[[PAGE ${page}]]\n${text}`)
    .join("\n\n");
  const figures = figurePages.length
    ? `Figure-bearing pages in this span are rendered as images: ${figurePages
        .map((p) => figureFileName(p))
        .join(", ")}. Read one only if a figure is central to the material.`
    : "";
  const delivered = deliveredTitles.length
    ? [
        ``,
        `Notes already delivered elsewhere in this book — do not repeat or overlap them:`,
        ...deliveredTitles.map((t) => `- ${t}`),
      ]
    : [];
  // The pet's aside rides along on this run, so it costs no extra quota.
  const pet = quipFor?.pet;
  const quip = quipFor && pet
    ? [
        ``,
        `Separately, the reader has a small pet reading along: ${pet.name}, ${pet.kind}. ${pet.about}`,
        `Optionally write one "quip" — something ${pet.name} blurts out about these pages, the kind of aside that makes the reader smile:`,
        `- Pick the funniest moment on page ${quipFor.fromPage} or later in this span (the reader is on page ${quipFor.fromPage}; ${pet.name} will say it just after the reader reads that spot). Set "page" to the page it's about and "anchor" to a verbatim 3–10 word quote from that page at the spot.`,
        `- One sentence, at most 110 characters, first person, in the voice of a small, curious, slightly cheeky creature.`,
        `- About something specific on that page (a name, idea, example, number, odd phrase) — a joke, pun, or funny reaction. Never a summary, lesson, or fact dump; never mean about the reader or the author; no spoilers beyond that page.`,
        `- Skip it (null) for front matter, tables of contents, indexes, or when nothing is genuinely fun.`,
      ]
    : [];
  return [
    `You are the reading companion inside TutorAI, annotating the margins of "${meta.title}" the way a brilliant colleague pencils notes into a book: only things the book itself does not say.`,
    ``,
    `The reader is on pages ${span.startPage}–${span.endPage} (${span.title}). Exact text of those pages, with [[PAGE n]] markers:`,
    `<<<`,
    text,
    `>>>`,
    figures,
    ``,
    `Task: write margin notes for this span. The bar: a knowledgeable reader must react "I didn't know that" or "that finally makes sense". Four kinds qualify:`,
    `- "example" — a real-world case with specifics (who, what system, what scale, what happened) that makes an abstract idea here concrete.`,
    `- "gotcha" — a trap, subtle failure mode, or misconception practitioners actually hit with this material, that the text doesn't warn about.`,
    `- "context" — the missing why: history, design rationale, or a connection that makes this material click.`,
    `- "update" — the world has moved since this was written: deprecations, renames, superseded advice, materially changed numbers.`,
    ``,
    `Hard rules:`,
    `- 0–3 notes; most spans deserve 0 or 1. Never pad. If nothing clears the bar, output {"insights":[]} — that is a good answer.`,
    `- Never restate, summarize, or explain what these pages already say. If the text mentions it, it is banned.`,
    `- Output nothing for front matter, tables of contents, exercises, solutions, indexes, or bibliographies.`,
    `- Every "update" note MUST be verified with WebSearch before you write it, and MUST carry 1–2 source URLs; if you cannot verify it, drop it. For other kinds use the web only when it buys real specificity — at most 3 searches for this whole task.`,
    `- Writing: "title" ≤ 60 characters, concrete and punchy. "body" is 2–4 short sentences, plain language, specific (names, versions, numbers), zero filler, no "the document/author says". It must be effortless to read.`,
    ...delivered,
    ...quip,
    ``,
    `Output ONLY a JSON object — no fences, no prose before or after — matching:`,
    `{"insights":[{"kind":"example|gotcha|context|update","page":${span.startPage},"anchor":"...","title":"...","body":"...","sources":[{"title":"...","url":"https://..."}]}]${quipFor ? `,"quip":{"page":${quipFor.fromPage},"anchor":"...","text":"..."} or null` : ""}}`,
    `"page" is the physical page the note belongs to. "anchor" is a verbatim 3–10 word quote copied exactly from that page's text, at the spot the note is about. "sources" may be [] for non-update notes.`,
  ].join("\n");
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

/** Daily Trivia: ten news-pegged questions over the player's topics, each
 *  with the story behind its answer. Research and fact-checking happen in
 *  this one run, on the web tools the read-only posture allows. */
export function triviaPrompt(topicIds: string[], today: Date, avoid: Recent): string {
  // Round-robin over the topics in a fresh order, so a short list still
  // varies which topics get the extra questions.
  const order = [...topicIds].sort(() => Math.random() - 0.5);
  const slots = Array.from({ length: QUESTIONS }, (_, i) => TOPIC[order[i % order.length]]);
  const date = today.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return [
    `You write TutorAI's Daily Trivia: ten multiple-choice questions a curious adult plays with their morning coffee, each followed by the story behind the answer. Today is ${date}.`,
    ``,
    `Topics for the ten questions, in order (id — what makes it fun):`,
    ...slots.map((t, i) => `${i + 1}. ${t.id} — ${t.angle}`),
    ``,
    `Research first. For each question, use WebSearch to find something reported in the last 30 days in that topic: a discovery, mission, record, anniversary, release or event. That news is the hook — but the question asks about the most surprising lasting fact the news touches, something still worth knowing long after the headline. Never ask what only someone who saw the news could answer.`,
    ``,
    `What makes a question great:`,
    `- Gettable: a curious non-expert can reason toward the answer or half-remember it, and the right answer lands as a small surprise. No jargon, no specialist recall, no bare dates or numbers unless the choices make them guessable.`,
    `- One fact, worded so exactly one choice is right. At most 30 words.`,
    `- Exactly 4 choices of the same kind and a believable range, similar in length and form. The strongest wrong choice is a common misconception. Never "all/none of the above", never joke choices.`,
    `- No trivia-only facts (obscure phobias, collective nouns), nothing contested. Quote someone only if you've traced the quote to its original source.`,
    `- Difficulty: 1 = most people get it, 2 = about two in three do, 3 = a real stretch that still feels fair. Write three 1s, four 2s and three 3s.`,
    ``,
    `Verify before you finish: confirm with sources that the right answer is right and every other choice is wrong. Replace any question you can't verify. Fetch a page when the snippets aren't conclusive. Budget: about 30 lookups (searches and page fetches) for the research, plus up to six for videos at the end.`,
    ``,
    `The story is the heart of it — the player reads it right after answering, and should want to read every word:`,
    `- Open with the reveal: the answer and the one-line why, in a sentence that clicks.`,
    `- Then tell it as a story: a person, a place, a moment; what was at stake; the twist that makes it surprising.`,
    `- Bring it to now: what just happened that makes this timely.`,
    `- End on a kicker — the detail they'll want to tell a friend.`,
    `- 200–320 words of Markdown in short paragraphs. Vivid, warm, plain words; concrete names, numbers and places. At most one bold phrase. No headings, no lists, no "Fun fact:", no wrap-up sentence.`,
    ``,
    `Give every question and story something to look at. The app loads and checks every picture and video itself, so never spend a lookup confirming one. Pictures cost nothing: take them from the pages you open for research (a Wikipedia article usually has several).`,
    `- "scene": a second Commons photo, shown above the question before it's answered. It sets the scene of the hook — the storm making landfall, the rocket on the pad, the dig site, the crowd at the festival — so the question feels like news. It shows this question's own subject or news event, never a stand-in (no other species, place or object "in the same spirit"). It must not give away or hint at the right choice (if the subject itself would show the answer, picture its setting or the news event instead), and must be a different photo from "image". Same file-name rules as "image". Aim for one with every question, but leave it null rather than risk a spoiler.`,
    `- "image": a photo from Wikimedia Commons that shows the subject itself — the animal, the object, the place, the person, the moment. Give its exact Commons file name, as it appears in a page you opened (the images in Wikipedia articles live on Commons); never guess one. Choose a striking photograph over a diagram, map, logo or book cover. One for every question; null only if nothing fitting exists. "caption" says in one short line what we're looking at.`,
    `- "video" — a required last step, after the research: a YouTube video worth watching right after the story — real footage of the creature, launch, place or event, or a clear short explainer — from a reputable channel (space agencies, museums, universities, broadcasters, well-known science channels). After the research, pick the three questions a video would add most to and find one for each with WebSearch for "site:youtube.com <subject>" (that returns watch links directly; up to two searches per question). Use the best result from a reputable channel; never guess a URL. null for the rest.`,
    ...(avoid.hooks.length
      ? [
          ``,
          `News already used in the last two weeks — pick different stories and different subjects. A new fact about the same probe, animal, event or anniversary still counts as a repeat:`,
          ...avoid.hooks.map((h) => `- ${h}`),
        ]
      : []),
    ...(avoid.facts.length
      ? [``, `Facts asked in recent weeks — don't ask about these again:`, ...avoid.facts.map((f) => `- ${f}`)]
      : []),
    ``,
    `Output ONLY a JSON object — no fences, no prose before or after — matching:`,
    `{"questions":[{"topic":"${slots[0].id}","difficulty":1,"hook":"...","question":"...","choices":["...","...","...","..."],"answer":0,"fact":"...","story":"...","whyNot":"...","sources":[{"title":"...","url":"https://..."}],"scene":{"file":"Example scene.jpg","caption":"..."},"image":{"file":"Example photo.jpg","caption":"..."},"video":{"url":"https://www.youtube.com/watch?v=...","title":"..."}}]}`,
    `- "topic" is the topic id from the list. "answer" is the 0-based index of the right choice.`,
    `- "hook": the news, at most 80 characters, with its date — e.g. "Juno's final Io flyby · 3 Oct".`,
    `- "fact": the fact the question tests, in one short sentence.`,
    `- "whyNot": one sentence on why the most tempting wrong choice tempts, and why it's wrong.`,
    `- "sources": 1–3 pages backing the answer and the hook.`,
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

const INSIGHT_KINDS: InsightKind[] = ["example", "gotcha", "context", "update"];

/** Validate model output into Insights: whitelist kinds, clamp pages to the
 *  span, require web sources on "update" notes, locate anchors, cap at 3. */
export function parseInsights(
  text: string,
  span: InsightSpan,
  pageTexts: { page: number; text: string }[],
): Insight[] {
  const raw = extractJson<{ insights?: unknown }>(text);
  if (!Array.isArray(raw.insights)) throw new Error("insights JSON missing insights[]");
  const notes: Insight[] = [];
  for (const n of raw.insights as Record<string, unknown>[]) {
    const kind = n?.kind as InsightKind;
    if (!INSIGHT_KINDS.includes(kind)) continue;
    if (typeof n.title !== "string" || !n.title.trim()) continue;
    if (typeof n.body !== "string" || !n.body.trim()) continue;
    const sources = (Array.isArray(n.sources) ? (n.sources as Record<string, unknown>[]) : [])
      .filter((s) => typeof s?.url === "string" && /^https?:\/\//.test(s.url as string))
      .slice(0, 2)
      .map((s): InsightSource => ({
        title: typeof s.title === "string" ? s.title : "",
        url: s.url as string,
      }));
    // An unverifiable currency claim is worse than no note at all.
    if (kind === "update" && !sources.length) continue;
    const page = Math.min(
      Math.max(span.startPage, typeof n.page === "number" ? Math.round(n.page) : span.startPage),
      span.endPage,
    );
    const anchor = typeof n.anchor === "string" ? n.anchor.trim() : undefined;
    notes.push({
      id: crypto.randomUUID(),
      page,
      kind,
      title: n.title.trim(),
      body: n.body.trim(),
      anchor,
      y: anchorY(anchor, pageTexts.find((p) => p.page === page)?.text ?? ""),
      sources,
      createdAt: Date.now(),
    });
    if (notes.length === 3) break;
  }
  return notes;
}

/** The pet's optional aside from an insights run; null when absent or
 *  malformed — a missing joke is never an error. */
export function parseQuip(
  text: string,
  span: InsightSpan,
  pageTexts: { page: number; text: string }[],
  fromPage: number,
): PetQuip | null {
  let raw: { quip?: { page?: unknown; anchor?: unknown; text?: unknown } | null };
  try {
    raw = extractJson(text);
  } catch {
    return null;
  }
  const q = raw.quip;
  if (!q || typeof q.text !== "string") return null;
  const line = q.text.trim().replace(/^["“]|["”]$/g, "");
  if (!line || line.length > 160) return null;
  // A page behind the reader would never be said; pull it up to where they are.
  let page = Math.min(
    Math.max(fromPage, typeof q.page === "number" ? Math.round(q.page) : fromPage),
    span.endPage,
  );
  const anchor = typeof q.anchor === "string" && q.anchor.trim() ? q.anchor.trim() : undefined;
  // The model's page number can be off (printed vs physical numbering); the
  // quote itself says where it is — the nearest page from the reader on.
  const quote = anchor ? squashText(anchor) : "";
  const found = quote
    ? pageTexts
        .filter((p) => p.page >= fromPage && squashText(p.text).includes(quote))
        .sort((a, b) => Math.abs(a.page - page) - Math.abs(b.page - page))[0]
    : undefined;
  if (found) page = found.page;
  // Unplaceable, it waits for the page's end: late beats spoiling the joke.
  const y = anchorY(anchor, pageTexts.find((p) => p.page === page)?.text ?? "", 0.95);
  return { id: crypto.randomUUID(), page, text: line, anchor, y, said: false };
}

/** Initial guess at a quote's vertical position, as a fraction of the page
 *  height: char offset in the extracted text, mapped linearly. PageInsights
 *  refines this against the rendered pdf.js text layer (real glyph geometry)
 *  whenever the page is on screen; this value is the fallback until then. */
function anchorY(anchor: string | undefined, pageText: string, missing = 0.5): number {
  const text = squashText(pageText);
  const quote = anchor ? squashText(anchor) : "";
  if (quote && text.length > 40) {
    const i = text.indexOf(quote);
    // Text occupies roughly the middle ~80% of a page between its margins.
    if (i >= 0) return 0.1 + ((i + quote.length) / text.length) * 0.78;
  }
  return missing;
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

/** Validate a trivia run: known topics, four distinct choices, a real story
 *  and at least one web source per question. Choices are shuffled (models
 *  favour putting the answer first) and the pack ordered easy to hard. */
export function parseTrivia(text: string, topicIds: string[]): TriviaQuestion[] {
  const raw = extractJson<{ questions?: unknown }>(text);
  if (!Array.isArray(raw.questions)) throw new Error("trivia JSON missing questions[]");
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const out: TriviaQuestion[] = [];
  for (const q of raw.questions as Record<string, unknown>[]) {
    const choices = Array.isArray(q?.choices) ? (q.choices as unknown[]).map(str) : [];
    const sources = (Array.isArray(q?.sources) ? (q.sources as Record<string, unknown>[]) : [])
      .map((x) => ({ title: str(x?.title), url: str(x?.url) }))
      .filter((x) => /^https:\/\/\S+$/.test(x.url))
      .slice(0, 3);
    const story = str(q?.story);
    const ok =
      topicIds.includes(str(q?.topic)) &&
      str(q?.question) &&
      choices.length === 4 &&
      choices.every(Boolean) &&
      new Set(choices.map((c) => c.toLowerCase())).size === 4 &&
      Number.isInteger(q.answer) && (q.answer as number) >= 0 && (q.answer as number) < 4 &&
      story.split(/\s+/).length >= 120 &&
      sources.length > 0;
    if (!ok) continue;
    const shuffled = shuffleChoices(choices, q.answer as number);
    const image = media(q.image, commonsImageOf);
    const scene = media(q.scene, commonsImageOf);
    out.push({
      topic: str(q.topic),
      difficulty: q.difficulty === 1 || q.difficulty === 3 ? q.difficulty : 2,
      hook: str(q.hook),
      question: str(q.question),
      choices: shuffled.choices,
      answer: shuffled.answer,
      fact: str(q.fact) || str(q.question),
      story,
      whyNot: str(q.whyNot),
      sources,
      // The same photo twice would spend the reveal's picture early.
      scene: scene?.file === image?.file ? undefined : scene,
      image,
      video: media(q.video, (o) => {
        const id = youtubeId(str(o.url));
        return id ? { id, title: str(o.title) } : undefined;
      }),
    });
  }
  // Array.sort is stable: the writer's order holds within a difficulty.
  return out.slice(0, QUESTIONS).sort((a, b) => a.difficulty - b.difficulty);
}

function commonsImageOf(o: Record<string, unknown>): TriviaImage | undefined {
  const file = typeof o.file === "string" ? commonsFile(o.file) : null;
  return file ? { file, caption: typeof o.caption === "string" ? o.caption.trim() : "" } : undefined;
}

/** An optional media object from model JSON, or undefined. */
function media<T>(raw: unknown, read: (o: Record<string, unknown>) => T | undefined): T | undefined {
  return raw && typeof raw === "object" ? read(raw as Record<string, unknown>) : undefined;
}

// ── Trivia follow-ups: Explain / Ask on a selection in a trivia question ──

const letter = (i: number) => String.fromCharCode(65 + i);

/** Opens a conversation about one trivia question. Before the player has
 *  answered, Claude isn't told the answer and must not find it for them. */
export function triviaChatPreamble(q: TriviaQuestion, picked: number | null, today: Date): string {
  return [
    `I'm playing a daily trivia game and want to talk about one of its questions. Today is ${today.toDateString()}.`,
    ``,
    `The news it hangs on: ${q.hook}`,
    `Question: ${q.question}`,
    ...q.choices.map((c, i) => `${letter(i)}) ${c}`),
    ``,
    picked !== null
      ? triviaAnswerContext(q, picked)
      : `I haven't answered yet. Help me with words and background, but never say, hint at or rule out which choice is right, and don't look the answer up.`,
    ``,
    `Talk to me like a curious friend, not a textbook: a short paragraph or two unless I ask for more. Search the web when I ask about something beyond what's here (what happened next, the latest news), and link what you cite.`,
  ].join("\n");
}

/** Tells a conversation begun before answering that the answer is now open. */
export function triviaAnsweredNote(q: TriviaQuestion, picked: number): string {
  return `I've answered now, so you can talk about the answer freely. ${triviaAnswerContext(q, picked)}`;
}

function triviaAnswerContext(q: TriviaQuestion, picked: number): string {
  const mine = picked === q.answer ? "I got it right." : `I picked ${letter(picked)}.`;
  return [
    `The answer is ${letter(q.answer)}) ${q.choices[q.answer]}. ${mine} The story I read after answering:`,
    ``,
    q.story,
    ``,
    `Its sources: ${q.sources.map((s) => s.url).join(", ")}`,
  ].join("\n");
}

export function explainTriviaMessage(text: string): string {
  return `Explain this:\n\n"${text.trim()}"\n\nWhat it means in plain language, and the context I need to make sense of it.`;
}
