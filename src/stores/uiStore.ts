import { create } from 'zustand';
import { NavView } from '../types';

interface UIStore {
  showSettings: boolean;
  showOverlaySettings: boolean;
  showInitDialog: boolean;
  activeView: NavView;
  setShowSettings: (show: boolean) => void;
  setShowOverlaySettings: (show: boolean) => void;
  setShowInitDialog: (show: boolean) => void;
  setActiveView: (view: NavView) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  showSettings: false,
  showOverlaySettings: false,
  showInitDialog: false,
  activeView: 'overview',
  setShowSettings: (show) => set({ showSettings: show }),
  setShowOverlaySettings: (show) => set({ showOverlaySettings: show }),
  setShowInitDialog: (show) => set({ showInitDialog: show }),
  setActiveView: (view) => set({ activeView: view }),
}));
