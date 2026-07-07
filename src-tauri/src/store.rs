//! On-disk persistence: the library index plus a per-document cache directory
//! holding extracted chapter text, AI artifacts, chat history, and project
//! workspaces. Everything is plain JSON/text files under the app data dir —
//! debuggable, and exactly the surface headless Claude reads with its tools.
//!
//! Layout:
//!   <app-data>/settings.json                          (app preferences: model, layout)
//!   <app-data>/library.json
//!   <app-data>/docs/<docId>/chapters/chapter-01.txt   (page-marked text)
//!   <app-data>/docs/<docId>/meta.json                 (extraction result)
//!   <app-data>/docs/<docId>/artifacts.json            (summaries, quizzes, chat)
//!   <app-data>/docs/<docId>/pages/page-0001.jpg       (figure-page images, ≤200)
//!   <app-data>/docs/<docId>/snips/                    (chat image attachments;
//!                                                      wiped on chat reset, stale
//!                                                      ones pruned at doc open)
//!   <app-data>/docs/<docId>/projects/<slug>/          (agentic workspaces; deleted
//!                                                      with their list entry)
//!
//! Removing a doc from the library deletes its whole cache dir.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub doc_id: String,
    pub path: String,
    pub title: String,
    pub pages: u32,
    pub added_at: u64,
    pub last_opened_at: u64,
    pub last_page: u32,
    /// Scroll offset within `last_page`, as a fraction of the page height
    /// (scale-invariant). Defaults to 0 for entries saved before this existed.
    #[serde(default)]
    pub last_scroll: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredDoc {
    pub doc_id: String,
    pub path: String,
    pub doc_dir: String,
}

fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn doc_dir(app: &AppHandle, doc_id: &str) -> Result<PathBuf, String> {
    if doc_id.is_empty() || !doc_id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("invalid doc id".into());
    }
    let dir = data_root(app)?.join("docs").join(doc_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Resolve a relative path inside a doc dir, rejecting traversal.
fn doc_file(app: &AppHandle, doc_id: &str, rel: &str) -> Result<PathBuf, String> {
    let ok = !rel.is_empty()
        && !rel.contains("..")
        && !rel.contains(':')
        && !rel.starts_with('/')
        && !rel.starts_with('\\');
    if !ok {
        return Err(format!("invalid doc file path: {rel}"));
    }
    Ok(doc_dir(app, doc_id)?.join(rel))
}

/// Content identity for a PDF: sha256 over (size, head 256 KiB, tail 256 KiB).
/// Cheap even for huge files, stable across renames and moves.
fn content_id(path: &str) -> Result<String, String> {
    const CHUNK: usize = 256 * 1024;
    let mut file = fs::File::open(path).map_err(|e| format!("cannot open PDF: {e}"))?;
    let len = file.metadata().map_err(|e| e.to_string())?.len();
    let mut hasher = Sha256::new();
    hasher.update(len.to_le_bytes());
    let mut buf = vec![0u8; CHUNK];
    let n = file.read(&mut buf).map_err(|e| e.to_string())?;
    hasher.update(&buf[..n]);
    if len > (2 * CHUNK) as u64 {
        file.seek(SeekFrom::End(-(CHUNK as i64))).map_err(|e| e.to_string())?;
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        hasher.update(&buf[..n]);
    }
    let digest = hasher.finalize();
    Ok(digest.iter().take(12).map(|b| format!("{b:02x}")).collect())
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("settings.json"))
}

fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("library.json"))
}

fn read_library(app: &AppHandle) -> Result<Vec<LibraryEntry>, String> {
    let path = library_path(app)?;
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(_) => Ok(Vec::new()),
    }
}

fn write_library(app: &AppHandle, entries: &[LibraryEntry]) -> Result<(), String> {
    let text = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(library_path(app)?, text).map_err(|e| e.to_string())
}

// ── Commands ───────────────────────────────────────────────────────────

