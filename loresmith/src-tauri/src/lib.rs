mod commands;
mod db;
mod entity_detection;
mod errors;
mod ollama;
mod rag;
mod conflict_detection;
mod state;

use state::AppState;
use commands::{project::*, entity::*, chapter::*, ai::*, export::*, conflicts::*};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .setup(|app| {
            // Load the user's previously chosen AI model before the UI starts
            commands::ai::load_persisted_settings(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project
            create_project,
            open_project,
            get_recent_projects,
            add_recent_project,
            // Entities
            create_entity,
            update_entity,
            delete_entity,
            get_entities,
            get_entity_categories,
            create_custom_category,
            create_relationship,
            get_relationships,
            delete_relationship,
            // Chapters
            create_chapter,
            save_chapter,
            get_chapter_content,
            delete_chapter,
            update_chapter_title,
            reorder_chapters,
            // Scenes
            create_scene,
            get_scenes,
            reorder_scenes,
            update_scene,
            delete_scene,
            // Snapshots
            get_version_snapshots,
            restore_snapshot,
            // AI
            setup_models,
            check_ollama,
            ai_query,
            get_ai_suggestions,
            set_ollama_model,
            get_ai_settings,
            save_ai_model,
            detect_entities_in_prose,
            analyze_and_import,
            // Export
            export_project,
            // Conflicts
            get_conflicts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
