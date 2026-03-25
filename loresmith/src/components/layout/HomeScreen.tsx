import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import { genreIcon, genreLabel, formatDate } from '../../lib/utils';
import type { Genre } from '../../types';
import { open } from '@tauri-apps/plugin-dialog';

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'horror', 'romance', 'mystery', 'historical', 'contemporary', 'custom'];

export default function HomeScreen() {
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setChapters = useProjectStore((s) => s.setChapters);
  const setEntityCategories = useProjectStore((s) => s.setEntityCategories);
  const addToast = useUIStore((s) => s.addToast);
  const setView = useUIStore((s) => s.setView);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardName, setWizardName] = useState('');
  const [wizardGenre, setWizardGenre] = useState<Genre>('fantasy');
  const [wizardPath, setWizardPath] = useState('');
  const [creating, setCreating] = useState(false);

  async function pickFolder() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setWizardPath(selected as string);
      }
    } catch (e) {
      // fallback for dev: user types path manually
    }
  }

  async function handleCreate() {
    if (!wizardName.trim()) {
      addToast('Please enter a project name', 'error');
      return;
    }
    if (!wizardPath) {
      addToast('Please select a save location', 'error');
      return;
    }
    setCreating(true);
    try {
      const result = await ipc.createProject(wizardName.trim(), wizardGenre, wizardPath);
      await ipc.addRecentProject(result.id, result.name, result.folder_path, wizardGenre);

      const openResult = await ipc.openProject(result.folder_path);
      const cats = await ipc.getEntityCategories(result.id);

      setActiveProject(openResult.project, result.folder_path);
      setChapters(openResult.chapters);
      setEntityCategories(cats);
      setView('chapters');
      addToast(`Project "${result.name}" created!`, 'success');
    } catch (e: any) {
      addToast(`Failed to create project: ${e?.message ?? e}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function openProject(folderPath?: string) {
    try {
      const path = folderPath ?? await open({ directory: true, multiple: false }) as string;
      if (!path) return;

      const result = await ipc.openProject(path);
      const cats = await ipc.getEntityCategories(result.project.id);
      const entities = await ipc.getEntities(result.project.id);
      const rels = await ipc.getRelationships(result.project.id);

      setActiveProject(result.project, path);
      setChapters(result.chapters);
      setEntityCategories(cats);

      const { setEntities, setRelationships } = useProjectStore.getState();
      setEntities(entities);
      setRelationships(rels);

      await ipc.addRecentProject(result.project.id, result.project.name, path, result.project.genre);
      setView('chapters');
      addToast(`Opened "${result.project.name}"`, 'success');
    } catch (e: any) {
      addToast(`Failed to open project: ${e?.message ?? JSON.stringify(e)}`, 'error');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'var(--color-bg)' }}>

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">📖</div>
        <h1 className="text-5xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          Neworld
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
          Local-first novel writing and world-building
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-12">
        <button
          onClick={() => setShowWizard(true)}
          className="px-6 py-3 rounded-lg font-semibold text-white transition-colors"
          style={{ background: 'var(--color-primary)' }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
        >
          + New Project
        </button>
        <button
          onClick={() => openProject()}
          className="px-6 py-3 rounded-lg font-semibold transition-colors"
          style={{ background: 'var(--color-bg-panel)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        >
          Open Folder
        </button>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Recent Projects
          </h2>
          <div className="space-y-2">
            {recentProjects.map((rp) => (
              <button
                key={rp.id}
                onClick={() => openProject(rp.folder_path)}
                className="w-full flex items-center gap-4 p-4 rounded-lg text-left transition-colors"
                style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
              >
                <span className="text-2xl">{genreIcon(rp.genre)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{rp.name}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {genreLabel(rp.genre)} · {rp.folder_path}
                  </div>
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(rp.opened_at)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New Project Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-xl p-6 space-y-5"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>New Project</h2>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Project Name
              </label>
              <input
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                placeholder="e.g. Ember Rising"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Genre
              </label>
              <div className="grid grid-cols-4 gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setWizardGenre(g)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: wizardGenre === g ? 'var(--color-primary)' : 'var(--color-bg)',
                      border: `1px solid ${wizardGenre === g ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      color: wizardGenre === g ? 'white' : 'var(--color-text)',
                    }}
                  >
                    <span className="text-xl">{genreIcon(g)}</span>
                    <span>{genreLabel(g)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Save Location
              </label>
              <div className="flex gap-2">
                <input
                  value={wizardPath}
                  onChange={(e) => setWizardPath(e.target.value)}
                  placeholder="Choose a folder..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={pickFolder}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowWizard(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
