import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import EntityForm from './EntityForm';
import EntityProfile from './EntityProfile';
import CategoryManager from './CategoryManager';
import Icon from '../common/Icon';

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

  useEffect(() => {
    if (!project) return;
    ipc.getEntities(project.id)
      .then(setEntities)
      .catch(() => addToast('Failed to load entities', 'error'));
  }, [project?.id]);

  const sidebarItemStyle = (isActive: boolean) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 7,
    border: `1px solid ${isActive ? 'rgba(201,145,58,0.2)' : 'transparent'}`,
    background: isActive ? 'var(--color-primary-dim)' : 'transparent',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'left' as const,
    transition: 'background 100ms ease',
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* ── Category sidebar ── */}
      <div
        style={{
          width: 176,
          minWidth: 176,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-sidebar)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            World
          </span>
          <button
            onClick={() => setShowCategoryManager(true)}
            title="Manage categories"
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              transition: 'color 100ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <Icon name="gear" size={13} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {/* All entries */}
          <button
            onClick={() => setSelectedCategoryId(null)}
            style={sidebarItemStyle(selectedCategoryId === null)}
            onMouseEnter={(e) => { if (selectedCategoryId !== null) e.currentTarget.style.background = 'var(--color-primary-muted)'; }}
            onMouseLeave={(e) => { if (selectedCategoryId !== null) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ flex: 1 }}>All Entries</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{entities.length}</span>
          </button>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 4px' }} />

          {categories.map((cat) => {
            const count = entities.filter((e) => e.category_id === cat.id).length;
            const isActive = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                style={sidebarItemStyle(isActive)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-primary-muted)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{cat.icon ?? '📄'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Entity list ── */}
      <div
        style={{
          width: 224,
          minWidth: 224,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search${selectedCategory ? ` ${selectedCategory.name}` : ''}…`}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
              transition: 'border-color 120ms ease',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,145,58,0.35)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
          <button
            onClick={() => setShowForm(true)}
            title={`Add ${selectedCategory?.name ?? 'entity'}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="plus" size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {filteredEntities.map((entity) => {
            const cat = categories.find((c) => c.id === entity.category_id);
            const isActive = selectedEntityId === entity.id;
            return (
              <button
                key={entity.id}
                onClick={() => setSelectedEntityId(entity.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  marginBottom: 2,
                  borderRadius: 7,
                  border: `1px solid ${isActive ? 'var(--color-border-strong)' : 'transparent'}`,
                  background: isActive ? 'var(--color-bg-panel)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text)',
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-panel)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 13, opacity: 0.7 }}>{cat?.icon ?? '📄'}</span>
                <span style={{
                  flex: 1,
                  fontWeight: isActive ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entity.name}
                </span>
              </button>
            );
          })}

          {filteredEntities.length === 0 && (
            <div style={{ padding: '32px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {search ? `No results for "${search}"` : 'No entries yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Entity detail ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedEntity ? (
          <EntityProfile
            entity={selectedEntity}
            category={categories.find((c) => c.id === selectedEntity.category_id)}
            onClose={() => setSelectedEntityId(null)}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ opacity: 0.1 }}>
              <Icon name="globe" size={48} strokeWidth={1} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Select an entry to view details
            </p>
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
