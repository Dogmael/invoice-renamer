use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::mistral::{load_prompt, MistralClient};
use crate::pdf_utils;

pub struct ProcessingState {
    cancel_requested: Arc<AtomicBool>,
}

impl ProcessingState {
    pub fn new() -> Self {
        Self {
            cancel_requested: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn begin_batch(&self) {
        self.cancel_requested.store(false, Ordering::SeqCst);
    }

    pub fn request_cancel(&self) {
        self.cancel_requested.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_requested.load(Ordering::SeqCst)
    }

    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancel_requested)
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessProgressEvent {
    pub path: String,
    pub status: String,
    pub progress: u8,
    pub new_path: Option<String>,
    pub new_name: Option<String>,
    pub error: Option<String>,
    pub completed_count: Option<usize>,
    pub total_count: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessFileResult {
    pub path: String,
    pub new_path: Option<String>,
    pub new_name: Option<String>,
    pub error: Option<String>,
}

pub fn sanitize_filename(text: &str) -> String {
    let mut safe: String = text
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '(' | ')' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();

    safe = safe.replace(' ', "_");
    while safe.contains("__") {
        safe = safe.replace("__", "_");
    }

    safe.trim_matches('_').to_string()
}

fn failed_filename_base(locale: &str) -> &'static str {
    if locale.to_lowercase().starts_with("fr") {
        "Echoue"
    } else {
        "Failed"
    }
}

fn rename_failed_invoice(pdf_path: &Path, locale: &str) -> Option<(String, String)> {
    let failed_name = failed_filename_base(locale);
    let new_pdf_path = rename_with_dedup(pdf_path, failed_name).ok()?;
    let new_name = new_pdf_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(failed_name)
        .to_string();

    Some((
        new_pdf_path.to_string_lossy().to_string(),
        new_name,
    ))
}

fn rename_with_dedup(pdf_path: &Path, new_pdf_name: &str) -> Result<PathBuf, String> {
    let folder_path = pdf_path
        .parent()
        .ok_or_else(|| "error.no_parent_folder".to_string())?;

    let mut counter = 1;
    let mut new_pdf_path = folder_path.join(format!("{new_pdf_name}.pdf"));

    while new_pdf_path.exists() {
        new_pdf_path = folder_path.join(format!("{new_pdf_name}({counter}).pdf"));
        counter += 1;
    }

    std::fs::rename(pdf_path, &new_pdf_path).map_err(|e| {
        crate::i18n::rename_failed(
            &pdf_path.display().to_string(),
            &new_pdf_path.display().to_string(),
            &e.to_string(),
        )
    })?;

    Ok(new_pdf_path)
}

fn emit_progress(app: &AppHandle, event: ProcessProgressEvent) {
    let _ = app.emit("process-progress", event);
}

fn progress_event(
    path: String,
    status: &str,
    progress: u8,
    new_path: Option<String>,
    new_name: Option<String>,
    error: Option<String>,
    completed_count: Option<usize>,
    total_count: Option<usize>,
) -> ProcessProgressEvent {
    ProcessProgressEvent {
        path,
        status: status.to_string(),
        progress,
        new_path,
        new_name,
        error,
        completed_count,
        total_count,
    }
}

fn reset_file_to_pending(
    app: &AppHandle,
    path: &str,
    completed_count: usize,
    total_count: usize,
) {
    emit_progress(
        app,
        progress_event(
            path.to_string(),
            "pending",
            0,
            None,
            None,
            None,
            Some(completed_count),
            Some(total_count),
        ),
    );
}

async fn process_single_pdf(
    app: &AppHandle,
    pdf_path: &Path,
    client: &MistralClient,
    prompt: &str,
    locale: &str,
    completed_count: usize,
    total_count: usize,
    state: &ProcessingState,
) -> Option<ProcessFileResult> {
    let path_string = pdf_path.to_string_lossy().to_string();

    if state.is_cancelled() {
        return None;
    }

    let mut progress = 5u8;

    emit_progress(
        app,
        progress_event(
            path_string.clone(),
            "processing",
            progress,
            None,
            None,
            None,
            Some(completed_count),
            Some(total_count),
        ),
    );

    let cancel_flag = state.cancel_flag();

    let result = async {
        let native_text = pdf_utils::extract_native_text_first_page(pdf_path)?;
        if state.is_cancelled() {
            return Err("__cancelled__".to_string());
        }

        progress = 25;
        emit_progress(
            app,
            progress_event(
                path_string.clone(),
                "processing",
                progress,
                None,
                None,
                None,
                Some(completed_count),
                Some(total_count),
            ),
        );

        let ocr_text = client.ocr_first_page(pdf_path, &cancel_flag).await?;
        if state.is_cancelled() {
            return Err("__cancelled__".to_string());
        }

        progress = 55;
        emit_progress(
            app,
            progress_event(
                path_string.clone(),
                "processing",
                progress,
                None,
                None,
                None,
                Some(completed_count),
                Some(total_count),
            ),
        );

        let raw_name = client
            .generate_filename(prompt, &native_text, &ocr_text, &cancel_flag)
            .await?;
        if state.is_cancelled() {
            return Err("__cancelled__".to_string());
        }

        progress = 80;
        emit_progress(
            app,
            progress_event(
                path_string.clone(),
                "processing",
                progress,
                None,
                None,
                None,
                Some(completed_count),
                Some(total_count),
            ),
        );

        let new_pdf_name = sanitize_filename(&raw_name);

        if new_pdf_name.is_empty() {
            return Err("error.empty_filename".to_string());
        }

        let new_pdf_path = rename_with_dedup(pdf_path, &new_pdf_name)?;
        let new_name = new_pdf_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&new_pdf_name)
            .to_string();

        Ok((new_pdf_path.to_string_lossy().to_string(), new_name))
    }
    .await;

    if state.is_cancelled() || result.as_ref().err().is_some_and(|error| error == "__cancelled__") {
        reset_file_to_pending(app, &path_string, completed_count, total_count);
        return None;
    }

    let next_completed = completed_count + 1;

    match result {
        Ok((new_path, new_name)) => {
            emit_progress(
                app,
                progress_event(
                    path_string.clone(),
                    "done",
                    100,
                    Some(new_path.clone()),
                    Some(new_name.clone()),
                    None,
                    Some(next_completed),
                    Some(total_count),
                ),
            );

            Some(ProcessFileResult {
                path: path_string,
                new_path: Some(new_path),
                new_name: Some(new_name),
                error: None,
            })
        }
        Err(error) => {
            let (new_path, new_name) = rename_failed_invoice(pdf_path, locale)
                .map(|(path, name)| (Some(path), Some(name)))
                .unwrap_or((None, None));

            emit_progress(
                app,
                progress_event(
                    path_string.clone(),
                    "error",
                    progress,
                    new_path.clone(),
                    new_name.clone(),
                    Some(error.clone()),
                    Some(next_completed),
                    Some(total_count),
                ),
            );

            Some(ProcessFileResult {
                path: path_string,
                new_path,
                new_name,
                error: Some(error),
            })
        }
    }
}

pub async fn process_invoices(
    app: AppHandle,
    paths: Vec<String>,
    locale: String,
    state: &ProcessingState,
) -> Result<Vec<ProcessFileResult>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    state.begin_batch();

