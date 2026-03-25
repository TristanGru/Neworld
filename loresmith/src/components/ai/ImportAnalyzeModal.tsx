import { useState } from 'react';
import { ipc } from '../../lib/ipc';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';

interface Props {
  onClose: () => void;
}

type Phase = 'input' | 'analyzing' | 'results';

interface ImportedEntity {
  category: string;
  name: string;
  fields: Record<string, string>;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Characters': '👤',
  'Locations': '📍',
  'Magic Systems': '✨',
  'Lore': '📜',
  'Factions & Organizations': '⚔️',
  'Items & Artifacts': '💎',
};

export default function ImportAnalyzeModal({ onClose }: Props) {
  const project = useProjectStore((s) => s.activeProject);
  const addToast = useUIStore((s) => s.addToast);

  const [writing, setWriting] = useState('');
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [results, setResults] = useState<ImportedEntity[]>([]);
  const [error, setError] = useState('');

  async function runAnalysis() {
    if (!project) return;
    if (!writing.trim() && !notes.trim()) {
      setError('Paste in at least some writing or notes to analyse.');
      return;
    }
    setError('');
    setPhase('analyzing');

    try {
      const imported = await ipc.analyzeAndImport(project.id, writing, notes);
      setResults(imported);
      setPhase('results');
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed. Make sure Ollama is running.');
      setPhase('input');
    }
  }

  // Group results by category
  const grouped = results.reduce<Record<string, ImportedEntity[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>✨ AI World Import</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Paste your writing and notes — the AI will extract characters, locations, lore, and more.
            </p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg" style={{ color: 'var(--color-text)' }}>✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {phase === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                  Your Writing
                  <span className="ml-2 font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Paste chapters, scenes, or any prose
                  </span>
                </label>
                <textarea
                  value={writing}
                  onChange={(e) => setWriting(e.target.value)}
                  rows={10}
                  placeholder="Paste your writing here — chapters, scenes, story excerpts..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>
                  Notes & Documentation
                  <span className="ml-2 font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Character sheets, world notes, outlines — anything
                  </span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  placeholder="Paste any existing notes, character descriptions, world-building docs..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <div
                className="rounded-lg px-4 py-3 text-xs"
                style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                💡 The AI will do its best but may miss things or make mistakes. You can always edit entities after import. Large texts may take a minute to process.
              </div>
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="text-5xl animate-pulse">🔍</div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Analysing your world...</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This may take up to a minute depending on your model.</p>
            </div>
          )}

          {phase === 'results' && (
            <div className="space-y-5">
              {results.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">🤷</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No entities were detected. Try adding more detailed writing or notes.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{results.length} entities</span> imported into your world.
                  </p>

                  {Object.entries(grouped).map(([category, entities]) => (
                    <div key={category}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <span>{CATEGORY_ICONS[category] ?? '📁'}</span>
                        {category} ({entities.length})
                      </h3>
                      <div className="space-y-2">
                        {entities.map((entity, i) => (
                          <div key={i} className="rounded-lg px-3 py-2.5"
                            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{entity.name}</p>
                            {Object.entries(entity.fields).filter(([, v]) => v).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                                {Object.entries(entity.fields)
                                  .filter(([, v]) => v)
                                  .slice(0, 4)
                                  .map(([k, v]) => (
                                    <span key={k} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                      <span className="capitalize">{k.replace(/_/g, ' ')}</span>: {String(v).slice(0, 60)}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
          {phase === 'results' ? (
            <>
              <button
                onClick={() => { setPhase('input'); setResults([]); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                Import More
              </button>
              <button
                onClick={() => { addToast(`${results.length} entities added to your world`, 'success'); onClose(); }}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                disabled={phase === 'analyzing'}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                Analyse & Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
