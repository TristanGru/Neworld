use std::collections::HashMap;
use std::sync::Mutex;
use rusqlite::Connection;

pub struct AppState {
    pub connections: Mutex<HashMap<String, Connection>>,
    pub ollama_base_url: String,
    pub ollama_model: Mutex<String>,
    pub ollama_embedding_model: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            ollama_model: Mutex::new(
                std::env::var("OLLAMA_DEFAULT_MODEL")
                    .unwrap_or_else(|_| "llama3".to_string())
            ),
            ollama_embedding_model: std::env::var("OLLAMA_EMBEDDING_MODEL")
                .unwrap_or_else(|_| "nomic-embed-text".to_string()),
        }
    }
}
