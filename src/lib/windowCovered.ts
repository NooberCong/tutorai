/** Whether the main window is entirely behind other windows
 *  (src-tauri/src/occlusion.rs). The webview stays visible then, so
 *  Alt-Tab, Task View and taskbar previews still show the page, but nothing
 *  needs to move: while covered, `data-covered` on <html> pauses CSS
 *  animations (styles.css) and the reader's backdrop stops (ReaderAmbience).
 *  Minimized is plain `document.visibilityState === "hidden"`. Off Windows
 *  the command is missing and the window is never covered. */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

let covered = false;
const subscribers = new Set<() => void>();

function set(c: boolean) {
  if (c === covered) return;
  covered = c;
  document.documentElement.toggleAttribute("data-covered", c);
  subscribers.forEach((f) => f());
}

let heard = false;
invoke<boolean>("window_covered").then((c) => heard || set(c), () => {});
void listen<boolean>("window-covered", (e) => {
  heard = true;
  set(e.payload);
});

export const isCovered = () => covered;

export function onCoveredChange(f: () => void): () => void {
  subscribers.add(f);
  return () => subscribers.delete(f);
}
