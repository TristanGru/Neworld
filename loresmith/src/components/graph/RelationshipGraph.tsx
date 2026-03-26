import { useEffect, useCallback, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeDragHandler,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';

const HIDDEN_KEY = (projectId: string) => `neworld_graph_hidden_${projectId}`;

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
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [relFrom, setRelFrom] = useState('');
  const [relTo, setRelTo] = useState('');
  const [relLabel, setRelLabel] = useState('');

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!project) return;
    const stored = localStorage.getItem(`neworld_graph_pos_${project.id}`);
    positionsRef.current = stored ? (JSON.parse(stored) as Record<string, { x: number; y: number }>) : {};
    const storedHidden = localStorage.getItem(HIDDEN_KEY(project.id));
    setHiddenIds(storedHidden ? new Set(JSON.parse(storedHidden) as string[]) : new Set());
    ipc.getRelationships(project.id).then(setRelationships).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    // Build nodes from entities, excluding hidden ones
    const visible = entities.filter((e) => !hiddenIds.has(e.id));
    const cols = Math.ceil(Math.sqrt(visible.length));
    const newNodes: Node[] = visible.map((entity, i) => {
      const cat = categories.find((c) => c.id === entity.category_id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        id: entity.id,
        // Use saved position if it exists, otherwise fall back to grid layout
        position: positionsRef.current[entity.id] ?? { x: col * 180, y: row * 120 },
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
  }, [entities, relationships, categories, hiddenIds]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setActiveEntity(node.id);
  }, []);

  const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    positionsRef.current[node.id] = node.position;
    if (project) {
      localStorage.setItem(`neworld_graph_pos_${project.id}`, JSON.stringify(positionsRef.current));
    }
  }, [project?.id]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  function hideNode(nodeId: string) {
    if (!project) return;
    const next = new Set(hiddenIds);
    next.add(nodeId);
    setHiddenIds(next);
    localStorage.setItem(HIDDEN_KEY(project.id), JSON.stringify([...next]));
    setContextMenu(null);
  }

  function showAllNodes() {
    if (!project) return;
    setHiddenIds(new Set());
    localStorage.removeItem(HIDDEN_KEY(project.id));
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Relationship Graph</h2>
          {hiddenIds.size > 0 && (
            <button
              onClick={showAllNodes}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 5,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {hiddenIds.size} hidden · Show all
            </button>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="text-sm px-3 py-1 rounded"
          style={{ background: 'var(--color-primary)', color: 'var(--color-bg)' }}>
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
          onNodeDragStop={onNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
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

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            padding: '4px',
            minWidth: 160,
          }}
        >
          <button
            onClick={() => hideNode(contextMenu.nodeId)}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ opacity: 0.6 }}>◌</span> Hide from graph
          </button>
          <button
            onClick={() => { setActiveEntity(contextMenu.nodeId); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ opacity: 0.6 }}>→</span> View profile
          </button>
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
