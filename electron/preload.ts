import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (updates: any) => ipcRenderer.invoke('update-config', updates),

  // Stats and Drops
  getStats: () => ipcRenderer.invoke('get-stats'),
  getDrops: () => ipcRenderer.invoke('get-drops'),
  getMapLogs: () => ipcRenderer.invoke('get-map-logs'),

  // Actions
  initializeTracker: () => ipcRenderer.invoke('initialize-tracker'),
  exportExcel: () => ipcRenderer.invoke('export-excel'),
  resetStats: () => ipcRenderer.invoke('reset-stats'),
  exportDebugLog: () => ipcRenderer.invoke('export-debug-log'),

  // Overlay mode controls
  toggleOverlayMode: (enabled: boolean) => ipcRenderer.invoke('toggle-overlay-mode', enabled),
  toggleClickThrough: (enabled: boolean) => ipcRenderer.invoke('toggle-click-through', enabled),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  setFontSize: (fontSize: number) => ipcRenderer.invoke('set-font-size', fontSize),
  setDisplayItems: (displayItems: any) => ipcRenderer.invoke('set-display-items', displayItems),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Listen for updates
  onUpdateDisplay: (callback: (data: any) => void) => {
    ipcRenderer.on('update-display', (_, data) => callback(data));
  },

  onInitializationComplete: (callback: () => void) => {
    ipcRenderer.on('initialization-complete', () => callback());
  },
});

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
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
      onUpdateDisplay: (callback: (data: any) => void) => void;
      onInitializationComplete: (callback: () => void) => void;
    };
  }
}
