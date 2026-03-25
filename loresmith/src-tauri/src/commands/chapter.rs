use std::path::Path;
use tauri::State;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

use crate::db::schema::{Chapter, Scene, VersionSnapshot};
use crate::errors::LoreError;
use crate::state::AppState;

const MAX_SNAPSHOTS: usize = 50;

fn count_words(text: &str) -> i64 {
    text.split_whitespace().count() as i64
}

#[derive(Serialize)]
pub struct SaveChapterResult {
    pub word_count: i64,
    pub snapshot_created: bool,
}

#[tauri::command]
pub async fn create_chapter(
    project_id: String,
    title: String,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<Chapter, LoreError> {
    let title = title.trim().to_string();
    if title.is_empty() { return Err(LoreError::NameEmpty); }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let prose_file = format!("prose/{}.md", id);

    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM chapters WHERE project_id = ?1",
        [&project_id], |row| row.get(0)
    ).unwrap_or(1);

    conn.execute(
        "INSERT INTO chapters (id, project_id, title, sort_order, prose_file, word_count, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,0,?6,?7)",
        rusqlite::params![id, project_id, title, sort_order, prose_file, now, now],
    )?;

    // Create the prose file
    let prose_path = Path::new(&folder_path).join(&prose_file);
    if let Some(parent) = prose_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&prose_path, "")?;

    Ok(Chapter { id, project_id, title, sort_order, prose_file, word_count: 0, created_at: now, updated_at: now })
}

#[tauri::command]
pub async fn save_chapter(
    chapter_id: String,
    content: String,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<SaveChapterResult, LoreError> {
    let project_id = find_chapter_project(&chapter_id, &state)?;
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let prose_file: String = conn.query_row(
        "SELECT prose_file FROM chapters WHERE id = ?1",
        [&chapter_id], |row| row.get(0)
    ).map_err(|_| LoreError::EntityNotFound)?;

    let prose_path = Path::new(&folder_path).join(&prose_file);
    if let Some(parent) = prose_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Write with retry
    let mut retries = 3;
    loop {
        match std::fs::write(&prose_path, &content) {
            Ok(_) => break,
            Err(e) if retries > 0 => {
                retries -= 1;
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
            Err(e) => return Err(LoreError::IoError(e.to_string())),
        }
    }

    let word_count = count_words(&content);
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE chapters SET word_count = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![word_count, now, chapter_id],
    )?;

    // Create snapshot if content differs from last snapshot
    let last_snapshot: Option<String> = conn.query_row(
        "SELECT content FROM version_snapshots WHERE chapter_id = ?1 ORDER BY created_at DESC LIMIT 1",
        [&chapter_id], |row| row.get(0)
    ).ok();

    let snapshot_created = if last_snapshot.as_deref() != Some(&content) {
        let snap_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO version_snapshots (id, chapter_id, content, created_at) VALUES (?1,?2,?3,?4)",
            rusqlite::params![snap_id, chapter_id, content, now],
        )?;
        // Prune old snapshots if over cap
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM version_snapshots WHERE chapter_id = ?1",
            [&chapter_id], |row| row.get(0)
        ).unwrap_or(0);
        if count > MAX_SNAPSHOTS as i64 {
            conn.execute(
                "DELETE FROM version_snapshots WHERE id IN (SELECT id FROM version_snapshots WHERE chapter_id = ?1 ORDER BY created_at ASC LIMIT ?2)",
                rusqlite::params![chapter_id, count - MAX_SNAPSHOTS as i64],
            )?;
        }
        true
    } else {
        false
    };

    Ok(SaveChapterResult { word_count, snapshot_created })
}

fn find_chapter_project(chapter_id: &str, state: &State<'_, AppState>) -> Result<String, LoreError> {
    let conns = state.connections.lock().unwrap();
    for (project_id, conn) in conns.iter() {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chapters WHERE id = ?1", [chapter_id],
            |row| row.get(0)
        ).unwrap_or(0);
        if count > 0 { return Ok(project_id.clone()); }
    }
    Err(LoreError::EntityNotFound)
}

