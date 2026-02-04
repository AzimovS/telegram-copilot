use crate::ai::types::{OpenAIMessage, OpenAIRequest, OpenAIResponse, ResponseFormat};
use reqwest::Client;
use std::time::Duration;

/// OpenAI API client with retry logic
pub struct OpenAIClient {
    client: Client,
    api_key: String,
    model: String,
}

/// Retry configuration
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000;

impl OpenAIClient {
    /// Create a new OpenAI client
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_key,
            model: "gpt-4o-mini".to_string(),
        }
    }

    /// Check if the client has a valid API key
    pub fn has_api_key(&self) -> bool {
        !self.api_key.is_empty()
    }

    /// Make a chat completion request with retry logic
    pub async fn chat_completion(
        &self,
        messages: Vec<OpenAIMessage>,
        temperature: f32,
        max_tokens: i32,
        json_response: bool,
    ) -> Result<String, String> {
        if !self.has_api_key() {
            return Err("OpenAI API key not configured".to_string());
        }

        let response_format = if json_response {
            Some(ResponseFormat {
                format_type: "json_object".to_string(),
            })
        } else {
            None
        };

        let request = OpenAIRequest {
            model: self.model.clone(),
            messages,
            temperature,
            max_tokens,
            response_format,
        };

        let mut last_error = String::new();
        let mut delay_ms = INITIAL_RETRY_DELAY_MS;

        for attempt in 0..MAX_RETRIES {
            match self.make_request(&request).await {
                Ok(content) => return Ok(content),
                Err(e) => {
                    last_error = e.clone();

                    // Check if we should retry
                    if attempt < MAX_RETRIES - 1 && Self::should_retry(&e) {
                        log::warn!(
                            "OpenAI request failed (attempt {}/{}): {}. Retrying in {}ms...",
                            attempt + 1,
                            MAX_RETRIES,
                            e,
                            delay_ms
                        );
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                        delay_ms *= 2; // Exponential backoff
                    } else {
                        log::error!(
                            "OpenAI request failed (attempt {}/{}): {}",
                            attempt + 1,
                            MAX_RETRIES,
                            e
                        );
                    }
                }
            }
        }

        Err(format!(
            "OpenAI request failed after {} attempts: {}",
            MAX_RETRIES, last_error
        ))
    }

    /// Make a single request to the OpenAI API
    async fn make_request(&self, request: &OpenAIRequest) -> Result<String, String> {
        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();

        if status.is_success() {
            let openai_response: OpenAIResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            openai_response
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
        // Retry on rate limits (429) and server errors (5xx)
        error.contains("429") || error.contains("5") && error.contains("API error")
    }
}

/// Parse JSON response safely with a default fallback
pub fn safe_json_parse<T: serde::de::DeserializeOwned>(
    content: &str,
    context: &str,
) -> Result<T, String> {
    serde_json::from_str(content).map_err(|e| {
        log::error!("Failed to parse {} JSON: {}. Content: {}", context, e, content);
        format!("JSON parse error for {}: {}", context, e)
    })
}
