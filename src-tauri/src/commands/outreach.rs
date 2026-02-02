use crate::telegram::TelegramClient;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

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

    pub async fn create_queue(
        &self,
        recipients: Vec<OutreachRecipient>,
        template: String,
    ) -> String {
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

        self.queues.write().await.insert(queue_id.clone(), queue);
        queue_id
    }

    pub async fn get_status(&self, queue_id: &str) -> Option<OutreachQueue> {
        self.queues.read().await.get(queue_id).cloned()
    }

    pub async fn update_recipient_status(
        &self,
        queue_id: &str,
        user_id: i64,
        status: &str,
        error: Option<String>,
    ) {
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            if let Some(recipient) = queue.recipients.iter_mut().find(|r| r.user_id == user_id) {
                recipient.status = status.to_string();
                recipient.error = error;
                if status == "sent" {
                    recipient.sent_at = Some(chrono::Utc::now().timestamp());
                    queue.sent_count += 1;
                } else if status == "failed" {
                    queue.failed_count += 1;
                }
            }
        }
    }

    pub async fn complete_queue(&self, queue_id: &str) {
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            queue.status = "completed".to_string();
            queue.completed_at = Some(chrono::Utc::now().timestamp());
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
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            queue.status = "cancelled".to_string();
            queue.completed_at = Some(chrono::Utc::now().timestamp());
            Ok(())
        } else {
            Err("Queue not found".to_string())
        }
    }
}

impl Default for OutreachManager {
    fn default() -> Self {
        Self::new()
    }
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
    let queue_id = manager.create_queue(recipients.clone(), template.clone()).await;
    log::info!("[Outreach] Created queue {}", queue_id);

    // Clone what we need for the background task
    let client = Arc::clone(&client);
    let manager = Arc::clone(&manager);
    let queue_id_clone = queue_id.clone();

    // Spawn background task to process the queue
    tauri::async_runtime::spawn(async move {
        log::info!("[Outreach] Starting to process queue {}", queue_id_clone);

        for (i, recipient) in recipients.iter().enumerate() {
            // Check if cancelled
            if manager.is_cancelled(&queue_id_clone).await {
                log::info!("[Outreach] Queue {} was cancelled", queue_id_clone);
                break;
            }

            // Add delay between messages (except for the first one)
            if i > 0 {
                log::info!("[Outreach] Waiting 60s before next message...");
                sleep(Duration::from_secs(60)).await;

                // Check cancellation again after delay
                if manager.is_cancelled(&queue_id_clone).await {
                    log::info!("[Outreach] Queue {} was cancelled during delay", queue_id_clone);
                    break;
                }
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
                    manager
                        .update_recipient_status(&queue_id_clone, recipient.user_id, "sent", None)
                        .await;
                }
                Err(e) => {
                    log::error!("[Outreach] Failed to send to {}: {}", recipient.user_id, e);

                    // Check for flood wait errors
                    let error_msg = e.to_string();
                    if error_msg.to_lowercase().contains("flood") {
                        // Extract wait time if possible and handle it
                        log::warn!("[Outreach] Rate limited, marking as failed");
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
