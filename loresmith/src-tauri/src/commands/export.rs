use std::path::Path;
use tauri::State;

use crate::errors::LoreError;
use crate::state::AppState;

#[tauri::command]
pub async fn export_project(
    project_id: String,
    format: String,
    output_path: String,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, LoreError> {
    if !["epub", "pdf", "docx"].contains(&format.as_str()) {
        return Err(LoreError::InvalidInput(format!("Invalid format: {}", format)));
    }

    let conns = state.connections.lock().unwrap();
    let conn = conns.get(&project_id).ok_or(LoreError::NotANeworldProject)?;

    // Get chapters ordered by sort_order
    let chapters: Vec<(String, String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, title, prose_file FROM chapters WHERE project_id = ?1 ORDER BY sort_order ASC"
        )?;
        let rows: Vec<_> = stmt.query_map([&project_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })?.collect();
        rows.into_iter().filter_map(|r| r.ok()).collect()
    };

    if chapters.is_empty() {
        return Err(LoreError::ExportFailed("No chapters to export".to_string()));
    }

    // Get project name
    let project_name: String = conn.query_row(
        "SELECT name FROM projects WHERE id = ?1", [&project_id],
        |row| row.get(0)
    ).unwrap_or_else(|_| "Untitled".to_string());

    // Build combined markdown document
    let mut combined = format!("# {}\n\n", project_name);
    for (_, title, prose_file) in &chapters {
        let prose_path = Path::new(&folder_path).join(prose_file);
        let content = if prose_path.exists() {
            std::fs::read_to_string(&prose_path).unwrap_or_default()
        } else {
            String::new()
        };
        combined.push_str(&format!("## {}\n\n{}\n\n", title, content));
    }

    // Write temp markdown file
    let temp_dir = std::env::temp_dir().join("neworld_export");
    std::fs::create_dir_all(&temp_dir)?;
    let temp_md = temp_dir.join(format!("{}.md", project_id));
    std::fs::write(&temp_md, &combined)?;

    // Try to find pandoc
    let pandoc_path = find_pandoc()?;

    let pandoc_format = match format.as_str() {
        "epub" => "epub",
        "pdf" => "pdf",
        "docx" => "docx",
        _ => "epub",
    };

    let output = std::process::Command::new(&pandoc_path)
        .arg(&temp_md)
        .arg("-o")
        .arg(&output_path)
        .arg("--standalone")
        .arg("--metadata")
        .arg(format!("title:{}", project_name))
        .output()
        .map_err(|e| LoreError::ExportFailed(e.to_string()))?;

    // Cleanup temp file
    let _ = std::fs::remove_file(&temp_md);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(LoreError::ExportFailed(stderr));
    }

    Ok(serde_json::json!({"success": true, "output_path": output_path}))
}

fn find_pandoc() -> Result<String, LoreError> {
    // Check sidecar path first
    let sidecar_paths = [
        "./sidecars/pandoc.exe",
        "./sidecars/pandoc",
        "../sidecars/pandoc.exe",
    ];
    for path in &sidecar_paths {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    // Check system PATH
    let which_result = if cfg!(windows) {
        std::process::Command::new("where").arg("pandoc").output()
    } else {
        std::process::Command::new("which").arg("pandoc").output()
    };

    if let Ok(out) = which_result {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }

    Err(LoreError::PandocNotFound)
}
