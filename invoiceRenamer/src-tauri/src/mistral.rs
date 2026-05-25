use reqwest::Client;
use serde_json::{json, Value};
use std::path::Path;

use crate::pdf_utils;

const MISTRAL_API_BASE: &str = "https://api.mistral.ai/v1";
const OCR_MODEL: &str = "mistral-ocr-latest";
const CHAT_MODEL: &str = "mistral-small-2506";

pub struct MistralClient {
    http: Client,
    api_key: String,
}

impl MistralClient {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();
        dotenvy::from_filename("../.env").ok();

        let api_key = std::env::var("MISTRAL_API_KEY")
            .map_err(|_| "MISTRAL_API_KEY is not set. Add it to a .env file.".to_string())?;

        Ok(Self {
            http: Client::new(),
            api_key,
        })
    }

    pub async fn ocr_first_page(&self, pdf_path: &Path) -> Result<Value, String> {
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

        self.post_json("/ocr", body).await
    }

    pub async fn generate_filename(&self, prompt: &str, native_text: &str, ocr_text: &Value) -> Result<String, String> {
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

        let response = self.post_json("/chat/completions", body).await?;
        let content = response
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .ok_or_else(|| "Mistral chat response did not contain a filename".to_string())?
            .trim()
            .trim_matches('"')
            .trim()
            .to_string();

        if content.eq_ignore_ascii_case("null") {
            return Err("Could not extract all required invoice information".to_string());
        }

        Ok(content)
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

            return Err(format!("Mistral API error ({status}): {message}"));
        }

        Ok(payload)
    }
}

pub fn load_prompt() -> Result<String, String> {
    for path in ["prompt.txt", "../prompt.txt", "../../prompt.txt"] {
        if let Ok(content) = std::fs::read_to_string(path) {
            return Ok(content);
        }
    }

    Err("prompt.txt not found. Place it at the project root.".to_string())
}
