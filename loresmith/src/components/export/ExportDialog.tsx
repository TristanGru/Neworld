import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';

const FORMATS = [
  { value: 'epub', label: 'ePub', icon: '📗', ext: '.epub' },
  { value: 'pdf', label: 'PDF', icon: '📄', ext: '.pdf' },
  { value: 'docx', label: 'Word (.docx)', icon: '📝', ext: '.docx' },
];

interface Props {
  onClose: () => void;
}

export default function ExportDialog({ onClose }: Props) {
  const project = useProjectStore((s) => s.activeProject);
  const folderPath = useProjectStore((s) => s.folderPath);
  const addToast = useUIStore((s) => s.addToast);

  const [format, setFormat] = useState('epub');
  const [exporting, setExporting] = useState(false);

  async function doExport() {
    if (!project || !folderPath) return;
    const fmt = FORMATS.find((f) => f.value === format);
    if (!fmt) return;

    try {
      const outputPath = await save({
        filters: [{ name: fmt.label, extensions: [fmt.value] }],
        defaultPath: `${project.name}${fmt.ext}`,
      });
      if (!outputPath) return;

      setExporting(true);
      await ipc.exportProject(project.id, format, outputPath, folderPath);
      addToast(`Exported to ${outputPath}`, 'success');
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? JSON.stringify(e) ?? 'Export failed';
      if (msg.includes('PANDOC_NOT_FOUND')) {
        addToast('Pandoc not found. Install pandoc to export.', 'error');
      } else {
        addToast(`Export failed: ${msg}`, 'error');
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
        <div className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Export Manuscript</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div className="p-4 space-y-3">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
              style={{
                background: format === f.value ? 'var(--color-primary)' : 'var(--color-bg)',
                border: `1px solid ${format === f.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: format === f.value ? 'white' : 'var(--color-text)',
              }}
            >
              <span className="text-xl">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onClose} className="text-sm px-4 py-2" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
          <button
            onClick={doExport}
            disabled={exporting}
            className="text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
