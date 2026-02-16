use crate::ai::client::LLMConfig;
use crate::db::with_db;

const LLM_CONFIG_KEY: &str = "llm_config";

pub fn save_llm_config(config: &LLMConfig) -> Result<(), String> {
    let json = serde_json::to_string(config)
        .map_err(|e| format!("Failed to serialize LLM config: {}", e))?;

    with_db(|conn| {
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = strftime('%s', 'now')",
            rusqlite::params![LLM_CONFIG_KEY, json],
        )
        .map_err(|e| format!("Failed to save LLM config: {}", e))?;
        Ok(())
    })
}

pub fn load_llm_config() -> Result<Option<LLMConfig>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let result = stmt
            .query_row(rusqlite::params![LLM_CONFIG_KEY], |row| {
                row.get::<_, String>(0)
            })
            .ok();

        match result {
            Some(json) => {
                let config: LLMConfig = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to parse saved LLM config: {}", e))?;
                Ok(Some(config))
            }
            None => Ok(None),
        }
    })
}
