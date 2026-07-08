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
};

let settings: Settings = { ...SETTINGS_DEFAULTS };

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
}
