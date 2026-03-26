import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import type { AiMessage } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import ImportAnalyzeModal from './ImportAnalyzeModal';

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

function getPersona(genre: string) {
  return PERSONA_NAMES[genre] ?? PERSONA_NAMES['custom'];
}

export default function AiPanel() {
  const project = useProjectStore((s) => s.activeProject);
  const ollamaAvailable = useUIStore((s) => s.ollamaAvailable);
  const setOllamaAvailable = useUIStore((s) => s.setOllamaAvailable);
  const addToast = useUIStore((s) => s.addToast);
  const aiMessages = useUIStore((s) => s.aiMessages);
  const setAiMessages = useUIStore((s) => s.setAiMessages);

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    ipc.checkOllama().then((status) => setOllamaAvailable(status.available));
    if (project) {
      ipc.getAiSuggestions(project.id).then(setSuggestions).catch(() => {});
    }
    return () => { unlistenRef.current?.(); };
  }, [project?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming || !project) return;

    const userMsg: AiMessage = { role: 'user', content: input.trim() };
    const assistantMsg: AiMessage = { role: 'assistant', content: '', streaming: true };

    // Build history from completed messages (no streaming ones)
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
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-5xl mb-6">{persona.icon}</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>{persona.name} is Offline</h2>
        <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
          Neworld's AI features require Ollama to be running. Install it to bring {persona.name} online.
        </p>
        <button
          onClick={() => ipc.checkOllama().then((s) => {
            setOllamaAvailable(s.available);
            if (s.available) addToast(`${persona.name} is online!`, 'success');
            else addToast('Still not found. Is Ollama running?', 'warning');
          })}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}>
        <span className="text-xl">{persona.icon}</span>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>{persona.name}</h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your world expert</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            title="Import existing writing and notes to auto-fill your world"
          >
            ✨ Import World
          </button>
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Online</span>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="p-4 border-b space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Insights</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
              <span>{s.type === 'conflict_warning' ? '⚠️' : '💡'}</span>
              <span style={{ color: 'var(--color-text)' }}>{s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-4xl mb-4">{persona.icon}</div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>{persona.name}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{persona.greeting}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-2xl px-4 py-3 rounded-xl text-sm"
              style={{
                background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-panel)',
                color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.streaming && <span className="inline-block w-1 h-4 bg-current opacity-70 animate-pulse ml-1" />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {showImport && <ImportAnalyzeModal onClose={() => setShowImport(false)} />}

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-panel)' }}>
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Ask ${persona.name}...`}
            disabled={streaming}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {streaming ? '...' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  );
}
