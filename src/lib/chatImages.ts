/** Images the reader attaches to a chat question. They are saved beside the
 *  snips, as files the headless CLI can Read, and go when the snips do: on
 *  "New conversation", or by the doc-open sweep of stale ones (store.rs). */

import { copyIntoDoc, writeDocBytes } from "./tauri";

/** What Claude's Read tool can see, by extension and clipboard MIME type. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const IMAGE_EXTENSIONS = Object.keys(IMAGE_TYPES);

const extensionOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";

export const isImagePath = (path: string) => extensionOf(path) in IMAGE_TYPES;

const newRel = (ext: string) =>
  `snips/image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

/** Copy an image file from disk; returns its doc-relative path. */
export async function saveImageFile(docId: string, path: string): Promise<string> {
  const rel = newRel(extensionOf(path));
  await copyIntoDoc(docId, path, rel);
  return rel;
}

/** Save the image on the clipboard, if it holds one. */
export async function saveClipboardImage(docId: string): Promise<string | null> {
  for (const item of await navigator.clipboard.read()) {
    const ext = IMAGE_EXTENSIONS.find((e) => item.types.includes(IMAGE_TYPES[e]));
    if (!ext) continue;
    const rel = newRel(ext);
    await writeDocBytes(docId, rel, await toBase64(await item.getType(IMAGE_TYPES[ext])));
    return rel;
  }
  return null;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
