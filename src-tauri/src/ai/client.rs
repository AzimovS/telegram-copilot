use crate::ai::types::{OpenAIMessage, OpenAIRequest, OpenAIResponse, ResponseFormat};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, Semaphore};
use tokio_util::sync::CancellationToken;

/// LLM provider type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LLMProvider {
    OpenAI,
    Ollama,
}

/// LLM provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub provider: LLMProvider,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            provider: LLMProvider::OpenAI,
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
    ollama_semaphore: Arc<Semaphore>,
    cancel_token: CancellationToken,
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
            ollama_semaphore: Arc::new(Semaphore::new(2)),
            cancel_token: CancellationToken::new(),
        }
    }

    /// Check if the client is configured (has API key for OpenAI, always true for Ollama)
    pub async fn is_configured(&self) -> bool {
        let config = self.config.read().await;
        match config.provider {
            LLMProvider::Ollama => true,
            LLMProvider::OpenAI => config
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

    /// Cancel all in-flight requests (drops HTTP futures, closing TCP connections)
    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }

    /// Check if cancellation has been requested
    pub fn is_cancelled(&self) -> bool {
        self.cancel_token.is_cancelled()
    }

    /// Make a chat completion request with retry logic
    pub async fn chat_completion(
        &self,
        messages: Vec<OpenAIMessage>,
        temperature: f32,
        max_tokens: i32,
        json_response: bool,
    ) -> Result<String, String> {
        if self.cancel_token.is_cancelled() {
            return Err("Request cancelled".to_string());
        }

        if !self.is_configured().await {
            return Err("LLM not configured: API key required for OpenAI".to_string());
        }

        let config = self.config.read().await.clone();

        let (response_format, messages) = match config.provider {
            LLMProvider::Ollama => {
                // Ollama models may not support response_format; reinforce via prompt
                let mut msgs = messages;
                if json_response {
                    if let Some(system_msg) = msgs.iter_mut().find(|m| m.role == "system") {
                        system_msg.content.push_str(
                            "\n\nCRITICAL: Output ONLY the raw JSON object. No markdown code fences, no explanation, no text before or after the JSON."
                        );
                    }
                }
                (None, msgs)
            }
            LLMProvider::OpenAI => {
                let fmt = if json_response {
                    Some(ResponseFormat {
                        format_type: "json_object".to_string(),
                    })
                } else {
                    None
                };
                (fmt, messages)
            }
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
            if self.cancel_token.is_cancelled() {
                return Err("Request cancelled".to_string());
            }

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
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_millis(delay_ms)) => {},
                            _ = self.cancel_token.cancelled() => return Err("Request cancelled".to_string()),
                        };
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

        let http_client = match config.provider {
            LLMProvider::Ollama => &self.client_ollama,
            LLMProvider::OpenAI => &self.client_openai,
        };

        let mut req = http_client
            .post(&url)
            .header("Content-Type", "application/json");

        if let Some(ref api_key) = config.api_key {
            if !api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", api_key));
            }
        }

        let send_future = req.json(request).send();
        let response = tokio::select! {
            result = send_future => result.map_err(|e| format!("Request failed: {}", e))?,
            _ = self.cancel_token.cancelled() => return Err("Request cancelled".to_string()),
        };

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
        // Rate limiting
        if error.contains("429") {
            return true;
        }
        // Server errors (500, 502, 503, 504)
        if error.contains("API error") &&
            (error.contains("500") || error.contains("502") || error.contains("503") || error.contains("504"))
        {
            return true;
        }
        // Connection errors (critical for Ollama)
        let lower = error.to_lowercase();
        lower.contains("connection refused")
            || lower.contains("timed out")
            || lower.contains("timeout")
            || lower.contains("reset by peer")
    }

    /// Acquire a concurrency permit for Ollama requests. Returns None for OpenAI (zero overhead).
    pub async fn acquire_permit(&self) -> Option<tokio::sync::OwnedSemaphorePermit> {
        let config = self.config.read().await;
        match config.provider {
            LLMProvider::Ollama => {
                drop(config); // Release read lock before awaiting permit
                Some(self.ollama_semaphore.clone().acquire_owned().await.expect("semaphore closed"))
            }
            LLMProvider::OpenAI => None,
        }
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
            parameter_size: m.details.and_then(|d| d.parameter_size),
        })
        .collect())
}

/// Ollama model info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub parameter_size: Option<String>,
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
    details: Option<OllamaModelDetails>,
}

/// Internal: nested details from Ollama /api/tags
#[derive(Debug, Deserialize)]
struct OllamaModelDetails {
    parameter_size: Option<String>,
}

/// Extract a JSON object from LLM output that may contain markdown fences or extra text.
/// Tries raw parse first, then strips code fences, then finds the outermost `{...}`.
fn extract_json(content: &str) -> Option<&str> {
    // 1. Try the raw content (already valid JSON)
    if content.trim_start().starts_with('{') {
        return Some(content);
    }

    // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
    if let Some(start) = content.find("```") {
        let after_fence = &content[start + 3..];
        // Skip optional language tag on the same line
        let inner = if let Some(nl) = after_fence.find('\n') {
            &after_fence[nl + 1..]
        } else {
            after_fence
        };
        if let Some(end) = inner.find("```") {
            let extracted = inner[..end].trim();
            if extracted.starts_with('{') {
                return Some(extracted);
            }
        }
    }

    // 3. Find first '{' and last '}' — extract the outermost JSON object
    let start = content.find('{')?;
    let end = content.rfind('}')?;
    if start < end {
        return Some(&content[start..=end]);
    }

    None
}

/// Parse JSON response safely, with extraction for LLMs that wrap JSON in extra text.
pub fn safe_json_parse<T: serde::de::DeserializeOwned>(
    content: &str,
    context: &str,
) -> Result<T, String> {
    // Fast path: try direct parse
    if let Ok(parsed) = serde_json::from_str(content) {
        return Ok(parsed);
    }

    // Slow path: try to extract JSON from wrapped response
    if let Some(extracted) = extract_json(content) {
        if let Ok(parsed) = serde_json::from_str(extracted) {
            log::debug!("Extracted JSON from wrapped {} response", context);
            return Ok(parsed);
        }
    }

    log::error!(
        "Failed to parse {} JSON. Content: {}",
        context,
        content
    );
    Err(format!("JSON parse error for {}: could not extract valid JSON", context))
}
