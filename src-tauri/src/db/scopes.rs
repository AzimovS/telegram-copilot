use super::with_db;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeProfile {
    pub id: String,
    pub name: String,
    pub config: ScopeConfig,
    pub is_default: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeConfig {
    pub folder_ids: Vec<i32>,
    pub chat_types: Vec<String>,
    pub excluded_chat_ids: Vec<i64>,
    pub included_chat_ids: Vec<i64>,
}

pub fn save_scope(profile: &ScopeProfile) -> Result<(), String> {
    with_db(|conn| {
        let config_json =
            serde_json::to_string(&profile.config).map_err(|e| format!("Failed to serialize config: {}", e))?;

        conn.execute(
            r#"
            INSERT INTO scope_profiles (id, name, config, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                config = excluded.config,
                is_default = excluded.is_default,
                updated_at = excluded.updated_at
            "#,
            rusqlite::params![
                profile.id,
                profile.name,
                config_json,
                profile.is_default as i32,
                profile.created_at,
                profile.updated_at
            ],
        )
        .map_err(|e| format!("Failed to save scope: {}", e))?;
        Ok(())
    })
}

pub fn load_scope(name: &str) -> Result<Option<ScopeProfile>, String> {
    with_db(|conn| {
        let result = conn.query_row(
            "SELECT id, name, config, is_default, created_at, updated_at FROM scope_profiles WHERE name = ?",
            [name],
            |row| {
                let config_json: String = row.get(2)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    config_json,
                    row.get::<_, i32>(3)? != 0,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            },
        );

        match result {
            Ok((id, name, config_json, is_default, created_at, updated_at)) => {
                let config: ScopeConfig = serde_json::from_str(&config_json)
                    .map_err(|e| format!("Failed to parse config: {}", e))?;
                Ok(Some(ScopeProfile {
                    id,
                    name,
                    config,
                    is_default,
                    created_at,
                    updated_at,
                }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to load scope: {}", e)),
        }
    })
}

pub fn list_scopes() -> Result<Vec<String>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT name FROM scope_profiles ORDER BY name")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let names = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query scopes: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(names)
    })
}

pub fn delete_scope(name: &str) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM scope_profiles WHERE name = ?", [name])
            .map_err(|e| format!("Failed to delete scope: {}", e))?;
        Ok(())
    })
}
