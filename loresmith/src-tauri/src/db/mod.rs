pub mod migrations;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;
use crate::errors::LoreError;

pub fn open_project_db(project_folder: &Path) -> Result<Connection, LoreError> {
    let db_path = project_folder.join("neworld.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent access
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    migrations::run_migrations(&conn)?;

    Ok(conn)
}

pub fn create_project_db(project_folder: &Path) -> Result<Connection, LoreError> {
    let prose_dir = project_folder.join("prose");
    std::fs::create_dir_all(&prose_dir)?;

    open_project_db(project_folder)
}
