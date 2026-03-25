use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::schema::Conflict;
use crate::errors::LoreError;

pub fn detect_conflicts(conn: &Connection, project_id: &str) -> Result<Vec<Conflict>, LoreError> {
    let mut conflicts = Vec::new();

    // BL-007: LOCATION_CONFLICT — same entity, same date, different locations
    let location_conflicts = detect_location_conflicts(conn, project_id)?;
    conflicts.extend(location_conflicts);

    // BL-008: DEAD_CHARACTER_ACTIVE — deceased character appears as POV after death
    let dead_char_conflicts = detect_dead_character_conflicts(conn, project_id)?;
    conflicts.extend(dead_char_conflicts);

    Ok(conflicts)
}

fn detect_location_conflicts(conn: &Connection, project_id: &str) -> Result<Vec<Conflict>, LoreError> {
    let mut conflicts = Vec::new();

    // Find timeline events that share the same event_date and have the same entity
    // but different location_entity_id
    let mut stmt = conn.prepare(
        "SELECT t1.id, t2.id, t1.event_date, t1.entity_ids, t1.location_entity_id, t2.location_entity_id
         FROM timeline_events t1
         JOIN timeline_events t2 ON t1.event_date = t2.event_date
             AND t1.id < t2.id
             AND t1.project_id = t2.project_id
             AND t1.location_entity_id != t2.location_entity_id
             AND t1.location_entity_id IS NOT NULL
             AND t2.location_entity_id IS NOT NULL
         WHERE t1.project_id = ?1"
    )?;

    let rows = stmt.query_map([project_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
        ))
    })?.filter_map(|r| r.ok());

    for (id1, id2, date, entity_ids_str, loc1, loc2) in rows {
        let entity_ids1: Vec<String> = serde_json::from_str(&entity_ids_str).unwrap_or_default();

        // Check if these two events share any entity
        let ids2_row = conn.query_row(
            "SELECT entity_ids FROM timeline_events WHERE id = ?1", [&id2],
            |row| row.get::<_, String>(0)
        ).unwrap_or_else(|_| "[]".to_string());
        let entity_ids2: Vec<String> = serde_json::from_str(&ids2_row).unwrap_or_default();

        let shared: Vec<String> = entity_ids1.iter()
            .filter(|id| entity_ids2.contains(id))
            .cloned()
            .collect();

        if !shared.is_empty() {
            let entity_names: Vec<String> = shared.iter().filter_map(|eid| {
                conn.query_row("SELECT name FROM entities WHERE id = ?1", [eid], |row| row.get::<_, String>(0)).ok()
            }).collect();

            conflicts.push(Conflict {
                conflict_type: "LOCATION_CONFLICT".to_string(),
                description: format!(
                    "Character(s) {} appear in two different locations on the same date: {}",
                    entity_names.join(", "), date
                ),
                entity_ids: shared,
                scene_ids: vec![],
            });
        }
    }

    Ok(conflicts)
}

fn detect_dead_character_conflicts(conn: &Connection, project_id: &str) -> Result<Vec<Conflict>, LoreError> {
    let mut conflicts = Vec::new();

    // Find entities with status = "deceased"
    let mut stmt = conn.prepare(
        "SELECT id, name, structured_data FROM entities WHERE project_id = ?1 AND category_id IN (SELECT id FROM entity_categories WHERE name = 'Characters' AND project_id = ?1)"
    )?;

    let entities = stmt.query_map([project_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?.filter_map(|r| r.ok());

    for (entity_id, entity_name, data_str) in entities {
        let data: serde_json::Value = serde_json::from_str(&data_str).unwrap_or_default();
        if data.get("status").and_then(|s| s.as_str()) == Some("deceased") {
            // Check if this entity is set as POV in any scene
            let pov_scenes: Vec<(String, String)> = {
                let mut stmt2 = conn.prepare(
                    "SELECT id, title FROM scenes WHERE project_id = ?1 AND pov_entity_id = ?2"
                )?;
                let rows: Vec<_> = stmt2.query_map(rusqlite::params![project_id, entity_id], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })?.collect();
                rows.into_iter().filter_map(|r| r.ok()).collect()
            };

            if !pov_scenes.is_empty() {
                let scene_titles: Vec<String> = pov_scenes.iter().map(|(_, t)| t.clone()).collect();
                let scene_ids: Vec<String> = pov_scenes.iter().map(|(id, _)| id.clone()).collect();
                conflicts.push(Conflict {
                    conflict_type: "DEAD_CHARACTER_ACTIVE".to_string(),
                    description: format!(
                        "Deceased character '{}' is set as POV in scene(s): {}",
                        entity_name,
                        scene_titles.join(", ")
                    ),
                    entity_ids: vec![entity_id],
                    scene_ids,
                });
            }
        }
    }

    Ok(conflicts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_conflicts_empty() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        let result = detect_conflicts(&conn, "test-project").unwrap();
        assert!(result.is_empty());
    }
}
