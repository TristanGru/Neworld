import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import { formatWordCount } from '../../lib/utils';
import type { Chapter } from '../../types';
import ProseEditor from './ProseEditor';
import ExportDialog from '../export/ExportDialog';
import Icon from '../common/Icon';

export default function ChaptersView() {
  const project = useProjectStore((s) => s.activeProject);
  const folderPath = useProjectStore((s) => s.folderPath);
  const chapters = useProjectStore((s) => s.chapters);
  const addChapter = useProjectStore((s) => s.addChapter);
  const updateChapter = useProjectStore((s) => s.updateChapter);
  const removeChapter = useProjectStore((s) => s.removeChapter);
  const activeChapterId = useUIStore((s) => s.activeChapterId);
  const setActiveChapter = useUIStore((s) => s.setActiveChapter);
  const addToast = useUIStore((s) => s.addToast);

  const [showExport, setShowExport] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [hoveredChapterId, setHoveredChapterId] = useState<string | null>(null);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null;

  async function createChapter() {
    if (!project || !folderPath) return;
    try {
      const ch = await ipc.createChapter(project.id, `Chapter ${chapters.length + 1}`, folderPath);
      addChapter(ch);
      setActiveChapter(ch.id);
    } catch (e: any) {
      addToast(`Failed to create chapter: ${e?.message ?? e}`, 'error');
    }
  }

  async function deleteChapter(ch: Chapter) {
    if (!folderPath) return;
    if (!confirm(`Delete "${ch.title}"? This cannot be undone.`)) return;
    try {
      await ipc.deleteChapter(ch.id, folderPath);
      removeChapter(ch.id);
      if (activeChapterId === ch.id) setActiveChapter(null);
    } catch (e: any) {
      addToast('Failed to delete chapter', 'error');
    }
  }

  async function saveTitle(ch: Chapter, newTitle: string) {
    if (!newTitle.trim()) return;
    try {
      await ipc.updateChapterTitle(ch.id, newTitle.trim());
      updateChapter(ch.id, { title: newTitle.trim() });
    } catch (e) {
      addToast('Failed to update title', 'error');
    }
    setEditingTitleId(null);
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* ── Chapter list ── */}
      <div
        style={{
          width: 200,
          minWidth: 200,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-sidebar)',
          overflow: 'hidden',
        }}
      >
        {/* List header */}
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
            Chapters
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowExport(true)}
              title="Export"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                transition: 'color 100ms ease, background 100ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.background = 'var(--color-primary-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon name="arrow-up" size={13} strokeWidth={2} />
            </button>
            <button
              onClick={createChapter}
              title="New Chapter"
              style={{
                width: 26,
                height: 26,
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
              <Icon name="plus" size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Chapter items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {chapters.map((ch) => {
            const isActive = activeChapterId === ch.id;
            return (
              <div
                key={ch.id}
                className="group"
                onClick={() => setActiveChapter(ch.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  marginBottom: 2,
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: isActive ? 'var(--color-primary-dim)' : 'transparent',
                  border: isActive ? '1px solid rgba(201,145,58,0.2)' : '1px solid transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                  transition: 'background 100ms ease, border-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  setHoveredChapterId(ch.id);
                  if (!isActive) e.currentTarget.style.background = 'var(--color-primary-muted)';
                }}
                onMouseLeave={(e) => {
                  setHoveredChapterId(null);
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {editingTitleId === ch.id ? (
                  <input
                    value={editingTitleValue}
                    onChange={(e) => setEditingTitleValue(e.target.value)}
                    onBlur={() => saveTitle(ch, editingTitleValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle(ch, editingTitleValue);
                      if (e.key === 'Escape') setEditingTitleId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      fontSize: 12,
                      outline: 'none',
                      borderBottom: '1px solid currentColor',
                      color: 'inherit',
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTitleId(ch.id);
                      setEditingTitleValue(ch.title);
                    }}
                  >
                    {ch.title}
                  </span>
                )}

                <span style={{ fontSize: 10, opacity: 0.5, flexShrink: 0 }}>
                  {formatWordCount(ch.word_count)}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); deleteChapter(ch); }}
                  title="Delete chapter"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: 'none',
                    background: hoveredChapterId === ch.id ? 'rgba(192,80,64,0.1)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: hoveredChapterId === ch.id ? '#c05040' : 'transparent',
                    flexShrink: 0,
                    transition: 'color 120ms ease, background 120ms ease',
                  }}
                >
                  <Icon name="trash" size={11} />
                </button>
              </div>
            );
          })}

          {chapters.length === 0 && (
            <div style={{ padding: '32px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                No chapters yet.
              </p>
              <button
                onClick={createChapter}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--color-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(201,145,58,0.4)',
                }}
              >
                Create one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Editor ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeChapter ? (
          <ProseEditor chapter={activeChapter} />
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
            <div style={{ opacity: 0.12 }}>
              <Icon name="book-open" size={48} strokeWidth={1} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {chapters.length > 0 ? 'Select a chapter to begin writing' : 'Create your first chapter to get started'}
            </p>
          </div>
        )}
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
}
