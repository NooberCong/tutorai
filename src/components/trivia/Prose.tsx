import type { MouseEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { renderMarkdown } from "../../lib/markdown";

/** Markdown whose links open in the browser, never inside the app. */
export function Prose(props: { text: string; className?: string }) {
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest?.("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href?.startsWith("https://")) void openUrl(href);
  };
  return (
    <div
      className={`md ${props.className ?? ""}`}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(props.text) }}
    />
  );
}
