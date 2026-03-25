import { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import type { View } from '../../types';

const navItems: { view: View; icon: string; label: string; description: string }[] = [
  {
    view: 'chapters',
    icon: '📝',
    label: 'Chapters',
    description: 'Write your story. Each chapter has a full prose editor with autosave, version history, and live entity detection.',
  },
  {
    view: 'world',
    icon: '🌍',
    label: 'World',
    description: 'Your world encyclopaedia. Store and organise characters, locations, lore, magic systems, factions, and artifacts.',
  },
  {
    view: 'corkboard',
    icon: '📌',
    label: 'Corkboard',
    description: 'Plan your scenes visually. Create scene cards per chapter and drag them into order before you write.',
  },
  {
    view: 'graph',
    icon: '🕸️',
    label: 'Graph',
    description: 'Visualise relationships between your entities as an interactive node map. Great for political webs and family trees.',
  },
  {
    view: 'ai',
    icon: '🤖',
    label: 'AI',
    description: 'Ask your local AI questions about your world, get writing suggestions, and check story consistency. Requires Ollama.',
  },
  {
    view: 'conflicts',
    icon: '⚠️',
    label: 'Conflicts',
    description: 'Automatic continuity checks. Detects location conflicts, deceased characters appearing as POV, and more.',
  },
];

export default function Sidebar() {
  const currentView = useUIStore((s) => s.currentView);
  const setView = useUIStore((s) => s.setView);
  const ollamaAvailable = useUIStore((s) => s.ollamaAvailable);
  const setShowTutorial = useUIStore((s) => s.setShowTutorial);
  const conflicts = useProjectStore((s) => s.conflicts);
  const activeProject = useProjectStore((s) => s.activeProject);
  const clearProject = useProjectStore((s) => s.clearProject);

  const [tooltip, setTooltip] = useState<{ view: View; description: string } | null>(null);

  return (
    <aside
      className="flex flex-col w-16 py-3 items-center gap-1 border-r"
      style={{ background: 'var(--color-bg-sidebar)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo / Home */}
      <div className="text-2xl mb-3 cursor-pointer" onClick={() => clearProject()} title="Home">
        📖
      </div>

      {/* Nav items */}
      {navItems.map(({ view, icon, label, description }) => {
        const isActive = currentView === view;
        const badge = view === 'conflicts' ? conflicts.length : view === 'ai' && !ollamaAvailable ? '!' : 0;

        return (
          <div key={view} className="relative w-full flex justify-center">
            <button
              onClick={() => setView(view)}
              onMouseEnter={() => setTooltip({ view, description })}
              onMouseLeave={() => setTooltip(null)}
              className="relative flex flex-col items-center gap-1 w-12 py-2 rounded-lg text-xs transition-colors"
              style={{
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? 'white' : 'var(--color-text-muted)',
              }}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] leading-none">{label}</span>
              {badge ? (
                <span
                  className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
                  style={{ background: 'var(--color-accent)', color: '#000' }}
                >
                  {badge === '!' ? '!' : badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </button>

            {/* Description tooltip */}
            {tooltip?.view === view && (
              <div
                className="absolute left-full top-0 ml-3 z-50 w-52 rounded-lg px-3 py-2.5 text-xs leading-relaxed pointer-events-none"
                style={{
                  background: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{label}</p>
                <p style={{ color: 'var(--color-text-muted)' }}>{description}</p>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex-1" />

      {/* Tutorial button */}
      <button
        onClick={() => setShowTutorial(true)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-opacity hover:opacity-100 opacity-50"
        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        title="Open tutorial"
      >
        ?
      </button>

      {/* Project avatar */}
      {activeProject && (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mb-1"
          style={{ background: 'var(--color-primary)', color: 'white' }}
          title={activeProject.name}
        >
          {activeProject.name[0].toUpperCase()}
        </div>
      )}
    </aside>
  );
}
