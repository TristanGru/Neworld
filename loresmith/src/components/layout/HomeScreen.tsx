import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import { genreIcon, genreLabel, formatDate } from '../../lib/utils';
import type { Genre } from '../../types';
import { open } from '@tauri-apps/plugin-dialog';

const GENRES: Genre[] = ['fantasy', 'sci-fi', 'horror', 'romance', 'mystery', 'historical', 'contemporary', 'custom'];

// Subtle wordmark SVG — pen crossing a globe ring
function Wordmark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.35" />
      <ellipse cx="24" cy="24" rx="10" ry="18" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.25" />
      <line x1="6" y1="24" x2="42" y2="24" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.2" />
      <path
        d="M30 14l3 3-12 12-4 1 1-4z"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

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
      if (selected) setWizardPath(selected as string);
    } catch (e) {
      // fallback: user types path manually
    }
  }

  async function handleCreate() {
    if (!wizardName.trim()) { addToast('Please enter a project name', 'error'); return; }
    if (!wizardPath) { addToast('Please select a save location', 'error'); return; }
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
      addToast(`"${result.name}" created`, 'success');
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
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
        background: 'var(--color-bg)',
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Wordmark />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--color-text)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Neworld
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Novel writing &amp; world-building
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 48 }}>
        <button
          onClick={() => setShowWizard(true)}
          style={{
            padding: '10px 22px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--color-bg)',
            background: 'var(--color-primary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 120ms ease, transform 100ms ease',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-primary-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          New Project
        </button>
        <button
          onClick={() => openProject()}
          style={{
            padding: '10px 22px',
            borderRadius: 8,
            fontWeight: 500,
            fontSize: 13,
            color: 'var(--color-text-muted)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            transition: 'color 120ms ease, border-color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text)';
            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          Open Folder
        </button>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div style={{ width: '100%', maxWidth: 520 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-subtle)',
              marginBottom: 10,
              paddingLeft: 2,
            }}
          >
            Recent
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentProjects.map((rp) => (
              <button
                key={rp.id}
                onClick={() => openProject(rp.folder_path)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 10,
                  textAlign: 'left',
                  background: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  transition: 'border-color 120ms ease, background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  e.currentTarget.style.background = 'var(--color-bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'var(--color-bg-panel)';
                }}
              >
                {/* Genre icon badge */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {genreIcon(rp.genre)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rp.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {genreLabel(rp.genre)}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', flexShrink: 0 }}>
                  {formatDate(rp.opened_at)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── New Project Wizard Modal ── */}
      {showWizard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              borderRadius: 14,
              padding: '28px 28px 24px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--color-text)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              New Project
            </h2>

            {/* Project Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Project Name
              </label>
              <input
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                placeholder="e.g. Ember Rising"
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text)',
                  outline: 'none',
                  transition: 'border-color 120ms ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,145,58,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
              />
            </div>

            {/* Genre picker */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Genre
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setWizardGenre(g)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '10px 4px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      background: wizardGenre === g ? 'var(--color-primary-dim)' : 'var(--color-bg-input)',
                      border: `1px solid ${wizardGenre === g ? 'rgba(201,145,58,0.35)' : 'var(--color-border)'}`,
                      color: wizardGenre === g ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{genreIcon(g)}</span>
                    <span>{genreLabel(g)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Save location */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Save Location
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={wizardPath}
                  onChange={(e) => setWizardPath(e.target.value)}
                  placeholder="Choose a folder..."
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-strong)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,145,58,0.4)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
                />
                <button
                  onClick={pickFolder}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-strong)',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'color 120ms ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button
                onClick={() => setShowWizard(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'color 120ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--color-bg)',
                  background: 'var(--color-primary)',
                  border: 'none',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = 'var(--color-primary-hover)'; }}
                onMouseLeave={(e) => { if (!creating) e.currentTarget.style.background = 'var(--color-primary)'; }}
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
