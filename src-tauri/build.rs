fn main() {
    // Embed OPENAI_API_KEY at build time (same pattern as Telegram credentials)
    // Try to load from .env file first
    if let Ok(contents) = std::fs::read_to_string(".env") {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');
                if key == "OPENAI_API_KEY" && !value.is_empty() {
                    println!("cargo:rustc-env={}={}", key, value);
                }
            }
        }
    }

    // Also check parent directory .env (for when building from src-tauri)
    if let Ok(contents) = std::fs::read_to_string("../.env") {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');
                if key == "OPENAI_API_KEY" && !value.is_empty() {
                    println!("cargo:rustc-env={}={}", key, value);
                }
            }
        }
    }

    tauri_build::build()
}
