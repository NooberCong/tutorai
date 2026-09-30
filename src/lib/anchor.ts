/** Where verbatim quotes sit on a rendered page, as fractions of the page
 *  height: found in the pdf.js text layer (real glyph geometry). Undefined
 *  for a quote that isn't found, or while the layer isn't rendered — callers
 *  fall back to the heuristic y computed from the extracted text. */
export function anchorFracs(pageEl: Element, anchors: (string | undefined)[]): (number | undefined)[] {
  const spans = Array.from(pageEl.querySelectorAll<HTMLElement>(".textLayer span"));
  const pageRect = pageEl.getBoundingClientRect();
  if (!spans.length || !pageRect.height) return anchors.map(() => undefined);
  const squash = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  let text = "";
  const starts = spans.map((s) => {
    const at = text.length;
    text += squash(s.textContent ?? "") + " ";
    return at;
  });
  return anchors.map((anchor) => {
    const at = anchor ? text.indexOf(squash(anchor)) : -1;
    if (at < 0) return undefined;
    let idx = 0;
    while (idx + 1 < starts.length && starts[idx + 1] <= at) idx++;
    const rect = spans[idx].getBoundingClientRect();
    return (rect.top + rect.height / 2 - pageRect.top) / pageRect.height;
  });
}
