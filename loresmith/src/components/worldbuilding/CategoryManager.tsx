import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import type { FieldDef } from '../../types';

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function CategoryManager({ projectId, onClose }: Props) {
  const addCategory = useProjectStore((s) => s.addEntityCategory);
  const addToast = useUIStore((s) => s.addToast);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📄');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields([...fields, { key: `field_${fields.length}`, label: '', type: 'text' }]);
  }

  function updateField(index: number, updates: Partial<FieldDef>) {
    const updated = fields.map((f, i) => i === index ? { ...f, ...updates } : f);
    setFields(updated);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  async function save() {
    if (!name.trim()) { addToast('Category name is required', 'error'); return; }
    setSaving(true);
    try {
      const validFields = fields.filter((f) => f.label.trim()).map((f) => ({
        ...f,
        key: f.label.toLowerCase().replace(/\s+/g, '_'),
      }));
      const cat = await ipc.createCustomCategory(projectId, name.trim(), icon || undefined, validFields);
      addCategory(cat);
      addToast(`Category "${name}" created`, 'success');
      onClose();
    } catch (e: any) {
      addToast(`Failed: ${e?.message ?? e}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>New Category</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-3">
            <div className="w-16">
              <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>Icon</label>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-full px-2 py-2 rounded text-center text-xl"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', outline: 'none' }} />
            </div>
            <div className="flex-1">
              <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Languages"
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Custom Fields</label>
              <button onClick={addField} className="text-xs" style={{ color: 'var(--color-primary)' }}>+ Add Field</button>
            </div>
            {fields.map((field, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={field.label} onChange={(e) => updateField(i, { label: e.target.value })}
                  placeholder="Field name"
                  className="flex-1 px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }} />
                <select value={field.type} onChange={(e) => updateField(i, { type: e.target.value as any })}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}>
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                </select>
                <button onClick={() => removeField(i)} className="text-xs text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 flex justify-end gap-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="text-sm px-4 py-2" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}>
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
