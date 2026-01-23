use rusqlite::Connection;

pub fn create_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        -- Contact tags
        CREATE TABLE IF NOT EXISTS contact_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tag TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(user_id, tag)
        );

        CREATE INDEX IF NOT EXISTS idx_contact_tags_user_id ON contact_tags(user_id);
        CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag);

        -- Contact notes
        CREATE TABLE IF NOT EXISTS contact_notes (
            user_id INTEGER PRIMARY KEY,
            notes TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Scope profiles
        CREATE TABLE IF NOT EXISTS scope_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            config TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Outreach queue
        CREATE TABLE IF NOT EXISTS outreach_queue (
            id TEXT PRIMARY KEY,
            template TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            started_at INTEGER,
            completed_at INTEGER
        );

        -- Outreach recipients
        CREATE TABLE IF NOT EXISTS outreach_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queue_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            error TEXT,
            sent_at INTEGER,
            FOREIGN KEY (queue_id) REFERENCES outreach_queue(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_outreach_recipients_queue_id ON outreach_recipients(queue_id);

        -- Last contact tracking
        CREATE TABLE IF NOT EXISTS last_contact (
            user_id INTEGER PRIMARY KEY,
            last_message_date INTEGER NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
        "#,
    )
    .map_err(|e| format!("Failed to create tables: {}", e))?;

    Ok(())
}
