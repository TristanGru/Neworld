use tauri::State;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

use crate::db::schema::{Entity, EntityCategory, Relationship};
use crate::errors::LoreError;
use crate::state::AppState;

#[tauri::command]
pub async fn create_entity(
    project_id: String,
    category_id: String,
    name: String,
    aliases: Vec<String>,
    structured_data: serde_json::Value,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> Result<Entity, LoreError> {
    let name = name.trim().to_string();
    if name.is_empty() { return Err(LoreError::NameEmpty); }
    if name.len() > 200 { return Err(LoreError::NameTooLong); }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    // Validate category exists in this project
    let cat_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM entity_categories WHERE id = ?1 AND project_id = ?2",
        rusqlite::params![category_id, project_id],
        |row| row.get::<_, i64>(0),
    ).map(|c| c > 0).unwrap_or(false);
    if !cat_exists { return Err(LoreError::CategoryNotFound); }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let aliases_str = serde_json::to_string(&aliases)?;
    let data_str = serde_json::to_string(&structured_data)?;

    conn.execute(
        "INSERT INTO entities (id, project_id, category_id, name, aliases, structured_data, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        rusqlite::params![id, project_id, category_id, name, aliases_str, data_str, notes, now, now],
    )?;

    Ok(Entity { id, project_id, category_id, name, aliases, structured_data, notes, created_at: now, updated_at: now })
}

