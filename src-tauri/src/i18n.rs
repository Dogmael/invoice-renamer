pub fn mistral_api_error(status: u16, message: &str) -> String {
    format!("error.mistral_api|status={status}|message={message}")
}

pub fn rename_failed(from: &str, to: &str, details: &str) -> String {
    format!("error.rename_failed|from={from}|to={to}|details={details}")
}

pub fn file_not_found(path: &str) -> String {
    format!("error.file_not_found|{path}")
}

pub fn invalid_file_name(path: &str) -> String {
    format!("error.invalid_file_name|{path}")
}

pub fn secure_storage_error(details: &str) -> String {
    format!("error.secure_storage|details={details}")
}

pub fn prompt_save_failed(details: &str) -> String {
    format!("error.prompt_save_failed|details={details}")
}

pub fn config_unavailable(details: &str) -> String {
    format!("error.config_unavailable|details={details}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mistral_api_error_includes_status_and_message() {
        assert_eq!(
            mistral_api_error(429, "rate limited"),
            "error.mistral_api|status=429|message=rate limited"
        );
    }

    #[test]
    fn rename_failed_includes_paths_and_details() {
        assert_eq!(
            rename_failed("/in/a.pdf", "/in/b.pdf", "permission denied"),
            "error.rename_failed|from=/in/a.pdf|to=/in/b.pdf|details=permission denied"
        );
    }

    #[test]
    fn file_not_found_includes_path() {
        assert_eq!(
            file_not_found("/tmp/missing.pdf"),
            "error.file_not_found|/tmp/missing.pdf"
        );
    }
}
