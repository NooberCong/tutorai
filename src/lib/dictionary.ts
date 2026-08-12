/** App-global dictionary access: the installed list (cached), the per-id
 *  enabled switch (a settings.json key), and word lookup across whatever is
 *  enabled. Dictionaries are not per-document, so this is a plain module in
 *  the settings.ts mold — no provider, callers just import functions. */

import {
  importDictionary,
  listDictionaries,
  lookupWord,
  removeDictionary,
} from "./tauri";
import { getSetting, saveSetting } from "./settings";
import type { DictHit, DictMeta } from "./types";

let cache: DictMeta[] | null = null;

export async function getDictionaries(force = false): Promise<DictMeta[]> {
  if (!cache || force) cache = await listDictionaries();
  return cache;
}

export function isEnabled(id: string): boolean {
  return !getSetting("dictDisabled").includes(id);
}

export function setEnabled(id: string, on: boolean): void {
  const disabled = getSetting("dictDisabled").filter((d) => d !== id);
  saveSetting("dictDisabled", on ? disabled : [...disabled, id]);
}

/** Look `text` up across all enabled dictionaries, in listing order. */
export async function lookup(text: string): Promise<DictHit[]> {
  const ids = (await getDictionaries())
    .filter((d) => isEnabled(d.id))
    .map((d) => d.id);
  if (ids.length === 0) return [];
  return lookupWord(text, ids);
}

export async function importDict(srcPath: string): Promise<DictMeta> {
  const meta = await importDictionary(srcPath);
  cache = null;
  return meta;
}

export async function removeDict(id: string): Promise<void> {
  await removeDictionary(id);
  cache = null;
  // A re-import of the same fileset gets the same id — don't let a stale
  // disabled flag resurrect switched-off.
  saveSetting(
    "dictDisabled",
    getSetting("dictDisabled").filter((d) => d !== id),
  );
}

/** Whether any dictionary is enabled — the popup's empty-state hint. */
export async function anyEnabled(): Promise<boolean> {
  return (await getDictionaries()).some((d) => isEnabled(d.id));
}
