use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub genre: String,
    pub theme_token_file: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntityCategory {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub icon: Option<String>,
    pub is_builtin: bool,
    pub field_schema: serde_json::Value,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Entity {
    pub id: String,
    pub project_id: String,
    pub category_id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub structured_data: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Relationship {
    pub id: String,
    pub project_id: String,
    pub from_entity_id: String,
    pub to_entity_id: String,
    pub label: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Chapter {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub sort_order: i64,
    pub prose_file: String,
    pub word_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Scene {
    pub id: String,
    pub chapter_id: String,
    pub project_id: String,
    pub title: String,
    pub summary: Option<String>,
    pub sort_order: i64,
    pub pov_entity_id: Option<String>,
    pub timeline_position: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEvent {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub event_date: Option<String>,
    pub entity_ids: Vec<String>,
    pub location_entity_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionSnapshot {
    pub id: String,
    pub chapter_id: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conflict {
    pub conflict_type: String,
    pub description: String,
    pub entity_ids: Vec<String>,
    pub scene_ids: Vec<String>,
}
