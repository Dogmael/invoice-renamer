use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::pdf_utils;

const MISTRAL_API_BASE: &str = "https://api.mistral.ai/v1";
const OCR_MODEL: &str = "mistral-ocr-latest";
const CHAT_MODEL: &str = "mistral-small-2506";
const KEYRING_SERVICE: &str = "invoicerenamer";
const KEYRING_ACCOUNT: &str = "mistral_api_key";
const DEFAULT_PROMPT: &str = "Tu renommes des factures PDF.\n\
Retourne uniquement un nom de fichier concis, sans extension.\n\
Format attendu: fournisseur_numero_facture_date_montant_ttc.\n\
Utilise des underscores, sans accents, sans caractères spéciaux.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MistralApiKeyInfo {
    pub has_key: bool,
    pub preview: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MistralApiKeyState {
    pub has_key: bool,
    pub preview: Option<String>,
    pub validation: Option<String>,
}

pub struct MistralClient {
    http: Client,
    api_key: String,
}

impl MistralClient {
    pub fn from_secure_store() -> Result<Self, String> {
        let api_key = read_api_key()?;

        Ok(Self {
            http: Client::new(),
            api_key,
        })
    }

    pub async fn ocr_first_page(
        &self,
        pdf_path: &Path,
        cancel: &Arc<AtomicBool>,
    ) -> Result<Value, String> {
        let pdf_base64 = pdf_utils::pdf_to_base64(pdf_path)?;
        let body = json!({
            "model": OCR_MODEL,
            "document": {
                "type": "document_url",
                "document_url": format!("data:application/pdf;base64,{pdf_base64}")
            },
            "include_image_base64": false,
            "pages": [0]
        });

        self.post_json_cancelable("/ocr", body, cancel).await
    }

    pub async fn generate_filename(
        &self,
        prompt: &str,
        native_text: &str,
        ocr_text: &Value,
        cancel: &Arc<AtomicBool>,
    ) -> Result<String, String> {
        let user_content = json!({
            "native_text": native_text,
            "ocr_text": ocr_text,
        });

        let body = json!({
            "model": CHAT_MODEL,
            "messages": [
                { "role": "system", "content": prompt },
                { "role": "user", "content": serde_json::to_string(&user_content).map_err(|e| e.to_string())? }
            ]
        });

        let response = self
            .post_json_cancelable("/chat/completions", body, cancel)
            .await?;
        let content = response
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .ok_or_else(|| "error.mistral_chat_no_filename".to_string())?
            .trim()
            .trim_matches('"')
            .trim()
            .to_string();

        if content.eq_ignore_ascii_case("null") {
            return Err("error.invoice_info_incomplete".to_string());
        }

        Ok(content)
    }

    async fn post_json_cancelable(
        &self,
        endpoint: &str,
        body: Value,
        cancel: &Arc<AtomicBool>,
    ) -> Result<Value, String> {
        tokio::select! {
            biased;
            _ = wait_for_cancel(cancel) => Err("__cancelled__".to_string()),
            result = self.post_json(endpoint, body) => result,
        }
    }

    async fn post_json(&self, endpoint: &str, body: Value) -> Result<Value, String> {
        let url = format!("{MISTRAL_API_BASE}{endpoint}");
        let response = self
            .http
            .post(url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let payload: Value = response.json().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            let message = payload
                .pointer("/message")
                .and_then(Value::as_str)
                .or_else(|| payload.as_str())
                .unwrap_or("Unknown Mistral API error");

            return Err(crate::i18n::mistral_api_error(status.as_u16(), message));
        }

        Ok(payload)
    }
}

async fn wait_for_cancel(cancel: &Arc<AtomicBool>) {
    while !cancel.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

pub fn load_prompt(app: &AppHandle) -> Result<String, String> {
    let prompt_path = app_prompt_path(app)?;

    if prompt_path.exists() {
        return std::fs::read_to_string(&prompt_path)
            .map_err(|e| crate::i18n::prompt_save_failed(&e.to_string()));
    }

    for path in ["prompt.txt", "../prompt.txt", "../../prompt.txt"] {
        if let Ok(content) = std::fs::read_to_string(path) {
            std::fs::write(&prompt_path, &content)
                .map_err(|e| crate::i18n::prompt_save_failed(&e.to_string()))?;
            return Ok(content);
        }
    }

    std::fs::write(&prompt_path, DEFAULT_PROMPT)
        .map_err(|e| crate::i18n::prompt_save_failed(&e.to_string()))?;
    Ok(DEFAULT_PROMPT.to_string())
}

pub fn save_prompt(app: &AppHandle, prompt: &str) -> Result<(), String> {
    if prompt.trim().is_empty() {
        return Err("error.prompt_not_found".to_string());
    }

    let prompt_path = app_prompt_path(app)?;
    std::fs::write(prompt_path, prompt)
        .map_err(|e| crate::i18n::prompt_save_failed(&e.to_string()))
}

pub fn get_api_key_info() -> Result<MistralApiKeyInfo, String> {
    match read_api_key() {
        Ok(key) => Ok(MistralApiKeyInfo {
            has_key: true,
            preview: Some(mask_api_key(&key)),
        }),
        Err(error) if error == "error.mistral_api_key_missing" => Ok(MistralApiKeyInfo {
            has_key: false,
            preview: None,
        }),
        Err(error) => Err(error),
    }
}

pub async fn get_api_key_state(validate: bool) -> Result<MistralApiKeyState, String> {
    match read_api_key() {
        Ok(key) => {
            let validation = if validate {
                Some(if validate_api_key(&key).await.is_ok() {
                    "valid".to_string()
                } else {
                    "invalid".to_string()
                })
            } else {
                None
            };

            Ok(MistralApiKeyState {
                has_key: true,
                preview: Some(mask_api_key(&key)),
                validation,
            })
        }
        Err(error) if error == "error.mistral_api_key_missing" => Ok(MistralApiKeyState {
            has_key: false,
            preview: None,
            validation: None,
        }),
        Err(error) => Err(error),
    }
}

pub fn get_api_key_preview() -> Result<Option<String>, String> {
    Ok(get_api_key_info()?.preview)
}

pub async fn validate_api_key(api_key: &str) -> Result<(), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("error.mistral_api_key_missing".to_string());
    }

    let client = Client::new();
    let response = client
        .get(format!("{MISTRAL_API_BASE}/models"))
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("error.mistral_api_key_validation|details={}", e))?;

    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err("error.mistral_api_key_invalid".to_string());
    }

    if !status.is_success() {
        let message = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown Mistral API error".to_string());
        return Err(crate::i18n::mistral_api_error(status.as_u16(), &message));
    }

    Ok(())
}

