use super::with_db;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactData {
    pub user_id: i64,
    pub tags: Vec<String>,
    pub notes: String,
    pub last_contact_date: Option<i64>,
}

pub fn get_contact_tags(user_id: i64) -> Result<Vec<String>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT tag FROM contact_tags WHERE user_id = ?")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let tags = stmt
            .query_map([user_id], |row| row.get(0))
            .map_err(|e| format!("Failed to query tags: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    })
}

pub fn add_contact_tag(user_id: i64, tag: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO contact_tags (user_id, tag) VALUES (?, ?)",
            rusqlite::params![user_id, tag],
        )
        .map_err(|e| format!("Failed to add tag: {}", e))?;
        Ok(())
    })
}

pub fn remove_contact_tag(user_id: i64, tag: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "DELETE FROM contact_tags WHERE user_id = ? AND tag = ?",
            rusqlite::params![user_id, tag],
        )
        .map_err(|e| format!("Failed to remove tag: {}", e))?;
        Ok(())
    })
}

pub fn get_contact_notes(user_id: i64) -> Result<String, String> {
    with_db(|conn| {
        let notes: Option<String> = conn
            .query_row(
                "SELECT notes FROM contact_notes WHERE user_id = ?",
                [user_id],
                |row| row.get(0),
            )
            .ok();
        Ok(notes.unwrap_or_default())
    })
}

pub fn update_contact_notes(user_id: i64, notes: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            r#"
            INSERT INTO contact_notes (user_id, notes, updated_at)
            VALUES (?, ?, strftime('%s', 'now'))
            ON CONFLICT(user_id) DO UPDATE SET
                notes = excluded.notes,
                updated_at = excluded.updated_at
            "#,
            rusqlite::params![user_id, notes],
        )
        .map_err(|e| format!("Failed to update notes: {}", e))?;
        Ok(())
    })
}

pub fn get_all_tags() -> Result<Vec<(String, i32)>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT tag, COUNT(*) as count FROM contact_tags GROUP BY tag ORDER BY count DESC")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let tags = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("Failed to query tags: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tags)
    })
}

pub fn get_last_contact_date(user_id: i64) -> Result<Option<i64>, String> {
    with_db(|conn| {
        let date: Option<i64> = conn
            .query_row(
                "SELECT last_message_date FROM last_contact WHERE user_id = ?",
                [user_id],
                |row| row.get(0),
            )
            .ok();
        Ok(date)
    })
}

pub fn update_last_contact_date(user_id: i64, date: i64) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            r#"
            INSERT INTO last_contact (user_id, last_message_date, updated_at)
            VALUES (?, ?, strftime('%s', 'now'))
            ON CONFLICT(user_id) DO UPDATE SET
                last_message_date = MAX(last_message_date, excluded.last_message_date),
                updated_at = excluded.updated_at
            "#,
            rusqlite::params![user_id, date],
        )
        .map_err(|e| format!("Failed to update last contact: {}", e))?;
        Ok(())
    })
}
