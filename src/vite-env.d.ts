/// <reference types="vite/client" />

interface ElectronAPI {
  getConfig: () => Promise<any>;
  updateConfig: (updates: any) => Promise<any>;
  getStats: () => Promise<any>;
  getDrops: () => Promise<any>;
  initializeTracker: () => Promise<{ success: boolean }>;
  exportExcel: () => Promise<{ success: boolean; filePath?: string }>;
  resetStats: () => Promise<{ success: boolean }>;
  exportDebugLog: () => Promise<{ success: boolean; filePath?: string }>;
  onUpdateDisplay: (callback: (data: any) => void) => void;
  onInitializationComplete: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
