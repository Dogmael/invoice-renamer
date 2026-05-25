mod i18n;
mod mistral;
mod pdf_utils;
mod processor;

use serde::Serialize;
use std::path::Path;
use tauri::Emitter;

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    size: u64,
}

#[tauri::command]
fn get_system_locale() -> String {
    sys_locale::get_locale().unwrap_or_else(|| "en".to_string())
}

#[tauri::command]
fn get_files_info(paths: Vec<String>) -> Result<Vec<FileInfo>, String> {
    paths
        .into_iter()
        .map(|path| {
            let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
            let name = Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| crate::i18n::invalid_file_name(&path))?
                .to_string();

            Ok(FileInfo {
                path,
                name,
                size: metadata.len(),
            })
        })
        .collect()
}

#[tauri::command]
async fn process_invoices(
    app: tauri::AppHandle,
    paths: Vec<String>,
    state: tauri::State<'_, processor::ProcessingState>,
) -> Result<Vec<processor::ProcessFileResult>, String> {
    processor::process_invoices(app, paths, &state).await
}

#[tauri::command]
fn cancel_processing(
    app: tauri::AppHandle,
    state: tauri::State<'_, processor::ProcessingState>,
) {
    state.request_cancel();
    let _ = app.emit("process-cancelled", ());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(processor::ProcessingState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_locale,
            get_files_info,
            process_invoices,
            cancel_processing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
