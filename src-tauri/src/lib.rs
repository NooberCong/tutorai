mod claude;
mod jobs;
mod store;

use claude::{JobEvent, JobSpec};
use jobs::Jobs;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};

/// First existing `.pdf` among CLI args — how "Open with TutorAI" (file
/// association / drag onto the exe) hands us a document.
fn pdf_arg<S: AsRef<str>>(args: &[S]) -> Option<String> {
    args.iter()
        .skip(1)
        .map(|a| a.as_ref())
        .find(|a| {
            a.to_ascii_lowercase().ends_with(".pdf") && std::path::Path::new(a).exists()
        })
        .map(String::from)
}

/// The PDF this process was launched with, if any (queried by the UI on boot).
#[tauri::command]
fn initial_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    pdf_arg(&args)
}

/// Start a Claude job; events stream through `channel`, the returned id
/// feeds `cancel_job`.
#[tauri::command]
fn run_job(jobs: State<'_, Jobs>, spec: JobSpec, channel: Channel<JobEvent>) -> u64 {
    jobs.spawn(spec, channel)
}

#[tauri::command]
fn cancel_job(jobs: State<'_, Jobs>, id: u64) {
    jobs.cancel(id);
}

/// Version string of the installed `claude` CLI, or null when missing.
#[tauri::command]
async fn claude_version() -> Option<String> {
    claude::version().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        // Must be first: re-launches (e.g. double-clicking another PDF) hand
        // their args to the running instance instead of opening a new window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(path) = pdf_arg(&argv) {
                let _ = app.emit("open-file", path);
            }
        }))
        // Persists size / position / maximized across sessions.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Jobs::default())
        .invoke_handler(tauri::generate_handler![
            run_job,
            cancel_job,
            claude_version,
            initial_file,
            store::register_pdf,
            store::get_library,
            store::upsert_library_entry,
            store::remove_library_entry,
            store::read_doc_text,
            store::write_doc_text,
            store::ensure_project_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