#[tauri::command]
pub async fn update_entity(
    id: String,
    name: Option<String>,
    aliases: Option<Vec<String>>,
    structured_data: Option<serde_json::Value>,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> Result<Entity, LoreError> {
    // First find the entity to get project_id
    let project_id = find_entity_project(&id, &state)?;

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let now = chrono::Utc::now().timestamp();

    if let Some(ref n) = name {
        let n = n.trim();
        if n.is_empty() { return Err(LoreError::NameEmpty); }
        if n.len() > 200 { return Err(LoreError::NameTooLong); }
        conn.execute("UPDATE entities SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![n, now, id])?;
    }
    if let Some(ref a) = aliases {
        let s = serde_json::to_string(a)?;
        conn.execute("UPDATE entities SET aliases = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![s, now, id])?;
    }
    if let Some(ref sd) = structured_data {
        let s = serde_json::to_string(sd)?;
        conn.execute("UPDATE entities SET structured_data = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![s, now, id])?;
    }
    if notes.is_some() {
        conn.execute("UPDATE entities SET notes = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![notes, now, id])?;
    }

    get_entity_by_id(conn, &id)
}

fn find_entity_project(entity_id: &str, state: &State<'_, AppState>) -> Result<String, LoreError> {
    let conns = state.connections.lock().unwrap();
    for (project_id, conn) in conns.iter() {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM entities WHERE id = ?1", [entity_id],
            |row| row.get(0),
        ).unwrap_or(0);
        if count > 0 {
            return Ok(project_id.clone());
        }
    }
    Err(LoreError::EntityNotFound)
}

fn get_entity_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Entity, LoreError> {
    conn.query_row(
        "SELECT id, project_id, category_id, name, aliases, structured_data, notes, created_at, updated_at FROM entities WHERE id = ?1",
        [id],
        |row| {
            let aliases_str: String = row.get(4)?;
            let data_str: String = row.get(5)?;
            Ok(Entity {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category_id: row.get(2)?,
                name: row.get(3)?,
                aliases: serde_json::from_str(&aliases_str).unwrap_or_default(),
                structured_data: serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Object(Default::default())),
                notes: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    ).map_err(|_| LoreError::EntityNotFound)
}

#[tauri::command]
pub async fn delete_entity(
    id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let project_id = find_entity_project(&id, &state)?;
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;
    conn.execute("DELETE FROM relationships WHERE from_entity_id = ?1 OR to_entity_id = ?1", [&id])?;
    conn.execute("DELETE FROM embedding_documents WHERE source_type = 'entity' AND source_id = ?1", [&id])?;
    conn.execute("DELETE FROM entities WHERE id = ?1", [&id])?;
    Ok(serde_json::json!({"deleted": true}))
}

#[tauri::command]
pub async fn get_entities(
    project_id: String,
    category_id: Option<String>,
    search: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Entity>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let mut query = "SELECT id, project_id, category_id, name, aliases, structured_data, notes, created_at, updated_at FROM entities WHERE project_id = ?1".to_string();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(project_id.clone())];

    if let Some(cat) = &category_id {
        query.push_str(" AND category_id = ?2");
        params.push(Box::new(cat.clone()));
    }
    if let Some(s) = &search {
        let idx = params.len() + 1;
        query.push_str(&format!(" AND (name LIKE ?{0} OR aliases LIKE ?{0})", idx));
        params.push(Box::new(format!("%{}%", s)));
    }
    query.push_str(" ORDER BY name ASC");

    let mut stmt = conn.prepare(&query)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let entities = stmt.query_map(params_refs.as_slice(), |row| {
        let aliases_str: String = row.get(4)?;
        let data_str: String = row.get(5)?;
        Ok(Entity {
            id: row.get(0)?,
            project_id: row.get(1)?,
            category_id: row.get(2)?,
            name: row.get(3)?,
            aliases: serde_json::from_str(&aliases_str).unwrap_or_default(),
            structured_data: serde_json::from_str(&data_str).unwrap_or_default(),
            notes: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(entities)
}

#[tauri::command]
pub async fn get_entity_categories(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<EntityCategory>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, icon, is_builtin, field_schema, sort_order FROM entity_categories WHERE project_id = ?1 ORDER BY sort_order ASC"
    )?;
    let cats = stmt.query_map([&project_id], |row| {
        let schema_str: String = row.get(5)?;
        Ok(EntityCategory {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            icon: row.get(3)?,
            is_builtin: row.get::<_, i64>(4)? == 1,
            field_schema: serde_json::from_str(&schema_str).unwrap_or(serde_json::Value::Array(vec![])),
            sort_order: row.get(6)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(cats)
}

#[tauri::command]
pub async fn create_custom_category(
    project_id: String,
    name: String,
    icon: Option<String>,
    field_schema: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<EntityCategory, LoreError> {
    let name = name.trim().to_string();
    if name.is_empty() { return Err(LoreError::NameEmpty); }
    if name.len() > 100 { return Err(LoreError::NameTooLong); }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let id = Uuid::new_v4().to_string();
    let schema_str = serde_json::to_string(&field_schema)?;
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM entity_categories WHERE project_id = ?1",
        [&project_id], |row| row.get(0)
    ).unwrap_or(100);

    conn.execute(
        "INSERT INTO entity_categories (id, project_id, name, icon, is_builtin, field_schema, sort_order) VALUES (?1,?2,?3,?4,0,?5,?6)",
        rusqlite::params![id, project_id, name, icon, schema_str, sort_order],
    )?;

    Ok(EntityCategory {
        id,
        project_id,
        name,
        icon,
        is_builtin: false,
        field_schema,
        sort_order,
    })
}

#[tauri::command]
pub async fn create_relationship(
    project_id: String,
    from_entity_id: String,
    to_entity_id: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<Relationship, LoreError> {
    if from_entity_id == to_entity_id {
        return Err(LoreError::SelfRelationship);
    }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO relationships (id, project_id, from_entity_id, to_entity_id, label, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        rusqlite::params![id, project_id, from_entity_id, to_entity_id, label, now],
    )?;

    Ok(Relationship { id, project_id, from_entity_id, to_entity_id, label, created_at: now })
}

#[tauri::command]
pub async fn get_relationships(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Relationship>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, from_entity_id, to_entity_id, label, created_at FROM relationships WHERE project_id = ?1"
    )?;
    let rels = stmt.query_map([&project_id], |row| {
        Ok(Relationship {
            id: row.get(0)?,
            project_id: row.get(1)?,
            from_entity_id: row.get(2)?,
            to_entity_id: row.get(3)?,
            label: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(rels)
}

#[tauri::command]
pub async fn delete_relationship(
    id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    let conns = state.connections.lock().unwrap();
    for conn in conns.values() {
        let affected = conn.execute("DELETE FROM relationships WHERE id = ?1", [&id])?;
        if affected > 0 {
            return Ok(serde_json::json!({"deleted": true}));
        }
    }
    Ok(serde_json::json!({"deleted": false}))
}
