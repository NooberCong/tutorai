/** Dictionaries section on the library screen: the built-in English
 *  dictionary plus StarDict imports, each with an enable toggle. Lives here
 *  because dictionaries are app-global exactly like the library itself. */

import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  getDictionaries,
  importDict,
  isEnabled,
  removeDict,
  setEnabled,
} from "../lib/dictionary";
import type { DictMeta } from "../lib/types";
import { Check, Plus, Trash } from "./Icons";

export function DictionaryManager() {
  const [dicts, setDicts] = useState<DictMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Enabled flags live in settings.ts, outside React — tick to re-render.
  const [, setTick] = useState(0);

  const refresh = () =>
    getDictionaries(true)
      .then(setDicts)
      .catch(() => setDicts([]));

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "StarDict dictionary", extensions: ["ifo"] }],
    });
    if (typeof path !== "string") return;
    setError(null);
    try {
      await importDict(path);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const toggle = (id: string) => {
    setEnabled(id, !isEnabled(id));
    setTick((t) => t + 1);
  };

  const remove = async (id: string) => {
    await removeDict(id).catch(() => {});
    await refresh();
  };

  return (
    <section className="dicts">
      <div className="library-head">
        <h2>Dictionaries</h2>
        <button className="btn" onClick={add}>
          <Plus width={13} height={13} />
          Add dictionary
        </button>
      </div>

      <div className="dict-list">
        {dicts.map((dict) => {
          const on = isEnabled(dict.id);
          return (
            <div key={dict.id} className={`dict-row ${on ? "" : "off"}`}>
              <button
                className={`dict-toggle ${on ? "on" : ""}`}
                role="switch"
                aria-checked={on}
                aria-label={`${dict.name} enabled`}
                title={on ? "Disable for lookups" : "Enable for lookups"}
                onClick={() => toggle(dict.id)}
              >
                <Check strokeWidth={2} />
              </button>
              <div className="dict-info">
                <span className="dict-name">{dict.name}</span>
                {dict.description && (
                  <span className="dict-desc">{dict.description}</span>
                )}
              </div>
              <span className="dict-count">
                {dict.wordCount.toLocaleString()} words
              </span>
              {dict.builtin ? (
                <span className="dict-badge">built-in</span>
              ) : (
                <button
                  className="dict-remove"
                  title="Remove dictionary"
                  aria-label={`Remove ${dict.name}`}
                  onClick={() => remove(dict.id)}
                >
                  <Trash width={13} height={13} />
                </button>
              )}
            </div>
          );
        })}
        {dicts.length === 0 && (
          <div className="dict-row empty">No dictionaries installed.</div>
        )}
      </div>

      {error && <div className="banner warn">{error}</div>}
      <p className="dict-hint">
        Select a word while reading and choose Translate to look it up.
        Import any StarDict dictionary by picking its <code>.ifo</code> file —
        other formats convert with PyGlossary or GoldenDict.
      </p>
    </section>
  );
}
