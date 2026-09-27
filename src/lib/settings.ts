/** App-wide preferences, persisted as settings.json in the app data dir.
 *
 *  Deliberately not localStorage: WebView2 storage is origin-scoped (the dev
 *  server and installed builds are different origins) and can be wiped
 *  independently of the app, so choices silently reset across restarts.
 *  A file under app data survives both, matching how everything else durable
 *  is stored.
 *
 *  `loadSettings()` runs once before the UI mounts (main.tsx); after that
 *  reads are synchronous and saves write through in the background.
 */

import { useSyncExternalStore } from "react";
import { readSettings, writeSettings } from "./tauri";

/** One pen-tray preset: a remembered pen the reader can switch to in one tap. */
export interface InkPreset {
  color: string;
  /** Stroke width in page units. */
  width: number;
  mode: "pen" | "highlighter";
}

export interface Settings {
  /** Claude model alias ("haiku" | "sonnet" | "opus"); "" = CLI default. */
  model: string;
  sidebarOpen: boolean;
  panelOpen: boolean;
  sidebarWidth: number;
  panelWidth: number;
  /** Reading companion (proactive margin notes) — opt-in, spends quota. */
  companion: boolean;
  /** Annotation colors, remembered per tool. */
  highlightColor: string;
  noteColor: string;
  textColor: string;
  /** Pen tray: three presets, each remembering its own color/width/mode. */
  inkPresets: InkPreset[];
  inkPresetIdx: number;
  /** Documents open in tabs last session, reopened on boot. `activePath`
   *  null means the library screen was showing. */
  openTabs: { paths: string[]; activePath: string | null };
  /** Dictionary ids switched off for lookups. Storing the disabled set means
   *  new imports and the built-in are on by default, with no migration. */
  dictDisabled: string[];
  /** Reading pets (the hatchery). Off means off: no tracking, no pet in the
   *  reader, no hatchery tab — the collection is kept for when it's back. */
  hatchery: boolean;
  /** Show the pet and egg in the reader's corner. When hidden, reading still
   *  warms eggs and grows pets. */
  hatcheryInReader: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  model: "",
  sidebarOpen: true,
  panelOpen: true,
  sidebarWidth: 256,
  panelWidth: 400,
  companion: false,
  highlightColor: "#FFDE59",
  noteColor: "#FFDE59",
  textColor: "#232B27",
  inkPresets: [
    { color: "#232B27", width: 2.5, mode: "pen" },
    { color: "#E24A3B", width: 2.5, mode: "pen" },
    { color: "#FFDE59", width: 9, mode: "highlighter" },
  ],
  inkPresetIdx: 0,
  openTabs: { paths: [], activePath: null },
  dictDisabled: [],
  hatchery: true,
  hatcheryInReader: true,
};

let settings: Settings = { ...SETTINGS_DEFAULTS };
const listeners = new Set<() => void>();

/** Missing keys (older files) and unreadable files both fall back to
 *  defaults — a broken settings.json must never block the app. */
export async function loadSettings(): Promise<void> {
  try {
    const text = await readSettings();
    const parsed = text ? (JSON.parse(text) as Partial<Settings>) : null;
    if (parsed && typeof parsed === "object") {
      settings = { ...SETTINGS_DEFAULTS, ...parsed };
    }
  } catch {
    // keep defaults
  }
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return settings[key];
}

export function saveSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  settings = { ...settings, [key]: value };
  writeSettings(JSON.stringify(settings, null, 2)).catch(() => {});
  listeners.forEach((l) => l());
}

/** A setting that re-renders its readers when it changes anywhere — for
 *  switches shown in more than one place. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSyncExternalStore(subscribe, () => settings[key]);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