/// App-wide preferences as a frontend-owned JSON blob (schema lives in
/// src/lib/settings.ts). A file rather than webview localStorage so it
/// survives WebView2 data resets and is shared between dev and installed
/// builds, whose webview origins differ.
#[tauri::command]
pub fn read_settings(app: AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(settings_path(&app)?) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn write_settings(app: AppHandle, content: String) -> Result<(), String> {
    fs::write(settings_path(&app)?, content).map_err(|e| e.to_string())
}

/// Snips are one-shot chat attachments. The chat wipes them when the
/// conversation resets; this sweep at doc-open catches the rest once they
/// are old enough that no conversation the reader resumes still needs them.
fn prune_stale_snips(dir: &Path) {
    const MAX_AGE: std::time::Duration = std::time::Duration::from_secs(14 * 24 * 60 * 60);
    let Ok(entries) = fs::read_dir(dir.join("snips")) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(modified) = entry.metadata().and_then(|m| m.modified()) else {
            continue;
        };
        if modified.elapsed().is_ok_and(|age| age > MAX_AGE) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Identify a PDF, open its cache dir, and whitelist it for the asset
/// protocol so pdf.js can stream it with range requests.
#[tauri::command]
pub fn register_pdf(app: AppHandle, path: String) -> Result<RegisteredDoc, String> {
    let doc_id = content_id(&path)?;
    let dir = doc_dir(&app, &doc_id)?;
    prune_stale_snips(&dir);
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|e| e.to_string())?;
    Ok(RegisteredDoc {
        doc_id,
        path,
        doc_dir: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_library(app: AppHandle) -> Result<Vec<LibraryEntry>, String> {
    let mut entries = read_library(&app)?;
    entries.sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at));
    // Re-whitelist known files so library thumbnails/open work after restart.
    for entry in &entries {
        let _ = app.asset_protocol_scope().allow_file(&entry.path);
    }
    Ok(entries)
}

#[tauri::command]
pub fn upsert_library_entry(app: AppHandle, mut entry: LibraryEntry) -> Result<(), String> {
    let mut entries = read_library(&app)?;
    entry.last_opened_at = now_ms();
    if let Some(existing) = entries.iter_mut().find(|e| e.doc_id == entry.doc_id) {
        entry.added_at = existing.added_at;
        *existing = entry;
    } else {
        entry.added_at = now_ms();
        entries.push(entry);
    }
    write_library(&app, &entries)
}

#[tauri::command]
pub fn remove_library_entry(app: AppHandle, doc_id: String) -> Result<(), String> {
    let mut entries = read_library(&app)?;
    entries.retain(|e| e.doc_id != doc_id);
    write_library(&app, &entries)?;
    if let Ok(dir) = doc_dir(&app, &doc_id) {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(())
}

#[tauri::command]
pub fn read_doc_text(app: AppHandle, doc_id: String, rel: String) -> Result<Option<String>, String> {
    let path = doc_file(&app, &doc_id, &rel)?;
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn write_doc_text(app: AppHandle, doc_id: String, rel: String, content: String) -> Result<(), String> {
    let path = doc_file(&app, &doc_id, &rel)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Write a binary file (base64 payload) into the doc cache — page images the
/// headless CLI can Read for figures the text extraction can't carry.
#[tauri::command]
pub fn write_doc_bytes(
    app: AppHandle,
    doc_id: String,
    rel: String,
    base64_data: String,
) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| e.to_string())?;
    let path = doc_file(&app, &doc_id, &rel)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, bytes).map_err(|e| e.to_string())
}

/// Delete a file or directory inside a doc's cache dir — spent snips, a
/// removed project workspace. Missing paths are not an error.
#[tauri::command]
pub fn remove_doc_path(app: AppHandle, doc_id: String, rel: String) -> Result<(), String> {
    let path = doc_file(&app, &doc_id, &rel)?;
    let result = if path.is_dir() {
        fs::remove_dir_all(&path)
    } else {
        fs::remove_file(&path)
    };
    match result {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Create (if needed) and return the absolute path of a project workspace.
#[tauri::command]
pub fn ensure_project_dir(app: AppHandle, doc_id: String, slug: String) -> Result<String, String> {
    if slug.is_empty() || !slug.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("invalid project slug".into());
    }
    let dir = doc_dir(&app, &doc_id)?.join("projects").join(&slug);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}
