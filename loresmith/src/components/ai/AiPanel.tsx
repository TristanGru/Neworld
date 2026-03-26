import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import type { AiMessage } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import ImportAnalyzeModal from './ImportAnalyzeModal';
import Icon from '../common/Icon';

const PERSONA_NAMES: Record<string, { name: string; icon: string; greeting: string }> = {
  fantasy:      { name: 'The Sage',        icon: '🔮', greeting: 'Ask me anything about your world. I know every character, place, and secret within it.' },
  'sci-fi':     { name: 'The Oracle',      icon: '🤖', greeting: 'Systems online. I have full knowledge of your universe — query anything.' },
  horror:       { name: 'The Chronicler',  icon: '📜', greeting: 'I have catalogued every dark corner of your world. What do you wish to uncover?' },
  romance:      { name: 'The Muse',        icon: '🌹', greeting: 'I know your characters\' hearts. Ask me anything about your story.' },
  mystery:      { name: 'The Detective',   icon: '🔍', greeting: 'Every clue, every character, every secret — I\'ve studied them all. What\'s the question?' },
  historical:   { name: 'The Archivist',   icon: '🏛️', greeting: 'The records of your world are open. Ask and I shall find the answer.' },
  contemporary: { name: 'The Confidant',   icon: '💬', greeting: 'I know your story inside and out. What would you like to explore?' },
  custom:       { name: 'The Lorekeeper',  icon: '📖', greeting: 'I am keeper of your world\'s lore. Ask me anything.' },
};

// Known model labels — shown in the picker to help users choose
const MODEL_LABELS: Record<string, { badge: string; badgeColor: string; description: string }> = {
  'llama3':        { badge: 'Quality',  badgeColor: '#c9913a', description: 'Best answers, slower responses' },
  'llama3:8b':     { badge: 'Quality',  badgeColor: '#c9913a', description: 'Best answers, slower responses' },
  'llama3.2:3b':   { badge: 'Fast',     badgeColor: '#5a8a55', description: 'Good answers, ~2.5× faster' },
  'llama3.2:1b':   { badge: 'Fastest',  badgeColor: '#5a8a55', description: 'Basic answers, ~4× faster' },
  'llama3.1':      { badge: 'Quality',  badgeColor: '#c9913a', description: 'Best answers, slower responses' },
  'llama3.1:8b':   { badge: 'Quality',  badgeColor: '#c9913a', description: 'Best answers, slower responses' },
  'mistral':       { badge: 'Quality',  badgeColor: '#c9913a', description: 'Strong alternative to llama3' },
  'phi3':          { badge: 'Fast',     badgeColor: '#5a8a55', description: 'Efficient, good for short Q&A' },
  'phi3:mini':     { badge: 'Fastest',  badgeColor: '#5a8a55', description: 'Very fast, smaller responses' },
  'gemma2:2b':     { badge: 'Fast',     badgeColor: '#5a8a55', description: 'Compact, quick responses' },
  'gemma2':        { badge: 'Quality',  badgeColor: '#c9913a', description: 'Google\'s capable model' },
};

function getPersona(genre: string) {
  return PERSONA_NAMES[genre] ?? PERSONA_NAMES['custom'];
}

function getModelLabel(model: string) {
  // Try exact match first, then prefix match
  if (MODEL_LABELS[model]) return MODEL_LABELS[model];
  const key = Object.keys(MODEL_LABELS).find((k) => model.startsWith(k));
  return key ? MODEL_LABELS[key] : null;
}

