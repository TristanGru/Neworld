export interface Project {
  id: string;
  name: string;
  genre: Genre;
  theme_token_file?: string;
  created_at: number;
  updated_at: number;
  folder_path?: string;
}

export type Genre =
  | 'fantasy'
  | 'sci-fi'
  | 'horror'
  | 'romance'
  | 'mystery'
  | 'historical'
  | 'contemporary'
  | 'custom';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  options?: string[];
}

export interface EntityCategory {
  id: string;
  project_id: string;
  name: string;
  icon?: string;
  is_builtin: boolean;
  field_schema: FieldDef[];
  sort_order: number;
}

export interface Entity {
  id: string;
  project_id: string;
  category_id: string;
  name: string;
  aliases: string[];
  structured_data: Record<string, string>;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface Relationship {
  id: string;
  project_id: string;
  from_entity_id: string;
  to_entity_id: string;
  label?: string;
  created_at: number;
}

export interface Chapter {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
  prose_file: string;
  word_count: number;
  created_at: number;
  updated_at: number;
}

export interface Scene {
  id: string;
  chapter_id: string;
  project_id: string;
  title: string;
  summary?: string;
  sort_order: number;
  pov_entity_id?: string;
  timeline_position?: string;
}

export interface VersionSnapshot {
  id: string;
  created_at: number;
  size: number;
}

export interface Conflict {
  conflict_type: string;
  description: string;
  entity_ids: string[];
  scene_ids: string[];
}

export interface EntityMatch {
  entity_id: string;
  name: string;
  start: number;
  end: number;
}

export interface RecentProject {
  id: string;
  name: string;
  folder_path: string;
  genre: Genre;
  opened_at: number;
}

export type View =
  | 'home'
  | 'chapters'
  | 'world'
  | 'ai'
  | 'corkboard'
  | 'graph'
  | 'conflicts'
  | 'settings';
