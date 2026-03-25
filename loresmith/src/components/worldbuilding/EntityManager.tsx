import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import EntityForm from './EntityForm';
import EntityProfile from './EntityProfile';
import CategoryManager from './CategoryManager';

export default function EntityManager() {
  const project = useProjectStore((s) => s.activeProject);
  const entities = useProjectStore((s) => s.entities);
  const categories = useProjectStore((s) => s.entityCategories);
  const setEntities = useProjectStore((s) => s.setEntities);
  const addToast = useUIStore((s) => s.addToast);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;

  const filteredEntities = entities.filter((e) => {
    const matchesCategory = !selectedCategoryId || e.category_id === selectedCategoryId;
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Load all entities on mount
  useEffect(() => {
    if (!project) return;
    ipc.getEntities(project.id)
      .then(setEntities)
      .catch(() => addToast('Failed to load entities', 'error'));
  }, [project?.id]);

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <div
        className="w-48 flex flex-col border-r overflow-hidden"
        style={{ background: 'var(--color-bg-sidebar)', borderColor: 'var(--color-border)' }}
      >
        <div className="p-3 flex items-center justify-between border-b text-sm font-semibold"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <span>World</span>
          <button
            onClick={() => setShowCategoryManager(true)}
            style={{ color: 'var(--color-text-muted)', fontSize: 12 }}
          >
            ⚙
          </button>
        </div>

        <button
          onClick={() => setSelectedCategoryId(null)}
          className="mx-2 mt-2 px-3 py-2 rounded-lg text-xs text-left"
          style={{
            background: selectedCategoryId === null ? 'var(--color-primary)' : 'transparent',
            color: selectedCategoryId === null ? 'white' : 'var(--color-text-muted)',
          }}
        >
          All Entries ({entities.length})
        </button>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {categories.map((cat) => {
            const count = entities.filter((e) => e.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left"
                style={{
                  background: selectedCategoryId === cat.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedCategoryId === cat.id ? 'white' : 'var(--color-text)',
                }}
              >
                <span>{cat.icon ?? '📄'}</span>
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Entity list */}
      <div
        className="w-64 flex flex-col border-r overflow-hidden"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <div className="p-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--color-border)' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => setShowForm(true)}
            className="text-lg leading-none"
            style={{ color: 'var(--color-primary)' }}
            title={`Add ${selectedCategory?.name ?? 'Entity'}`}
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEntities.map((entity) => {
            const cat = categories.find((c) => c.id === entity.category_id);
            return (
              <button
                key={entity.id}
                onClick={() => setSelectedEntityId(entity.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left"
                style={{
                  background: selectedEntityId === entity.id ? 'var(--color-bg-panel)' : 'transparent',
                  border: selectedEntityId === entity.id ? '1px solid var(--color-border)' : '1px solid transparent',
                  color: 'var(--color-text)',
                }}
              >
                <span>{cat?.icon ?? '📄'}</span>
                <span className="flex-1 truncate font-medium">{entity.name}</span>
              </button>
            );
          })}
          {filteredEntities.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No entries yet.
            </p>
          )}
        </div>
      </div>

      {/* Entity detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedEntity ? (
          <EntityProfile
            entity={selectedEntity}
            category={categories.find((c) => c.id === selectedEntity.category_id)}
            onClose={() => setSelectedEntityId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: 'var(--color-text-muted)' }}>Select an entry to view details</p>
          </div>
        )}
      </div>

      {showForm && (
        <EntityForm
          projectId={project!.id}
          categories={categories}
          defaultCategoryId={selectedCategoryId ?? undefined}
          onSaved={(entity) => {
            const { addEntity } = useProjectStore.getState();
            addEntity(entity);
            setShowForm(false);
            setSelectedEntityId(entity.id);
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          projectId={project!.id}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}
