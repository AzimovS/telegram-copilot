use crate::db;
use crate::telegram::TelegramClient;
use crate::utils::rate_limiter::RateLimiter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutreachRecipient {
    pub user_id: i64,
    pub first_name: String,
    pub last_name: String,
    pub status: String,
    pub error: Option<String>,
    pub sent_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutreachQueue {
    pub id: String,
    pub template: String,
    pub recipients: Vec<OutreachRecipient>,
    pub status: String,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub sent_count: i32,
    pub failed_count: i32,
}

pub struct OutreachManager {
    queues: RwLock<std::collections::HashMap<String, OutreachQueue>>,
}

impl OutreachManager {
    pub fn new() -> Self {
        Self {
            queues: RwLock::new(std::collections::HashMap::new()),
        }
    }

    /// Load incomplete queues from database on startup
    pub async fn restore_from_db(&self) -> Result<(), String> {
        let queues = db::with_db(|conn| db::outreach::load_incomplete_queues(conn))?;
        let mut memory_queues = self.queues.write().await;
        for queue in queues {
            log::info!("[Outreach] Restored queue {} from database", queue.id);
            memory_queues.insert(queue.id.clone(), queue);
        }
        Ok(())
    }

    pub async fn create_queue(
        &self,
        recipients: Vec<OutreachRecipient>,
        template: String,
    ) -> Result<String, String> {
        let queue_id = uuid::Uuid::new_v4().to_string();

        let queue = OutreachQueue {
            id: queue_id.clone(),
            template,
            recipients,
            status: "running".to_string(),
            started_at: Some(chrono::Utc::now().timestamp()),
            completed_at: None,
            sent_count: 0,
            failed_count: 0,
        };

        // Persist to database
        db::with_db(|conn| db::outreach::save_queue(conn, &queue))?;

        self.queues.write().await.insert(queue_id.clone(), queue);
        Ok(queue_id)
    }

    pub async fn get_status(&self, queue_id: &str) -> Option<OutreachQueue> {
        // Check in-memory cache first
        if let Some(queue) = self.queues.read().await.get(queue_id) {
            return Some(queue.clone());
        }
        // Fall back to database
        db::with_db(|conn| db::outreach::load_queue(conn, queue_id)).ok().flatten()
    }

    pub async fn update_recipient_status(
        &self,
        queue_id: &str,
        user_id: i64,
        status: &str,
        error: Option<String>,
    ) {
        let sent_at = if status == "sent" {
            Some(chrono::Utc::now().timestamp())
        } else {
            None
        };

        // Update in-memory
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            if let Some(recipient) = queue.recipients.iter_mut().find(|r| r.user_id == user_id) {
                recipient.status = status.to_string();
                recipient.error = error.clone();
                if status == "sent" {
                    recipient.sent_at = sent_at;
                    queue.sent_count += 1;
                } else if status == "failed" {
                    queue.failed_count += 1;
                }
            }
        }
        drop(queues);

        // Persist to database
        if let Err(e) = db::with_db(|conn| {
            db::outreach::update_recipient_status(conn, queue_id, user_id, status, error, sent_at)
        }) {
            log::error!("[Outreach] Failed to persist recipient status: {}", e);
        }
    }

    pub async fn complete_queue(&self, queue_id: &str) {
        let completed_at = Some(chrono::Utc::now().timestamp());

        // Update in-memory
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            queue.status = "completed".to_string();
            queue.completed_at = completed_at;
        }
        drop(queues);

        // Persist to database
        if let Err(e) = db::with_db(|conn| {
            db::outreach::update_queue_status(conn, queue_id, "completed", completed_at)
        }) {
            log::error!("[Outreach] Failed to persist queue completion: {}", e);
        }
    }

    pub async fn is_cancelled(&self, queue_id: &str) -> bool {
        self.queues
            .read()
            .await
            .get(queue_id)
            .map(|q| q.status == "cancelled")
            .unwrap_or(true)
    }

    pub async fn cancel(&self, queue_id: &str) -> Result<(), String> {
        let completed_at = Some(chrono::Utc::now().timestamp());

        // Update in-memory
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            queue.status = "cancelled".to_string();
            queue.completed_at = completed_at;
        } else {
            return Err("Queue not found".to_string());
        }
        drop(queues);

        // Persist to database
        db::with_db(|conn| {
            db::outreach::update_queue_status(conn, queue_id, "cancelled", completed_at)
        })?;

        Ok(())
    }
}

impl Default for OutreachManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Extract flood wait seconds from error message
fn extract_flood_wait_seconds(error_msg: &str) -> Option<u64> {
    // Look for patterns like "FLOOD_WAIT_60" or "wait for 60 seconds"
    let error_lower = error_msg.to_lowercase();

    // Pattern 1: FLOOD_WAIT_X
    if let Some(idx) = error_lower.find("flood_wait_") {
        let start = idx + "flood_wait_".len();
        let num_str: String = error_lower[start..].chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(secs) = num_str.parse() {
            return Some(secs);
        }
    }

    // Pattern 2: "wait for X seconds" or "X seconds"
    for word in error_lower.split_whitespace() {
        if let Ok(secs) = word.parse::<u64>() {
            if secs > 0 && secs < 86400 {
                // Reasonable range
                return Some(secs);
            }
        }
    }

    // Default to 60 seconds if we can't parse
    Some(60)
}

