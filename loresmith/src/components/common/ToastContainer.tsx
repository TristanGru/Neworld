import { useUIStore } from '../../store/uiStore';

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast-enter flex items-center gap-3 px-4 py-3 rounded-lg text-sm shadow-xl cursor-pointer max-w-xs"
          style={{
            background: toast.type === 'error' ? '#ef4444' :
              toast.type === 'success' ? '#22c55e' :
              toast.type === 'warning' ? '#f59e0b' :
              'var(--color-bg-panel)',
            color: toast.type === 'info' ? 'var(--color-text)' : 'white',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onClick={() => removeToast(toast.id)}
        >
          <span>
            {toast.type === 'error' ? '✕' :
             toast.type === 'success' ? '✓' :
             toast.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
