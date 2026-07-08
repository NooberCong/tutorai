/** User annotations for one document: highlights, underlines, strikethroughs,
 *  sticky notes, free text, and ink strokes.
 *
 *  The PDF is never modified. Annotations live in this provider and persist
 *  (debounced) to annotations.json in the doc cache dir — plain JSON the
 *  headless CLI can read. Geometry is stored in page-fraction coordinates,
 *  the app-wide convention, so marks track every zoom and reflow for free.
 *  Undo/redo is a per-gesture log of {before, after} patches. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { annotBounds } from "./annotGeometry";
import { useSession } from "./session";
import { getSetting, saveSetting, SETTINGS_DEFAULTS, type InkPreset } from "./settings";
import { readDocText, writeDocText } from "./tauri";
import {
  ANNOT_SCHEMA_VERSION,
  type Annotation,
  type AnnotationsFile,
  type FracRect,
  type TextMarkupAnnot,
} from "./types";

const FILE = "annotations.json";
const SAVE_DEBOUNCE = 400;
const HISTORY_CAP = 100;

/** Marker inks for white paper — saturated and print-like, deliberately not
 *  the app's dusty dark-theme tints. Highlights render with multiply blend. */
export const HIGHLIGHT_COLORS = [
  { name: "Sun", hex: "#FFDE59" },
  { name: "Spring", hex: "#5CE39B" },
  { name: "Sky", hex: "#5BC8FF" },
  { name: "Rose", hex: "#FF8FC0" },
  { name: "Violet", hex: "#B9A0FF" },
];

export const INK_COLORS = [
  { name: "Graphite", hex: "#232B27" },
  { name: "Red", hex: "#E24A3B" },
  { name: "Blue", hex: "#2E66D0" },
  { name: "Green", hex: "#1E9E63" },
  { name: "Plum", hex: "#7A4FC9" },
  { name: "Amber", hex: "#E8890C" },
];

/** A 2px Sun line is invisible on white; lines need a darker weight. */
export function lineColor(hex: string): string {
  return hex.toUpperCase() === "#FFDE59" ? "#E8C22E" : hex;
}

export type MarkupType = TextMarkupAnnot["type"];

export type AnnotTool =
  | null // browse: read + click-select
  | "select" // like browse, but text hit-testing yields to annotations
  | "highlight" // drag-marker: text selection becomes a highlight on release
  | "pen"
  | "freetext"
  | "note"
  | "eraser";

interface Patch {
  before: Annotation | null;
  after: Annotation | null;
}

interface HistoryEntry {
  patches: Patch[];
}

export interface UndoToast {
  label: string;
  page: number;
  nonce: number;
}

interface AnnotationsValue {
  annotations: Annotation[];
  /** Per-page views with stable array identities (memo-friendly). */
  byPage: Map<number, Annotation[]>;

  railOpen: boolean;
  toggleRail: () => void;
  tool: AnnotTool;
  setTool: (t: AnnotTool) => void;

  hlColor: string;
  setHlColor: (hex: string) => void;
  noteColor: string;
  setNoteColor: (hex: string) => void;
  textColor: string;
  setTextColor: (hex: string) => void;
  inkPresets: InkPreset[];
  inkPresetIdx: number;
  setInkPresetIdx: (i: number) => void;
  updateInkPreset: (patch: Partial<InkPreset>) => void;

  selectedId: string | null;
  select: (id: string | null) => void;
  /** Annotation whose note/text editor is open. */
  editingId: string | null;
  setEditing: (id: string | null) => void;
  /** Just-created ids — drives the highlight sweep entrance. */
  freshIds: Set<string>;
  /** Locate pulse target (sidebar jump). */
  flashId: string | null;
  undoToast: UndoToast | null;

