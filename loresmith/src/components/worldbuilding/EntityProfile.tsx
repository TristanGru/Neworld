import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import type { Entity, EntityCategory } from '../../types';

interface Props {
  entity: Entity;
  category?: EntityCategory;
  onClose?: () => void;
}

export default function EntityProfile({ entity, category, onClose }: Props) {
  const updateEntity = useProjectStore((s) => s.updateEntity);
  const removeEntity = useProjectStore((s) => s.removeEntity);
  const addToast = useUIStore((s) => s.addToast);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(entity.name);
  const [editNotes, setEditNotes] = useState(entity.notes ?? '');
  const [editData, setEditData] = useState<Record<string, string>>(entity.structured_data);

  async function save() {
    try {
      const updated = await ipc.updateEntity(entity.id, editName, entity.aliases, editData, editNotes);
      updateEntity(entity.id, { name: updated.name, notes: updated.notes, structured_data: updated.structured_data });
      setEditing(false);
      addToast('Saved', 'success');
    } catch (e: any) {
      addToast(`Failed to save: ${e?.message ?? e}`, 'error');
    }
  }

  async function deleteEntity() {
    if (!confirm(`Delete "${entity.name}"?`)) return;
    try {
      await ipc.deleteEntity(entity.id);
      removeEntity(entity.id);
      onClose?.();
    } catch (e: any) {
      addToast('Failed to delete entity', 'error');
    }
  }

  const fields = category?.field_schema ?? [];

  return (
    <div className="h-full flex flex-col overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
      >
        <span className="text-2xl">{category?.icon ?? '📄'}</span>
        <div className="flex-1">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-lg font-bold bg-transparent border-b outline-none w-full"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          ) : (
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{entity.name}</h2>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{category?.name}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={save} className="text-xs px-3 py-1 rounded"
                style={{ background: 'var(--color-primary)', color: 'white' }}>Save</button>
              <button onClick={() => { setEditing(false); setEditData(entity.structured_data); setEditNotes(entity.notes ?? ''); }}
                className="text-xs px-3 py-1 rounded" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs px-3 py-1 rounded"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>Edit</button>
              <button onClick={deleteEntity} className="text-xs px-3 py-1 rounded text-red-400">Delete</button>
            </>
          )}
          {onClose && <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>✕</button>}
        </div>
      </div>

      {/* Aliases */}
      {entity.aliases.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Also known as</p>
          <div className="flex flex-wrap gap-1">
            {entity.aliases.map((alias) => (
              <span key={alias} className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Structured fields */}
      {fields.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Details
          </p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{field.label}</label>
                {editing ? (
                  field.type === 'textarea' ? (
                    <textarea
                      value={editData[field.key] ?? ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="w-full mt-1 px-2 py-1 rounded text-sm resize-none"
                      rows={3}
                      style={{
                        background: 'var(--color-bg-panel)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        outline: 'none',
                      }}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={editData[field.key] ?? ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="w-full mt-1 px-2 py-1 rounded text-sm"
                      style={{
                        background: 'var(--color-bg-panel)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        outline: 'none',
                      }}
                    >
                      <option value="">—</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={editData[field.key] ?? ''}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="w-full mt-1 px-2 py-1 rounded text-sm"
                      style={{
                        background: 'var(--color-bg-panel)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        outline: 'none',
                      }}
                    />
                  )
                ) : (
                  <p className="text-sm mt-0.5" style={{ color: entity.structured_data[field.key] ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {entity.structured_data[field.key] || '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="px-4 pt-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Notes
        </p>
        {editing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            rows={8}
            placeholder="Free-form notes..."
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
              fontFamily: 'var(--font-prose)',
            }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap" style={{ color: entity.notes ? 'var(--color-text)' : 'var(--color-text-muted)', fontFamily: 'var(--font-prose)' }}>
            {entity.notes || 'No notes yet. Click Edit to add some.'}
          </p>
        )}
      </div>
    </div>
  );
}
