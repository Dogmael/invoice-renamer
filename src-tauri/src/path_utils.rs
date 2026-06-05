use std::path::{Path, PathBuf};

pub fn validate_user_pdf_path(path: &str) -> Result<PathBuf, String> {
    let pdf_path = Path::new(path);

    let is_pdf = pdf_path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"));

    if !is_pdf {
        return Err(crate::i18n::invalid_file_name(path));
    }

    let metadata = std::fs::metadata(pdf_path).map_err(|_| crate::i18n::file_not_found(path))?;

    if !metadata.is_file() {
        return Err(crate::i18n::file_not_found(path));
    }

    Ok(pdf_path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("invoicerenamer_path_{name}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn accepts_pdf_file() {
        let dir = temp_dir("ok");
        let path = dir.join("invoice.pdf");
        fs::write(&path, b"pdf").expect("write pdf");

        let validated = validate_user_pdf_path(&path.to_string_lossy()).expect("valid pdf");
        assert_eq!(validated, path);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_non_pdf_extension() {
        let dir = temp_dir("ext");
        let path = dir.join("invoice.txt");
        fs::write(&path, b"txt").expect("write txt");

        assert!(validate_user_pdf_path(&path.to_string_lossy()).is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_missing_file() {
        assert!(validate_user_pdf_path("/nonexistent/invoice.pdf").is_err());
    }
}
