/** Text reduced to lowercase letters and digits, for finding a quote in page
 *  text: pdf.js splits runs mid-word, breaks words with line-end hyphens and
 *  curls quotes the model wrote straight, so spacing and punctuation can't be
 *  trusted to match. */
export function squashText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Where verbatim quotes sit on a rendered page, as fractions of the page
 *  height: found in the pdf.js text layer (real glyph geometry). `at: "end"`
 *  gives the bottom of the quote's last line — where a reader has finished
 *  reading it — instead of its first line's middle. Undefined for a quote
 *  that isn't found, or while the layer isn't rendered — callers fall back to
 *  the heuristic y computed from the extracted text. */
export function anchorFracs(
  pageEl: Element,
  anchors: (string | undefined)[],
  at: "start" | "end" = "start",
): (number | undefined)[] {
  const spans = Array.from(pageEl.querySelectorAll<HTMLElement>(".textLayer span"));
  const pageRect = pageEl.getBoundingClientRect();
  if (!spans.length || !pageRect.height) return anchors.map(() => undefined);
  let text = "";
  const starts = spans.map((s) => {
    const from = text.length;
    text += squashText(s.textContent ?? "");
    return from;
  });
  const spanAt = (i: number) => {
    let idx = 0;
    while (idx + 1 < starts.length && starts[idx + 1] <= i) idx++;
    return spans[idx].getBoundingClientRect();
  };
  return anchors.map((anchor) => {
    const quote = anchor ? squashText(anchor) : "";
    const i = quote ? text.indexOf(quote) : -1;
    if (i < 0) return undefined;
    const rect = at === "end" ? spanAt(i + quote.length - 1) : spanAt(i);
    const y = at === "end" ? rect.bottom : rect.top + rect.height / 2;
    return (y - pageRect.top) / pageRect.height;
  });
}
