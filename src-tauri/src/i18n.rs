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
