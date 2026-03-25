import { useState } from 'react';

const STEPS = [
  {
    icon: '👋',
    title: 'Welcome to Neworld',
    content: (
      <div className="space-y-3">
        <p>Neworld is a local-first novel writing and world-building app. Everything you create stays on your machine — no cloud, no subscriptions.</p>
        <p>This quick tour will walk you through each section so you can hit the ground running.</p>
      </div>
    ),
  },
  {
    icon: '📝',
    title: 'Chapters',
    content: (
      <div className="space-y-3">
        <p><strong>Chapters</strong> is where you write your story. Each chapter is a full prose editor with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Auto-save every 30 seconds</li>
          <li>Version history — snapshot and restore any previous draft</li>
          <li>Entity detection — character and location names are underlined as you type; click them to open their profile</li>
          <li>@mention autocomplete — type <code className="bg-black/20 px-1 rounded">@</code> to insert a named entity</li>
          <li>Double-click a chapter title to rename it</li>
        </ul>
      </div>
    ),
  },
  {
    icon: '🌍',
    title: 'World',
    content: (
      <div className="space-y-3">
        <p><strong>World</strong> is your encyclopaedia. Organise everything about your story universe into categories:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Characters</strong> — physical traits, status, motivation</li>
          <li><strong>Locations</strong> — region, climate, significance</li>
          <li><strong>Lore</strong> — history, origins, related entities</li>
          <li><strong>Magic Systems</strong> — rules, limitations, cost</li>
          <li><strong>Factions & Organizations</strong> — goals, allies, enemies</li>
          <li><strong>Items & Artifacts</strong> — powers, current owner</li>
        </ul>
        <p>You can also create custom categories with your own fields.</p>
      </div>
    ),
  },
  {
    icon: '📌',
    title: 'Corkboard',
    content: (
      <div className="space-y-3">
        <p><strong>Corkboard</strong> is your scene planner. Within each chapter you can create scenes and drag them into order before you write.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create scenes with a title and summary</li>
          <li>Assign a POV character per scene</li>
          <li>Drag cards to reorder</li>
          <li>Use it as a planning board before drafting prose</li>
        </ul>
      </div>
    ),
  },
  {
    icon: '🕸️',
    title: 'Graph',
    content: (
      <div className="space-y-3">
        <p><strong>Graph</strong> visualises relationships between your world entities as an interactive node map.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Each entity is a node — click to open its profile</li>
          <li>Draw connections between entities and label the relationship (e.g. "allies", "rivals", "parent of")</li>
          <li>Zoom, pan, and rearrange freely</li>
          <li>Great for untangling complex political webs or family trees</li>
        </ul>
      </div>
    ),
  },
  {
    icon: '🤖',
    title: 'AI Assistant — Setup Required',
    content: (
      <div className="space-y-4">
        <p>Neworld's AI uses <strong>Ollama</strong> — a free, fully local AI that runs entirely on your machine. No API keys, no internet required.</p>

        <div className="rounded-lg p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="font-semibold text-sm">Setup steps:</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>
              Download and install Ollama from{' '}
              <strong>ollama.com</strong>
            </li>
            <li>
              Open a terminal and run:<br />
              <code className="block mt-1 bg-black/40 px-3 py-1.5 rounded text-xs font-mono">ollama pull llama3</code>
            </li>
            <li>
              Also pull an embedding model:<br />
              <code className="block mt-1 bg-black/40 px-3 py-1.5 rounded text-xs font-mono">ollama pull nomic-embed-text</code>
            </li>
            <li>Make sure Ollama is running (it starts automatically on most systems after install)</li>
          </ol>
        </div>

        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Once Ollama is running, the AI panel will let you ask questions about your world, get writing suggestions, and check story consistency — all powered by your local models.</p>
      </div>
    ),
  },
  {
    icon: '⚠️',
    title: 'Conflicts',
    content: (
      <div className="space-y-3">
        <p><strong>Conflicts</strong> automatically scans your story for logical inconsistencies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Location conflict</strong> — a character appears in two places on the same date</li>
          <li><strong>Dead character active</strong> — a deceased character is set as a scene POV</li>
        </ul>
        <p>Check this panel after major editing sessions to catch continuity errors before they compound.</p>
      </div>
    ),
  },
  {
    icon: '🚀',
    title: "You're all set!",
    content: (
      <div className="space-y-3">
        <p>Create your first project from the home screen — pick a name, choose a genre, and select a folder on your machine to store everything.</p>
        <p>You can always reopen this guide from the <strong>?</strong> button at the bottom of the sidebar.</p>
        <p>Happy writing!</p>
      </div>
    ),
  },
];

interface Props {
  onClose: () => void;
}

export default function TutorialModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-xl rounded-2xl flex flex-col"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{current.icon}</span>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{current.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed"
          style={{ color: 'var(--color-text)' }}
        >
          {current.content}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--color-border)' }}>
          {/* Step dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === step ? 'var(--color-primary)' : 'var(--color-border)' }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? onClose : () => setStep((s) => s + 1)}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
