use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::errors::LoreError;

#[derive(Clone, Serialize)]
pub struct SetupProgress {
    pub model: String,
    pub status: String,
    pub percent: f32,
}

#[derive(Serialize)]
struct PullRequest {
    name: String,
}

#[derive(Deserialize)]
struct PullChunk {
    status: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
}

pub async fn pull_model(
    base_url: &str,
    model: &str,
    app_handle: &AppHandle,
) -> Result<(), LoreError> {
    use futures_util::StreamExt;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(7200))
        .build()
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let url = format!("{}/api/pull", base_url);
    let req = PullRequest { name: model.to_string() };

    let resp = client.post(&url).json(&req).send().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| LoreError::IoError(e.to_string()))?;
        let text = String::from_utf8_lossy(&bytes);

        for line in text.lines() {
            if line.trim().is_empty() { continue; }
            if let Ok(data) = serde_json::from_str::<PullChunk>(line) {
                let status = data.status.unwrap_or_default();
                let percent = match (data.total, data.completed) {
                    (Some(total), Some(completed)) if total > 0 => {
                        (completed as f32 / total as f32) * 100.0
                    }
                    _ => 0.0,
                };

                let _ = app_handle.emit("setup_progress", SetupProgress {
                    model: model.to_string(),
                    status: status.clone(),
                    percent,
                });

                if status == "success" {
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}

#[derive(Serialize)]
struct GenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct GenerateChunk {
    response: Option<String>,
    done: Option<bool>,
}

#[derive(Serialize)]
struct EmbedRequest {
    model: String,
    prompt: String,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Vec<f32>,
}

#[derive(Deserialize)]
struct ModelsResponse {
    models: Vec<ModelInfo>,
}

#[derive(Deserialize)]
struct ModelInfo {
    name: String,
}

pub async fn check_health(base_url: &str) -> Result<Vec<String>, LoreError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let url = format!("{}/api/tags", base_url);
    let resp = client.get(&url).send().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let data: ModelsResponse = resp.json().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    Ok(data.models.into_iter().map(|m| m.name).collect())
}

pub async fn embed_text(base_url: &str, model: &str, text: &str) -> Result<Vec<f32>, LoreError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| LoreError::EmbeddingFailed(e.to_string()))?;

    let url = format!("{}/api/embeddings", base_url);
    let req = EmbedRequest {
        model: model.to_string(),
        prompt: text.to_string(),
    };

    let resp = client.post(&url).json(&req).send().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let data: EmbedResponse = resp.json().await
        .map_err(|e| LoreError::EmbeddingFailed(e.to_string()))?;

    Ok(data.embedding)
}

pub async fn generate_completion(
    base_url: &str,
    model: &str,
    prompt: &str,
) -> Result<String, LoreError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let url = format!("{}/api/generate", base_url);
    let req = GenerateRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: false,
    };

    let resp = client.post(&url).json(&req).send().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    #[derive(Deserialize)]
    struct FullResponse { response: String }

    let data: FullResponse = resp.json().await
        .map_err(|e| LoreError::IoError(e.to_string()))?;

    Ok(data.response)
}

pub async fn stream_completion(
    base_url: &str,
    model: &str,
    prompt: &str,
    token_event: String,
    app_handle: AppHandle,
) -> Result<(), LoreError> {
    use futures_util::StreamExt;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let url = format!("{}/api/generate", base_url);
    let req = GenerateRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: true,
    };

    let resp = client.post(&url).json(&req).send().await
        .map_err(|_| LoreError::OllamaUnreachable)?;

    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| LoreError::IoError(e.to_string()))?;
        let text = String::from_utf8_lossy(&bytes);

        for line in text.lines() {
            if line.trim().is_empty() { continue; }
            if let Ok(data) = serde_json::from_str::<GenerateChunk>(line) {
                if let Some(token) = data.response {
                    let _ = app_handle.emit(&token_event, serde_json::json!({"token": token}));
                }
                if data.done.unwrap_or(false) {
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}
