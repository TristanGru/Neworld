import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import type { SetupProgress } from './store/uiStore';
import { ipc } from './lib/ipc';
import { applyTheme } from './lib/utils';
import HomeScreen from './components/layout/HomeScreen';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import ToastContainer from './components/common/ToastContainer';
import TutorialModal from './components/common/TutorialModal';
import SetupScreen from './components/common/SetupScreen';

const REQUIRED_MODELS = ['llama3', 'nomic-embed-text'];

function App() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const setRecentProjects = useProjectStore((s) => s.setRecentProjects);
  const setOllamaAvailable = useUIStore((s) => s.setOllamaAvailable);
  const showTutorial = useUIStore((s) => s.showTutorial);
  const setShowTutorial = useUIStore((s) => s.setShowTutorial);
  const setupComplete = useUIStore((s) => s.setupComplete);
  const setSetupComplete = useUIStore((s) => s.setSetupComplete);
  const setSetupProgress = useUIStore((s) => s.setSetupProgress);

  useEffect(() => {
    applyTheme('neutral');
    ipc.getRecentProjects().then(setRecentProjects).catch(() => {});

    // Check if models are already present; if not, start setup
    ipc.checkOllama().then((status) => {
      setOllamaAvailable(status.available);
      const hasAllModels = REQUIRED_MODELS.every((required) =>
        status.models.some((m) => m.startsWith(required))
      );
      if (status.available && hasAllModels) {
        setSetupComplete(true);
      } else {
        // Kick off model setup — SetupScreen is already showing
        ipc.setupModels()
          .then(() => {
            setOllamaAvailable(true);
            setSetupComplete(true);
          })
          .catch(() => {
            // Still mark complete so the app isn't stuck; AI features will show as unavailable
            setSetupComplete(true);
          });
      }
    }).catch(() => {
      setOllamaAvailable(false);
      // Ollama not running at all — try setup (handles waiting for it to start)
      ipc.setupModels()
        .then(() => {
          setOllamaAvailable(true);
          setSetupComplete(true);
        })
        .catch(() => {
          setSetupComplete(true);
        });
    });

    // Listen for progress events from Rust
    const unlistenProgress = listen<SetupProgress>('setup_progress', (e) => {
      setSetupProgress(e.payload);
    });
    const unlistenComplete = listen('setup_complete', () => {
      setOllamaAvailable(true);
      setSetupComplete(true);
    });

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (activeProject) {
      applyTheme(activeProject.genre);
    }
  }, [activeProject?.genre]);

  if (!setupComplete) {
    return <SetupScreen />;
  }

  return (
    <div className="h-full flex flex-col">
      {activeProject ? <WorkspaceLayout /> : <HomeScreen />}
      <ToastContainer />
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </div>
  );
}

export default App;
