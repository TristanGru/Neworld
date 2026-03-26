import { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import type { View } from '../../types';
import Icon from '../common/Icon';
import type { IconName } from '../common/Icon';

const navItems: { view: View; icon: IconName; label: string; description: string }[] = [
  {
    view: 'chapters',
    icon: 'book-open',
    label: 'Write',
    description: 'Write your story. Full prose editor with autosave, version history, and live entity detection.',
  },
  {
    view: 'world',
    icon: 'globe',
    label: 'World',
    description: 'Your world encyclopaedia — characters, locations, lore, magic systems, factions, and more.',
  },
  {
    view: 'corkboard',
    icon: 'squares',
    label: 'Board',
    description: 'Plan scenes visually per chapter and arrange them before you write.',
  },
  {
    view: 'graph',
    icon: 'share-nodes',
    label: 'Graph',
    description: 'Visualise relationships between your entities as an interactive node map.',
  },
  {
    view: 'ai',
    icon: 'sparkles',
    label: 'Sage',
    description: 'Your AI world expert. Ask anything about your story — all local, all private.',
  },
  {
    view: 'conflicts',
    icon: 'triangle-alert',
    label: 'Issues',
    description: 'Automatic continuity checks — detects location conflicts, deceased characters, and more.',
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
      style={{
        width: 56,
        minWidth: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 2,
        background: 'var(--color-bg-sidebar)',
        borderRight: '1px solid var(--color-border)',
        flexShrink: 0,
      }}
    >
      {/* Back to Home */}
      <button
        onClick={clearProject}
        title="All projects"
        style={{
          width: 36,
          height: 36,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          transition: 'color 120ms ease, background 120ms ease',
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
        <Icon name="arrow-left" size={16} strokeWidth={2} />
      </button>

      {/* Divider */}
      <div style={{ width: 28, height: 1, background: 'var(--color-border)', marginBottom: 6 }} />

      {/* Nav items */}
      {navItems.map(({ view, icon, label, description }) => {
        const isActive = currentView === view;
        const badge =
          view === 'conflicts' ? conflicts.length :
          view === 'ai' && !ollamaAvailable ? '!' : 0;

        return (
          <div key={view} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setView(view)}
              title={label}
              style={{
                position: 'relative',
                width: 40,
                height: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                transition: 'color 120ms ease, background 120ms ease',
                background: isActive ? 'var(--color-primary-dim)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                outline: isActive ? '1px solid rgba(201,145,58,0.2)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-primary-muted)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }
                setTooltip({ view, description });
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }
                setTooltip(null);
              }}
            >
              <Icon name={icon} size={18} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{
                fontSize: 9,
                letterSpacing: '0.02em',
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
                opacity: isActive ? 1 : 0.7,
              }}>
                {label}
              </span>

              {badge ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    fontSize: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    background: badge === '!' ? 'var(--color-primary)' : 'var(--color-accent)',
                    color: '#fff',
                  }}
                >
                  {badge === '!' ? '!' : badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </button>

            {/* Tooltip */}
            {tooltip?.view === view && (
              <div
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 10px)',
                  top: 0,
                  zIndex: 50,
                  width: 210,
                  borderRadius: 10,
                  padding: '10px 12px',
                  pointerEvents: 'none',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 4, fontSize: 12, color: 'var(--color-text)' }}>
                  {label}
                </p>
                <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                  {description}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Help */}
      <button
        onClick={() => setShowTutorial(true)}
        title="Tutorial"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          marginBottom: 6,
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
        <Icon name="question-circle" size={14} strokeWidth={1.5} />
      </button>

      {/* Project avatar */}
      {activeProject && (
        <div
          title={activeProject.name}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            background: 'var(--color-primary-dim)',
            color: 'var(--color-primary)',
            border: '1px solid rgba(201,145,58,0.2)',
            letterSpacing: '-0.01em',
          }}
        >
          {activeProject.name[0].toUpperCase()}
        </div>
      )}
    </aside>
  );
}
