/** Typesets the Markdown document handed over by src-tauri/src/markdown.rs
 *  (window.__PRINT_JOB__), then resolves window.__printReady once fonts and
 *  images are in, so the PDF prints complete. */

import { convertFileSrc } from "@tauri-apps/api/core";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "katex/dist/katex.min.css";
import "./print.css";
import { renderDocument } from "../lib/markdown";

interface PrintJob {
  markdown: string;
  /** Folder of the Markdown file; relative images and links resolve here. */
  dir: string;
  /** File name without extension: the title when the text has none. */
  name: string;
}

declare global {
  interface Window {
    __PRINT_JOB__: PrintJob;
    __printReady: Promise<void>;
  }
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const IMAGE_WAIT_MS = 15_000;

window.__printReady = typeset(window.__PRINT_JOB__);

async function typeset({ markdown, dir, name }: PrintJob): Promise<void> {
  const front = FRONT_MATTER.exec(markdown);
  const doc = document.getElementById("doc")!;
  doc.innerHTML = renderDocument(front ? markdown.slice(front[0].length) : markdown);

  // The PDF's title (pdf.js reads it as the document's title in the library).
  const frontTitle = front?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  document.title = frontTitle || doc.querySelector("h1")?.textContent?.trim() || name;

  addHeadingIds(doc);
  for (const a of doc.querySelectorAll("a[href]")) {
    const path = localPath(a.getAttribute("href")!, dir);
    if (path) a.setAttribute("href", `file:///${path.replace(/\\/g, "/")}`);
  }
  const images = [...doc.querySelectorAll("img")];
  for (const img of images) {
    const path = localPath(img.getAttribute("src") ?? "", dir);
    if (path) img.src = convertFileSrc(path);
  }

  await Promise.race([
    Promise.all(images.map((img) => img.decode().catch(() => img.replaceWith(img.alt)))),
    new Promise((r) => setTimeout(r, IMAGE_WAIT_MS)),
  ]);
  await document.fonts.ready;
}

/** GitHub-style anchors, so `[see](#setup)` links work in the PDF. */
function addHeadingIds(root: HTMLElement) {
  const seen = new Map<string, number>();
  for (const h of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const base = (h.textContent ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    h.id = n ? `${base}-${n}` : base;
  }
}

/** Absolute Windows path a reference in the document points to, or null when
 *  it isn't a local file (a web URL, an in-page #anchor, mailto: …). */
function localPath(ref: string, dir: string): string | null {
  let path: string;
  if (/^file:/i.test(ref)) path = decodeURIComponent(new URL(ref).pathname).replace(/^\/(?=[a-z]:)/i, "");
  else if (/^[a-z]:[\\/]/i.test(ref)) path = ref;
  else if (/^([a-z][a-z\d+.-]*:|#|\/\/)/i.test(ref)) return null;
  else path = `${dir}\\${safeDecode(ref.split(/[?#]/)[0])}`;
  // Resolve . and .. so the asset protocol's scope check sees the real path.
  const unc = /^[\\/]{2}/.test(path) ? "\\\\" : "";
  const parts: string[] = [];
  for (const part of path.split(/[\\/]+/)) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return unc + parts.join("\\");
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
