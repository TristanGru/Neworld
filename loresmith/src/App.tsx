import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import { ipc } from './lib/ipc';
import { applyTheme } from './lib/utils';
import HomeScreen from './components/layout/HomeScreen';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import ToastContainer from './components/common/ToastContainer';
import TutorialModal from './components/common/TutorialModal';

function App() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const setRecentProjects = useProjectStore((s) => s.setRecentProjects);
  const setOllamaAvailable = useUIStore((s) => s.setOllamaAvailable);
  const showTutorial = useUIStore((s) => s.showTutorial);
  const setShowTutorial = useUIStore((s) => s.setShowTutorial);

  useEffect(() => {
    ipc.getRecentProjects().then(setRecentProjects).catch(() => {});
    ipc.checkOllama().then((status) => {
      setOllamaAvailable(status.available);
    }).catch(() => {
      setOllamaAvailable(false);
    });
    applyTheme('neutral');
  }, []);

  useEffect(() => {
    if (activeProject) {
      applyTheme(activeProject.genre);
    }
  }, [activeProject?.genre]);

  return (
    <div className="h-full flex flex-col">
      {activeProject ? <WorkspaceLayout /> : <HomeScreen />}
      <ToastContainer />
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

export default App;
