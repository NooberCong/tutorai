/** Markdown → sanitized HTML, with [p.N] citations turned into page chips and
 *  LaTeX math rendered by KaTeX. */

import { marked, type TokenizerAndRendererExtension } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import type * as React from "react";

const CITATION = /\[p\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/g;

const math = (tex: string, displayMode: boolean) =>
  katex.renderToString(tex, { displayMode, throwOnError: false });

/**
 * One unambiguous math delimiter pair, as a marked inline extension. Extensions
 * are tried before the built-in tokenizers at each position but after code spans
 * and fences have been claimed, so `$$` inside code stays literal and the TeX
 * never reaches the emphasis tokenizer that would eat its `_` and `^`.
 */
function mathExtension(
  name: string,
  open: string,
  close: string,
  displayMode: boolean,
): TokenizerAndRendererExtension {
  return {
    name,
    level: "inline",
    start: (src) => src.indexOf(open),
    tokenizer(src) {
      if (!src.startsWith(open)) return undefined;
      const end = src.indexOf(close, open.length);
      // Unclosed — the usual case is math half-streamed. Falling through to the
      // text tokenizer shows it raw for a beat; the next token resolves it.
      if (end < 0) return undefined;
      return {
        type: name,
        raw: src.slice(0, end + close.length),
        text: src.slice(open.length, end),
      };
    },
    renderer: (token) => math(token.text, displayMode),
  };
}

const DIGIT = /[0-9]/;
const SPACE = /\s/;

/**
 * `$…$` inline math. The models write it whatever the prompt asks, and these
 * documents quote prices in the same breath ("$55.05 + $50.51 … totals
 * $666.67"), so the delimiter has to be told apart from a currency sign by
 * shape:
 *
 *   - An opening `$` is never followed by a digit or a space. That alone rules
 *     out every price, which is exactly `$` + digits.
 *   - A closing `$` is never preceded by a space or a backslash (`\$` is an
 *     escaped dollar *inside* the math), nor followed by a digit.
 *
 * When no closer qualifies the run stays literal text, so a stray `$` costs
 * nothing.
 *
 * `$$` is declined outright and left to the display extension. That has to be
 * explicit rather than a matter of registration order: marked *unshifts* inline
 * extensions, so the array below runs back to front.
 */
const dollarMath: TokenizerAndRendererExtension = {
  name: "mathDollar",
  level: "inline",
  start: (src) => src.indexOf("$"),
  tokenizer(src) {
    const opener = src[1];
    if (src[0] !== "$" || !opener || DIGIT.test(opener) || SPACE.test(opener)) {
      return undefined;
    }
    if (opener === "$") return undefined;
    for (let i = 2; i < src.length; i++) {
      if (src[i] !== "$") continue;
      const before = src[i - 1];
      const after = src[i + 1];
      if (SPACE.test(before) || before === "\\") continue;
      if (after && DIGIT.test(after)) continue;
      return { type: "mathDollar", raw: src.slice(0, i + 1), text: src.slice(1, i) };
    }
    return undefined;
  },
  renderer: (token) => math(token.text, false),
};

marked.setOptions({ gfm: true, breaks: true });
marked.use({
  extensions: [
    mathExtension("mathDisplay", "$$", "$$", true),
    mathExtension("mathDisplayBracket", "\\[", "\\]", true),
    mathExtension("mathInline", "\\(", "\\)", false),
    dollarMath,
  ],
});

/** Render markdown; [p.N] / [p.N-M] become clickable .cite chips. */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false });
  const withCites = html.replace(
    CITATION,
    (_m, a: string, b?: string) =>
      `<button class="cite" data-page="${a}">p.${a}${b ? `–${b}` : ""}</button>`,
  );
  return DOMPurify.sanitize(withCites, {
    // <semantics>/<annotation> hold KaTeX's MathML layer, which is what screen
    // readers use. Without them DOMPurify drops the tags but keeps their text,
    // spilling the raw TeX into the rendered output.
    ADD_TAGS: ["semantics", "annotation"],
    ADD_ATTR: ["data-page", "encoding"],
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