pub async fn validate_stored_api_key() -> Result<(), String> {
    validate_api_key(&read_api_key()?).await
}

pub fn has_api_key() -> bool {
    read_api_key().is_ok()
}

pub fn set_api_key(api_key: &str) -> Result<MistralApiKeyInfo, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("error.mistral_api_key_missing".to_string());
    }

    let entry = keyring_entry()?;
    entry
        .set_password(api_key)
        .map_err(map_keyring_error)?;
    set_api_key_cache(api_key.to_string());

    Ok(api_key_info_from_key(api_key))
}

pub fn clear_api_key() -> Result<(), String> {
    clear_api_key_cache();
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(e) => {
            if is_missing_keyring_entry(&e) {
                Ok(())
            } else {
                Err(map_keyring_error(e))
            }
        }
    }
}

fn read_api_key() -> Result<String, String> {
    if let Ok(cache) = API_KEY_CACHE.lock() {
        if let Some(key) = cache.as_ref() {
            return Ok(key.clone());
        }
    }

    let key = read_api_key_from_keyring()?;
    set_api_key_cache(key.clone());
    Ok(key)
}

fn read_api_key_from_keyring() -> Result<String, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(api_key) => {
            if api_key.trim().is_empty() {
                clear_api_key_cache();
                Err("error.mistral_api_key_missing".to_string())
            } else {
                Ok(api_key)
            }
        }
        Err(error) => {
            if is_missing_keyring_entry(&error) {
                clear_api_key_cache();
                Err("error.mistral_api_key_missing".to_string())
            } else {
                Err(map_keyring_error(error))
            }
        }
    }
}

static API_KEY_CACHE: Mutex<Option<String>> = Mutex::new(None);

fn set_api_key_cache(api_key: String) {
    if let Ok(mut cache) = API_KEY_CACHE.lock() {
        *cache = Some(api_key);
    }
}

fn clear_api_key_cache() {
    if let Ok(mut cache) = API_KEY_CACHE.lock() {
        *cache = None;
    }
}

fn app_prompt_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| crate::i18n::config_unavailable(&e.to_string()))?;
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| crate::i18n::config_unavailable(&e.to_string()))?;
    Ok(config_dir.join("prompt.txt"))
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(map_keyring_error)
}

fn is_missing_keyring_entry(error: &keyring::Error) -> bool {
    let message = error.to_string().to_lowercase();
    message.contains("no matching entry")
        || message.contains("no entry")
        || message.contains("could not find")
        || message.contains("not found")
}

fn map_keyring_error(error: keyring::Error) -> String {
    if is_missing_keyring_entry(&error) {
        return "error.secure_storage_not_found".to_string();
    }

    crate::i18n::secure_storage_error(&error.to_string())
}

fn mask_api_key(key: &str) -> String {
    let key = key.trim();
    let chars: Vec<char> = key.chars().collect();
    let len = chars.len();

    if len <= 4 {
        return format!("**...{key}");
    }

    let suffix: String = chars.iter().skip(len - 4).collect();
    format!("**...{suffix}")
}

pub fn api_key_info_from_key(api_key: &str) -> MistralApiKeyInfo {
    MistralApiKeyInfo {
        has_key: true,
        preview: Some(mask_api_key(api_key)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_key_preview_masks_long_keys() {
        let info = api_key_info_from_key("abcdefghijklmnop");
        assert_eq!(info.has_key, true);
        assert_eq!(info.preview, Some("**...mnop".to_string()));
    }

    #[test]
    fn api_key_preview_keeps_short_keys_visible() {
        let info = api_key_info_from_key("abc");
        assert_eq!(info.preview, Some("**...abc".to_string()));
    }

    #[test]
    fn api_key_preview_trims_whitespace() {
        let info = api_key_info_from_key("  abcdefghijklmnop  ");
        assert_eq!(info.preview, Some("**...mnop".to_string()));
    }
}
