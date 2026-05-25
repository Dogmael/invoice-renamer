use std::path::Path;

pub fn extract_native_text_first_page(pdf_path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(pdf_path).map_err(|e| e.to_string())?;
    let pages = pdf_extract::extract_text_from_mem_by_pages(&bytes).map_err(|e| e.to_string())?;

    pages
        .into_iter()
        .next()
        .ok_or_else(|| "PDF has no pages".to_string())
}

pub fn pdf_to_base64(pdf_path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(pdf_path).map_err(|e| e.to_string())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    ))
}
