/** Reading the operator lists pdf.js builds to draw a page: the matrix math to
 *  follow its transforms, and the list the canvas render already holds, so a
 *  walk over a drawn page costs no extra parse. */

import type { PDFPageProxy } from "pdfjs-dist";

export type Matrix = number[];

export interface OpList {
  fnArray: number[];
  argsArray: unknown[][];
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Operator args carry matrices as plain arrays or Float32Arrays. */
export const asMatrix = (v: unknown): Matrix | null =>
  v != null && (Array.isArray(v) || ArrayBuffer.isView(v)) && (v as ArrayLike<number>).length === 6
    ? Array.from(v as ArrayLike<number>)
    : null;

export const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

type IntentStates = Map<unknown, { operatorList?: OpList & { lastChunk?: boolean }; renderTasks?: Set<unknown> }>;

/** pdf.js keeps operator lists per rendering intent on the page proxy.
 *  `_intentStates` is internal, so anything unexpected yields null and callers
 *  go without. */
export function intentStates(page: PDFPageProxy): IntentStates | null {
  const states = (page as unknown as { _intentStates?: unknown })._intentStates;
  return states instanceof Map ? (states as IntentStates) : null;
}

/** The completed display operator list the canvas render already fetched;
 *  null once pdf.js has freed it (page.cleanup()). */
export function cachedOperatorList(page: PDFPageProxy): OpList | null {
  for (const state of intentStates(page)?.values() ?? []) {
    const list = state.operatorList;
    if (list?.lastChunk && Array.isArray(list.fnArray) && Array.isArray(list.argsArray)) return list;
  }
  return null;
}
