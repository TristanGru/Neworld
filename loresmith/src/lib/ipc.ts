import { invoke } from '@tauri-apps/api/core';
import type {
  Project, Entity, EntityCategory, Chapter, Scene,
  Relationship, Conflict, EntityMatch, VersionSnapshot, RecentProject, FieldDef
} from '../types';

// Project commands
export const ipc = {
  createProject: (name: string, genre: string, save_path: string) =>
    invoke<{ id: string; name: string; genre: string; created_at: number; folder_path: string }>(
      'create_project', { name, genre, savePath: save_path }
    ),

  openProject: (folder_path: string) =>
    invoke<{ project: Project; chapters: Chapter[]; entity_counts: Record<string, number>; folder_path: string }>(
      'open_project', { folderPath: folder_path }
    ),

  getRecentProjects: () =>
    invoke<RecentProject[]>('get_recent_projects'),

  addRecentProject: (project_id: string, name: string, folder_path: string, genre: string) =>
    invoke<void>('add_recent_project', { projectId: project_id, name, folderPath: folder_path, genre }),

  // Entity commands
  createEntity: (project_id: string, category_id: string, name: string, aliases: string[], structured_data: Record<string, string>, notes?: string) =>
    invoke<Entity>('create_entity', { projectId: project_id, categoryId: category_id, name, aliases, structuredData: structured_data, notes }),

  updateEntity: (id: string, name?: string, aliases?: string[], structured_data?: Record<string, string>, notes?: string) =>
    invoke<Entity>('update_entity', { id, name, aliases, structuredData: structured_data, notes }),

  deleteEntity: (id: string) =>
    invoke<{ deleted: boolean }>('delete_entity', { id }),

  getEntities: (project_id: string, category_id?: string, search?: string) =>
    invoke<Entity[]>('get_entities', { projectId: project_id, categoryId: category_id, search }),

  getEntityCategories: (project_id: string) =>
    invoke<EntityCategory[]>('get_entity_categories', { projectId: project_id }),

  createCustomCategory: (project_id: string, name: string, icon?: string, field_schema?: FieldDef[]) =>
    invoke<EntityCategory>('create_custom_category', { projectId: project_id, name, icon, fieldSchema: field_schema ?? [] }),

  createRelationship: (project_id: string, from_entity_id: string, to_entity_id: string, label?: string) =>
    invoke<Relationship>('create_relationship', { projectId: project_id, fromEntityId: from_entity_id, toEntityId: to_entity_id, label }),

  getRelationships: (project_id: string) =>
    invoke<Relationship[]>('get_relationships', { projectId: project_id }),

  deleteRelationship: (id: string) =>
    invoke<{ deleted: boolean }>('delete_relationship', { id }),

  // Chapter commands
  createChapter: (project_id: string, title: string, folder_path: string) =>
    invoke<Chapter>('create_chapter', { projectId: project_id, title, folderPath: folder_path }),

  saveChapter: (chapter_id: string, content: string, folder_path: string) =>
    invoke<{ word_count: number; snapshot_created: boolean }>('save_chapter', { chapterId: chapter_id, content, folderPath: folder_path }),

  getChapterContent: (chapter_id: string, folder_path: string) =>
    invoke<string>('get_chapter_content', { chapterId: chapter_id, folderPath: folder_path }),

  deleteChapter: (chapter_id: string, folder_path: string) =>
    invoke<{ deleted: boolean }>('delete_chapter', { chapterId: chapter_id, folderPath: folder_path }),

  updateChapterTitle: (chapter_id: string, title: string) =>
    invoke<{ updated: boolean }>('update_chapter_title', { chapterId: chapter_id, title }),

  reorderChapters: (project_id: string, chapter_ids: string[]) =>
    invoke<{ updated: number }>('reorder_chapters', { projectId: project_id, chapterIds: chapter_ids }),

  // Scene commands
  createScene: (chapter_id: string, project_id: string, title: string, summary?: string, pov_entity_id?: string, timeline_position?: string) =>
    invoke<Scene>('create_scene', { chapterId: chapter_id, projectId: project_id, title, summary, povEntityId: pov_entity_id, timelinePosition: timeline_position }),

  getScenes: (project_id: string, chapter_id?: string) =>
    invoke<Scene[]>('get_scenes', { projectId: project_id, chapterId: chapter_id }),

  reorderScenes: (chapter_id: string, scene_ids: string[]) =>
    invoke<{ updated: number }>('reorder_scenes', { chapterId: chapter_id, sceneIds: scene_ids }),

  updateScene: (id: string, title?: string, summary?: string, pov_entity_id?: string, timeline_position?: string) =>
    invoke<{ updated: boolean }>('update_scene', { id, title, summary, povEntityId: pov_entity_id, timelinePosition: timeline_position }),

  deleteScene: (id: string) =>
    invoke<{ deleted: boolean }>('delete_scene', { id }),

  // Snapshot commands
  getVersionSnapshots: (chapter_id: string) =>
    invoke<VersionSnapshot[]>('get_version_snapshots', { chapterId: chapter_id }),

  restoreSnapshot: (snapshot_id: string) =>
    invoke<{ content: string }>('restore_snapshot', { snapshotId: snapshot_id }),

  // AI commands
  checkOllama: () =>
    invoke<{ available: boolean; models: string[] }>('check_ollama'),

  aiQuery: (project_id: string, query: string) =>
    invoke<void>('ai_query', { projectId: project_id, query }),

  getAiSuggestions: (project_id: string) =>
    invoke<Array<{ type: string; message: string }>>('get_ai_suggestions', { projectId: project_id }),

  setOllamaModel: (model: string) =>
    invoke<void>('set_ollama_model', { model }),

  detectEntities: (project_id: string, prose: string) =>
    invoke<EntityMatch[]>('detect_entities_in_prose', { projectId: project_id, prose }),

  // Export
  exportProject: (project_id: string, format: string, output_path: string, folder_path: string) =>
    invoke<{ success: boolean; output_path: string }>('export_project', { projectId: project_id, format, outputPath: output_path, folderPath: folder_path }),

  // Conflicts
  getConflicts: (project_id: string) =>
    invoke<Conflict[]>('get_conflicts', { projectId: project_id }),

  // Import
  analyzeAndImport: (project_id: string, writing: string, notes: string) =>
    invoke<Array<{ category: string; name: string; fields: Record<string, string> }>>(
      'analyze_and_import', { projectId: project_id, writing, notes }
    ),
};
