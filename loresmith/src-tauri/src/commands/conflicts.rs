use tauri::State;

use crate::db::schema::Conflict;
use crate::errors::LoreError;
use crate::state::AppState;
use crate::conflict_detection;

#[tauri::command]
pub async fn get_conflicts(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Conflict>, LoreError> {
    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;
    conflict_detection::detect_conflicts(conn, &project_id)
}
