import { useEffect, useState } from 'react';
import { ipc } from '../../lib/ipc';
import { formatDate } from '../../lib/utils';
import type { VersionSnapshot } from '../../types';

interface Props {
  chapterId: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export default function VersionHistoryPanel({ chapterId, onRestore, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipc.getVersionSnapshots(chapterId)
      .then(setSnapshots)
      .finally(() => setLoading(false));
  }, [chapterId]);

  async function restore(snapshotId: string) {
    const result = await ipc.restoreSnapshot(snapshotId);
    onRestore(result.content);
    onClose();
  }

  return (
    <div
      className="absolute right-0 top-12 bottom-0 w-72 border-l overflow-y-auto z-10"
      style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Version History</span>
        <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>✕</button>
      </div>

      {loading ? (
        <p className="text-xs p-4" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : snapshots.length === 0 ? (
        <p className="text-xs p-4" style={{ color: 'var(--color-text-muted)' }}>No saved snapshots yet.</p>
      ) : (
        <div className="p-2 space-y-1">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {formatDate(snap.created_at)}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {Math.round(snap.size / 1000)}kb
                </div>
              </div>
              <button
                onClick={() => restore(snap.id)}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--color-primary)', color: 'white' }}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