    let client = MistralClient::from_secure_store()?;
    let prompt = load_prompt(&app)?;
    let total_count = paths.len();
    let mut results = Vec::with_capacity(total_count);
    let mut completed_count = 0;
    let mut cancelled = false;

    for path in paths {
        if state.is_cancelled() {
            cancelled = true;
            break;
        }

        let pdf_path = PathBuf::from(&path);
        if !pdf_path.exists() {
            let error = crate::i18n::file_not_found(&path);
            completed_count += 1;
            emit_progress(
                &app,
                progress_event(
                    path.clone(),
                    "error",
                    0,
                    None,
                    None,
                    Some(error.clone()),
                    Some(completed_count),
                    Some(total_count),
                ),
            );
            results.push(ProcessFileResult {
                path,
                new_path: None,
                new_name: None,
                error: Some(error),
            });
            continue;
        }

        match process_single_pdf(
            &app,
            &pdf_path,
            &client,
            &prompt,
            &locale,
            completed_count,
            total_count,
            state,
        )
        .await
        {
            Some(result) => {
                results.push(result);
                completed_count += 1;
            }
            None => {
                cancelled = true;
                break;
            }
        }
    }

    if cancelled || state.is_cancelled() {
        let _ = app.emit("process-cancelled", ());
    }

    Ok(results)
}
