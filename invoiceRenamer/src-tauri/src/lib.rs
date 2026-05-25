use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    size: u64,
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
                .ok_or_else(|| format!("Invalid file name for path: {path}"))?
                .to_string();

            Ok(FileInfo {
                path,
                name,
                size: metadata.len(),
            })
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_files_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
