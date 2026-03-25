import { useUIStore } from '../../store/uiStore';
import Sidebar from './Sidebar';
import ChaptersView from '../editor/ChaptersView';
import EntityManager from '../worldbuilding/EntityManager';
import AiPanel from '../ai/AiPanel';
import CorkboardView from '../corkboard/CorkboardView';
import RelationshipGraph from '../graph/RelationshipGraph';
import ConflictsPanel from '../conflicts/ConflictsPanel';
import EntityProfilePanel from '../worldbuilding/EntityProfilePanel';

export default function WorkspaceLayout() {
  const currentView = useUIStore((s) => s.currentView);
  const entityPanelOpen = useUIStore((s) => s.entityPanelOpen);
  const activeEntityId = useUIStore((s) => s.activeEntityId);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {currentView === 'chapters' && <ChaptersView />}
          {currentView === 'world' && <EntityManager />}
          {currentView === 'ai' && <AiPanel />}
          {currentView === 'corkboard' && <CorkboardView />}
          {currentView === 'graph' && <RelationshipGraph />}
          {currentView === 'conflicts' && <ConflictsPanel />}
        </div>
        {entityPanelOpen && activeEntityId && (
          <EntityProfilePanel entityId={activeEntityId} />
        )}
      </main>
    </div>
  );
}
