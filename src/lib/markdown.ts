/** Markdown → sanitized HTML, with [p.N] citations turned into page chips. */

import { marked } from "marked";
import DOMPurify from "dompurify";
import type * as React from "react";

marked.setOptions({ gfm: true, breaks: true });

const CITATION = /\[p\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/g;

/** Render markdown; [p.N] / [p.N-M] become clickable .cite chips. */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false });
  const withCites = html.replace(
    CITATION,
    (_m, a: string, b?: string) =>
      `<button class="cite" data-page="${a}">p.${a}${b ? `–${b}` : ""}</button>`,
  );
  return DOMPurify.sanitize(withCites, {
    ADD_ATTR: ["data-page"],
  });
}

/** Delegate clicks on .cite chips inside `container` to a page jump. */
export function onCitationClick(
  event: React.MouseEvent<HTMLElement>,
  jump: (page: number) => void,
): void {
  const target = (event.target as HTMLElement).closest?.(".cite");
  const page = target?.getAttribute("data-page");
  if (page) {
    event.preventDefault();
    jump(parseInt(page, 10));
  }
}
