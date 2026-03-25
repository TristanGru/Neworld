import { useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';

export default function RelationshipGraph() {
  const project = useProjectStore((s) => s.activeProject);
  const entities = useProjectStore((s) => s.entities);
  const categories = useProjectStore((s) => s.entityCategories);
  const setRelationships = useProjectStore((s) => s.setRelationships);
  const relationships = useProjectStore((s) => s.relationships);
  const setActiveEntity = useUIStore((s) => s.setActiveEntity);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showForm, setShowForm] = useState(false);
  const [relFrom, setRelFrom] = useState('');
  const [relTo, setRelTo] = useState('');
  const [relLabel, setRelLabel] = useState('');

  useEffect(() => {
    if (!project) return;
    ipc.getRelationships(project.id).then(setRelationships).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    // Build nodes from entities
    const cols = Math.ceil(Math.sqrt(entities.length));
    const newNodes: Node[] = entities.map((entity, i) => {
      const cat = categories.find((c) => c.id === entity.category_id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        id: entity.id,
        position: { x: col * 180, y: row * 120 },
        data: {
          label: (
            <div className="flex flex-col items-center gap-1 text-xs">
              <span className="text-lg">{cat?.icon ?? '📄'}</span>
              <span className="font-medium max-w-24 text-center leading-tight truncate">{entity.name}</span>
            </div>
          ),
        },
        style: {
          background: 'var(--color-bg-panel)',
          border: '2px solid var(--color-border)',
          borderRadius: 8,
          color: 'var(--color-text)',
          padding: '8px 12px',
          minWidth: 100,
        },
      };
    });

    // Build edges from relationships
    const newEdges: Edge[] = relationships.map((rel) => ({
      id: rel.id,
      source: rel.from_entity_id,
      target: rel.to_entity_id,
      label: rel.label ?? undefined,
      animated: false,
      style: { stroke: 'var(--color-border)', strokeWidth: 2 },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--color-bg-panel)' },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [entities, relationships, categories]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setActiveEntity(node.id);
  }, []);

  async function createRel() {
    if (!project || !relFrom || !relTo) return;
    try {
      const rel = await ipc.createRelationship(project.id, relFrom, relTo, relLabel || undefined);
      setRelationships([...relationships, rel]);
      setShowForm(false);
      setRelFrom(''); setRelTo(''); setRelLabel('');
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? e}`);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Relationship Graph</h2>
        <button onClick={() => setShowForm(true)}
          className="text-sm px-3 py-1 rounded"
          style={{ background: 'var(--color-primary)', color: 'white' }}>
          + Relationship
        </button>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          style={{ background: 'var(--color-bg)' }}
        >
          <Background color="var(--color-border)" gap={20} />
          <Controls style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }} />
          <MiniMap
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
            nodeColor="var(--color-primary)"
          />
        </ReactFlow>
      </div>

      {entities.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p style={{ color: 'var(--color-text-muted)' }}>Create entities in the World tab to build your graph</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-96 rounded-xl p-6 space-y-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Create Relationship</h3>

            {['from', 'to'].map((field) => (
              <div key={field}>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {field === 'from' ? 'From Entity' : 'To Entity'}
                </label>
                <select
                  value={field === 'from' ? relFrom : relTo}
                  onChange={(e) => field === 'from' ? setRelFrom(e.target.value) : setRelTo(e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }}
                >
                  <option value="">— Select entity —</option>
                  {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            ))}

            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>Label (optional)</label>
              <input value={relLabel} onChange={(e) => setRelLabel(e.target.value)}
                placeholder="e.g. ally of, located in"
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none' }} />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--color-text-muted)' }} className="text-sm px-4 py-2">Cancel</button>
              <button onClick={createRel} className="text-sm px-5 py-2 rounded-lg text-white font-semibold"
                style={{ background: 'var(--color-primary)' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
