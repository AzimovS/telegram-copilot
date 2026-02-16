use crate::ai::types::{OpenAIMessage, OpenAIRequest, OpenAIResponse, ResponseFormat};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::RwLock;

/// LLM provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub provider: String,        // "openai" | "ollama"
    pub base_url: String,        // "https://api.openai.com" | "http://localhost:11434"
    pub api_key: Option<String>, // None for Ollama
    pub model: String,           // "gpt-4o-mini" | "llama3" etc.
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            provider: "openai".to_string(),
            base_url: "https://api.openai.com".to_string(),
            api_key: None,
            model: "gpt-4o-mini".to_string(),
        }
    }
}

/// LLM API client with retry logic, supporting OpenAI and Ollama
pub struct LLMClient {
    client_openai: Client,
    client_ollama: Client,
    config: RwLock<LLMConfig>,
}

/// Retry configuration
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000;

impl LLMClient {
    /// Create a new LLM client with the given config
    pub fn new(config: LLMConfig) -> Self {
        let client_openai = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        let client_ollama = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client_openai,
            client_ollama,
            config: RwLock::new(config),
        }
    }

    /// Check if the client is configured (has API key for OpenAI, always true for Ollama)
    pub async fn is_configured(&self) -> bool {
        let config = self.config.read().await;
        match config.provider.as_str() {
            "ollama" => true,
            _ => config
                .api_key
                .as_ref()
                .map(|k| !k.is_empty())
                .unwrap_or(false),
        }
    }

    /// Update the runtime configuration
    pub async fn update_config(&self, new_config: LLMConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
    }

    /// Get a clone of the current configuration
    pub async fn get_config(&self) -> LLMConfig {
        self.config.read().await.clone()
    }

    /// Make a chat completion request with retry logic
    pub async fn chat_completion(
        &self,
        messages: Vec<OpenAIMessage>,
        temperature: f32,
        max_tokens: i32,
        json_response: bool,
    ) -> Result<String, String> {
        if !self.is_configured().await {
            return Err("LLM not configured: API key required for OpenAI".to_string());
        }

        let config = self.config.read().await.clone();

        let response_format = if json_response {
            Some(ResponseFormat {
                format_type: "json_object".to_string(),
            })
        } else {
            None
        };

        let request = OpenAIRequest {
            model: config.model.clone(),
            messages,
            temperature,
            max_tokens,
            response_format,
        };

        let mut last_error = String::new();
        let mut delay_ms = INITIAL_RETRY_DELAY_MS;

        for attempt in 0..MAX_RETRIES {
            match self.make_request(&config, &request).await {
                Ok(content) => return Ok(content),
                Err(e) => {
                    last_error = e.clone();

                    if attempt < MAX_RETRIES - 1 && Self::should_retry(&e) {
                        log::warn!(
                            "LLM request failed (attempt {}/{}): {}. Retrying in {}ms...",
                            attempt + 1,
                            MAX_RETRIES,
                            e,
                            delay_ms
                        );
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                        delay_ms *= 2;
                    } else {
                        log::error!(
                            "LLM request failed (attempt {}/{}): {}",
                            attempt + 1,
                            MAX_RETRIES,
                            e
                        );
                    }
                }
            }
        }

        Err(format!(
            "LLM request failed after {} attempts: {}",
            MAX_RETRIES, last_error
        ))
    }

    /// Make a single request to the LLM API
    async fn make_request(
        &self,
        config: &LLMConfig,
        request: &OpenAIRequest,
    ) -> Result<String, String> {
        let url = format!(
            "{}/v1/chat/completions",
            config.base_url.trim_end_matches('/')
        );

        let http_client = match config.provider.as_str() {
            "ollama" => &self.client_ollama,
            _ => &self.client_openai,
        };

        let mut req = http_client
            .post(&url)
            .header("Content-Type", "application/json");

        if let Some(ref api_key) = config.api_key {
            if !api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", api_key));
            }
        }

        let response = req
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();

        if status.is_success() {
            let llm_response: OpenAIResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            llm_response
                .choices
                .first()
                .map(|choice| choice.message.content.clone())
                .ok_or_else(|| "No response content".to_string())
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            Err(format!("API error ({}): {}", status.as_u16(), error_text))
        }
    }

    /// Determine if an error is retryable
    fn should_retry(error: &str) -> bool {
        error.contains("429") || error.contains("5") && error.contains("API error")
    }
}

/// List available models from an Ollama instance
pub async fn list_ollama_models(base_url: &str) -> Result<Vec<OllamaModel>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|_| "Ollama is not running or unreachable. Start Ollama and try again.".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Ollama returned error ({})",
            response.status().as_u16()
        ));
    }

    let body: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(body
        .models
        .into_iter()
        .map(|m| OllamaModel {
            name: m.name,
            size: m.size,
            modified_at: m.modified_at,
        })
        .collect())
}

/// Ollama model info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

/// Internal: Ollama /api/tags response
#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaTagModel>,
}

/// Internal: single model entry from Ollama
#[derive(Debug, Deserialize)]
struct OllamaTagModel {
    name: String,
    size: Option<u64>,
    modified_at: Option<String>,
}

/// Parse JSON response safely with a default fallback
pub fn safe_json_parse<T: serde::de::DeserializeOwned>(
    content: &str,
    context: &str,
) -> Result<T, String> {
    serde_json::from_str(content).map_err(|e| {
        log::error!(
            "Failed to parse {} JSON: {}. Content: {}",
            context,
            e,
            content
        );
        format!("JSON parse error for {}: {}", context, e)
    })
}
