/** Pictures and videos for trivia stories.
 *
 *  Images come from Wikimedia Commons by file name — free to show, stable,
 *  and served at any width by Special:FilePath. Videos are YouTube ids,
 *  opened in the browser (embedded players refuse to run inside the app's
 *  webview). The writer may still name a file or video that doesn't exist,
 *  so every one is loaded once before a pack is saved, and dropped if it
 *  doesn't come back. */

import type { TriviaQuestion } from "./game";

export const commonsImage = (file: string, width = 960) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
export const commonsPage = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** A Commons file name from whatever the writer gave: a bare name, a
 *  "File:" title, or a commons/upload.wikimedia.org URL. */
export function commonsFile(raw: string): string | null {
  // …/wiki/File:<name>, or upload.wikimedia.org/…/a/ab/<name>[/960px-<name>]
  const wiki = raw.match(/\/wiki\/([^?#]+)/);
  const upload = raw.match(/upload\.wikimedia\.org\/[^?#]*?\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/);
  let name = (wiki?.[1] ?? upload?.[1] ?? raw).trim();
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep as given
  }
  name = name.replace(/^(Special:FilePath\/|File:|Image:)/i, "").replace(/_/g, " ").trim();
  return /\.(jpe?g|png|gif|webp|tiff?)$/i.test(name) ? name : null;
}

/** A YouTube video id from a watch, short, embed or youtu.be URL. */
export function youtubeId(raw: string): string | null {
  const m = raw.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Natural width of an image once loaded, or 0 if it fails or is slow. */
function loadedWidth(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(0), 15_000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img.naturalWidth);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(0);
    };
    img.src = src;
  });
}

/** Drop any image or video that doesn't load. A missing YouTube video
 *  still answers, with a 120px placeholder instead of its 320px thumbnail. */
export async function verifyMedia(questions: TriviaQuestion[]): Promise<TriviaQuestion[]> {
  return Promise.all(
    questions.map(async (q) => {
      const [scene, image, video] = await Promise.all([
        q.scene && loadedWidth(commonsImage(q.scene.file)),
        q.image && loadedWidth(commonsImage(q.image.file)),
        q.video && loadedWidth(youtubeThumb(q.video.id)),
      ]);
      return {
        ...q,
        scene: scene ? q.scene : undefined,
        image: image ? q.image : undefined,
        video: video && video >= 320 ? q.video : undefined,
      };
    }),
  );
}