  add: (a: Annotation) => void;
  addMarkups: (
    markups: { page: number; rects: FracRect[]; quote: string }[],
    type: MarkupType,
    color: string,
  ) => void;
  addNote: (page: number, at: { x: number; y: number }, quote?: string) => void;
  addFreeText: (page: number, at: { x: number; y: number }) => void;
  update: (id: string, patch: Partial<Annotation>) => void;
  /** Mid-gesture update — no history; pair with commitEdit at gesture end. */
  updateLive: (id: string, patch: Partial<Annotation>) => void;
  /** Record one undo entry for a finished gesture, given the pre-gesture
   *  snapshot (current state is the "after"). */
  commitEdit: (before: Annotation) => void;
  remove: (ids: string[]) => void;
  /** Abandon a just-created annotation (empty note/text on blur): removes it
   *  and pops its creation off the undo stack — no ghost history. */
  cancelCreate: (id: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  focusAnnotation: (a: Annotation) => void;
}

const AnnotationsContext = createContext<AnnotationsValue | null>(null);

export function useAnnotations(): AnnotationsValue {
  const value = useContext(AnnotationsContext);
  if (!value) throw new Error("useAnnotations outside AnnotationsProvider");
  return value;
}

export function annotLabel(a: Annotation): string {
  switch (a.type) {
    case "highlight":
      return "highlight";
    case "underline":
      return "underline";
    case "strikethrough":
      return "strikethrough";
    case "note":
      return "note";
    case "freetext":
      return "text";
    case "ink":
      return "ink";
  }
}

export function AnnotationsProvider(props: { children: ReactNode }) {
  const { reg, jumpToPage } = useSession();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [railOpen, setRailOpen] = useState(false);
  const [tool, setToolState] = useState<AnnotTool>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [, setHistVer] = useState(0);

  const [hlColor, setHlColorState] = useState(() => getSetting("highlightColor"));
  const [noteColor, setNoteColorState] = useState(() => getSetting("noteColor"));
  const [textColor, setTextColorState] = useState(() => getSetting("textColor"));
  const [inkPresets, setInkPresets] = useState(() => {
    const p = getSetting("inkPresets");
    // A hand-edited settings.json must never break the tray.
    return Array.isArray(p) && p.length && p.every((x) => x && typeof x.color === "string")
      ? p
      : SETTINGS_DEFAULTS.inkPresets;
  });
  const [inkPresetIdx, setInkPresetIdxState] = useState(() =>
    Math.min(Math.max(getSetting("inkPresetIdx") || 0, 0), 2),
  );
  const safePresetIdx = Math.min(inkPresetIdx, inkPresets.length - 1);

  const annotsRef = useRef(annotations);
  annotsRef.current = annotations;
  const undoRef = useRef<HistoryEntry[]>([]);
  const redoRef = useRef<HistoryEntry[]>([]);
  /** Entries with a type this build doesn't know — preserved verbatim. */
  const unknownRef = useRef<unknown[]>([]);
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number>(undefined);
  const freshTimer = useRef<number>(undefined);
  const flashTimer = useRef<number>(undefined);
  const toastTimer = useRef<number>(undefined);

  // ── Load once, persist debounced, flush on blur/unmount ─────────────
  useEffect(() => {
    let stale = false;
    readDocText(reg.docId, FILE)
      .then((text) => {
        if (stale) return;
        if (text) {
          const file = JSON.parse(text) as AnnotationsFile;
          const known: Annotation[] = [];
          const KNOWN = new Set(["highlight", "underline", "strikethrough", "note", "freetext", "ink"]);
          for (const a of file.annotations ?? []) {
            if (a && KNOWN.has((a as Annotation).type)) known.push(a as Annotation);
            else unknownRef.current.push(a);
          }
          setAnnotations(known);
        }
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
    return () => {
      stale = true;
    };
  }, [reg.docId]);

  const persistNow = useCallback(() => {
    if (!loadedRef.current || !dirtyRef.current) return;
    dirtyRef.current = false;
    const file: AnnotationsFile = {
      version: ANNOT_SCHEMA_VERSION,
      annotations: [...annotsRef.current, ...(unknownRef.current as Annotation[])],
    };
    writeDocText(reg.docId, FILE, JSON.stringify(file)).catch(() => {});
  }, [reg.docId]);

  const schedulePersist = useCallback(() => {
    dirtyRef.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(persistNow, SAVE_DEBOUNCE);
  }, [persistNow]);

  // The window can close without unmounting the provider — flush on blur.
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(saveTimer.current);
      persistNow();
    };
    window.addEventListener("blur", flush);
    return () => {
      window.removeEventListener("blur", flush);
      flush();
    };
  }, [persistNow]);