/// Personalize a message template with contact info
fn personalize_message(template: &str, first_name: &str, last_name: &str) -> String {
    let first = if first_name.is_empty() { "there" } else { first_name };
    let last = last_name;
    let full = if last.is_empty() {
        first.to_string()
    } else {
        format!("{} {}", first, last)
    };

    template
        .replace("{name}", first)
        .replace("{first_name}", first)
        .replace("{last_name}", last)
        .replace("{full_name}", &full)
}

#[tauri::command]
pub async fn queue_outreach_messages(
    client: State<'_, Arc<TelegramClient>>,
    manager: State<'_, Arc<OutreachManager>>,
    rate_limiter: State<'_, Arc<RateLimiter>>,
    recipient_ids: Vec<i64>,
    template: String,
) -> Result<String, String> {
    log::info!("[Outreach] Starting outreach to {} recipients", recipient_ids.len());

    if recipient_ids.is_empty() {
        return Err("No recipients specified".to_string());
    }

    if template.trim().is_empty() {
        return Err("Message template is empty".to_string());
    }

    // Fetch contacts to get names for personalization
    let contacts = client.get_contacts().await?;

    // Build recipient list with names
    let recipients: Vec<OutreachRecipient> = recipient_ids
        .iter()
        .map(|&user_id| {
            let contact = contacts.iter().find(|c| c.id == user_id);
            OutreachRecipient {
                user_id,
                first_name: contact.map(|c| c.first_name.clone()).unwrap_or_default(),
                last_name: contact.map(|c| c.last_name.clone()).unwrap_or_default(),
                status: "pending".to_string(),
                error: None,
                sent_at: None,
            }
        })
        .collect();

    // Create the queue
    let queue_id = manager.create_queue(recipients.clone(), template.clone()).await?;
    log::info!("[Outreach] Created queue {}", queue_id);

    // Clone what we need for the background task
    let client = Arc::clone(&client);
    let manager = Arc::clone(&manager);
    let limiter = Arc::clone(&rate_limiter);
    let queue_id_clone = queue_id.clone();

    // Spawn background task to process the queue
    tauri::async_runtime::spawn(async move {
        log::info!("[Outreach] Starting to process queue {}", queue_id_clone);

        for recipient in recipients.iter() {
            // Check if cancelled
            if manager.is_cancelled(&queue_id_clone).await {
                log::info!("[Outreach] Queue {} was cancelled", queue_id_clone);
                break;
            }

            // Use rate limiter to wait for appropriate time
            let wait_result = limiter.can_send(recipient.user_id);
            if let Err(wait_secs) = wait_result {
                log::info!("[Outreach] Rate limiter: waiting {} seconds for user {}", wait_secs, recipient.user_id);

                // Wait in small increments to check for cancellation
                let target_time = Instant::now() + Duration::from_secs(wait_secs);
                while Instant::now() < target_time {
                    if manager.is_cancelled(&queue_id_clone).await {
                        log::info!("[Outreach] Queue {} was cancelled during rate limit wait", queue_id_clone);
                        return;
                    }
                    sleep(Duration::from_secs(1)).await;
                }
            }

            // Final cancellation check before sending
            if manager.is_cancelled(&queue_id_clone).await {
                log::info!("[Outreach] Queue {} was cancelled before sending", queue_id_clone);
                break;
            }

            // Personalize the message
            let message = personalize_message(&template, &recipient.first_name, &recipient.last_name);
            log::info!(
                "[Outreach] Sending to {} ({}): {}",
                recipient.first_name,
                recipient.user_id,
                &message[..message.len().min(50)]
            );

            // Send the message - user_id is the chat_id for DMs
            match client.send_message(recipient.user_id, &message).await {
                Ok(_) => {
                    log::info!("[Outreach] Successfully sent to {}", recipient.user_id);
                    limiter.record_send(recipient.user_id);
                    manager
                        .update_recipient_status(&queue_id_clone, recipient.user_id, "sent", None)
                        .await;
                }
                Err(e) => {
                    log::error!("[Outreach] Failed to send to {}: {}", recipient.user_id, e);

                    // Check for flood wait errors
                    let error_msg = e.to_string();
                    if error_msg.to_lowercase().contains("flood") {
                        // Extract wait time from error message (e.g., "FLOOD_WAIT_X")
                        if let Some(wait_secs) = extract_flood_wait_seconds(&error_msg) {
                            log::warn!("[Outreach] FLOOD_WAIT received, adding {} seconds to rate limiter", wait_secs);
                            limiter.handle_flood_wait(wait_secs);
                        }
                    }

                    manager
                        .update_recipient_status(
                            &queue_id_clone,
                            recipient.user_id,
                            "failed",
                            Some(error_msg),
                        )
                        .await;
                }
            }
        }

        // Mark queue as completed
        manager.complete_queue(&queue_id_clone).await;
        log::info!("[Outreach] Queue {} completed", queue_id_clone);
    });

    Ok(queue_id)
}

#[tauri::command]
pub async fn get_outreach_status(
    manager: State<'_, Arc<OutreachManager>>,
    queue_id: String,
) -> Result<Option<OutreachQueue>, String> {
    Ok(manager.get_status(&queue_id).await)
}

#[tauri::command]
pub async fn cancel_outreach(
    manager: State<'_, Arc<OutreachManager>>,
    queue_id: String,
) -> Result<(), String> {
    manager.cancel(&queue_id).await
}
