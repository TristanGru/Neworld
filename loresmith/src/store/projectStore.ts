import { create } from 'zustand';
import type { Project, Chapter, EntityCategory, Entity, Relationship, Conflict, RecentProject } from '../types';

interface ProjectState {
  activeProject: Project | null;
  folderPath: string | null;
  chapters: Chapter[];
  entityCategories: EntityCategory[];
  entities: Entity[];
  relationships: Relationship[];
  conflicts: Conflict[];
  recentProjects: RecentProject[];

  setActiveProject: (project: Project, folderPath: string) => void;
  setChapters: (chapters: Chapter[]) => void;
  addChapter: (chapter: Chapter) => void;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  removeChapter: (id: string) => void;
  setEntityCategories: (cats: EntityCategory[]) => void;
  addEntityCategory: (cat: EntityCategory) => void;
  setEntities: (entities: Entity[]) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  setRelationships: (rels: Relationship[]) => void;
  addRelationship: (rel: Relationship) => void;
  removeRelationship: (id: string) => void;
  setConflicts: (conflicts: Conflict[]) => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  folderPath: null,
  chapters: [],
  entityCategories: [],
  entities: [],
  relationships: [],
  conflicts: [],
  recentProjects: [],

  setActiveProject: (project, folderPath) =>
    set({ activeProject: project, folderPath }),

  setChapters: (chapters) => set({ chapters }),
  addChapter: (chapter) => set((s) => ({ chapters: [...s.chapters, chapter] })),
  updateChapter: (id, updates) =>
    set((s) => ({ chapters: s.chapters.map((c) => c.id === id ? { ...c, ...updates } : c) })),
  removeChapter: (id) =>
    set((s) => ({ chapters: s.chapters.filter((c) => c.id !== id) })),

  setEntityCategories: (cats) => set({ entityCategories: cats }),
  addEntityCategory: (cat) => set((s) => ({ entityCategories: [...s.entityCategories, cat] })),

  setEntities: (entities) => set({ entities }),
  addEntity: (entity) => set((s) => ({ entities: [...s.entities, entity] })),
  updateEntity: (id, updates) =>
    set((s) => ({ entities: s.entities.map((e) => e.id === id ? { ...e, ...updates } : e) })),
  removeEntity: (id) =>
    set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),

  setRelationships: (rels) => set({ relationships: rels }),
  addRelationship: (rel) => set((s) => ({ relationships: [...s.relationships, rel] })),
  removeRelationship: (id) =>
    set((s) => ({ relationships: s.relationships.filter((r) => r.id !== id) })),

  setConflicts: (conflicts) => set({ conflicts }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),

  clearProject: () => set({
    activeProject: null,
    folderPath: null,
    chapters: [],
    entityCategories: [],
    entities: [],
    relationships: [],
    conflicts: [],
  }),
}));