  // ── History core ──────────────────────────────────────────────────────
  const applyPatches = useCallback(
    (patches: Patch[], dir: "after" | "before") => {
      setAnnotations((prev) => {
        let next = prev;
        const ordered = dir === "after" ? patches : [...patches].reverse();
        for (const p of ordered) {
          const target = dir === "after" ? p.after : p.before;
          const other = dir === "after" ? p.before : p.after;
          if (target === null) {
            next = next.filter((a) => a.id !== other!.id);
          } else if (other === null) {
            next = [...next, target];
          } else {
            next = next.map((a) => (a.id === target.id ? target : a));
          }
        }
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const commit = useCallback(
    (patches: Patch[]) => {
      if (!patches.length) return;
      applyPatches(patches, "after");
      undoRef.current.push({ patches });
      if (undoRef.current.length > HISTORY_CAP) undoRef.current.shift();
      redoRef.current = [];
      setHistVer((v) => v + 1);
    },
    [applyPatches],
  );

  const markFresh = useCallback((ids: string[]) => {
    setFreshIds(new Set(ids));
    window.clearTimeout(freshTimer.current);
    freshTimer.current = window.setTimeout(() => setFreshIds(new Set()), 700);
  }, []);

  const showToast = useCallback((entry: HistoryEntry, verb: string) => {
    const a = entry.patches[0]?.before ?? entry.patches[0]?.after;
    if (!a) return;
    setUndoToast({ label: `${verb} ${annotLabel(a)}`, page: a.page, nonce: Date.now() });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setUndoToast(null), 1800);
  }, []);

  const undo = useCallback(() => {
    const entry = undoRef.current.pop();
    if (!entry) return;
    applyPatches(entry.patches, "before");
    redoRef.current.push(entry);
    setHistVer((v) => v + 1);
    setSelectedId(null);
    setEditingId(null);
    showToast(entry, entry.patches[0]?.before === null ? "removed" : "restored");
  }, [applyPatches, showToast]);

  const redo = useCallback(() => {
    const entry = redoRef.current.pop();
    if (!entry) return;
    applyPatches(entry.patches, "after");
    undoRef.current.push(entry);
    setHistVer((v) => v + 1);
    setSelectedId(null);
    setEditingId(null);
    showToast(entry, entry.patches[0]?.after === null ? "removed" : "restored");
  }, [applyPatches, showToast]);

  // ── CRUD ──────────────────────────────────────────────────────────────
  const add = useCallback(
    (a: Annotation) => {
      commit([{ before: null, after: a }]);
      markFresh([a.id]);
    },
    [commit, markFresh],
  );

  const newBase = () => {
    const now = Date.now();
    return { id: crypto.randomUUID(), createdAt: now, modifiedAt: now };
  };

  const addMarkups = useCallback(
    (
      markups: { page: number; rects: FracRect[]; quote: string }[],
      type: MarkupType,
      color: string,
    ) => {
      const annots: Annotation[] = markups.map((m) => ({
        ...newBase(),
        type,
        page: m.page,
        color,
        rects: m.rects,
        quote: m.quote,
      }));
      commit(annots.map((a) => ({ before: null, after: a })));
      markFresh(annots.map((a) => a.id));
    },
    [commit, markFresh],
  );

  const addNote = useCallback(
    (page: number, at: { x: number; y: number }, quote?: string) => {
      const a: Annotation = { ...newBase(), type: "note", page, color: noteColor, at, note: "", quote };
      commit([{ before: null, after: a }]);
      markFresh([a.id]);
      setSelectedId(null);
      setEditingId(a.id);
    },
    [commit, markFresh, noteColor],
  );

  const addFreeText = useCallback(
    (page: number, at: { x: number; y: number }) => {
      const a: Annotation = {
        ...newBase(),
        type: "freetext",
        page,
        color: textColor,
        rect: { x: at.x, y: at.y, w: Math.min(0.3, 1 - at.x), h: 0.03 },
        text: "",
        fontSize: 13,
      };
      commit([{ before: null, after: a }]);
      setSelectedId(null);
      setEditingId(a.id);
    },
    [commit, textColor],
  );

  const update = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      const before = annotsRef.current.find((a) => a.id === id);
      if (!before) return;
      const after = { ...before, ...patch, modifiedAt: Date.now() } as Annotation;
      commit([{ before, after }]);
    },
    [commit],
  );

  const updateLive = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      );
    },
    [],
  );

  const commitEdit = useCallback(
    (before: Annotation) => {
      const current = annotsRef.current.find((a) => a.id === before.id);
      if (!current || current === before) return;
      const after = { ...current, modifiedAt: Date.now() } as Annotation;
      // The live state already holds `after` minus the timestamp; route it
      // through commit so undo/redo and persistence see one gesture.
      commit([{ before, after }]);
    },
    [commit],
  );

  const remove = useCallback(
    (ids: string[]) => {
      const patches: Patch[] = [];
      for (const id of ids) {
        const before = annotsRef.current.find((a) => a.id === id);
        if (before) patches.push({ before, after: null });
      }
      commit(patches);
      setSelectedId((s) => (s && ids.includes(s) ? null : s));
      setEditingId((s) => (s && ids.includes(s) ? null : s));
    },
    [commit],
  );

  const cancelCreate = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    const last = undoRef.current[undoRef.current.length - 1];
    if (
      last &&
      last.patches.length === 1 &&
      last.patches[0].before === null &&
      last.patches[0].after?.id === id
    ) {
      undoRef.current.pop();
    }
    setHistVer((v) => v + 1);
    setSelectedId((s) => (s === id ? null : s));
    setEditingId((s) => (s === id ? null : s));
    schedulePersist();
  }, [schedulePersist]);

  // ── Tool / selection / colors ────────────────────────────────────────
  const setTool = useCallback((t: AnnotTool) => {
    setToolState(t);
    setSelectedId(null);
    setEditingId(null);
    if (t) {
      setRailOpen(true);
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  const toggleRail = useCallback(() => {
    setRailOpen((open) => {
      if (open) {
        setToolState(null);
        setSelectedId(null);
        setEditingId(null);
      }
      return !open;
    });
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) setEditingId(null);
  }, []);

  const setHlColor = useCallback((hex: string) => {
    saveSetting("highlightColor", hex);
    setHlColorState(hex);
  }, []);
  const setNoteColor = useCallback((hex: string) => {
    saveSetting("noteColor", hex);
    setNoteColorState(hex);
  }, []);
  const setTextColor = useCallback((hex: string) => {
    saveSetting("textColor", hex);
    setTextColorState(hex);
  }, []);
  const setInkPresetIdx = useCallback((i: number) => {
    saveSetting("inkPresetIdx", i);
    setInkPresetIdxState(i);
  }, []);
  const updateInkPreset = useCallback(
    (patch: Partial<InkPreset>) => {
      setInkPresets((prev) => {
        const next = prev.map((p, i) => (i === safePresetIdx ? { ...p, ...patch } : p));
        saveSetting("inkPresets", next);
        return next;
      });
    },
    [safePresetIdx],
  );

  const focusAnnotation = useCallback(
    (a: Annotation) => {
      setSelectedId(a.id);
      const b = annotBounds(a);
      jumpToPage(a.page, Math.max(0, b.y - 0.18));
      setFlashId(a.id);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 1300);
    },
    [jumpToPage],
  );

  // ── Keyboard ──────────────────────────────────────────────────────────
  const latest = useRef({ tool, railOpen, selectedId, editingId, inkPresetIdx });
  latest.current = { tool, railOpen, selectedId, editingId, inkPresetIdx };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const { tool, railOpen, selectedId, editingId, inkPresetIdx } = latest.current;
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        // One level per press: editor → selection → tool → rail.
        if (editingId) setEditingId(null);
        else if (selectedId) setSelectedId(null);
        else if (tool) setToolState(null);
        else if (railOpen) setRailOpen(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          remove([selectedId]);
        }
        return;
      }
      // With a live text selection the popover owns the letters (1–5/U/S/N).
      if (!window.getSelection()?.isCollapsed) return;
      switch (key) {
        case "m":
          toggleRail();
          break;
        case "v":
          setTool(tool === "select" ? null : "select");
          break;
        case "h":
          setTool(tool === "highlight" ? null : "highlight");
          break;
        case "p":
          setTool(tool === "pen" ? null : "pen");
          break;
        case "t":
          setTool(tool === "freetext" ? null : "freetext");
          break;
        case "n":
          setTool(tool === "note" ? null : "note");
          break;
        case "e":
          setTool(tool === "eraser" ? null : "eraser");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          setHlColor(HIGHLIGHT_COLORS[Number(key) - 1].hex);
          break;
        case "[":
        case "]":
          if (tool === "pen") {
            const widths = [1.5, 2.5, 4, 9];
            setInkPresets((prev) => {
              const cur = prev[inkPresetIdx];
              const at = widths.reduce(
                (best, w, i) => (Math.abs(w - cur.width) < Math.abs(widths[best] - cur.width) ? i : best),
                0,
              );
              const next = Math.min(Math.max(at + (key === "]" ? 1 : -1), 0), widths.length - 1);
              const updated = prev.map((p, i) =>
                i === inkPresetIdx ? { ...p, width: widths[next] } : p,
              );
              saveSetting("inkPresets", updated);
              return updated;
            });
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, remove, setTool, setHlColor, toggleRail]);

  // ── Per-page view with stable array identities ────────────────────────
  const byPageRef = useRef(new Map<number, Annotation[]>());
  const byPage = useMemo(() => {
    const next = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const list = next.get(a.page);
      if (list) list.push(a);
      else next.set(a.page, [a]);
    }
    const prev = byPageRef.current;
    for (const [page, list] of next) {
      const old = prev.get(page);
      if (old && old.length === list.length && old.every((v, i) => v === list[i])) {
        next.set(page, old);
      }
    }
    byPageRef.current = next;
    return next;
  }, [annotations]);

  const value = useMemo<AnnotationsValue>(
    () => ({
      annotations,
      byPage,
      railOpen,
      toggleRail,
      tool,
      setTool,
      hlColor,
      setHlColor,
      noteColor,
      setNoteColor,
      textColor,
      setTextColor,
      inkPresets,
      inkPresetIdx: safePresetIdx,
      setInkPresetIdx,
      updateInkPreset,
      selectedId,
      select,
      editingId,
      setEditing: setEditingId,
      freshIds,
      flashId,
      undoToast,
      add,
      addMarkups,
      addNote,
      addFreeText,
      update,
      updateLive,
      commitEdit,
      remove,
      cancelCreate,
      undo,
      redo,
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
      focusAnnotation,
    }),
    [annotations, byPage, railOpen, toggleRail, tool, setTool, hlColor, setHlColor,
     noteColor, setNoteColor, textColor, setTextColor, inkPresets, safePresetIdx,
     setInkPresetIdx, updateInkPreset, selectedId, select, editingId, freshIds,
     flashId, undoToast, add, addMarkups, addNote, addFreeText, update, updateLive,
     commitEdit, remove, cancelCreate, undo, redo, focusAnnotation],
  );

  return (
    <AnnotationsContext.Provider value={value}>{props.children}</AnnotationsContext.Provider>
  );
}
