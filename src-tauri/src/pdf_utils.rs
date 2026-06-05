use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

pub fn extract_native_text_first_page(pdf_path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(pdf_path).map_err(|e| e.to_string())?;

    // pdf-extract panics on some malformed PDFs (e.g. InvalidContentStream) instead of
    // returning an error — fall back to empty text and let OCR handle extraction.
    let result = catch_unwind(AssertUnwindSafe(|| {
        pdf_extract::extract_text_from_mem_by_pages(&bytes)
    }));

    match result {
        Ok(Ok(pages)) => Ok(pages.into_iter().next().unwrap_or_default()),
        _ => Ok(String::new()),
    }
}

pub fn pdf_to_base64(pdf_path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(pdf_path).map_err(|e| e.to_string())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    ))
}
