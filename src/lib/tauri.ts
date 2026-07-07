/** Thin wrappers over the Rust commands. All app IPC goes through here. */

import { invoke, Channel, convertFileSrc } from "@tauri-apps/api/core";
import type {
  DoneEvent,
  JobEvent,
  JobSpec,
  LibraryEntry,
  RegisteredDoc,
} from "./types";

export const readSettings = () => invoke<string | null>("read_settings");
export const writeSettings = (content: string) =>
  invoke<void>("write_settings", { content });

export const registerPdf = (path: string) =>
  invoke<RegisteredDoc>("register_pdf", { path });

/** asset:// URL pdf.js can stream with range requests. */
export const pdfUrl = (path: string) => convertFileSrc(path);

export const getLibrary = () => invoke<LibraryEntry[]>("get_library");
export const upsertLibraryEntry = (entry: LibraryEntry) =>
  invoke<void>("upsert_library_entry", { entry });
export const removeLibraryEntry = (docId: string) =>
  invoke<void>("remove_library_entry", { docId });

export const readDocText = (docId: string, rel: string) =>
  invoke<string | null>("read_doc_text", { docId, rel });
export const writeDocText = (docId: string, rel: string, content: string) =>
  invoke<void>("write_doc_text", { docId, rel, content });
export const writeDocBytes = (docId: string, rel: string, base64Data: string) =>
  invoke<void>("write_doc_bytes", { docId, rel, base64Data });
export const removeDocPath = (docId: string, rel: string) =>
  invoke<void>("remove_doc_path", { docId, rel });
export const ensureProjectDir = (docId: string, slug: string) =>
  invoke<string>("ensure_project_dir", { docId, slug });

export const claudeVersion = () => invoke<string | null>("claude_version");

/** PDF path this process was launched with (file association), if any. */
export const initialFile = () => invoke<string | null>("initial_file");

export interface JobHandle {
  /** Resolves with the terminal done event; rejects on failure/cancel. */
  result: Promise<DoneEvent>;
  cancel: () => void;
}

/** Start a headless Claude job; every stream event also hits `onEvent`. */
export function runJob(
  spec: JobSpec,
  onEvent?: (e: JobEvent) => void,
): JobHandle {
  const channel = new Channel<JobEvent>();
  let settle!: { resolve: (e: DoneEvent) => void; reject: (e: Error) => void };
  const result = new Promise<DoneEvent>((resolve, reject) => {
    settle = { resolve, reject };
  });

  channel.onmessage = (event) => {
    onEvent?.(event);
    if (event.type === "done") {
      if (event.ok) settle.resolve(event);
      else settle.reject(new Error(event.text || `claude run ${event.status}`));
    } else if (event.type === "failed") {
      settle.reject(new Error(event.message));
    }
  };

  const idPromise = invoke<number>("run_job", { spec, channel });
  idPromise.catch((e) => settle.reject(new Error(String(e))));

  return {
    result,
    cancel: () => {
      idPromise.then((id) => invoke("cancel_job", { id })).catch(() => {});
    },
  };
}
