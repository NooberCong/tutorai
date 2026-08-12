//! Dictionary commands: import, listing, removal, and word lookup.
//!
//! All parsing and lookup logic lives in the `stardict` crate; this module
//! owns the on-disk locations, the lazily loaded in-memory registry, and the
//! Tauri command surface. Imports are copied into <app-data>/dictionaries/<id>/
//! under normalized names (dict.ifo, dict.idx, …); built-ins ship as bundled
//! resources under <resource>/dictionaries/<id>/ and go through the same loader.

use serde::Serialize;
use stardict::{Definition, Dict, DictMeta, Fileset};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

/// Selections longer than this are prose, not a dictionary query.
const MAX_QUERY_CHARS: usize = 64;

#[derive(Default)]
pub struct DictState(Mutex<HashMap<String, Arc<Dict>>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictHit {
    pub dict_id: String,
    pub dict_name: String,
    /// Matched headword — may differ from the query after a fallback.
    pub word: String,
    pub definitions: Vec<Definition>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric())
}

fn dicts_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(crate::store::data_root(app)?.join("dictionaries"))
}

fn builtin_root(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve("dictionaries", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.is_dir())
}

/// Where a dictionary id lives on disk: imports win over built-ins.
fn locate(app: &AppHandle, id: &str) -> Option<(PathBuf, bool)> {
    let imported = dicts_root(app).ok()?.join(id);
    if imported.join("dict.ifo").is_file() {
        return Some((imported, false));
    }
    let builtin = builtin_root(app)?.join(id);
    if builtin.join("dict.ifo").is_file() {
        return Some((builtin, true));
    }
    None
}

fn get_or_load(app: &AppHandle, state: &DictState, id: &str) -> Result<Arc<Dict>, String> {
    if let Some(dict) = state.0.lock().unwrap().get(id) {
        return Ok(dict.clone());
    }
    // Load outside the lock — a big dictionary must not stall other lookups.
    let (dir, builtin) = locate(app, id).ok_or("dictionary not found")?;
    let loaded = Arc::new(Fileset::in_dir(&dir).load(id, builtin)?);
    state
        .0
        .lock()
        .unwrap()
        .entry(id.to_string())
        .or_insert_with(|| loaded.clone());
    Ok(loaded)
}

/// Import the StarDict fileset whose .ifo the user picked. The fileset is
/// fully parsed and validated before anything is copied, so a broken
/// dictionary never lands in the app data dir.
#[tauri::command]
pub async fn import_dictionary(
    app: AppHandle,
    state: State<'_, DictState>,
    src_path: String,
) -> Result<DictMeta, String> {
    let fileset = Fileset::locate(&src_path)?;
    let id = crate::store::content_id(&fileset.idx.to_string_lossy())?;
    let target = dicts_root(&app)?.join(&id);
    if target.join("dict.ifo").is_file() {
        return stardict::read_meta(&target, &id, false); // same fileset imported before
    }

    let loaded = fileset.load(&id, false)?;
    let meta = loaded.meta.clone();

    let copy_all = || -> Result<(), String> {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        fs::copy(&fileset.ifo, target.join("dict.ifo")).map_err(|e| e.to_string())?;
        fs::copy(&fileset.idx, target.join("dict.idx")).map_err(|e| e.to_string())?;
        fs::copy(&fileset.dict, target.join(fileset.dict_file_name()))
            .map_err(|e| e.to_string())?;
        if let Some(syn) = &fileset.syn {
            fs::copy(syn, target.join("dict.syn")).map_err(|e| e.to_string())?;
        }
        Ok(())
    };
    if let Err(e) = copy_all() {
        let _ = fs::remove_dir_all(&target);
        return Err(format!("could not copy dictionary: {e}"));
    }

    state.0.lock().unwrap().insert(id, Arc::new(loaded));
    Ok(meta)
}

/// All dictionaries on disk, built-ins first. Only each .ifo is parsed —
/// listing must stay cheap with big dictionaries installed.
#[tauri::command]
pub async fn list_dictionaries(app: AppHandle) -> Result<Vec<DictMeta>, String> {
    fn scan(root: PathBuf, builtin: bool, out: &mut Vec<DictMeta>) {
        let Ok(read) = fs::read_dir(root) else { return };
        for entry in read.flatten() {
            let id = entry.file_name().to_string_lossy().to_string();
            if !valid_id(&id) {
                continue;
            }
            if let Ok(meta) = stardict::read_meta(&entry.path(), &id, builtin) {
                out.push(meta);
            }
        }
    }
    let mut out = Vec::new();
    if let Some(root) = builtin_root(&app) {
        scan(root, true, &mut out);
    }
    scan(dicts_root(&app)?, false, &mut out);
    Ok(out)
}

#[tauri::command]
pub async fn remove_dictionary(
    app: AppHandle,
    state: State<'_, DictState>,
    id: String,
) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid dictionary id".into());
    }
    let dir = dicts_root(&app)?.join(&id);
    if !dir.is_dir() {
        // Built-ins live in the read-only resource dir and never match here.
        return Err("not an imported dictionary".into());
    }
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    state.0.lock().unwrap().remove(&id);
    Ok(())
}

/// Look a selection up across the given dictionaries, in the given order.
/// Unknown or unloadable ids are skipped — a dictionary removed while the
/// popup is open is not an error.
#[tauri::command]
pub async fn lookup_word(
    app: AppHandle,
    state: State<'_, DictState>,
    word: String,
    dict_ids: Vec<String>,
) -> Result<Vec<DictHit>, String> {
    let query = stardict::normalize_query(&word);
    if query.is_empty() || query.chars().count() > MAX_QUERY_CHARS {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for id in &dict_ids {
        if !valid_id(id) {
            continue;
        }
        let Ok(dict) = get_or_load(&app, &state, id) else {
            continue;
        };
        for (word, definitions) in dict.hits(&query) {
            out.push(DictHit {
                dict_id: id.clone(),
                dict_name: dict.meta.name.clone(),
                word,
                definitions,
            });
        }
    }
    Ok(out)
}
