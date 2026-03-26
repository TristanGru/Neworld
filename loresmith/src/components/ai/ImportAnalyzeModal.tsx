import { useState } from 'react';
import { ipc } from '../../lib/ipc';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import Icon from '../common/Icon';

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
  'Characters':              '👤',
  'Locations':               '📍',
  'Magic Systems':           '✨',
  'Lore':                    '📜',
  'Factions & Organizations':'⚔️',
  'Items & Artifacts':       '💎',
};

const WRITING_LIMIT = 8000;
const NOTES_LIMIT   = 4000;

export default function ImportAnalyzeModal({ onClose }: Props) {
  const project = useProjectStore((s) => s.activeProject);
  const setEntities = useProjectStore((s) => s.setEntities);
  const addToast = useUIStore((s) => s.addToast);
  const currentModel = useUIStore((s) => s.currentModel);

  const [writing, setWriting] = useState('');
  const [notes,   setNotes]   = useState('');
  const [phase,   setPhase]   = useState<Phase>('input');
  const [results, setResults] = useState<ImportedEntity[]>([]);
  const [error,   setError]   = useState('');

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

      // Refresh entity store so World view shows new entries immediately
      if (imported.length > 0) {
        ipc.getEntities(project.id).then(setEntities).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed. Make sure Ollama is running.');
      setPhase('input');
    }
  }

  function handleDone() {
    addToast(`${results.length} ${results.length === 1 ? 'entity' : 'entities'} added to your world`, 'success');
    onClose();
  }

  const grouped = results.reduce<Record<string, ImportedEntity[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const writingOver  = writing.length > WRITING_LIMIT;
  const notesOver    = notes.length   > NOTES_LIMIT;
  const canAnalyze   = (writing.trim().length > 0 || notes.trim().length > 0) && phase !== 'analyzing';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.72)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>
              Import World Content
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Paste your writing and notes — the AI will extract characters, locations, lore, and more.
            </p>
          </div>
          <button
            onClick={onClose}
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
              color: 'var(--color-text-muted)',
              flexShrink: 0,
              transition: 'color 100ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <Icon name="x" size={16} strokeWidth={2} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* Input phase */}
          {phase === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Writing textarea */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    Your Writing
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      Chapters, scenes, or any prose
                    </span>
                  </label>
                  <span style={{
                    fontSize: 10,
                    color: writingOver ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {writing.length.toLocaleString()} / {WRITING_LIMIT.toLocaleString()}
                    {writingOver && ' — will be trimmed'}
                  </span>
                </div>
                <textarea
                  value={writing}
                  onChange={(e) => setWriting(e.target.value)}
                  rows={9}
                  placeholder="Paste chapters, scenes, or story excerpts here…"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: 'var(--font-prose)',
                    lineHeight: 1.7,
                    resize: 'vertical',
                    background: 'var(--color-bg-input)',
                    border: `1px solid ${writingOver ? 'rgba(192,80,64,0.4)' : 'var(--color-border)'}`,
                    color: 'var(--color-text)',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { if (!writingOver) e.currentTarget.style.borderColor = 'rgba(201,145,58,0.4)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = writingOver ? 'rgba(192,80,64,0.4)' : 'var(--color-border)'; }}
                />
              </div>

              {/* Notes textarea */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    Notes &amp; Docs
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      Character sheets, world-building notes, outlines
                    </span>
                  </label>
                  <span style={{
                    fontSize: 10,
                    color: notesOver ? 'var(--color-accent)' : 'var(--color-text-subtle)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {notes.length.toLocaleString()} / {NOTES_LIMIT.toLocaleString()}
                    {notesOver && ' — will be trimmed'}
                  </span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Character descriptions, place names, magic rules, faction notes…"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    background: 'var(--color-bg-input)',
                    border: `1px solid ${notesOver ? 'rgba(192,80,64,0.4)' : 'var(--color-border)'}`,
                    color: 'var(--color-text)',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { if (!notesOver) e.currentTarget.style.borderColor = 'rgba(201,145,58,0.4)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = notesOver ? 'rgba(192,80,64,0.4)' : 'var(--color-border)'; }}
                />
              </div>

              {/* Error */}
              {error && (
                <p style={{ fontSize: 12, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
              )}

              {/* Hint */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Icon name="wand" size={14} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  The AI extracts named entities from your text and adds them to your world. It may miss things or make mistakes — you can always edit entries afterwards. Large texts may take up to a minute.
                </p>
              </div>
            </div>
          )}

          {/* Analyzing phase */}
          {phase === 'analyzing' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 24px',
                gap: 16,
                textAlign: 'center',
              }}
            >
              <div style={{ color: 'var(--color-primary)', opacity: 0.8 }}>
                <Icon name="sparkles" size={40} strokeWidth={1.5} style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>
                  Analysing your world…
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Running on <strong style={{ color: 'var(--color-text)' }}>{currentModel}</strong> — this can take up to a minute.
                  <br />The app will stay responsive while it works.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      opacity: 0.6,
                      animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Results phase */}
          {phase === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ opacity: 0.12, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                    <Icon name="globe" size={48} strokeWidth={1} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', marginBottom: 6 }}>
                    Nothing detected
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                    The AI couldn't identify named entities. Try adding more specific names — characters, places, or factions.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: 'var(--color-primary-dim)',
                        border: '1px solid rgba(201,145,58,0.2)',
                      }}
                    >
                      <Icon name="check" size={11} strokeWidth={2.5} style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                        {results.length} {results.length === 1 ? 'entity' : 'entities'} imported
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Now visible in your World view
                    </span>
                  </div>

                  {Object.entries(grouped).map(([category, entities]) => (
                    <div key={category}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <span style={{ fontSize: 13 }}>{CATEGORY_ICONS[category] ?? '📁'}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-muted)',
                        }}>
                          {category}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>
                          {entities.length}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {entities.map((entity, i) => {
                          const fieldEntries = Object.entries(entity.fields).filter(([, v]) => v).slice(0, 4);
                          return (
                            <div
                              key={i}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: 'var(--color-bg-panel)',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 3px' }}>
                                {entity.name}
                              </p>
                              {fieldEntries.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                                  {fieldEntries.map(([k, v]) => (
                                    <span key={k} style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                      <span style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                                      {': '}
                                      <span style={{ color: 'var(--color-text)' }}>
                                        {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {phase === 'results' ? (
            <>
              <button
                onClick={() => { setPhase('input'); setResults([]); setError(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'border-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
              >
                Import More
              </button>
              <button
                onClick={handleDone}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-bg)',
                  background: 'var(--color-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={phase === 'analyzing'}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                  opacity: phase === 'analyzing' ? 0.4 : 1,
                  transition: 'color 100ms ease',
                }}
                onMouseEnter={(e) => { if (phase !== 'analyzing') e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                disabled={!canAnalyze}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-bg)',
                  background: 'var(--color-primary)',
                  border: 'none',
                  cursor: canAnalyze ? 'pointer' : 'not-allowed',
                  opacity: canAnalyze ? 1 : 0.4,
                  transition: 'background 100ms ease, opacity 100ms ease',
                }}
                onMouseEnter={(e) => { if (canAnalyze) e.currentTarget.style.background = 'var(--color-primary-hover)'; }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
              >
                Analyse &amp; Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
