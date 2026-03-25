import { create } from 'zustand';
import type { View } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface UIState {
  currentView: View;
  activeChapterId: string | null;
  activeEntityId: string | null;
  sidebarOpen: boolean;
  entityPanelOpen: boolean;
  ollamaAvailable: boolean;
  showTutorial: boolean;
  toasts: Toast[];

  setView: (view: View) => void;
  setActiveChapter: (id: string | null) => void;
  setActiveEntity: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setEntityPanelOpen: (open: boolean) => void;
  setOllamaAvailable: (available: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const TUTORIAL_KEY = 'neworld_tutorial_seen';

export const useUIStore = create<UIState>((set) => ({
  currentView: 'home',
  activeChapterId: null,
  activeEntityId: null,
  sidebarOpen: true,
  entityPanelOpen: false,
  ollamaAvailable: false,
  showTutorial: !localStorage.getItem(TUTORIAL_KEY),
  toasts: [],

  setView: (view) => set({ currentView: view }),
  setActiveChapter: (id) => set({ activeChapterId: id }),
  setActiveEntity: (id) => set({ activeEntityId: id, entityPanelOpen: id !== null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setEntityPanelOpen: (open) => set({ entityPanelOpen: open }),
  setOllamaAvailable: (available) => set({ ollamaAvailable: available }),
  setShowTutorial: (show) => {
    if (!show) localStorage.setItem(TUTORIAL_KEY, '1');
    set({ showTutorial: show });
  },

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
