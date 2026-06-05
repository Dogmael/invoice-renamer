mod i18n;
mod mistral;
mod path_utils;
mod pdf_utils;
mod processor;

use serde::Serialize;
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
            let pdf_path = path_utils::validate_user_pdf_path(&path)?;
            let metadata = std::fs::metadata(&pdf_path).map_err(|e| e.to_string())?;
            let name = pdf_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| crate::i18n::invalid_file_name(&path))?
                .to_string();

            Ok(FileInfo {
                path: pdf_path.to_string_lossy().to_string(),
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
    locale: String,
    state: tauri::State<'_, processor::ProcessingState>,
) -> Result<Vec<processor::ProcessFileResult>, String> {
    processor::process_invoices(app, paths, locale, &state).await
}

#[tauri::command]
fn cancel_processing(
    app: tauri::AppHandle,
    state: tauri::State<'_, processor::ProcessingState>,
) {
    state.request_cancel();
    let _ = app.emit("process-cancelled", ());
}

#[tauri::command]
fn get_prompt(app: tauri::AppHandle) -> Result<String, String> {
    mistral::load_prompt(&app)
}

#[tauri::command]
fn set_prompt(app: tauri::AppHandle, prompt: String) -> Result<(), String> {
    mistral::save_prompt(&app, &prompt)
}

#[tauri::command]
fn get_mistral_api_key_info() -> Result<mistral::MistralApiKeyInfo, String> {
    mistral::get_api_key_info()
}

#[tauri::command]
async fn get_mistral_api_key_state(validate: bool) -> Result<mistral::MistralApiKeyState, String> {
    mistral::get_api_key_state(validate).await
}

#[tauri::command]
fn get_mistral_api_key_preview() -> Result<Option<String>, String> {
    mistral::get_api_key_preview()
}

#[tauri::command]
async fn validate_mistral_api_key(api_key: String) -> Result<(), String> {
    mistral::validate_api_key(&api_key).await
}

#[tauri::command]
async fn validate_stored_mistral_api_key() -> Result<(), String> {
    mistral::validate_stored_api_key().await
}

#[tauri::command]
fn has_mistral_api_key() -> bool {
    mistral::has_api_key()
}

#[tauri::command]
fn set_mistral_api_key(api_key: String) -> Result<mistral::MistralApiKeyInfo, String> {
    mistral::set_api_key(&api_key)
}

#[tauri::command]
fn clear_mistral_api_key() -> Result<(), String> {
    mistral::clear_api_key()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(processor::ProcessingState::new())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_system_locale,
            get_files_info,
            process_invoices,
            cancel_processing,
            get_prompt,
            set_prompt,
            get_mistral_api_key_info,
            get_mistral_api_key_state,
            get_mistral_api_key_preview,
            validate_mistral_api_key,
            validate_stored_mistral_api_key,
            has_mistral_api_key,
            set_mistral_api_key,
            clear_mistral_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
