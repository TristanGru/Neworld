use std::path::Path;
use tauri::State;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

use crate::db::{create_project_db, open_project_db};
use crate::db::schema::{Project, Chapter, EntityCategory};
use crate::errors::LoreError;
use crate::state::AppState;

const VALID_GENRES: &[&str] = &[
    "fantasy", "sci-fi", "horror", "romance", "mystery",
    "historical", "contemporary", "custom",
];

fn slug(name: &str) -> String {
    let lower = name.to_lowercase();
    let re_chars: String = lower.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    // Collapse consecutive dashes
    let mut result = String::new();
    let mut prev_dash = false;
    for c in re_chars.chars() {
        if c == '-' {
            if !prev_dash { result.push(c); }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    result.trim_matches('-').to_string()
}

#[derive(Serialize)]
pub struct CreateProjectResult {
    pub id: String,
    pub name: String,
    pub genre: String,
    pub created_at: i64,
    pub folder_path: String,
}

#[tauri::command]
pub async fn create_project(
    name: String,
    genre: String,
    save_path: String,
    state: State<'_, AppState>,
) -> Result<CreateProjectResult, LoreError> {
    if name.trim().is_empty() {
        return Err(LoreError::NameEmpty);
    }
    if name.len() > 200 {
        return Err(LoreError::NameTooLong);
    }
    if !VALID_GENRES.contains(&genre.as_str()) {
        return Err(LoreError::GenreInvalid);
    }

    let folder_name = slug(&name);
    let base = Path::new(&save_path);
    if !base.exists() {
        return Err(LoreError::PathNotWritable);
    }
    let project_folder = base.join(&folder_name);
    if project_folder.exists() {
        // If it already exists, just append a uuid suffix
        let project_folder = base.join(format!("{}-{}", folder_name, &Uuid::new_v4().to_string()[..8]));
        std::fs::create_dir_all(&project_folder)?;
    } else {
        std::fs::create_dir_all(&project_folder)?;
    }

    let project_folder = base.join(&folder_name);
    std::fs::create_dir_all(&project_folder)?;

    let conn = create_project_db(&project_folder)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO projects (id, name, genre, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, name, genre, now, now],
    )?;

    // Seed built-in entity categories
    seed_builtin_categories(&conn, &id, now)?;

    let folder_path = project_folder.to_string_lossy().to_string();

    {
        let mut conns = state.connections.lock().unwrap();
        conns.insert(id.clone(), conn);
    }

    Ok(CreateProjectResult {
        id,
        name,
        genre,
        created_at: now,
        folder_path,
    })
}

#[derive(Serialize)]
pub struct OpenProjectResult {
    pub project: Project,
    pub chapters: Vec<Chapter>,
    pub entity_counts: std::collections::HashMap<String, i64>,
    pub folder_path: String,
}

#[tauri::command]
pub async fn open_project(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<OpenProjectResult, LoreError> {
    let path = Path::new(&folder_path);
    let db_path = path.join("neworld.db");
    if !db_path.exists() {
        return Err(LoreError::NotANeworldProject);
    }

    let conn = open_project_db(path)?;

    let project: Project = conn.query_row(
        "SELECT id, name, genre, theme_token_file, created_at, updated_at FROM projects LIMIT 1",
        [],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                genre: row.get(2)?,
                theme_token_file: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    ).map_err(|_| LoreError::NotANeworldProject)?;

    let chapters = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, sort_order, prose_file, word_count, created_at, updated_at FROM chapters WHERE project_id = ?1 ORDER BY sort_order ASC"
        )?;
        let rows: Vec<_> = stmt.query_map([&project.id], |row| {
            Ok(Chapter {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                sort_order: row.get(3)?,
                prose_file: row.get(4)?,
                word_count: row.get(5).unwrap_or(0),
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?.collect();
        rows.into_iter().filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    let mut entity_counts = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT category_id, COUNT(*) FROM entities WHERE project_id = ?1 GROUP BY category_id"
        )?;
        let rows = stmt.query_map([&project.id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows.filter_map(|r| r.ok()) {
            entity_counts.insert(row.0, row.1);
        }
    }

    let project_id = project.id.clone();
    {
        let mut conns = state.connections.lock().unwrap();
        conns.insert(project_id, conn);
    }

    Ok(OpenProjectResult {
        project,
        chapters,
        entity_counts,
        folder_path,
    })
}

fn seed_builtin_categories(conn: &rusqlite::Connection, project_id: &str, now: i64) -> Result<(), LoreError> {
    let categories = builtin_categories();
    for (i, cat) in categories.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        let schema_str = serde_json::to_string(&cat.field_schema)?;
        conn.execute(
            "INSERT INTO entity_categories (id, project_id, name, icon, is_builtin, field_schema, sort_order) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
            rusqlite::params![id, project_id, cat.name, cat.icon, schema_str, i as i64],
        )?;
    }
    Ok(())
}

struct BuiltinCategory {
    name: &'static str,
    icon: Option<&'static str>,
    field_schema: serde_json::Value,
}

fn builtin_categories() -> Vec<BuiltinCategory> {
    vec![
        BuiltinCategory {
            name: "Characters",
            icon: Some("👤"),
            field_schema: serde_json::json!([
                {"key": "age", "label": "Age", "type": "text"},
                {"key": "eye_color", "label": "Eye Color", "type": "text"},
                {"key": "hair", "label": "Hair", "type": "text"},
                {"key": "occupation", "label": "Occupation", "type": "text"},
                {"key": "faction", "label": "Faction", "type": "text"},
                {"key": "status", "label": "Status", "type": "select", "options": ["alive", "deceased", "unknown"]},
                {"key": "first_appearance", "label": "First Appearance", "type": "text"},
                {"key": "motivation", "label": "Motivation", "type": "textarea"}
            ]),
        },
        BuiltinCategory {
            name: "Locations",
            icon: Some("📍"),
            field_schema: serde_json::json!([
                {"key": "type", "label": "Type", "type": "text"},
                {"key": "region", "label": "Region", "type": "text"},
                {"key": "population", "label": "Population", "type": "text"},
                {"key": "climate", "label": "Climate", "type": "text"},
                {"key": "significance", "label": "Significance", "type": "textarea"}
            ]),
        },
        BuiltinCategory {
            name: "Lore",
            icon: Some("📜"),
            field_schema: serde_json::json!([
                {"key": "type", "label": "Type", "type": "text"},
                {"key": "era", "label": "Era / Period", "type": "text"},
                {"key": "origin", "label": "Origin", "type": "text"},
                {"key": "significance", "label": "Significance", "type": "textarea"},
                {"key": "related_entities", "label": "Related Entities", "type": "text"}
            ]),
        },
        BuiltinCategory {
            name: "Magic Systems",
            icon: Some("✨"),
            field_schema: serde_json::json!([
                {"key": "type", "label": "Type", "type": "text"},
                {"key": "source", "label": "Source", "type": "text"},
                {"key": "rules", "label": "Rules", "type": "textarea"},
                {"key": "limitations", "label": "Limitations", "type": "textarea"},
                {"key": "cost", "label": "Cost / Drawbacks", "type": "textarea"},
                {"key": "practitioners", "label": "Practitioners", "type": "text"}
            ]),
        },
        BuiltinCategory {
            name: "Timeline Events",
            icon: Some("📅"),
            field_schema: serde_json::json!([
                {"key": "event_date", "label": "Date", "type": "text"},
                {"key": "location", "label": "Location", "type": "text"},
                {"key": "participants", "label": "Participants", "type": "text"},
                {"key": "outcome", "label": "Outcome", "type": "textarea"}
            ]),
        },
        BuiltinCategory {
            name: "Factions & Organizations",
            icon: Some("⚔️"),
            field_schema: serde_json::json!([
                {"key": "type", "label": "Type", "type": "text"},
                {"key": "leader", "label": "Leader", "type": "text"},
                {"key": "goals", "label": "Goals", "type": "textarea"},
                {"key": "membership", "label": "Membership", "type": "text"},
                {"key": "allies", "label": "Allies", "type": "text"},
                {"key": "enemies", "label": "Enemies", "type": "text"}
            ]),
        },
        BuiltinCategory {
            name: "Items & Artifacts",
            icon: Some("💎"),
            field_schema: serde_json::json!([
                {"key": "type", "label": "Type", "type": "text"},
                {"key": "origin", "label": "Origin", "type": "text"},
                {"key": "powers", "label": "Powers / Properties", "type": "textarea"},
                {"key": "current_owner", "label": "Current Owner", "type": "text"},
                {"key": "location", "label": "Location", "type": "text"}
            ]),
        },
    ]
}

#[tauri::command]
pub async fn get_recent_projects() -> Result<Vec<serde_json::Value>, LoreError> {
    // Read from a simple JSON file in app data dir
    let config_path = get_config_path();
    if !config_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&config_path)?;
    let data: serde_json::Value = serde_json::from_str(&content)?;
    Ok(data["recent_projects"].as_array().cloned().unwrap_or_default())
}

#[tauri::command]
pub async fn add_recent_project(
    project_id: String,
    name: String,
    folder_path: String,
    genre: String,
) -> Result<(), LoreError> {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut data: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({"recent_projects": []}))
    } else {
        serde_json::json!({"recent_projects": []})
    };

    let recent = data["recent_projects"].as_array_mut().unwrap();
    // Remove existing entry for same project
    recent.retain(|p| p["id"].as_str() != Some(&project_id));
    // Prepend new entry
    recent.insert(0, serde_json::json!({
        "id": project_id,
        "name": name,
        "folder_path": folder_path,
        "genre": genre,
        "opened_at": chrono::Utc::now().timestamp()
    }));
    // Keep max 20 recent projects
    recent.truncate(20);

    std::fs::write(&config_path, serde_json::to_string_pretty(&data)?)?;
    Ok(())
}

fn get_config_path() -> std::path::PathBuf {
    let base = dirs_sys_not_a_crate_but_lets_use_env();
    base.join("neworld").join("config.json")
}

fn dirs_sys_not_a_crate_but_lets_use_env() -> std::path::PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        std::path::PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home).join(".config")
    } else {
        std::path::PathBuf::from(".")
    }
}
