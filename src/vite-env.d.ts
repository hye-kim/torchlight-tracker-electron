/// <reference types="vite/client" />

interface ElectronAPI {
  getConfig: () => Promise<any>;
  updateConfig: (updates: any) => Promise<any>;
  getStats: () => Promise<any>;
  getDrops: () => Promise<any>;
  getMapLogs: () => Promise<any>;
  initializeTracker: () => Promise<{ success: boolean }>;
  exportExcel: () => Promise<{ success: boolean; filePath?: string }>;
  resetStats: () => Promise<{ success: boolean }>;
  exportDebugLog: () => Promise<{ success: boolean; filePath?: string }>;
  toggleOverlayMode: (enabled: boolean) => Promise<{ success: boolean }>;
  toggleClickThrough: (enabled: boolean) => Promise<{ success: boolean }>;
  setIgnoreMouseEvents: (ignore: boolean) => Promise<{ success: boolean }>;
  setFontSize: (fontSize: number) => Promise<{ success: boolean }>;
  setDisplayItems: (displayItems: any) => Promise<{ success: boolean }>;
  windowMinimize: () => Promise<{ success: boolean }>;
  windowMaximize: () => Promise<{ success: boolean }>;
  windowClose: () => Promise<{ success: boolean }>;
  windowResize: (width: number, height: number) => Promise<{ success: boolean }>;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
  onUpdateDisplay: (callback: (data: any) => void) => void;
  onInitializationComplete: (callback: () => void) => void;
  onOverlayModeChanged: (callback: (overlayMode: boolean) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
