mod claude;
mod jobs;
mod store;

use claude::{JobEvent, JobSpec};
use jobs::Jobs;
use tauri::ipc::Channel;
use tauri::State;

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Jobs::default())
        .invoke_handler(tauri::generate_handler![
            run_job,
            cancel_job,
            claude_version,
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
