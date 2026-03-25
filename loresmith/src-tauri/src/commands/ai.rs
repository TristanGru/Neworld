use tauri::{State, AppHandle, Emitter};
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
pub async fn check_ollama(
    state: State<'_, AppState>,
) -> Result<OllamaStatus, LoreError> {
    match ollama::check_health(&state.ollama_base_url).await {
        Ok(models) => Ok(OllamaStatus { available: true, models }),
        Err(_) => Ok(OllamaStatus { available: false, models: vec![] }),
    }
}

#[tauri::command]
pub async fn ai_query(
    project_id: String,
    query: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    if query.trim().is_empty() {
        return Err(LoreError::InvalidInput("Query cannot be empty".to_string()));
    }

    let base_url = state.ollama_base_url.clone();
    let model = state.ollama_model.lock().unwrap().clone();
    let embedding_model = state.ollama_embedding_model.clone();

    // Embed the query
    let query_embedding = ollama::embed_text(&base_url, &embedding_model, &query).await
        .map_err(|_| LoreError::EmbeddingFailed("Query embedding failed".to_string()))?;

    // Retrieve relevant chunks
    let chunks = {
        let conns = state.connections.lock().unwrap();
        if let Some(conn) = conns.get(&project_id) {
            rag::retrieve_chunks(conn, &project_id, &query_embedding, 8)?
        } else {
            return Err(LoreError::NotANeworldProject);
        }
    };

    // Get project genre for system prompt
    let genre = {
        let conns = state.connections.lock().unwrap();
        if let Some(conn) = conns.get(&project_id) {
            conn.query_row(
                "SELECT genre FROM projects WHERE id = ?1", [&project_id],
                |row| row.get::<_, String>(0)
            ).unwrap_or_else(|_| "unknown".to_string())
        } else {
            "unknown".to_string()
        }
    };

    // Build RAG prompt
    let context = chunks.iter()
        .map(|c| format!("[{}]: {}", c.source_type, c.content))
        .collect::<Vec<_>>()
        .join("\n\n");

    let system_prompt = format!(
        "You are a knowledgeable assistant for a {} novel project. \
        Answer questions based ONLY on the provided context about the writer's world. \
        If the context doesn't contain enough information to answer, say \"I don't know\" rather than guessing. \
        Be concise and helpful.",
        genre
    );

    let full_prompt = if context.is_empty() {
        format!("{}\n\nQuestion: {}", system_prompt, query)
    } else {
        format!("{}\n\nContext from the world:\n{}\n\nQuestion: {}", system_prompt, context, query)
    };

    // Stream response
    let done_event = format!("ai_done_{}", project_id);
    let token_event = format!("ai_token_{}", project_id);

    tokio::spawn(async move {
        match ollama::stream_completion(&base_url, &model, &full_prompt, token_event.clone(), app_handle.clone()).await {
            Ok(_) => {
                let _ = app_handle.emit(&done_event, ());
            }
            Err(e) => {
                let _ = app_handle.emit(&done_event, serde_json::json!({"error": e.to_string()}));
            }
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

#[tauri::command]
pub async fn set_ollama_model(
    model: String,
    state: State<'_, AppState>,
) -> Result<(), LoreError> {
    let mut m = state.ollama_model.lock().unwrap();
    *m = model;
    Ok(())
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
                let structured_data = serde_json::to_string(&fields).unwrap_or_else(|_| "{}".to_string());

                let entity_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO entities (id, project_id, category_id, name, aliases, structured_data, notes, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, '[]', ?5, '', ?6, ?6)",
                    rusqlite::params![entity_id, project_id, category_id, name, structured_data, now],
                )?;

                imported.push(ImportedEntity {
                    category: category_name.to_string(),
                    name,
                    fields: serde_json::Value::Object(fields),
                });
            }
        }
    }

    Ok(imported)
}
