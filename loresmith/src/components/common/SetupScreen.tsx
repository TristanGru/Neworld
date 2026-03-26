import { useUIStore } from '../../store/uiStore';

const REQUIRED_MODELS = ['llama3', 'nomic-embed-text'];

const MODEL_LABELS: Record<string, string> = {
  llama3: 'Story Intelligence',
  'nomic-embed-text': 'World Memory',
};

function humanStatus(status: string): string {
  if (status === 'waiting_for_ollama') return 'Starting up the AI engine…';
  if (status === 'pulling manifest') return 'Preparing…';
  if (status === 'starting') return 'Starting download…';
  if (status === 'verifying sha256 digest') return 'Verifying…';
  if (status === 'writing manifest') return 'Finishing up…';
  if (status === 'removing any unused layers') return 'Cleaning up…';
  if (status === 'success') return 'Ready';
  if (status.startsWith('pulling')) return 'Downloading…';
  return 'Working…';
}

export default function SetupScreen() {
  const progress = useUIStore((s) => s.setupProgress);

  const currentModel = progress?.model ?? '';
  const currentStatus = progress?.status ?? '';
  const percent = progress?.percent ?? 0;

  const isWaiting = currentStatus === 'waiting_for_ollama' || currentStatus === '';
  const activeModel = REQUIRED_MODELS.find((m) => currentModel.startsWith(m)) ?? null;
  const activeModelIndex = activeModel ? REQUIRED_MODELS.indexOf(activeModel) : 0;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#1a1410] text-[#e8d5b7] select-none z-50">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-900/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-8 max-w-md w-full px-8">
        {/* Icon */}
        <div className="text-7xl animate-pulse" style={{ animationDuration: '3s' }}>
          📖
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-200 mb-2">Welcome to Neworld</h1>
          <p className="text-amber-400/70 text-sm leading-relaxed">
            {isWaiting
              ? 'Starting the AI engine for the first time…'
              : 'Getting your AI ready. This only happens once.'}
          </p>
        </div>

        {/* Model progress list */}
        <div className="w-full flex flex-col gap-4">
          {REQUIRED_MODELS.map((model, i) => {
            const label = MODEL_LABELS[model] ?? model;
            const isActive = activeModel === model;
            const isDone =
              activeModel !== null
                ? i < activeModelIndex
                : false;
            const isPending = !isActive && !isDone;

            const barPercent = isActive
              ? percent
              : isDone
              ? 100
              : 0;

            return (
              <div key={model} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span
                    className={
                      isDone
                        ? 'text-emerald-400'
                        : isActive
                        ? 'text-amber-200'
                        : 'text-amber-700'
                    }
                  >
                    {isDone ? '✓ ' : isActive ? '⟳ ' : '  '}
                    {label}
                  </span>
                  <span className="text-amber-600 text-xs">
                    {isDone
                      ? 'Ready'
                      : isActive
                      ? humanStatus(currentStatus)
                      : isPending
                      ? 'Waiting…'
                      : ''}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-amber-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDone ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${barPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Size note */}
        <p className="text-amber-700/60 text-xs text-center">
          Downloading ~5 GB of AI models. This is a one-time setup —<br />
          Neworld will open automatically when it's done.
        </p>
      </div>
    </div>
  );
}
