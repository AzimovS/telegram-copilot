pub mod schema;
pub mod contacts;
pub mod scopes;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;

pub static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn init_db(app_dir: PathBuf) -> Result<(), String> {
    let db_path = app_dir.join("telegram_copilot.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    schema::create_tables(&conn)?;

    *DB.lock().unwrap() = Some(conn);

    log::info!("Database initialized at {:?}", db_path);
    Ok(())
}

pub fn with_db<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let guard = DB.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    f(conn)
}
