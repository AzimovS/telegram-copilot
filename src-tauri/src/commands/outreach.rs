use crate::utils::rate_limiter::RateLimiter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutreachRecipient {
    pub user_id: i64,
    pub status: String,
    pub error: Option<String>,
    pub sent_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    rate_limiter: RateLimiter,
}

impl OutreachManager {
    pub fn new() -> Self {
        Self {
            queues: RwLock::new(std::collections::HashMap::new()),
            rate_limiter: RateLimiter::new(60), // 60 seconds between messages
        }
    }

    pub async fn queue_messages(
        &self,
        recipient_ids: Vec<i64>,
        template: String,
    ) -> Result<String, String> {
        let queue_id = uuid::Uuid::new_v4().to_string();

        let recipients: Vec<OutreachRecipient> = recipient_ids
            .into_iter()
            .map(|user_id| OutreachRecipient {
                user_id,
                status: "pending".to_string(),
                error: None,
                sent_at: None,
            })
            .collect();

        let queue = OutreachQueue {
            id: queue_id.clone(),
            template,
            recipients,
            status: "idle".to_string(),
            started_at: None,
            completed_at: None,
            sent_count: 0,
            failed_count: 0,
        };

        self.queues.write().await.insert(queue_id.clone(), queue);

        Ok(queue_id)
    }

    pub async fn get_status(&self, queue_id: &str) -> Option<OutreachQueue> {
        self.queues.read().await.get(queue_id).cloned()
    }

    pub async fn cancel(&self, queue_id: &str) -> Result<(), String> {
        let mut queues = self.queues.write().await;
        if let Some(queue) = queues.get_mut(queue_id) {
            queue.status = "cancelled".to_string();
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

#[tauri::command]
pub async fn queue_outreach_messages(
    manager: State<'_, Arc<OutreachManager>>,
    recipient_ids: Vec<i64>,
    template: String,
) -> Result<String, String> {
    manager.queue_messages(recipient_ids, template).await
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