export default function AiPanel() {
  const project = useProjectStore((s) => s.activeProject);
  const ollamaAvailable = useUIStore((s) => s.ollamaAvailable);
  const setOllamaAvailable = useUIStore((s) => s.setOllamaAvailable);
  const addToast = useUIStore((s) => s.addToast);
  const aiMessages = useUIStore((s) => s.aiMessages);
  const setAiMessages = useUIStore((s) => s.setAiMessages);
  const currentModel = useUIStore((s) => s.currentModel);
  const setCurrentModel = useUIStore((s) => s.setCurrentModel);
  const availableModels = useUIStore((s) => s.availableModels);
  const setAvailableModels = useUIStore((s) => s.setAvailableModels);

  const messages: AiMessage[] = project ? (aiMessages[project.id] ?? []) : [];
  const setMessages = (updater: AiMessage[] | ((prev: AiMessage[]) => AiMessage[])) => {
    if (!project) return;
    const next = typeof updater === 'function' ? updater(messages) : updater;
    setAiMessages(project.id, next);
  };

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ type: string; message: string }>>([]);
  const [showImport, setShowImport] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ipc.checkOllama().then((status) => setOllamaAvailable(status.available));
    if (project) {
      ipc.getAiSuggestions(project.id).then(setSuggestions).catch(() => {});
    }
    // Load model settings
    ipc.getAiSettings().then((s) => {
      setCurrentModel(s.current_model);
      setAvailableModels(s.available_models);
    }).catch(() => {});
    return () => { unlistenRef.current?.(); };
  }, [project?.id]);

  // Close picker on outside click
  useEffect(() => {
    if (!showModelPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModelPicker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function selectModel(model: string) {
    setSavingModel(true);
    try {
      await ipc.saveAiModel(model);
      setCurrentModel(model);
      addToast(`Switched to ${model}`, 'success');
    } catch {
      addToast('Failed to switch model', 'error');
    } finally {
      setSavingModel(false);
      setShowModelPicker(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming || !project) return;

    const userMsg: AiMessage = { role: 'user', content: input.trim() };
    const assistantMsg: AiMessage = { role: 'assistant', content: '', streaming: true };

    const history = messages
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const tokenEvent = `ai_token_${project.id}`;
      const doneEvent = `ai_done_${project.id}`;

      unlistenRef.current?.();
      let fullContent = '';

      const unlistenToken = await listen(tokenEvent, (event: any) => {
        const token: string = event.payload?.token ?? '';
        fullContent += token;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, content: fullContent };
          return updated;
        });
      });

      const unlistenDone = await listen(doneEvent, () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, streaming: false };
          return updated;
        });
        setStreaming(false);
        unlistenToken();
        unlistenDone();
      });

      unlistenRef.current = () => { unlistenToken(); unlistenDone(); };

      await ipc.aiQuery(project.id, userMsg.content, history);
    } catch (e: any) {
      setStreaming(false);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: 'Error: ' + (e?.message ?? 'AI unavailable'), streaming: false };
        }
        return updated;
      });
    }
  }

  const persona = getPersona(project?.genre ?? 'custom');

  if (!ollamaAvailable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>{persona.icon}</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
          {persona.name} is Offline
        </h2>
        <p style={{ fontSize: 13, marginBottom: 24, maxWidth: 320, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Neworld's AI requires Ollama to be running. Install it to bring {persona.name} online.
        </p>
        <button
          onClick={() => ipc.checkOllama().then((s) => {
            setOllamaAvailable(s.available);
            if (s.available) addToast(`${persona.name} is online!`, 'success');
            else addToast('Still not found. Is Ollama running?', 'warning');
          })}
          style={{
            padding: '9px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-bg)',
            background: 'var(--color-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-panel)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 20 }}>{persona.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{persona.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Your world expert</div>
        </div>

        {/* Model picker trigger */}
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button
            onClick={() => setShowModelPicker((v) => !v)}
            title="Switch AI model"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 9px',
              borderRadius: 6,
              fontSize: 11,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'border-color 120ms ease, color 120ms ease',
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
            <Icon name="sparkles" size={11} />
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentModel}
            </span>
            <Icon name="chevron-right" size={10} strokeWidth={2} style={{ transform: showModelPicker ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' } as React.CSSProperties} />
          </button>

          {/* Model picker dropdown */}
          {showModelPicker && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                zIndex: 50,
                width: 280,
                borderRadius: 10,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Installed Models
                </p>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '6px 6px' }}>
                {availableModels.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 10px', textAlign: 'center' }}>
                    No models found. Install one via Ollama.
                  </p>
                ) : (
                  availableModels.map((model) => {
                    const isActive = model === currentModel;
                    const label = getModelLabel(model);
                    return (
                      <button
                        key={model}
                        onClick={() => selectModel(model)}
                        disabled={savingModel}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 7,
                          border: `1px solid ${isActive ? 'rgba(201,145,58,0.2)' : 'transparent'}`,
                          background: isActive ? 'var(--color-primary-dim)' : 'transparent',
                          cursor: savingModel ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          transition: 'background 100ms ease',
                          opacity: savingModel ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-primary-muted)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {model}
                          </div>
                          {label && (
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                              {label.description}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {label && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: label.badgeColor + '22',
                              color: label.badgeColor,
                              letterSpacing: '0.04em',
                            }}>
                              {label.badge}
                            </span>
                          )}
                          {isActive && (
                            <Icon name="check" size={13} strokeWidth={2.5} style={{ color: 'var(--color-primary)' } as React.CSSProperties} />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 10, color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
                  Install more models via <code style={{ background: 'var(--color-bg-input)', padding: '1px 4px', borderRadius: 3, fontSize: 9 }}>ollama pull &lt;model&gt;</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Import button */}
        <button
          onClick={() => setShowImport(true)}
          style={{
            padding: '5px 9px',
            borderRadius: 6,
            fontSize: 11,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'border-color 120ms ease, color 120ms ease',
          }}
          title="Import existing writing to auto-fill your world"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
            e.currentTarget.style.color = 'var(--color-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          ✨ Import
        </button>

        {/* Online indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5a8a55' }} />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Online</span>
        </div>
      </div>

      {/* ── Suggestions ── */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 2 }}>
            Insights
          </p>
          {suggestions.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                background: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span>{s.type === 'conflict_warning' ? '⚠️' : '💡'}</span>
              <span style={{ color: 'var(--color-text)', lineHeight: 1.5 }}>{s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{persona.icon}</div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--color-text)' }}>
              {persona.name}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
              {persona.greeting}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-panel)',
                  color: msg.role === 'user' ? 'var(--color-bg)' : 'var(--color-text)',
                  border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                {msg.streaming && (
                  <span style={{
                    display: 'inline-block',
                    width: 3,
                    height: 14,
                    background: 'currentColor',
                    opacity: 0.7,
                    marginLeft: 2,
                    animation: 'pulse 1s ease-in-out infinite',
                    verticalAlign: 'middle',
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {showImport && <ImportAnalyzeModal onClose={() => setShowImport(false)} />}

      {/* ── Input ── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-panel)',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={`Ask ${persona.name}…`}
          disabled={streaming}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            outline: 'none',
            transition: 'border-color 120ms ease',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,145,58,0.4)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
        <button
          onClick={sendMessage}
          disabled={streaming || !input.trim()}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-bg)',
            background: 'var(--color-primary)',
            border: 'none',
            cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: streaming || !input.trim() ? 0.45 : 1,
            transition: 'opacity 120ms ease',
          }}
        >
          {streaming ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  );
}
