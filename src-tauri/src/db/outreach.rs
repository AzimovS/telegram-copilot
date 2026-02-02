use rusqlite::{params, Connection, OptionalExtension};

use crate::commands::outreach::{OutreachQueue, OutreachRecipient};

/// Save a new outreach queue to the database
pub fn save_queue(conn: &Connection, queue: &OutreachQueue) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO outreach_queue (id, template, status, created_at, started_at, completed_at)
        VALUES (?1, ?2, ?3, strftime('%s', 'now'), ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at
        "#,
        params![
            queue.id,
            queue.template,
            queue.status,
            queue.started_at,
            queue.completed_at
        ],
    )
    .map_err(|e| format!("Failed to save queue: {}", e))?;

    // Save recipients
    for recipient in &queue.recipients {
        save_recipient(conn, &queue.id, recipient)?;
    }

    Ok(())
}

/// Save or update a single recipient
pub fn save_recipient(
    conn: &Connection,
    queue_id: &str,
    recipient: &OutreachRecipient,
) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO outreach_recipients (queue_id, user_id, status, error, sent_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(queue_id, user_id) DO UPDATE SET
            status = excluded.status,
            error = excluded.error,
            sent_at = excluded.sent_at
        "#,
        params![
            queue_id,
            recipient.user_id,
            recipient.status,
            recipient.error,
            recipient.sent_at
        ],
    )
    .map_err(|e| format!("Failed to save recipient: {}", e))?;

    Ok(())
}

/// Update queue status
pub fn update_queue_status(
    conn: &Connection,
    queue_id: &str,
    status: &str,
    completed_at: Option<i64>,
) -> Result<(), String> {
    conn.execute(
        r#"
        UPDATE outreach_queue
        SET status = ?1, completed_at = ?2
        WHERE id = ?3
        "#,
        params![status, completed_at, queue_id],
    )
    .map_err(|e| format!("Failed to update queue status: {}", e))?;

    Ok(())
}

/// Update recipient status
pub fn update_recipient_status(
    conn: &Connection,
    queue_id: &str,
    user_id: i64,
    status: &str,
    error: Option<String>,
    sent_at: Option<i64>,
) -> Result<(), String> {
    conn.execute(
        r#"
        UPDATE outreach_recipients
        SET status = ?1, error = ?2, sent_at = ?3
        WHERE queue_id = ?4 AND user_id = ?5
        "#,
        params![status, error, sent_at, queue_id, user_id],
    )
    .map_err(|e| format!("Failed to update recipient status: {}", e))?;

    Ok(())
}

/// Load a queue by ID
pub fn load_queue(conn: &Connection, queue_id: &str) -> Result<Option<OutreachQueue>, String> {
    let queue = conn
        .query_row(
            r#"
            SELECT id, template, status, started_at, completed_at
            FROM outreach_queue
            WHERE id = ?1
            "#,
            params![queue_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to load queue: {}", e))?;

    match queue {
        Some((id, template, status, started_at, completed_at)) => {
            let recipients = load_recipients(conn, &id)?;
            let sent_count = recipients.iter().filter(|r| r.status == "sent").count() as i32;
            let failed_count = recipients.iter().filter(|r| r.status == "failed").count() as i32;

            Ok(Some(OutreachQueue {
                id,
                template,
                recipients,
                status,
                started_at,
                completed_at,
                sent_count,
                failed_count,
            }))
        }
        None => Ok(None),
    }
}

/// Load recipients for a queue
pub fn load_recipients(conn: &Connection, queue_id: &str) -> Result<Vec<OutreachRecipient>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT user_id, status, error, sent_at
            FROM outreach_recipients
            WHERE queue_id = ?1
            ORDER BY id ASC
            "#,
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map(params![queue_id], |row| {
            Ok(OutreachRecipient {
                user_id: row.get(0)?,
                first_name: String::new(), // Not stored in DB, will be fetched from contacts
                last_name: String::new(),
                status: row.get(1)?,
                error: row.get(2)?,
                sent_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query recipients: {}", e))?;

    let mut recipients = Vec::new();
    for row in rows {
        recipients.push(row.map_err(|e| format!("Failed to read recipient row: {}", e))?);
    }

    Ok(recipients)
}

/// Load all incomplete (running/paused) queues
pub fn load_incomplete_queues(conn: &Connection) -> Result<Vec<OutreachQueue>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, template, status, started_at, completed_at
            FROM outreach_queue
            WHERE status IN ('running', 'paused', 'pending')
            ORDER BY created_at ASC
            "#,
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
            ))
        })
        .map_err(|e| format!("Failed to query queues: {}", e))?;

    let mut queues = Vec::new();
    for row in rows {
        let (id, template, status, started_at, completed_at) =
            row.map_err(|e| format!("Failed to read queue row: {}", e))?;

        let recipients = load_recipients(conn, &id)?;
        let sent_count = recipients.iter().filter(|r| r.status == "sent").count() as i32;
        let failed_count = recipients.iter().filter(|r| r.status == "failed").count() as i32;

        queues.push(OutreachQueue {
            id,
            template,
            recipients,
            status,
            started_at,
            completed_at,
            sent_count,
            failed_count,
        });
    }

    Ok(queues)
}

/// Delete a queue and its recipients.
/// TODO: Expose as a Tauri command for cleaning up old/completed queues.
#[allow(dead_code)]
pub fn delete_queue(conn: &Connection, queue_id: &str) -> Result<(), String> {
    // Recipients are deleted via CASCADE
    conn.execute(
        "DELETE FROM outreach_queue WHERE id = ?1",
        params![queue_id],
    )
    .map_err(|e| format!("Failed to delete queue: {}", e))?;

    Ok(())
}
