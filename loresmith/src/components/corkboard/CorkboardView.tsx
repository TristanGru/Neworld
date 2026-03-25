import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import type { Scene } from '../../types';

export default function CorkboardView() {
  const project = useProjectStore((s) => s.activeProject);
  const chapters = useProjectStore((s) => s.chapters);
  const entities = useProjectStore((s) => s.entities);
  const addToast = useUIStore((s) => s.addToast);
  const setView = useUIStore((s) => s.setView);
  const setActiveChapter = useUIStore((s) => s.setActiveChapter);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showNewScene, setShowNewScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState('');

  useEffect(() => {
    if (!project) return;
    ipc.getScenes(project.id, selectedChapterId ?? undefined).then(setScenes).catch(() => {});
  }, [project?.id, selectedChapterId]);

  const chapter = chapters.find((c) => c.id === selectedChapterId);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId || !selectedChapterId) return;

    const newOrder = [...scenes];
    const fromIdx = newOrder.findIndex((s) => s.id === dragId);
    const toIdx = newOrder.findIndex((s) => s.id === targetId);
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);

    const reordered = newOrder.map((s, i) => ({ ...s, sort_order: i }));
    setScenes(reordered);
    setDragId(null);
    setDragOverId(null);

    try {
      await ipc.reorderScenes(selectedChapterId, reordered.map((s) => s.id));
    } catch (e) {
      addToast('Failed to reorder scenes', 'error');
    }
  }

  async function createScene() {
    if (!project || !selectedChapterId || !newSceneTitle.trim()) return;
    try {
      const scene = await ipc.createScene(selectedChapterId, project.id, newSceneTitle.trim());
      setScenes((prev) => [...prev, scene]);
      setNewSceneTitle('');
      setShowNewScene(false);
    } catch (e) {
      addToast('Failed to create scene', 'error');
    }
  }

  async function deleteScene(id: string) {
    try {
      await ipc.deleteScene(id);
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      addToast('Failed to delete scene', 'error');
    }
  }

  return (
    <div className="flex h-full">
      {/* Chapter selector */}
      <div className="w-48 border-r flex flex-col"
        style={{ background: 'var(--color-bg-sidebar)', borderColor: 'var(--color-border)' }}>
        <div className="p-3 border-b text-sm font-semibold"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          Corkboard
        </div>
        <button
          onClick={() => setSelectedChapterId(null)}
          className="mx-2 mt-2 px-3 py-2 rounded text-xs text-left"
          style={{
            background: selectedChapterId === null ? 'var(--color-primary)' : 'transparent',
            color: selectedChapterId === null ? 'white' : 'var(--color-text-muted)',
          }}
        >
          All Scenes
        </button>
        {chapters.map((ch) => (
          <button key={ch.id} onClick={() => setSelectedChapterId(ch.id)}
            className="mx-2 mt-1 px-3 py-2 rounded text-xs text-left truncate"
            style={{
              background: selectedChapterId === ch.id ? 'var(--color-primary)' : 'transparent',
              color: selectedChapterId === ch.id ? 'white' : 'var(--color-text)',
            }}>
            {ch.title}
          </button>
        ))}
      </div>

      {/* Corkboard area */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {chapter ? chapter.title : 'All Scenes'}
          </h2>
          {selectedChapterId && (
            <div className="flex gap-2">
              <button onClick={() => { setActiveChapter(selectedChapterId); setView('chapters'); }}
                className="text-xs px-3 py-1 rounded"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                Edit Prose
              </button>
              <button onClick={() => setShowNewScene(true)}
                className="text-xs px-3 py-1 rounded"
                style={{ background: 'var(--color-primary)', color: 'white' }}>
                + Scene
              </button>
            </div>
          )}
        </div>

        {showNewScene && selectedChapterId && (
          <div className="mb-4 flex gap-2">
            <input value={newSceneTitle} onChange={(e) => setNewSceneTitle(e.target.value)}
              placeholder="Scene title..."
              className="flex-1 px-3 py-2 rounded text-sm"
              style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
              onKeyDown={(e) => e.key === 'Enter' && createScene()}
              autoFocus />
            <button onClick={createScene} className="px-3 py-2 rounded text-sm text-white"
              style={{ background: 'var(--color-primary)' }}>Add</button>
            <button onClick={() => setShowNewScene(false)} className="px-3 py-2 text-sm"
              style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {scenes.map((scene) => {
            const povEntity = entities.find((e) => e.id === scene.pov_entity_id);
            return (
              <div
                key={scene.id}
                draggable
                onDragStart={(e) => onDragStart(e, scene.id)}
                onDragOver={(e) => onDragOver(e, scene.id)}
                onDrop={(e) => onDrop(e, scene.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                className="group relative rounded-lg p-4 cursor-grab active:cursor-grabbing"
                style={{
                  background: 'var(--color-bg-panel)',
                  border: dragOverId === scene.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  opacity: dragId === scene.id ? 0.5 : 1,
                  minHeight: 120,
                }}
              >
                <button
                  onClick={() => deleteScene(scene.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 text-xs"
                >
                  ✕
                </button>
                <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--color-text)' }}>
                  {scene.title}
                </h3>
                {scene.summary && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{scene.summary}</p>
                )}
                {povEntity && (
                  <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    POV: {povEntity.name}
                  </div>
                )}
                {scene.timeline_position && (
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    📅 {scene.timeline_position}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scenes.length === 0 && (
          <div className="text-center py-16">
            <p style={{ color: 'var(--color-text-muted)' }}>
              {selectedChapterId ? 'No scenes yet. Add one above.' : 'Select a chapter to see its scenes.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
