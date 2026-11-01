/** The files TutorAI opens: PDFs, and Markdown, which the app typesets to a
 *  PDF on first open (src-tauri/src/markdown.rs). */

export const DOC_EXTENSIONS = ["pdf", "md", "markdown"];

const EXTENSION = new RegExp(`\\.(${DOC_EXTENSIONS.join("|")})$`, "i");

export const isDocPath = (path: string) => EXTENSION.test(path);

export const isMarkdownPath = (path: string) => /\.(md|markdown)$/i.test(path);

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** A file name without its document extension — the fallback title. */
export const docStem = (name: string) => name.replace(EXTENSION, "");

/** The document a `file:` URL points to (a Markdown file's link to another
 *  note, say), or null when it isn't a file TutorAI opens. */
export function fileUrlDocPath(url: string): string | null {
  if (!/^file:/i.test(url)) return null;
  try {
    const { host, pathname } = new URL(url);
    const path = decodeURIComponent(pathname).replace(/^\/(?=[a-z]:)/i, "").replace(/\//g, "\\");
    const full = host ? `\\\\${host}${path}` : path;
    return isDocPath(full) ? full : null;
  } catch {
    return null;
  }
}
