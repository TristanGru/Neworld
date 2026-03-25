import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import { formatWordCount } from '../../lib/utils';
import type { Chapter } from '../../types';
import ProseEditor from './ProseEditor';
import ExportDialog from '../export/ExportDialog';

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
    if (!confirm(`Delete chapter "${ch.title}"? This cannot be undone.`)) return;
    try {
      await ipc.deleteChapter(ch.id, folderPath);
      removeChapter(ch.id);
      if (activeChapterId === ch.id) setActiveChapter(null);
    } catch (e: any) {
      addToast(`Failed to delete chapter`, 'error');
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
    <div className="flex h-full">
      {/* Chapter List */}
      <div
        className="w-56 flex flex-col border-r overflow-hidden"
        style={{ background: 'var(--color-bg-sidebar)', borderColor: 'var(--color-border)' }}
      >
        <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Chapters</span>
          <div className="flex gap-1">
            <button
              onClick={() => setShowExport(true)}
              title="Export"
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ↑
            </button>
            <button
              onClick={createChapter}
              title="New Chapter"
              className="text-lg leading-none px-1 py-0"
              style={{ color: 'var(--color-primary)' }}
            >
              +
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((ch) => (
            <div
              key={ch.id}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: activeChapterId === ch.id ? 'var(--color-primary)' : 'transparent',
                color: activeChapterId === ch.id ? 'white' : 'var(--color-text)',
              }}
              onClick={() => setActiveChapter(ch.id)}
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
                  className="flex-1 bg-transparent text-xs outline-none border-b"
                  style={{ borderColor: 'currentColor' }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-xs font-medium truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTitleId(ch.id);
                    setEditingTitleValue(ch.title);
                  }}
                >
                  {ch.title}
                </span>
              )}
              <span className="text-[10px] opacity-60">{formatWordCount(ch.word_count)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChapter(ch); }}
                title="Delete chapter"
                className="opacity-0 group-hover:opacity-100 text-xs rounded px-1 hover:text-red-400 transition-opacity"
                style={{ color: activeChapterId === ch.id ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}
              >
                🗑
              </button>
            </div>
          ))}
          {chapters.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No chapters yet.
              <br />
              <button onClick={createChapter} style={{ color: 'var(--color-primary)' }}>
                Create one
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        {activeChapter ? (
          <ProseEditor chapter={activeChapter} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">📝</div>
              <p style={{ color: 'var(--color-text-muted)' }}>
                {chapters.length > 0 ? 'Select a chapter to begin writing' : 'Create your first chapter to get started'}
              </p>
            </div>
          </div>
        )}
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
}