#[tauri::command]
pub async fn get_chapter_content(
    chapter_id: String,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<String, LoreError> {
    let project_id = find_chapter_project(&chapter_id, &state)?;
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let prose_file: String = conn.query_row(
        "SELECT prose_file FROM chapters WHERE id = ?1",
        [&chapter_id], |row| row.get(0)
    ).map_err(|_| LoreError::EntityNotFound)?;

    let prose_path = Path::new(&folder_path).join(&prose_file);
    if prose_path.exists() {
        Ok(std::fs::read_to_string(&prose_path)?)
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
pub async fn delete_chapter(
    chapter_id: String,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let project_id = find_chapter_project(&chapter_id, &state)?;
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let prose_file: String = conn.query_row(
        "SELECT prose_file FROM chapters WHERE id = ?1",
        [&chapter_id], |row| row.get(0)
    ).map_err(|_| LoreError::EntityNotFound)?;

    // Delete prose file
    let prose_path = Path::new(&folder_path).join(&prose_file);
    let _ = std::fs::remove_file(&prose_path);

    conn.execute("DELETE FROM chapters WHERE id = ?1", [&chapter_id])?;
    Ok(serde_json::json!({"deleted": true}))
}

#[tauri::command]
pub async fn update_chapter_title(
    chapter_id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let title = title.trim().to_string();
    if title.is_empty() { return Err(LoreError::NameEmpty); }
    let project_id = find_chapter_project(&chapter_id, &state)?;
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;
    let now = chrono::Utc::now().timestamp();
    conn.execute("UPDATE chapters SET title = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![title, now, chapter_id])?;
    Ok(serde_json::json!({"updated": true}))
}

#[tauri::command]
pub async fn reorder_chapters(
    project_id: String,
    chapter_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;
    for (i, id) in chapter_ids.iter().enumerate() {
        conn.execute("UPDATE chapters SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, id])?;
    }
    Ok(serde_json::json!({"updated": chapter_ids.len()}))
}

// Scenes

#[tauri::command]
pub async fn create_scene(
    chapter_id: String,
    project_id: String,
    title: String,
    summary: Option<String>,
    pov_entity_id: Option<String>,
    timeline_position: Option<String>,
    state: State<'_, AppState>,
) -> Result<Scene, LoreError> {
    let title = title.trim().to_string();
    if title.is_empty() { return Err(LoreError::NameEmpty); }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let id = Uuid::new_v4().to_string();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM scenes WHERE chapter_id = ?1",
        [&chapter_id], |row| row.get(0)
    ).unwrap_or(1);

    conn.execute(
        "INSERT INTO scenes (id, chapter_id, project_id, title, summary, sort_order, pov_entity_id, timeline_position) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        rusqlite::params![id, chapter_id, project_id, title, summary, sort_order, pov_entity_id, timeline_position],
    )?;

    Ok(Scene { id, chapter_id, project_id, title, summary, sort_order, pov_entity_id, timeline_position })
}

#[tauri::command]
pub async fn get_scenes(
    project_id: String,
    chapter_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Scene>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    if let Some(chap) = chapter_id {
        let mut stmt = conn.prepare(
            "SELECT id, chapter_id, project_id, title, summary, sort_order, pov_entity_id, timeline_position FROM scenes WHERE chapter_id = ?1 ORDER BY sort_order ASC"
        )?;
        let scenes = stmt.query_map([&chap], |row| {
            Ok(Scene {
                id: row.get(0)?,
                chapter_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                summary: row.get(4)?,
                sort_order: row.get(5)?,
                pov_entity_id: row.get(6)?,
                timeline_position: row.get(7)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(scenes)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, chapter_id, project_id, title, summary, sort_order, pov_entity_id, timeline_position FROM scenes WHERE project_id = ?1 ORDER BY sort_order ASC"
        )?;
        let scenes = stmt.query_map([&project_id], |row| {
            Ok(Scene {
                id: row.get(0)?,
                chapter_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                summary: row.get(4)?,
                sort_order: row.get(5)?,
                pov_entity_id: row.get(6)?,
                timeline_position: row.get(7)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(scenes)
    }
}

#[tauri::command]
pub async fn reorder_scenes(
    chapter_id: String,
    scene_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        for (i, id) in scene_ids.iter().enumerate() {
            conn.execute("UPDATE scenes SET sort_order = ?1 WHERE id = ?2 AND chapter_id = ?3",
                rusqlite::params![i as i64, id, chapter_id])?;
        }
    }
    Ok(serde_json::json!({"updated": scene_ids.len()}))
}

#[tauri::command]
pub async fn update_scene(
    id: String,
    title: Option<String>,
    summary: Option<String>,
    pov_entity_id: Option<String>,
    timeline_position: Option<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        if let Some(t) = &title {
            conn.execute("UPDATE scenes SET title = ?1 WHERE id = ?2", rusqlite::params![t, id])?;
        }
        if let Some(s) = &summary {
            conn.execute("UPDATE scenes SET summary = ?1 WHERE id = ?2", rusqlite::params![s, id])?;
        }
        if pov_entity_id.is_some() {
            conn.execute("UPDATE scenes SET pov_entity_id = ?1 WHERE id = ?2", rusqlite::params![pov_entity_id, id])?;
        }
        if timeline_position.is_some() {
            conn.execute("UPDATE scenes SET timeline_position = ?1 WHERE id = ?2", rusqlite::params![timeline_position, id])?;
        }
    }
    Ok(serde_json::json!({"updated": true}))
}

#[tauri::command]
pub async fn delete_scene(
    id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        conn.execute("DELETE FROM scenes WHERE id = ?1", [&id])?;
    }
    Ok(serde_json::json!({"deleted": true}))
}

// Version snapshots

#[tauri::command]
pub async fn get_version_snapshots(
    chapter_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chapters WHERE id = ?1", [&chapter_id], |row| row.get(0)
        ).unwrap_or(0);
        if count > 0 {
            let mut stmt = conn.prepare(
                "SELECT id, created_at, LENGTH(content) as size FROM version_snapshots WHERE chapter_id = ?1 ORDER BY created_at DESC"
            )?;
            let snaps: Vec<serde_json::Value> = stmt.query_map([&chapter_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "created_at": row.get::<_, i64>(1)?,
                    "size": row.get::<_, i64>(2)?
                }))
            })?.filter_map(|r| r.ok()).collect();
            return Ok(snaps);
        }
    }
    Ok(vec![])
}

#[tauri::command]
pub async fn restore_snapshot(
    snapshot_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        let result = conn.query_row(
            "SELECT content FROM version_snapshots WHERE id = ?1",
            [&snapshot_id], |row| row.get::<_, String>(0)
        );
        if let Ok(content) = result {
            return Ok(serde_json::json!({"content": content}));
        }
    }
    Err(LoreError::EntityNotFound)
}
