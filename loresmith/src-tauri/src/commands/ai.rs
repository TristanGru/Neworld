use tauri::{State, AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};

use crate::errors::LoreError;
use crate::state::AppState;
use crate::ollama;
use crate::rag;

#[derive(Serialize)]
pub struct OllamaStatus {
    pub available: bool,
    pub models: Vec<String>,
}

#[tauri::command]
pub async fn setup_models(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    let base_url = state.ollama_base_url.clone();
    let model = state.ollama_model.lock().unwrap().clone();
    let embed_model = state.ollama_embedding_model.clone();

    // Ollama may have just been installed — wait up to 60s for it to start
    let mut attempts = 0;
    let models = loop {
        match ollama::check_health(&base_url).await {
            Ok(m) => break m,
            Err(_) => {
                attempts += 1;
                if attempts >= 12 {
                    return Err(LoreError::OllamaUnreachable);
                }
                let _ = app_handle.emit("setup_progress", serde_json::json!({
                    "model": "", "status": "waiting_for_ollama", "percent": 0.0
                }));
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    };

    let main_needed = !models.iter().any(|m| m.starts_with(&model));
    let embed_needed = !models.iter().any(|m| m.starts_with(&embed_model));

    if main_needed {
        ollama::pull_model(&base_url, &model, &app_handle).await?;
    }
    if embed_needed {
        ollama::pull_model(&base_url, &embed_model, &app_handle).await?;
    }

    let _ = app_handle.emit("setup_complete", ());
    Ok(())
}

#[tauri::command]
pub async fn check_ollama(
    state: State<'_, AppState>,
) -> Result<OllamaStatus, LoreError> {
    match ollama::check_health(&state.ollama_base_url).await {
        Ok(models) => Ok(OllamaStatus { available: true, models }),
        Err(_) => Ok(OllamaStatus { available: false, models: vec![] }),
    }
}

#[derive(Deserialize)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn ai_query(
    project_id: String,
    query: String,
    history: Vec<HistoryMessage>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    if query.trim().is_empty() {
        return Err(LoreError::InvalidInput("Query cannot be empty".to_string()));
    }

    let base_url = state.ollama_base_url.clone();
    let model = state.ollama_model.lock().unwrap().clone();
    let embedding_model = state.ollama_embedding_model.clone();

    // Check if there is anything indexed before paying the cost of embedding
    let has_chunks = {
        let conns = state.connections.lock().unwrap();
        if let Some(conn) = conns.get(&project_id) {
            conn.query_row(
                "SELECT COUNT(*) FROM embedding_documents WHERE project_id = ?1 AND embedding IS NOT NULL",
                [&project_id],
                |row| row.get::<_, i64>(0),
            ).unwrap_or(0) > 0
        } else {
            return Err(LoreError::NotANeworldProject);
        }
    };

    // Only embed + retrieve when there is indexed content to search
    let context = if has_chunks {
        let query_embedding = ollama::embed_text(&base_url, &embedding_model, &query).await
            .unwrap_or_default();
        if !query_embedding.is_empty() {
            let conns = state.connections.lock().unwrap();
            if let Some(conn) = conns.get(&project_id) {
                rag::retrieve_chunks(conn, &project_id, &query_embedding, 8)
                    .unwrap_or_default()
                    .iter()
                    .map(|c| format!("[{}]: {}", c.source_type, c.content))
                    .collect::<Vec<_>>()
                    .join("\n\n")
            } else { String::new() }
        } else { String::new() }
    } else {
        String::new()
    };

    // Get project genre
    let genre = {
        let conns = state.connections.lock().unwrap();
        if let Some(conn) = conns.get(&project_id) {
            conn.query_row(
                "SELECT genre FROM projects WHERE id = ?1", [&project_id],
                |row| row.get::<_, String>(0)
            ).unwrap_or_else(|_| "unknown".to_string())
        } else { "unknown".to_string() }
    };

    let persona = match genre.as_str() {
        "fantasy"     => "the Sage",
        "sci-fi"      => "the Oracle",
        "horror"      => "the Chronicler",
        "romance"     => "the Muse",
        "mystery"     => "the Detective",
        "historical"  => "the Archivist",
        "contemporary"=> "the Confidant",
        _             => "the Lorekeeper",
    };

    // Build messages for chat API — system + history + current query with any RAG context
    let system_content = if context.is_empty() {
        format!(
            "You are {}, a dedicated expert on this writer's world. \
            You live and breathe the details of their {} story. \
            Be concise, insightful, and deeply supportive of their creative vision.",
            persona, genre
        )
    } else {
        format!(
            "You are {}, a dedicated expert on this writer's world. \
            You have deep knowledge of every character, location, and event in their {} story. \
            Answer questions using the world knowledge below. Be concise and insightful.\
            \n\nWorld knowledge:\n{}",
            persona, genre, context
        )
    };

    let mut messages: Vec<ollama::ChatMessage> = vec![
        ollama::ChatMessage { role: "system".to_string(), content: system_content },
    ];

    for h in history {
        messages.push(ollama::ChatMessage { role: h.role, content: h.content });
    }

    messages.push(ollama::ChatMessage { role: "user".to_string(), content: query });

    let done_event = format!("ai_done_{}", project_id);
    let token_event = format!("ai_token_{}", project_id);

    tokio::spawn(async move {
        match ollama::stream_chat(&base_url, &model, messages, token_event.clone(), app_handle.clone()).await {
            Ok(_) => { let _ = app_handle.emit(&done_event, ()); }
            Err(e) => { let _ = app_handle.emit(&done_event, serde_json::json!({"error": e.to_string()})); }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn get_ai_suggestions(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let mut suggestions = Vec::new();

    // Find characters with long appearance gaps
    // For each chapter, find entities mentioned in early chapters but not recent ones
    // This is a simplified heuristic version
    let chapters: Vec<(String, String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, title, sort_order FROM chapters WHERE project_id = ?1 ORDER BY sort_order ASC"
        )?;
        let rows: Vec<_> = stmt.query_map([&project_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
        })?.collect();
        rows.into_iter().filter_map(|r| r.ok()).collect()
    };

    if chapters.len() > 3 {
        suggestions.push(serde_json::json!({
            "type": "connection_hint",
            "message": format!(
                "Your project has {} chapters. Consider reviewing character appearances for consistency.",
                chapters.len()
            )
        }));
    }

    // Get conflict count
    let conflicts = crate::conflict_detection::detect_conflicts(conn, &project_id)?;
    if !conflicts.is_empty() {
        suggestions.push(serde_json::json!({
            "type": "conflict_warning",
            "message": format!("{} potential conflict(s) detected. Check the Conflicts panel.", conflicts.len()),
            "count": conflicts.len()
        }));
    }

    Ok(suggestions)
}

/// Path to the persistent settings file in app data directory
fn settings_path(app_handle: &AppHandle) -> std::path::PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("neworld_settings.json")
}

#[tauri::command]
pub async fn set_ollama_model(
    model: String,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    let mut m = state.ollama_model.lock().unwrap();
    *m = model;
    Ok(())
}

#[derive(Serialize)]
pub struct AiSettings {
    pub current_model: String,
    pub available_models: Vec<String>,
}

#[tauri::command]
pub async fn get_ai_settings(
    state: State<'_, AppState>,
) -> Result<AiSettings, LoreError> {
    let current_model = state.ollama_model.lock().unwrap().clone();
    let embed_model = state.ollama_embedding_model.clone();

    // Fetch all installed models and exclude the embedding model (not useful for chat)
    let available_models: Vec<String> = ollama::check_health(&state.ollama_base_url)
        .await
        .unwrap_or_default()
        .into_iter()
        .filter(|m| !m.starts_with(&embed_model))
        .collect();

    // If the saved model name doesn't exactly match any installed model,
    // try to find one that starts with the saved name (e.g. "llama3" -> "llama3:latest")
    // and update the state so subsequent queries use the real name.
    let resolved = if available_models.iter().any(|m| m == &current_model) {
        current_model
    } else {
        let fallback = available_models.iter()
            .find(|m| m.starts_with(&current_model) || current_model.starts_with(m.as_str()))
            .cloned()
            .unwrap_or(current_model);
        let mut m = state.ollama_model.lock().unwrap();
        *m = fallback.clone();
        fallback
    };

    Ok(AiSettings { current_model: resolved, available_models })
}

#[tauri::command]
pub async fn save_ai_model(
    model: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    // Update in-memory state
    {
        let mut m = state.ollama_model.lock().unwrap();
        *m = model.clone();
    }

    // Persist to settings file
    let path = settings_path(&app_handle);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let settings = serde_json::json!({ "ollama_model": model });
    std::fs::write(&path, serde_json::to_string_pretty(&settings).unwrap_or_default())
        .map_err(|e| LoreError::IoError(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn pull_model_direct(
    model: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    ollama::pull_model(&state.ollama_base_url, &model, &app_handle).await
}

/// Load persisted settings into AppState — called from the Tauri setup hook.
pub fn load_persisted_settings(app: &tauri::App) {
    let path = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("neworld_settings.json");

    if let Ok(contents) = std::fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&contents) {
            if let Some(model) = settings.get("ollama_model").and_then(|v| v.as_str()) {
                let state = app.state::<crate::state::AppState>();
                let mut m = state.ollama_model.lock().unwrap();
                *m = model.to_string();
            }
        }
    }
}

#[tauri::command]
pub async fn detect_entities_in_prose(
    project_id: String,
    prose: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::entity_detection::EntityMatch>, LoreError> {
    if prose.len() > 100_000 {
        return Err(LoreError::InvalidInput("Prose too long (max 100,000 chars)".to_string()));
    }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    // Load all entities for this project
    let entities: Vec<(String, String, Vec<String>)> = {
        let mut stmt = conn.prepare(
            "SELECT id, name, aliases FROM entities WHERE project_id = ?1"
        )?;
        let rows: Vec<_> = stmt.query_map([&project_id], |row| {
            let aliases_str: String = row.get(2)?;
            let aliases: Vec<String> = serde_json::from_str(&aliases_str).unwrap_or_default();
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, aliases))
        })?.collect();
        rows.into_iter().filter_map(|r| r.ok()).collect()
    };

    let detector = crate::entity_detection::EntityDetector::new(entities);
    let matches = detector.detect(&prose);

    Ok(matches)
}

#[derive(Serialize)]
pub struct ImportedEntity {
    pub category: String,
    pub name: String,
    pub fields: serde_json::Value,
    pub action: String, // "created" or "updated"
}

#[tauri::command]
pub async fn analyze_and_import(
    project_id: String,
    writing: String,
    notes: String,
    state: State<'_, AppState>,
) -> Result<Vec<ImportedEntity>, LoreError> {
    let model = state.ollama_model.lock().unwrap().clone();

    let combined_text = format!(
        "=== WRITING ===\n{}\n\n=== NOTES / DOCUMENTATION ===\n{}",
        writing.chars().take(8000).collect::<String>(),
        notes.chars().take(4000).collect::<String>()
    );

    let prompt = format!(
        r#"You are a world-building assistant. Analyse the text below and extract all named entities.

Return ONLY a valid JSON object — no explanation, no markdown, no code fences. Use this exact structure:
{{
  "characters": [
    {{"name": "string", "age": "string", "occupation": "string", "faction": "string", "status": "alive|deceased|unknown", "motivation": "string"}}
  ],
  "locations": [
    {{"name": "string", "type": "string", "region": "string", "climate": "string", "significance": "string"}}
  ],
  "magic_systems": [
    {{"name": "string", "type": "string", "source": "string", "rules": "string", "limitations": "string", "cost": "string", "practitioners": "string"}}
  ],
  "lore": [
    {{"name": "string", "type": "string", "era": "string", "origin": "string", "significance": "string"}}
  ],
  "factions": [
    {{"name": "string", "type": "string", "leader": "string", "goals": "string", "allies": "string", "enemies": "string"}}
  ],
  "items": [
    {{"name": "string", "type": "string", "origin": "string", "powers": "string", "current_owner": "string"}}
  ]
}}

Only include entities that are clearly named in the text. Leave unknown fields as empty strings. Do not invent details not present in the text.

TEXT TO ANALYSE:
{}
"#,
        combined_text
    );

    let raw = ollama::generate_completion(&state.ollama_base_url, &model, &prompt).await?;

    // Strip markdown code fences if model adds them anyway
    let json_str = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| LoreError::InvalidInput(format!("AI returned invalid JSON: {}", e)))?;

    // Get category map from DB
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let category_map: std::collections::HashMap<String, String> = {
        let mut stmt = conn.prepare("SELECT id, name FROM entity_categories WHERE project_id = ?1")?;
        let rows: Vec<_> = stmt.query_map([&project_id], |row| {
            Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?))
        })?.collect();
        rows.into_iter().filter_map(|r| r.ok()).collect()
    };

    let mut imported: Vec<ImportedEntity> = Vec::new();
    let now = chrono::Utc::now().timestamp();

    let sections: &[(&str, &str)] = &[
        ("characters", "Characters"),
        ("locations", "Locations"),
        ("magic_systems", "Magic Systems"),
        ("lore", "Lore"),
        ("factions", "Factions & Organizations"),
        ("items", "Items & Artifacts"),
    ];

    for (json_key, category_name) in sections {
        let category_id = match category_map.get(*category_name) {
            Some(id) => id.clone(),
            None => continue,
        };

        if let Some(arr) = parsed.get(json_key).and_then(|v| v.as_array()) {
            for item in arr {
                let name = match item.get("name").and_then(|n| n.as_str()) {
                    Some(n) if !n.trim().is_empty() => n.trim().to_string(),
                    _ => continue,
                };

                // Build structured_data from all fields except "name"
                let mut fields = serde_json::Map::new();
                if let Some(obj) = item.as_object() {
                    for (k, v) in obj {
                        if k != "name" {
                            if let Some(s) = v.as_str() {
                                if !s.trim().is_empty() {
                                    fields.insert(k.clone(), serde_json::Value::String(s.to_string()));
                                }
                            }
                        }
                    }
                }
                // Check if an entity with the same name already exists in this category
                let existing: Option<(String, String)> = conn.query_row(
                    "SELECT id, structured_data FROM entities \
                     WHERE project_id = ?1 AND category_id = ?2 AND LOWER(name) = LOWER(?3)",
                    rusqlite::params![project_id, category_id, name],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                ).ok();

                let (final_fields, action) = if let Some((existing_id, existing_sd)) = existing {
                    // Merge: start from existing data, overlay non-empty new fields
                    let mut merged: serde_json::Map<String, serde_json::Value> =
                        serde_json::from_str(&existing_sd).unwrap_or_default();
                    for (k, v) in &fields {
                        merged.insert(k.clone(), v.clone());
                    }
                    let merged_sd = serde_json::to_string(&merged).unwrap_or_else(|_| "{}".to_string());
                    conn.execute(
                        "UPDATE entities SET structured_data = ?1, updated_at = ?2 WHERE id = ?3",
                        rusqlite::params![merged_sd, now, existing_id],
                    )?;
                    (merged, "updated".to_string())
                } else {
                    // Insert new entity
                    let structured_data = serde_json::to_string(&fields).unwrap_or_else(|_| "{}".to_string());
                    let entity_id = uuid::Uuid::new_v4().to_string();
                    conn.execute(
                        "INSERT INTO entities (id, project_id, category_id, name, aliases, structured_data, notes, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, '[]', ?5, '', ?6, ?6)",
                        rusqlite::params![entity_id, project_id, category_id, name, structured_data, now],
                    )?;
                    (fields, "created".to_string())
                };

                imported.push(ImportedEntity {
                    category: category_name.to_string(),
                    name,
                    fields: serde_json::Value::Object(final_fields),
                    action,
                });
            }
        }
    }

    Ok(imported)
}
