/** pdf.js loading, outline→chapter mapping, and page-marked text extraction. */

import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Chapter } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = PDFDocumentProxy;

export function loadPdf(url: string): Promise<PdfDoc> {
  return pdfjs.getDocument({ url }).promise;
}

interface OutlineNode {
  title: string;
  dest: unknown;
  items?: OutlineNode[];
}

async function destToPage(doc: PdfDoc, dest: unknown): Promise<number | null> {
  try {
    const resolved = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(resolved) || resolved[0] == null) return null;
    return (await doc.getPageIndex(resolved[0])) + 1;
  } catch {
    return null;
  }
}

async function levelToStarts(
  doc: PdfDoc,
  nodes: OutlineNode[],
): Promise<{ title: string; page: number }[]> {
  const starts: { title: string; page: number }[] = [];
  for (const node of nodes) {
    const page = await destToPage(doc, node.dest);
    if (page != null && node.title.trim()) {
      starts.push({ title: node.title.trim(), page });
    }
  }
  return starts;
}

/**
 * Derive chapters from the PDF outline. Uses top-level bookmarks; if there are
 * too few (a lone root node wrapping everything), descends one level.
 * Returns [] when no usable outline exists.
 */
export async function outlineChapters(doc: PdfDoc): Promise<Chapter[]> {
  const outline = (await doc.getOutline()) as OutlineNode[] | null;
  if (!outline?.length) return [];

  let starts = await levelToStarts(doc, outline);
  if (starts.length < 2 && outline[0]?.items?.length) {
    const children = await levelToStarts(doc, outline[0].items);
    if (children.length >= 2) starts = children;
  }
  if (starts.length < 2) return [];

  // Sort by page and merge same-page entries (keep the first title).
  starts.sort((a, b) => a.page - b.page);
  const merged = starts.filter((s, i) => i === 0 || s.page > starts[i - 1].page);

  const chapters: Chapter[] = merged.map((s, i) => ({
    title: s.title,
    startPage: s.page,
    endPage: i + 1 < merged.length ? merged[i + 1].page - 1 : doc.numPages,
  }));
  // Front matter before the first bookmark belongs to the first chapter.
  chapters[0].startPage = 1;
  return chapters;
}

/** Extract plain text for every page. Slow for big books — report progress. */
export async function extractPages(
  doc: PdfDoc,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) {
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
    }
    pages.push(text.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim());
    page.cleanup();
    if (i % 10 === 0 || i === doc.numPages) onProgress?.(i, doc.numPages);
  }
  return pages;
}

/**
 * Compose one text file per chapter with [[PAGE n]] markers, the ground truth
 * headless Claude reads. Returns {rel, content} pairs (rel under the doc dir).
 */
export function buildChapterFiles(
  pages: string[],
  chapters: Chapter[],
): { rel: string; content: string }[] {
  return chapters.map((ch, i) => {
    let body = `# ${ch.title}\n(pages ${ch.startPage}–${ch.endPage})\n`;
    for (let p = ch.startPage; p <= ch.endPage; p++) {
      body += `\n[[PAGE ${p}]]\n${pages[p - 1] ?? ""}\n`;
    }
    return { rel: `chapters/${chapterFileName(i)}`, content: body };
  });
}

export function chapterFileName(index: number): string {
  return `chapter-${String(index + 1).padStart(2, "0")}.txt`;
}

/** Fallback single chapter covering the whole document. */
export function wholeDocChapter(pages: number): Chapter {
  return { title: "Full document", startPage: 1, endPage: pages };
}

/** Does this page carry visual content — raster images, or enough vector
 *  drawing to suggest a diagram/chart — that text extraction can't convey? */
export async function pageHasFigures(doc: PdfDoc, num: number): Promise<boolean> {
  const page = await doc.getPage(num);
  try {
    const ops = await page.getOperatorList();
    let paths = 0;
    for (const fn of ops.fnArray) {
      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject ||
        fn === pdfjs.OPS.paintImageXObjectRepeat
      ) {
        return true;
      }
      if (fn === pdfjs.OPS.constructPath) paths++;
    }
    // Text pages still draw a few rules/boxes; real diagrams draw many paths.
    return paths > 40;
  } catch {
    return false;
  } finally {
    page.cleanup();
  }
}

/** Render one page to a JPEG (base64, no data: prefix) for the AI to Read. */
export async function renderPageJpegBase64(
  doc: PdfDoc,
  num: number,
  width = 1100,
): Promise<string> {
  const page = await doc.getPage(num);
  const vp1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / vp1.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.8);
  page.cleanup();
  return url.slice(url.indexOf(",") + 1);
}

/** Cache-relative path of a page's figure image. */
export function figureFileName(page: number): string {
  return `pages/page-${String(page).padStart(4, "0")}.jpg`;
}

/** Render page 1 as a small JPEG data URL — the book's library cover. */
export async function renderCoverDataUrl(doc: PdfDoc, width = 360): Promise<string> {
  const page = await doc.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / vp1.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.82);
  page.cleanup();
  return url;
}
