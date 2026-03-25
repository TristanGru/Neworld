import { useState } from 'react';
import { ipc } from '../../lib/ipc';
import { useUIStore } from '../../store/uiStore';
import type { Entity, EntityCategory } from '../../types';

interface Props {
  projectId: string;
  categories: EntityCategory[];
  defaultCategoryId?: string;
  onSaved: (entity: Entity) => void;
  onClose: () => void;
}

export default function EntityForm({ projectId, categories, defaultCategoryId, onSaved, onClose }: Props) {
  const addToast = useUIStore((s) => s.addToast);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldData, setFieldData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function submit() {
    if (!name.trim()) { addToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const aliasList = aliases.split(',').map((a) => a.trim()).filter(Boolean);
      const entity = await ipc.createEntity(projectId, categoryId, name.trim(), aliasList, fieldData, notes || undefined);
      onSaved(entity);
      addToast(`Created "${name}"`, 'success');
    } catch (e: any) {
      addToast(`Failed: ${e?.message ?? e}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <div className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>New Entry</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setFieldData({}); }}
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elara Voss"
              autoFocus
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {/* Aliases */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>Aliases (comma-separated)</label>
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. The Pale Witch, Elara of Ashford"
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
            />
          </div>

          {/* Dynamic fields */}
          {selectedCategory?.field_schema.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  value={fieldData[field.key] ?? ''}
                  onChange={(e) => setFieldData({ ...fieldData, [field.key]: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded text-sm resize-none"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                />
              ) : field.type === 'select' ? (
                <select
                  value={fieldData[field.key] ?? ''}
                  onChange={(e) => setFieldData({ ...fieldData, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                >
                  <option value="">—</option>
                  {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  value={fieldData[field.key] ?? ''}
                  onChange={(e) => setFieldData({ ...fieldData, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                />
              )}
            </div>
          ))}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 rounded text-sm resize-none"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
            />
          </div>
        </div>

        <div className="p-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }} className="text-sm px-4 py-2">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
