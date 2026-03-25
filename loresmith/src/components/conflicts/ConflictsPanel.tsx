import { useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';

export default function ConflictsPanel() {
  const project = useProjectStore((s) => s.activeProject);
  const entities = useProjectStore((s) => s.entities);
  const conflicts = useProjectStore((s) => s.conflicts);
  const setConflicts = useProjectStore((s) => s.setConflicts);
  const setActiveEntity = useUIStore((s) => s.setActiveEntity);

  useEffect(() => {
    if (!project) return;
    ipc.getConflicts(project.id).then(setConflicts).catch(() => {});
  }, [project?.id]);

  function refresh() {
    if (!project) return;
    ipc.getConflicts(project.id).then(setConflicts);
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="p-4 border-b flex items-center justify-between"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Conflicts</h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Consistency issues detected in your world
          </p>
        </div>
        <button onClick={refresh} className="text-xs px-3 py-1 rounded"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>No conflicts detected</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Your world is consistent!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict, i) => (
              <div key={i} className="p-4 rounded-lg"
                style={{ background: 'var(--color-bg-panel)', border: '1px solid #ef444450' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-400 text-lg">⚠️</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: '#ef444420', color: '#ef4444' }}>
                    {conflict.conflict_type}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {conflict.description}
                </p>
                {conflict.entity_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conflict.entity_ids.map((eid) => {
                      const entity = entities.find((e) => e.id === eid);
                      return entity ? (
                        <button
                          key={eid}
                          onClick={() => setActiveEntity(eid)}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-entity-mark)' }}
                        >
                          {entity.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
