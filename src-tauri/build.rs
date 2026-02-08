const EMBED_KEYS: &[&str] = &["TELEGRAM_API_ID", "TELEGRAM_API_HASH", "OPENAI_API_KEY"];

fn load_env_from(path: &str) {
    if let Ok(contents) = std::fs::read_to_string(path) {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');
                if EMBED_KEYS.contains(&key) && !value.is_empty() {
                    println!("cargo:rustc-env={}={}", key, value);
                }
            }
        }
    }
}

fn main() {
    // Embed credentials at compile time from .env so the built app works standalone
    load_env_from(".env");
    load_env_from("../.env"); // When building from src-tauri

    tauri_build::build()
}
