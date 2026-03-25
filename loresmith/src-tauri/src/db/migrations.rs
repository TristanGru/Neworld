use rusqlite::Connection;
use crate::errors::LoreError;

const MIGRATION_001: &str = include_str!("migrations/001_initial.sql");

pub fn run_migrations(conn: &Connection) -> Result<(), LoreError> {
    // Ensure migration tracking table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );"
    ).map_err(|e| LoreError::DbMigrationFailed(e.to_string()))?;

    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        conn.execute_batch(MIGRATION_001)
            .map_err(|e| LoreError::DbMigrationFailed(format!("Migration 001 failed: {}", e)))?;
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
            [now],
        ).map_err(|e| LoreError::DbMigrationFailed(e.to_string()))?;
    }

    Ok(())
}
